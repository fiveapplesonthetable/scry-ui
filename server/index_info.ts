// Index introspection: walk the on-disk index dir, parse manifest.json,
// and run `scry stats` (which has no --json mode) to capture its text
// output so the dashboard can show it raw. The structured stats fields
// come from the JSON-RPC `stats` cmd over the daemon — this module is
// just for filesystem and text-only sidecars.

import {spawn} from 'node:child_process';
import {readdirSync, readFileSync, statSync} from 'node:fs';
import {join} from 'node:path';

import type {IndexInfo} from '../shared/protocol.js';

export function readIndexInfo(indexDir: string, scryBin: string): Promise<IndexInfo> {
  let manifest: Record<string, unknown> = {};
  try {
    manifest = JSON.parse(readFileSync(join(indexDir, 'manifest.json'), 'utf-8'));
  } catch {
    /* manifest may not exist */
  }

  let total = 0;
  const files: Array<{name: string; bytes: number}> = [];
  try {
    for (const name of readdirSync(indexDir)) {
      const p = join(indexDir, name);
      try {
        const s = statSync(p);
        if (s.isFile()) {
          files.push({name, bytes: s.size});
          total += s.size;
        }
      } catch {
        /* ignore */
      }
    }
    files.sort((a, b) => b.bytes - a.bytes);
  } catch {
    /* index dir may not exist */
  }

  return runScryStats(scryBin, indexDir).then((stats_text) => ({
    dir: indexDir,
    total_bytes: total,
    manifest,
    files,
    stats_text,
  }));
}

function runScryStats(bin: string, indexDir: string): Promise<string> {
  return new Promise((resolve) => {
    const out: string[] = [];
    const p = spawn(bin, ['stats', '--index', indexDir], {
      env: {...process.env, SCRY_QUIET: '1'},
    });
    p.stdout.on('data', (b: Buffer) => out.push(b.toString('utf-8')));
    p.stderr.on('data', (b: Buffer) => out.push(b.toString('utf-8')));
    p.on('exit', () => resolve(out.join('')));
    p.on('error', (e) => resolve(`scry stats failed: ${e.message}`));
    setTimeout(() => {
      try {
        p.kill();
      } catch {
        /* ignore */
      }
      resolve(out.join('') || '(scry stats timed out)');
    }, 8000);
  });
}
