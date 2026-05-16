// Health: KPIs for backend + daemon + index, then the daemon stderr
// tail. Polls every 4s so the values stay current.

import m from 'mithril';

import {fmtBytes, fmtCount, fmtMs, fmtRelTime, percentile} from '../base/format.js';
import {refreshHealth, refreshIndex, store} from '../core/store.js';

export const HealthPage: m.ClosureComponent = () => {
  let timer: number | null = null;
  return {
    oninit() {
      void refreshHealth();
      void refreshIndex();
      timer = window.setInterval(() => void refreshHealth(), 4000);
    },
    onremove() {
      if (timer != null) window.clearInterval(timer);
    },
    view() {
      const h = store.health;
      const m_ = store.metrics;
      const idx = store.index;
      const recent = m_?.recent ?? [];
      const totalCalls = m_ ? Object.values(m_.counts).reduce((a, b) => a + b, 0) : 0;
      const lastQuery = recent.length > 0 ? recent[recent.length - 1] : null;
      const latencies = recent.map((p) => p.ms);
      const p50 = percentile(latencies, 50);
      const p95 = percentile(latencies, 95);

      const indexFiles =
        (idx?.manifest['stats'] as Record<string, number> | undefined)?.['files_total'] ?? 0;
      const indexedAt = idx?.manifest['indexed_at'] as string | undefined;
      const version = idx?.manifest['scry_version'] as string | undefined;

      // Pretty-print the bytes the manifest reports as the indexed
      // source size — not the same as the on-disk index sidecar size.
      const srcBytes =
        (idx?.manifest['stats'] as Record<string, number> | undefined)?.['bytes_total'] ?? 0;

      return m('.sc-health', [
        m('.sc-dash__kpi', [
          kpi('backend', h ? 'up' : '—', h ? `${fmtMs(h.uptime_ms)} uptime` : ''),
          kpi(
            'scry serve',
            h?.scry_connected ? 'connected' : 'disconnected',
            m_?.scry_last_restart_ms
              ? `restart ${fmtRelTime(m_.scry_last_restart_ms)}`
              : 'no restarts',
            h?.scry_connected ? 'var(--sc-ok)' : 'var(--sc-err)',
          ),
          kpi('rss', m_ ? fmtBytes(m_.rss_bytes) : '—', 'node process'),
          kpi('queries', String(totalCalls), 'this session'),
          kpi('p50 / p95', m_ ? `${fmtMs(p50)} / ${fmtMs(p95)}` : '—', 'latency'),
          kpi(
            'last query',
            lastQuery ? lastQuery.cmd : '—',
            lastQuery ? `${fmtRelTime(lastQuery.t)} · ${lastQuery.hits} hits` : '',
          ),
        ]),
        m('.sc-section', [
          m('h3.sc-section__title', 'Index'),
          m('dl.sc-dl', [
            m('dt', 'index dir'),
            m('dd', idx?.dir ?? '—'),
            m('dt', 'index version'),
            m('dd', version ?? '—'),
            m('dt', 'built'),
            m('dd', indexedAt ?? '—'),
            m('dt', 'files indexed'),
            m('dd', fmtCount(indexFiles)),
            m('dt', 'source size'),
            m('dd', fmtBytes(srcBytes)),
            m('dt', 'index size'),
            m('dd', fmtBytes(idx?.total_bytes ?? 0)),
            m('dt', 'sidecars'),
            m('dd', String(idx?.files.length ?? 0)),
          ]),
        ]),
        m('.sc-section', [
          m('h3.sc-section__title', 'scry stderr (last 200 lines)'),
          m(
            'pre.sc-pre',
            {style: {maxHeight: '460px'}, 'data-test': 'scry-stderr'},
            store.scryStderr.length === 0 ? '(empty)' : store.scryStderr.join('\n'),
          ),
        ]),
      ]);
    },
  };
};

function kpi(label: string, value: string, sub?: string, valueColor?: string): m.Vnode {
  return m('.sc-dash__kpi-item', [
    m('span.sc-dash__kpi-label', label),
    m(
      'span.sc-dash__kpi-value',
      {style: valueColor ? {color: valueColor} : undefined},
      value,
    ),
    sub
      ? m('span', {style: {color: 'var(--sc-text-mute)', fontSize: 'var(--sc-fs-xs)'}}, sub)
      : null,
  ]);
}

