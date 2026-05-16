// Log discovery + SSE tail. We scan /mnt/agent (the scry parent dir)
// for files matching scry*.log and stream their contents to the UI.
// SSE chosen over WebSocket so the proxy story stays simple: same
// HTTP server, same /api path, no upgrade plumbing.

import {readdirSync, statSync} from 'node:fs';
import {open, type FileHandle} from 'node:fs/promises';
import {dirname, join} from 'node:path';

import type {Response} from 'express';

import type {LogFile} from '../shared/protocol.js';

const LOG_ROOTS = ['/mnt/agent', '/var/log'];
const NAME_RE = /^scry[A-Za-z0-9._-]*\.log$/;

export function listLogs(): LogFile[] {
  const out: LogFile[] = [];
  for (const root of LOG_ROOTS) {
    try {
      for (const name of readdirSync(root)) {
        if (!NAME_RE.test(name)) continue;
        try {
          const s = statSync(join(root, name));
          if (!s.isFile()) continue;
          out.push({name: join(root, name), bytes: s.size, mtime_ms: s.mtimeMs});
        } catch {
          /* ignore */
        }
      }
    } catch {
      /* ignore */
    }
  }
  out.sort((a, b) => b.mtime_ms - a.mtime_ms);
  return out;
}

/**
 * Validate that `path` is under a known log root. Prevents path
 * traversal — the UI sends absolute paths but we don't trust them.
 */
function isAllowed(path: string): boolean {
  return LOG_ROOTS.some((r) => path === r || dirname(path) === r);
}

const TAIL_BYTES = 16 * 1024;
const POLL_MS = 500;

export async function streamLog(path: string, res: Response): Promise<void> {
  if (!isAllowed(path)) {
    res.status(400).end('disallowed path');
    return;
  }
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  let fh: FileHandle | null = null;
  let offset = 0;
  let alive = true;
  res.on('close', () => {
    alive = false;
    if (fh) void fh.close().catch(() => undefined);
  });

  function send(payload: object): void {
    if (!alive) return;
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  }

  try {
    fh = await open(path, 'r');
    const st = await fh.stat();
    // Seed with the tail.
    offset = Math.max(0, st.size - TAIL_BYTES);
    const buf = Buffer.alloc(st.size - offset);
    await fh.read(buf, 0, buf.length, offset);
    offset = st.size;
    send({type: 'seed', text: buf.toString('utf-8')});

    while (alive) {
      await new Promise((r) => setTimeout(r, POLL_MS));
      if (!alive || !fh) break;
      const s = await fh.stat();
      if (s.size < offset) {
        // truncated / rotated — reopen.
        try {
          await fh.close();
        } catch {
          /* ignore */
        }
        fh = await open(path, 'r');
        offset = 0;
      }
      if (s.size > offset) {
        const len = s.size - offset;
        const chunk = Buffer.alloc(len);
        await fh.read(chunk, 0, len, offset);
        offset = s.size;
        send({type: 'chunk', text: chunk.toString('utf-8')});
      }
    }
  } catch (e) {
    send({type: 'error', message: String(e)});
  } finally {
    if (fh) {
      try {
        await fh.close();
      } catch {
        /* ignore */
      }
    }
    try {
      res.end();
    } catch {
      /* ignore */
    }
  }
}
