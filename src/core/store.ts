// Central reactive state. Mithril doesn't need a framework here —
// modules import the singleton and call `m.redraw()` after mutating.

import m from 'mithril';

import type {
  CommandId,
  Hit,
  IndexInfo,
  LogFile,
  Metrics,
  QueryResponse,
  UiSettings,
} from '../../shared/protocol.js';
import {DEFAULT_SETTINGS} from '../../shared/protocol.js';
import {Api} from '../base/api.js';

export type Theme = 'light' | 'dark' | 'auto';

interface SearchState {
  cmd: CommandId;
  /** Free-form args keyed by command-specific argument name. */
  args: Record<string, string | number | boolean | undefined>;
  busy: boolean;
  response: QueryResponse | null;
  /** Index into response.hits, or null. */
  selected: number | null;
  /** Filter strip visible? */
  filtersOpen: boolean;
  /** Autocomplete suggestions for the current input value. */
  suggestions: Hit[];
  /** Active suggestion index (keyboard nav). */
  suggestionIdx: number;
  /** Suggestions visible? */
  suggestOpen: boolean;
}

interface State {
  page: 'search' | 'dashboard' | 'logs' | 'settings' | 'health' | 'file';
  theme: Theme;
  settings: UiSettings;
  search: SearchState;
  filePeek: {
    open: boolean;
    path: string;
    line: number;
    lines: string[];
    startLine: number;
    busy: boolean;
    totalLines: number;
    truncated: boolean;
  };
  index: IndexInfo | null;
  metrics: Metrics | null;
  logs: LogFile[];
  scryStderr: string[];
  health: {ok: boolean; scry_connected: boolean; uptime_ms: number} | null;
}

const THEME_KEY = 'scry-ui:theme';

function initialTheme(): Theme {
  try {
    const t = localStorage.getItem(THEME_KEY);
    if (t === 'light' || t === 'dark' || t === 'auto') return t;
  } catch {
    /* ignore */
  }
  return 'auto';
}

function initialPage(): State['page'] {
  const hash = location.hash.replace(/^#\//, '').split('?')[0] ?? '';
  if (
    hash === 'dashboard' ||
    hash === 'logs' ||
    hash === 'settings' ||
    hash === 'health' ||
    hash === 'file'
  ) {
    return hash;
  }
  return 'search';
}

/** Parse the query string after a `#/<page>?...`. */
export function hashQuery(): URLSearchParams {
  const idx = location.hash.indexOf('?');
  return new URLSearchParams(idx === -1 ? '' : location.hash.slice(idx + 1));
}

export const store: State = {
  page: initialPage(),
  theme: initialTheme(),
  settings: {...DEFAULT_SETTINGS},
  search: {
    cmd: 'grep',
    args: {},
    busy: false,
    response: null,
    selected: null,
    filtersOpen: false,
    suggestions: [],
    suggestionIdx: -1,
    suggestOpen: false,
  },
  filePeek: {
    open: false,
    path: '',
    line: 0,
    lines: [],
    startLine: 1,
    busy: false,
    totalLines: 0,
    truncated: false,
  },
  index: null,
  metrics: null,
  logs: [],
  scryStderr: [],
  health: null,
};

// --- theme -----------------------------------------------------------

export function applyTheme(t: Theme): void {
  store.theme = t;
  try {
    localStorage.setItem(THEME_KEY, t);
  } catch {
    /* ignore */
  }
  let effective: 'light' | 'dark';
  if (t === 'auto') {
    effective = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  } else {
    effective = t;
  }
  document.documentElement.setAttribute('data-theme', effective);
  m.redraw();
}

// --- navigation ------------------------------------------------------

export function goto(p: State['page']): void {
  store.page = p;
  location.hash = `#/${p}`;
  m.redraw();
}

window.addEventListener('hashchange', () => {
  store.page = initialPage();
  m.redraw();
  // When the route is #/file, the URL carries the path/line — re-fetch
  // on every change so navigating between different hits reloads correctly.
  if (store.page === 'file') {
    void loadFileFromHash();
  }
});

// --- queries ---------------------------------------------------------

export function setCmd(cmd: CommandId): void {
  store.search.cmd = cmd;
  // Keep the primary input across cmd switches — name/pattern/etc are
  // often the same string the user wanted to try with a different verb.
  store.search.response = null;
  store.search.selected = null;
  store.search.suggestions = [];
  store.search.suggestOpen = false;
  m.redraw();
}

export function setArg(key: string, value: string | number | boolean | undefined): void {
  store.search.args = {...store.search.args, [key]: value};
}

export function toggleFilters(): void {
  store.search.filtersOpen = !store.search.filtersOpen;
  m.redraw();
}

export async function runQuery(): Promise<void> {
  const {cmd, args} = store.search;
  store.search.busy = true;
  store.search.response = null;
  store.search.selected = null;
  store.search.suggestOpen = false;
  m.redraw();
  try {
    const r = await Api.query(cmd, stripEmpty(args));
    store.search.response = r;
  } catch (e) {
    store.search.response = {
      cmd,
      hits: [],
      elapsed_ms: 0,
      notes: [`request failed: ${String(e)}`],
    };
  } finally {
    store.search.busy = false;
    m.redraw();
  }
}

function stripEmpty(o: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(o)) {
    if (v === '' || v === undefined || v === null) continue;
    if (typeof v === 'number' && Number.isNaN(v)) continue;
    out[k] = v;
  }
  return out;
}

