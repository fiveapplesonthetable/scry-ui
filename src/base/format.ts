// Human-friendly formatters used across the UI. Pure, no Mithril deps.

export function fmtBytes(n: number): string {
  if (!isFinite(n) || n < 0) return '—';
  if (n < 1024) return `${n} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let v = n / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  const digits = v >= 100 ? 0 : v >= 10 ? 1 : 2;
  return `${v.toFixed(digits)} ${units[i]}`;
}

export function fmtCount(n: number): string {
  if (!isFinite(n)) return '—';
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0)}K`;
  if (n < 1_000_000_000) return `${(n / 1_000_000).toFixed(n < 10_000_000 ? 1 : 0)}M`;
  return `${(n / 1_000_000_000).toFixed(1)}B`;
}

export function fmtMs(n: number): string {
  if (!isFinite(n)) return '—';
  if (n < 1) return '<1 ms';
  if (n < 1000) return `${Math.round(n)} ms`;
  if (n < 60_000) return `${(n / 1000).toFixed(2)} s`;
  const m = Math.floor(n / 60_000);
  const s = Math.floor((n % 60_000) / 1000);
  return `${m}m ${s}s`;
}

export function fmtRelTime(epochMs: number): string {
  const dt = Date.now() - epochMs;
  if (dt < 1000) return 'just now';
  if (dt < 60_000) return `${Math.floor(dt / 1000)}s ago`;
  if (dt < 3_600_000) return `${Math.floor(dt / 60_000)}m ago`;
  if (dt < 86_400_000) return `${Math.floor(dt / 3_600_000)}h ago`;
  return `${Math.floor(dt / 86_400_000)}d ago`;
}

export function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx] ?? 0;
}

const LANG_COLORS: Record<string, string> = {
  Java: '#b07219',
  Kotlin: '#A97BFF',
  Cpp: '#f34b7d',
  C: '#555555',
  Rust: '#dea584',
  Go: '#00ADD8',
  Python: '#3572A5',
  Shell: '#89e051',
  Assembly: '#6E4C13',
  Aidl: '#3aa6ff',
  Hidl: '#3a8dff',
  Soong: '#888888',
  Bazel: '#76d275',
  Make: '#5f9a76',
  CMake: '#DA3434',
  Gn: '#7adbe2',
  Kconfig: '#a0a0a0',
  Owners: '#888888',
  Aconfig: '#ff9800',
  InitRc: '#ff5722',
  SelinuxTe: '#673ab7',
  ApiTxt: '#0091EA',
  AndroidManifest: '#A4C639',
};

export function langColor(lang?: string): string {
  if (!lang) return '#888';
  return LANG_COLORS[lang] ?? '#888';
}

export function shortPath(path: string, maxSegments = 4): string {
  const parts = path.split('/');
  if (parts.length <= maxSegments) return path;
  return '…/' + parts.slice(-maxSegments).join('/');
}
