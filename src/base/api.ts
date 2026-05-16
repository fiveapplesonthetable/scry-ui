// Thin fetch wrapper. All endpoints are JSON; SSE goes through the
// browser EventSource directly so we don't wrap that.

import type {
  CommandDef,
  IndexInfo,
  LogFile,
  Metrics,
  QueryResponse,
  UiSettings,
} from '../../shared/protocol.js';

async function jget<T>(url: string): Promise<T> {
  const r = await fetch(url, {headers: {Accept: 'application/json'}});
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
  return (await r.json()) as T;
}

async function jpost<T>(url: string, body: unknown): Promise<T> {
  const r = await fetch(url, {
    method: 'POST',
    headers: {'Content-Type': 'application/json', Accept: 'application/json'},
    body: JSON.stringify(body),
  });
  if (!r.ok && r.status !== 500) throw new Error(`${url}: HTTP ${r.status}`);
  return (await r.json()) as T;
}

export const Api = {
  commands: (): Promise<CommandDef[]> => jget<CommandDef[]>('/api/commands'),
  query: (cmd: string, args: Record<string, unknown>): Promise<QueryResponse> =>
    jpost<QueryResponse>('/api/q', {cmd, args}),
  indexInfo: (): Promise<IndexInfo> => jget<IndexInfo>('/api/index'),
  metrics: (): Promise<Metrics> => jget<Metrics>('/api/metrics'),
  settings: (): Promise<UiSettings> => jget<UiSettings>('/api/settings'),
  saveSettings: (s: Partial<UiSettings>): Promise<{ok: boolean; settings: UiSettings}> =>
    jpost<{ok: boolean; settings: UiSettings}>('/api/settings', s),
  logs: (): Promise<LogFile[]> => jget<LogFile[]>('/api/logs/list'),
  health: (): Promise<{ok: boolean; scry_connected: boolean; uptime_ms: number}> =>
    jget('/api/health'),
  scryStderr: (): Promise<{lines: string[]}> => jget('/api/scry-stderr'),
  /** Fetch a file. Pass `span` to clip to N lines around `line`; omit
   *  for the whole file (capped to 2 MB; over that, returns the first
   *  200 lines + `truncated: true`). */
  file: (
    path: string,
    line: number,
    span?: number,
  ): Promise<{
    path: string;
    line: number;
    start_line: number;
    end_line: number;
    total_lines: number;
    truncated: boolean;
    lines: string[];
  }> => {
    const qs = new URLSearchParams({path, line: String(line)});
    if (span !== undefined) qs.set('span', String(span));
    return jget(`/api/file?${qs.toString()}`);
  },
};