// --- autocomplete ----------------------------------------------------

/**
 * Which scry command to use for suggestions, given the current
 * primary-search command. We pick `prefix` for symbol-by-name commands
 * (def/ref/callers/prefix/fuzzy) — it's the fastest path on the index.
 */
const SUGGEST_CMD: Partial<Record<CommandId, CommandId>> = {
  def: 'prefix',
  ref: 'prefix',
  callers: 'prefix',
  prefix: 'prefix',
  fuzzy: 'prefix',
};

let suggestTimer: number | null = null;
let suggestSeq = 0;

export function inputChanged(value: string): void {
  const cmd = store.search.cmd;
  const sugCmd = SUGGEST_CMD[cmd];
  if (!sugCmd || value.length < 2) {
    store.search.suggestions = [];
    store.search.suggestOpen = false;
    store.search.suggestionIdx = -1;
    return;
  }
  if (suggestTimer != null) window.clearTimeout(suggestTimer);
  const mySeq = ++suggestSeq;
  suggestTimer = window.setTimeout(async () => {
    try {
      const r = await Api.query(sugCmd, {prefix: value, limit: 12});
      if (mySeq !== suggestSeq) return; // a newer input superseded us
      store.search.suggestions = r.hits;
      store.search.suggestOpen = r.hits.length > 0;
      store.search.suggestionIdx = -1;
      m.redraw();
    } catch {
      /* ignore */
    }
  }, 120);
}

export function moveSuggestion(delta: number): void {
  const s = store.search;
  if (!s.suggestOpen || s.suggestions.length === 0) return;
  let next = s.suggestionIdx + delta;
  if (next < -1) next = s.suggestions.length - 1;
  if (next >= s.suggestions.length) next = -1;
  s.suggestionIdx = next;
  m.redraw();
}

export function acceptSuggestion(): boolean {
  const s = store.search;
  if (!s.suggestOpen || s.suggestionIdx < 0) return false;
  const sug = s.suggestions[s.suggestionIdx];
  if (!sug || !sug.name) return false;
  pickSuggestion(sug);
  return true;
}

export function pickSuggestion(sug: Hit): void {
  const primaryArg = primaryArgFor(store.search.cmd);
  if (sug.name) setArg(primaryArg, sug.name);
  store.search.suggestOpen = false;
  store.search.suggestionIdx = -1;
  m.redraw();
  // Blur the input so j/k navigation works on the results immediately.
  const active = document.activeElement as HTMLElement | null;
  if (active && active.tagName === 'INPUT') active.blur();
  void runQuery();
}

export function dismissSuggestions(): void {
  store.search.suggestOpen = false;
  store.search.suggestionIdx = -1;
  m.redraw();
}

