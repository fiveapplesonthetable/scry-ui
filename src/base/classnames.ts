// Conditional className join. Falsy values drop out, true keeps the
// key. Tighter than the `classnames` npm package and avoids the dep.
export function cn(...parts: Array<string | false | null | undefined | Record<string, unknown>>): string {
  const out: string[] = [];
  for (const p of parts) {
    if (!p) continue;
    if (typeof p === 'string') {
      out.push(p);
      continue;
    }
    for (const [k, v] of Object.entries(p)) if (v) out.push(k);
  }
  return out.join(' ');
}
