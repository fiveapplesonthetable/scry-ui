// Server entry. Loads settings, brings up the scry daemon, mounts the
// /api routes, and serves the built UI from dist/ (or 404s in dev where
// Vite serves the SPA on a different port and proxies /api here).

import {existsSync} from 'node:fs';
import {createServer} from 'node:http';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

import express from 'express';

import {buildApi} from './api.js';
import {MetricsStore} from './metrics.js';
import {ScryDaemon} from './scry.js';
import {loadSettings} from './settings.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const DIST = resolve(HERE, '..', 'dist');
const HTTP_PORT = Number(process.env['PORT'] ?? 8787);

async function main(): Promise<void> {
  const settings = loadSettings();
  process.stdout.write(
    `[scry-ui] settings: index=${settings.index_dir} bin=${settings.scry_bin} port=${settings.scry_port}\n`,
  );

  const scry = new ScryDaemon({
    bin: settings.scry_bin,
    indexDir: settings.index_dir,
    port: settings.scry_port,
  });
  try {
    await scry.start();
    process.stdout.write(`[scry-ui] scry serve ready on 127.0.0.1:${settings.scry_port}\n`);
  } catch (e) {
    process.stderr.write(`[scry-ui] scry start failed: ${String(e)}\n`);
    process.stderr.write(`[scry-ui] continuing without scry; UI will surface the error.\n`);
  }

  const metrics = new MetricsStore();
  const api = buildApi({scry, metrics, settings});

  // Outer app: API + static dist + SPA fallback.
  const app = express();
  app.use(api);
  if (existsSync(DIST)) {
    app.use(express.static(DIST));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api/')) return next();
      res.sendFile(join(DIST, 'index.html'));
    });
  }

  const server = createServer(app);
  server.listen(HTTP_PORT, '0.0.0.0', () => {
    process.stdout.write(`[scry-ui] http://0.0.0.0:${HTTP_PORT}\n`);
  });

  const shutdown = (sig: string) => {
    process.stdout.write(`[scry-ui] ${sig} received, shutting down\n`);
    server.close();
    process.exit(0);
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

void main();
