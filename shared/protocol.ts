// Shared types between the browser SPA (src/) and the Node backend
// (server/). Anything in this file must compile under BOTH tsconfigs,
// so: no DOM types, no Node types. Plain values only.

/**
 * Every scry command we expose in the UI. Mirrors the subcommands of
 * the `scry` CLI as of 0.1.5 (see `scry --help`). Categorised so the
 * UI can group commands in the picker without re-deriving the bucket.
 */
export const COMMANDS = [
  // search
  {id: 'def', label: 'Definition', kind: 'search', primary: true},
  {id: 'ref', label: 'References', kind: 'search', primary: true},
  {id: 'callers', label: 'Callers', kind: 'search', primary: true},
  {id: 'prefix', label: 'Prefix', kind: 'search', primary: true},
  {id: 'fuzzy', label: 'Fuzzy', kind: 'search', primary: true},
  {id: 'grep', label: 'Grep', kind: 'search', primary: true},
  {id: 'ask', label: 'Ask (semantic)', kind: 'search', primary: false},

  // file-oriented
  {id: 'outline', label: 'Outline', kind: 'file', primary: true},
  {id: 'tldr', label: 'TL;DR', kind: 'file', primary: true},
  {id: 'coverage', label: 'Coverage', kind: 'file', primary: true},
  {id: 'owner', label: 'Owner', kind: 'file', primary: true},
  {id: 'module-of', label: 'Module of', kind: 'file', primary: true},

  // history / repo
  {id: 'recall', label: 'Recall (history)', kind: 'history', primary: false},
  {id: 'diff', label: 'Diff', kind: 'repo', primary: false},
] as const satisfies ReadonlyArray<CommandDef>;

export interface CommandDef {
  id: string;
  label: string;
  kind: 'search' | 'file' | 'history' | 'repo';
  primary: boolean;
}

export type CommandId = (typeof COMMANDS)[number]['id'];

/**
 * Argument forms — what each command takes. Kept narrow so the UI can
 * render exactly the right inputs without a long switch in components.
 * Every command also accepts an optional `limit` and `index` override.
 */
export interface BaseArgs {
  limit?: number;
}
export interface DefArgs extends BaseArgs {
  name: string;
  kind?: string;
  lang?: string;
  in?: string;
}
export interface RefArgs extends BaseArgs {
  name: string;
  lang?: string;
  in?: string;
}
export interface CallersArgs extends BaseArgs {
  name: string;
  lang?: string;
  in?: string;
}
export interface PrefixArgs extends BaseArgs {
  prefix: string;
  lang?: string;
}
export interface FuzzyArgs extends BaseArgs {
  query: string;
  distance?: number;
  lang?: string;
}
export interface GrepArgs extends BaseArgs {
  pattern: string;
  regex?: boolean;
  lang?: string;
  in?: string;
}
export interface AskArgs extends BaseArgs {
  query: string;
}
export interface OutlineArgs {
  path: string;
}
export interface TldrArgs {
  path: string;
}
export interface CoverageArgs extends BaseArgs {
  path: string;
}
export interface OwnerArgs {
  path: string;
  includeDeep?: boolean;
}
export interface ModuleOfArgs {
  path: string;
}
export interface RecallArgs extends BaseArgs {
  /** "last 10 minutes" etc. The CLI knows. */
  window?: string;
}
export interface DiffArgs extends BaseArgs {
  since: string;
  thenCallers?: boolean;
}

export type CommandArgs =
  | ({cmd: 'def'} & DefArgs)
  | ({cmd: 'ref'} & RefArgs)
  | ({cmd: 'callers'} & CallersArgs)
  | ({cmd: 'prefix'} & PrefixArgs)
  | ({cmd: 'fuzzy'} & FuzzyArgs)
  | ({cmd: 'grep'} & GrepArgs)
  | ({cmd: 'ask'} & AskArgs)
  | ({cmd: 'outline'} & OutlineArgs)
  | ({cmd: 'tldr'} & TldrArgs)
  | ({cmd: 'coverage'} & CoverageArgs)
  | ({cmd: 'owner'} & OwnerArgs)
  | ({cmd: 'module-of'} & ModuleOfArgs)
  | ({cmd: 'recall'} & RecallArgs)
  | ({cmd: 'diff'} & DiffArgs);

/**
 * Single result row. scry's JSON shapes vary per command; we keep a
 * superset here so the UI can render any of them with one row component.
 * Unknown fields go in `extra` for the row's expand panel.
 */
export interface Hit {
  path?: string;
  line?: number;
  col?: number;
  snippet?: string;
  name?: string;
  fqn?: string;
  kind?: string;
  lang?: string;
  scope?: string[];
  id?: number | string;
  distance?: number;
  score?: number;
  extra?: Record<string, unknown>;
}

export interface QueryResponse {
  /** Echoed back: the cmd we ran. */
  cmd: CommandId;
  /** Always present; may be empty. */
  hits: Hit[];
  /** Server-measured wall time in milliseconds (proxy + scry). */
  elapsed_ms: number;
  /** scry's own stderr footer if we could parse it; undefined otherwise. */
  footer?: string;
  /** scry's stderr lines (debug, warning) — useful for the UI. */
  notes: string[];
  /** If scry returned a single JSON object instead of an array (e.g. tldr). */
  one?: unknown;
}

export interface IndexInfo {
  /** Resolved on-disk index dir. */
  dir: string;
  /** Total bytes on disk for the index. */
  total_bytes: number;
  /** Parsed manifest.json from the index, raw. */
  manifest: Record<string, unknown>;
  /** Per-file sizes (so the dashboard can chart them). */
  files: Array<{name: string; bytes: number}>;
  /** Raw `scry stats` text. */
  stats_text: string;
}

export interface LatencyPoint {
  /** epoch ms */
  t: number;
  /** elapsed ms */
  ms: number;
  cmd: CommandId;
  /** how many hits the query produced */
  hits: number;
}

export interface Metrics {
  /** Capped ring buffer of recent queries. */
  recent: LatencyPoint[];
  /** Counts by cmd. */
  counts: Record<string, number>;
  /** Backend uptime in ms. */
  uptime_ms: number;
  /** Backend RSS in bytes. */
  rss_bytes: number;
  /** scry serve socket: connected? */
  scry_connected: boolean;
  /** Last scry serve restart epoch ms, if it crashed. */
  scry_last_restart_ms: number | null;
}

export interface LogFile {
  name: string;
  bytes: number;
  mtime_ms: number;
}

export interface UiSettings {
  index_dir: string;
  scry_bin: string;
  scry_port: number;
  default_limit: number;
  /** "light" | "dark" | "auto" (auto = prefers-color-scheme) */
  theme: 'light' | 'dark' | 'auto';
  density: 'cozy' | 'compact';
}

export const DEFAULT_SETTINGS: UiSettings = {
  index_dir: '/mnt/agent/scry-index',
  scry_bin: '/mnt/agent/scry/target/release/scry',
  scry_port: 9787,
  default_limit: 100,
  theme: 'auto',
  density: 'cozy',
};
