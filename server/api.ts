// HTTP surface. Express + thin handlers; the real work lives in
// scry.ts / settings.ts / metrics.ts / index_info.ts / logs.ts.

import {readFile} from 'node:fs/promises';

import express, {type Express, type Request, type Response} from 'express';

import {
  COMMANDS,
  type CommandId,
  type Hit,
  type QueryResponse,
  type UiSettings,
} from '../shared/protocol.js';

import {readIndexInfo} from './index_info.js';
import {listLogs, streamLog} from './logs.js';
import {MetricsStore} from './metrics.js';
import {ScryDaemon} from './scry.js';
import {loadSettings, saveSettings} from './settings.js';

export interface ApiDeps {
  scry: ScryDaemon;
  metrics: MetricsStore;
  /** Mutated in place — fields that affect scry are also pushed to ScryDaemon.restart. */
  settings: UiSettings;
}

const VALID_CMDS = new Set<string>(COMMANDS.map((c) => c.id));

export function buildApi(deps: ApiDeps): Express {
  const app = express();
  app.use(express.json({limit: '256kb'}));

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      scry_connected: deps.scry.isConnected(),
      uptime_ms: process.uptime() * 1000,
    });
  });

  app.get('/api/settings', (_req, res) => {
    res.json(deps.settings);
  });

  app.post('/api/settings', async (req: Request, res: Response) => {
    const body = (req.body ?? {}) as Partial<UiSettings>;
    const next: UiSettings = {...deps.settings, ...body};
    const scryChanged =
      next.index_dir !== deps.settings.index_dir ||
      next.scry_bin !== deps.settings.scry_bin ||
      next.scry_port !== deps.settings.scry_port;
    Object.assign(deps.settings, next);
    saveSettings(next);
    if (scryChanged) {
      try {
        await deps.scry.restart({
          bin: next.scry_bin,
          indexDir: next.index_dir,
          port: next.scry_port,
        });
      } catch (e) {
        res.status(500).json({ok: false, error: String(e)});
        return;
      }
    }
    res.json({ok: true, settings: next});
  });

  app.get('/api/commands', (_req, res) => {
    res.json(COMMANDS);
  });

  app.post('/api/q', async (req: Request, res: Response) => {
    const body = (req.body ?? {}) as {cmd?: string; args?: Record<string, unknown>};
    const rawCmd = body.cmd;
    const args = body.args ?? {};
    if (!rawCmd || !VALID_CMDS.has(rawCmd)) {
      res.status(400).json({error: `unknown cmd: ${String(rawCmd)}`});
      return;
    }
    const cmd = rawCmd as CommandId;
    const started = Date.now();
    try {
      const r = await deps.scry.request({cmd, args});
      const elapsed = Date.now() - started;
      if (r.error) {
        res.status(500).json({
          cmd,
          hits: [],
          elapsed_ms: elapsed,
          notes: [`scry error: ${r.error}`],
        } satisfies QueryResponse);
        return;
      }
      const hits = normaliseResult(r.result);
      deps.metrics.record(cmd, elapsed, hits.length);
      const out: QueryResponse = {
        cmd,
        hits,
        elapsed_ms: elapsed,
        notes: deps.scry.stderr().slice(-20),
        one: Array.isArray(r.result) ? undefined : r.result,
      };
      res.json(out);
    } catch (e) {
      const elapsed = Date.now() - started;
      res.status(500).json({
        cmd,
        hits: [],
        elapsed_ms: elapsed,
        notes: [`request failed: ${String(e)}`],
      } satisfies QueryResponse);
    }
  });

  app.get('/api/index', async (_req, res) => {
    try {
      const info = await readIndexInfo(deps.settings.index_dir, deps.settings.scry_bin);
      res.json(info);
    } catch (e) {
      res.status(500).json({error: String(e)});
    }
  });

  app.get('/api/metrics', (_req, res) => {
    res.json(deps.metrics.snapshot(deps.scry.isConnected(), deps.scry.lastRestart()));
  });

  app.get('/api/scry-stderr', (_req, res) => {
    res.json({lines: deps.scry.stderr()});
  });

  app.get('/api/logs/list', (_req, res) => {
    res.json(listLogs());
  });

  app.get('/api/logs/tail', async (req: Request, res: Response) => {
    const path = String(req.query['path'] ?? '');
    if (!path) {
      res.status(400).end('missing path');
      return;
    }
    await streamLog(path, res);
  });

  // File fetch. Default returns the whole file (capped at 2 MB) for the
  // file viewer page. Pass `span=N&line=M` for a small window (legacy
  // side-panel use). Always returns line numbers + total count.
  app.get('/api/file', async (req: Request, res: Response) => {
    const path = String(req.query['path'] ?? '');
    const line = Number(req.query['line'] ?? 0) || 0;
    const span = req.query['span'] ? Math.min(2000, Number(req.query['span']) || 0) : 0;
    if (!path.startsWith('/')) {
      res.status(400).json({error: 'absolute path required'});
      return;
    }
    try {
      const data = await readFile(path, 'utf-8');
      const lines = data.split('\n');
      // 2 MB cap to keep highlight.js + browser responsive.
      const total = lines.length;
      if (data.length > 2 * 1024 * 1024 && span === 0) {
        res.json({
          path,
          line,
          start_line: 1,
          end_line: 200,
          total_lines: total,
          truncated: true,
          lines: lines.slice(0, 200),
        });
        return;
      }
      if (span > 0) {
        const start = Math.max(0, line - Math.floor(span / 2));
        const end = Math.min(total, start + span);
        res.json({
          path,
          line,
          start_line: start + 1,
          end_line: end,
          total_lines: total,
          truncated: false,
          lines: lines.slice(start, end),
        });
        return;
      }
      res.json({
        path,
        line,
        start_line: 1,
        end_line: total,
        total_lines: total,
        truncated: false,
        lines,
      });
    } catch (e) {
      res.status(500).json({error: String(e)});
    }
  });

  return app;
}