function primaryArgFor(cmd: CommandId): string {
  switch (cmd) {
    case 'grep':
      return 'pattern';
    case 'prefix':
      return 'prefix';
    case 'fuzzy':
    case 'ask':
      return 'query';
    case 'outline':
    case 'tldr':
    case 'coverage':
    case 'owner':
    case 'module-of':
      return 'path';
    case 'recall':
      return 'window';
    case 'diff':
      return 'since';
    default:
      return 'name';
  }
}

// --- result selection (keyboard) ------------------------------------

export function moveSelection(delta: number): void {
  const r = store.search.response;
  if (!r || r.hits.length === 0) return;
  const cur = store.search.selected;
  let next = cur == null ? (delta > 0 ? 0 : r.hits.length - 1) : cur + delta;
  if (next < 0) next = r.hits.length - 1;
  if (next >= r.hits.length) next = 0;
  store.search.selected = next;
  m.redraw();
  // Scroll into view.
  requestAnimationFrame(() => {
    const el = document.querySelector(`[data-hit-idx="${next}"]`);
    if (el) (el as HTMLElement).scrollIntoView({block: 'nearest'});
  });
}

export function openSelected(): void {
  const r = store.search.response;
  const sel = store.search.selected;
  if (!r || sel == null) return;
  const hit = r.hits[sel];
  if (hit) void openFile(hit, sel);
}

// --- file viewer page ------------------------------------------------

/** Navigate to the file viewer for `hit`. */
export function openFile(hit: Hit, idx: number): void {
  if (!hit.path || !hit.line) return;
  store.search.selected = idx;
  const qs = new URLSearchParams({path: hit.path, line: String(hit.line)});
  location.hash = `#/file?${qs.toString()}`;
}

/** Fetch the file the URL points at and parse it into filePeek. */
export async function loadFileFromHash(): Promise<void> {
  const q = hashQuery();
  const path = q.get('path');
  const line = Number(q.get('line') ?? 0) || 0;
  if (!path) return;
  store.filePeek.path = path;
  store.filePeek.line = line;
  store.filePeek.busy = true;
  store.filePeek.lines = [];
  store.filePeek.truncated = false;
  m.redraw();
  try {
    const r = await Api.file(path, line);
    store.filePeek.lines = r.lines;
    store.filePeek.startLine = r.start_line;
    store.filePeek.totalLines = r.total_lines;
    store.filePeek.truncated = !!r.truncated;
  } catch (e) {
    store.filePeek.lines = [`(read failed: ${String(e)})`];
    store.filePeek.startLine = 1;
    store.filePeek.totalLines = 1;
  } finally {
    store.filePeek.busy = false;
    m.redraw();
  }
}

/** Close the file viewer; usually goes back to search. */
export function closeFile(): void {
  if (history.length > 1) history.back();
  else location.hash = '#/search';
}

// --- background refreshers ------------------------------------------

let metricsTimer: number | null = null;
export function startMetricsPolling(): void {
  if (metricsTimer != null) return;
  const tick = async (): Promise<void> => {
    try {
      store.metrics = await Api.metrics();
      m.redraw();
    } catch {
      /* ignore */
    }
  };
  void tick();
  metricsTimer = window.setInterval(tick, 3000);
}

export async function refreshIndex(): Promise<void> {
  try {
    store.index = await Api.indexInfo();
    m.redraw();
  } catch {
    /* ignore */
  }
}

export async function refreshLogs(): Promise<void> {
  try {
    store.logs = await Api.logs();
    m.redraw();
  } catch {
    /* ignore */
  }
}

export async function refreshHealth(): Promise<void> {
  try {
    store.health = await Api.health();
    const r = await Api.scryStderr();
    store.scryStderr = r.lines;
    m.redraw();
  } catch {
    /* ignore */
  }
}

export async function refreshSettings(): Promise<void> {
  try {
    store.settings = await Api.settings();
    m.redraw();
  } catch {
    /* ignore */
  }
}

export async function saveSettings(s: Partial<UiSettings>): Promise<void> {
  const r = await Api.saveSettings(s);
  store.settings = r.settings;
  m.redraw();
}
