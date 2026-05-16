// ScryDaemon: a long-lived `scry serve --listen tcp:127.0.0.1:PORT`
// subprocess plus a single persistent JSON-RPC socket to it. The
// HTTP layer multiplexes requests over this one socket: assign each
// an id, wait for the matching reply.
//
// Why one socket: `scry serve` shares the mmap'd index across
// connections, so one warm socket gives us per-query cost close to
// the in-process cost without per-request reconnect overhead.
//
// Restart policy: if the child dies, we kill the pending requests
// with an error and respawn. Callers see a single failed request,
// the next request transparently uses the fresh socket.

import {ChildProcess, spawn} from 'node:child_process';
import {createConnection, Socket} from 'node:net';
import {setTimeout as sleep} from 'node:timers/promises';

export type ScryRequest = {cmd: string; args: Record<string, unknown>};
export type ScryResponse = {result?: unknown; error?: string};

type Pending = {
  resolve: (r: ScryResponse) => void;
  reject: (e: Error) => void;
  cmd: string;
};

export interface ScryConfig {
  bin: string;
  indexDir: string;
  port: number;
}

const READY_TIMEOUT_MS = 10_000;
const REQUEST_TIMEOUT_MS = 60_000;

export class ScryDaemon {
  private cfg: ScryConfig;
  private child: ChildProcess | null = null;
  private sock: Socket | null = null;
  private pending = new Map<number, Pending>();
  private nextId = 1;
  private buf = '';
  private connected = false;
  private restarting: Promise<void> | null = null;
  private restartCount = 0;
  private lastRestartMs: number | null = null;
  private stderrTail: string[] = [];

  constructor(cfg: ScryConfig) {
    this.cfg = cfg;
  }

  isConnected(): boolean {
    return this.connected;
  }
  lastRestart(): number | null {
    return this.lastRestartMs;
  }
  restartTotal(): number {
    return this.restartCount;
  }
  stderr(): string[] {
    return [...this.stderrTail];
  }
  config(): ScryConfig {
    return {...this.cfg};
  }

  async start(): Promise<void> {
    if (this.connected) return;
    await this.spawnAndConnect();
  }

  async restart(newCfg?: Partial<ScryConfig>): Promise<void> {
    if (newCfg) this.cfg = {...this.cfg, ...newCfg};
    if (this.restarting) return this.restarting;
    this.restarting = (async () => {
      try {
        this.teardown(new Error('restart requested'));
        await sleep(200);
        await this.spawnAndConnect();
      } finally {
        this.restarting = null;
      }
    })();
    return this.restarting;
  }

  async request(req: ScryRequest): Promise<ScryResponse> {
    if (!this.connected) await this.start();
    const id = this.nextId++;
    const line = JSON.stringify({id, cmd: req.cmd, args: req.args}) + '\n';
    return new Promise<ScryResponse>((resolve, reject) => {
      const sock = this.sock;
      if (!sock) {
        reject(new Error('scry socket not connected'));
        return;
      }
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`scry request timeout (cmd=${req.cmd})`));
      }, REQUEST_TIMEOUT_MS);
      this.pending.set(id, {
        cmd: req.cmd,
        resolve: (r) => {
          clearTimeout(timer);
          resolve(r);
        },
        reject: (e) => {
          clearTimeout(timer);
          reject(e);
        },
      });
      sock.write(line, (err) => {
        if (err) {
          this.pending.delete(id);
          clearTimeout(timer);
          reject(err);
        }
      });
    });
  }

  private async spawnAndConnect(): Promise<void> {
    const {bin, indexDir, port} = this.cfg;
    const child = spawn(
      bin,
      ['serve', '--index', indexDir, '--listen', `tcp:127.0.0.1:${port}`],
      {
        env: {...process.env, SCRY_QUIET: '1'},
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );
    this.child = child;
    child.stdout.on('data', (b: Buffer) => this.captureStderr('out', b));
    child.stderr.on('data', (b: Buffer) => this.captureStderr('err', b));
    child.on('exit', (code, signal) => {
      this.captureStderr('sys', Buffer.from(`scry exited code=${code} sig=${signal}\n`));
      this.teardown(new Error(`scry exited code=${code} sig=${signal}`));
      // Don't auto-restart in a tight loop; let next request trigger it.
    });

    // Wait for the TCP port to accept connections.
    const start = Date.now();
    while (Date.now() - start < READY_TIMEOUT_MS) {
      try {
        await this.connect(port);
        this.connected = true;
        return;
      } catch {
        await sleep(150);
      }
    }
    throw new Error(`scry serve never bound 127.0.0.1:${port}`);
  }

  private connect(port: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const sock = createConnection({host: '127.0.0.1', port}, () => {
        this.sock = sock;
        sock.on('data', (chunk: Buffer) => this.onData(chunk));
        sock.on('error', (e) => {
          this.captureStderr('sock', Buffer.from(`socket error: ${e.message}\n`));
        });
        sock.on('close', () => {
          this.teardown(new Error('socket closed'));
        });
        resolve();
      });
      sock.once('error', (e) => reject(e));
    });
  }

  private onData(chunk: Buffer): void {
    this.buf += chunk.toString('utf-8');
    let nl = this.buf.indexOf('\n');
    while (nl !== -1) {
      const line = this.buf.slice(0, nl);
      this.buf = this.buf.slice(nl + 1);
      this.handleLine(line);
      nl = this.buf.indexOf('\n');
    }
  }

  private handleLine(line: string): void {
    if (!line.trim()) return;
    let msg: {id?: number; result?: unknown; error?: string};
    try {
      msg = JSON.parse(line) as typeof msg;
    } catch {
      this.captureStderr('parse', Buffer.from(`bad line: ${line.slice(0, 200)}\n`));
      return;
    }
    if (typeof msg.id !== 'number') return;
    const p = this.pending.get(msg.id);
    if (!p) return;
    this.pending.delete(msg.id);
    p.resolve({result: msg.result, error: msg.error});
  }

  private teardown(reason: Error): void {
    this.connected = false;
    for (const [id, p] of this.pending) {
      p.reject(reason);
      this.pending.delete(id);
    }
    if (this.sock) {
      try {
        this.sock.destroy();
      } catch {
        /* ignore */
      }
      this.sock = null;
    }
    if (this.child) {
      try {
        this.child.kill('SIGTERM');
      } catch {
        /* ignore */
      }
      this.child = null;
    }
    this.lastRestartMs = Date.now();
    this.restartCount++;
  }

  private captureStderr(_tag: string, b: Buffer): void {
    const s = b.toString('utf-8');
    for (const line of s.split('\n')) {
      if (!line) continue;
      this.stderrTail.push(line);
      if (this.stderrTail.length > 200) this.stderrTail.shift();
    }
  }
}