/**
 * Normalise scry's JSON-RPC result into a Hit[]. Most commands return
 * an array of objects; a few (stats, tldr) return a single object —
 * those land in QueryResponse.one and `hits` is empty.
 */
function normaliseResult(result: unknown): Hit[] {
  if (!Array.isArray(result)) return [];
  const out: Hit[] = [];
  for (const row of result) {
    if (!row || typeof row !== 'object') continue;
    const r = row as Record<string, unknown>;
    out.push({
      path: typeof r['path'] === 'string' ? r['path'] : undefined,
      line: typeof r['line'] === 'number' ? r['line'] : undefined,
      col: typeof r['col'] === 'number' ? r['col'] : undefined,
      snippet: typeof r['snippet'] === 'string' ? r['snippet'] : undefined,
      name: typeof r['name'] === 'string' ? r['name'] : undefined,
      fqn: typeof r['fqn'] === 'string' ? r['fqn'] : undefined,
      kind: typeof r['kind'] === 'string' ? r['kind'] : undefined,
      lang: typeof r['lang'] === 'string' ? r['lang'] : undefined,
      scope: Array.isArray(r['scope'])
        ? (r['scope'] as unknown[]).filter((x): x is string => typeof x === 'string')
        : undefined,
      id: typeof r['id'] === 'number' || typeof r['id'] === 'string' ? r['id'] : undefined,
      distance: typeof r['distance'] === 'number' ? r['distance'] : undefined,
      score: typeof r['score'] === 'number' ? r['score'] : undefined,
      extra: extractExtra(r),
    });
  }
  // Use the loadSettings import to silence the unused-import warning
  // in dev builds where the function is only called inside the closure.
  void loadSettings;
  return out;
}

const KNOWN_KEYS = new Set([
  'path',
  'line',
  'col',
  'snippet',
  'name',
  'fqn',
  'kind',
  'lang',
  'scope',
  'id',
  'distance',
  'score',
]);

function extractExtra(r: Record<string, unknown>): Record<string, unknown> | undefined {
  const extra: Record<string, unknown> = {};
  let has = false;
  for (const k of Object.keys(r)) {
    if (KNOWN_KEYS.has(k)) continue;
    extra[k] = r[k];
    has = true;
  }
  return has ? extra : undefined;
}
