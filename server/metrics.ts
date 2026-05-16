// In-process metrics: a ring buffer of recent queries (for the chart)
// plus a per-command counter (for the bar chart). All in-memory; resets
// on backend restart. Cheap enough that we record every query.

import type {CommandId, LatencyPoint, Metrics} from '../shared/protocol.js';

const CAP = 500;

export class MetricsStore {
  private buf: LatencyPoint[] = [];
  private counts = new Map<string, number>();
  private startedAt = Date.now();

  record(cmd: CommandId, elapsedMs: number, hits: number): void {
    this.buf.push({t: Date.now(), ms: elapsedMs, cmd, hits});
    if (this.buf.length > CAP) this.buf.shift();
    this.counts.set(cmd, (this.counts.get(cmd) ?? 0) + 1);
  }

  snapshot(scryConnected: boolean, scryLastRestart: number | null): Metrics {
    return {
      recent: [...this.buf],
      counts: Object.fromEntries(this.counts),
      uptime_ms: Date.now() - this.startedAt,
      rss_bytes: process.memoryUsage().rss,
      scry_connected: scryConnected,
      scry_last_restart_ms: scryLastRestart,
    };
  }
}
