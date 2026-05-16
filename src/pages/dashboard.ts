// Dashboard: a KPI strip across the top, then flat sections separated
// by hairlines — no cards, no padding boxes. Charts inline; raw
// `scry stats` output at the bottom.

import m from 'mithril';

import {fmtBytes, fmtCount, fmtMs, fmtRelTime, langColor, percentile} from '../base/format.js';
import {refreshIndex, store} from '../core/store.js';
import {LineChart, type Series} from '../widgets/line_chart.js';
import {Sparkline} from '../widgets/sparkline.js';

interface Row {
  label: string;
  value: number;
  color?: string;
}

function bars(rows: Row[], fmt: (n: number) => string): m.Children {
  if (rows.length === 0) return m('.sc-empty', '—');
  const max = Math.max(...rows.map((r) => r.value), 1);
  return m(
    '.sc-bars',
    rows.map((r) =>
      m('.sc-barrow', {key: r.label, title: `${r.label}: ${fmt(r.value)}`}, [
        m('.sc-barrow__label', r.label),
        m(
          '.sc-barrow__track',
          m('.sc-barrow__fill', {
            style: {
              width: `${(r.value / max) * 100}%`,
              background: r.color ?? 'var(--sc-accent)',
            },
          }),
        ),
        m('.sc-barrow__value', fmt(r.value)),
      ]),
    ),
  );
}

export const DashboardPage: m.ClosureComponent = () => {
  let initd = false;
  return {
    oninit() {
      if (initd) return;
      initd = true;
      void refreshIndex();
    },
    view() {
      const idx = store.index;
      const metrics = store.metrics;
      const recent = metrics?.recent ?? [];
      const latencies = recent.map((p) => p.ms);
      const p50 = percentile(latencies, 50);
      const p95 = percentile(latencies, 95);
      const p99 = percentile(latencies, 99);
      const cmdRows = metrics
        ? Object.entries(metrics.counts)
            .sort((a, b) => b[1] - a[1])
            .map(([cmd, count]) => ({label: cmd, value: count}))
        : [];
      const series: Series[] = recent.length
        ? [
            {
              label: 'elapsed_ms',
              color: 'var(--sc-chart-1)',
              points: recent.map((p) => ({x: p.t, y: p.ms})),
            },
          ]
        : [];

      // manifest.json nests these under .stats, but `scry serve` cmd=stats
      // returns them flat. Take whichever's present.
      const m_stats = (idx?.manifest['stats'] as Record<string, number> | undefined) ?? {};
      const pick = (key: string): number =>
        (idx?.manifest[key] as number | undefined) ?? m_stats[key] ?? 0;
      const filesTotal = pick('files_total');
      const symbols = pick('symbols');
      const refs = pick('refs');
      const bytesTotal = pick('bytes_total');
      const indexedAt = idx?.manifest['indexed_at'] as string | undefined;
      const version = idx?.manifest['scry_version'] as string | undefined;

      return m('.sc-dash', [
        // Inline KPI strip — no cards.
        m('.sc-dash__kpi', [
          kpi('files', fmtCount(filesTotal), fmtBytes(bytesTotal)),
          kpi('symbols', fmtCount(symbols)),
          kpi('refs', fmtCount(refs)),
          kpi('index', fmtBytes(idx?.total_bytes ?? 0), `${idx?.files.length ?? 0} sidecars`),
          kpi('queries', fmtCount(recent.length), recent.length ? `p50 ${fmtMs(p50)}` : 'session'),
        ]),

        // Latency chart
        m('.sc-section', [
          m('h3.sc-section__title', 'Query latency'),
          recent.length
            ? [
                m(LineChart, {
                  height: 220,
                  series,
                  yLabel: 'ms',
                  yFmt: (v: number) => `${Math.round(v)}`,
                  xFmt: (v: number) => fmtRelTime(v),
                }),
                m('.sc-section__meta', {style: {flexWrap: 'wrap'}}, [
                  m('span', `p50 ${fmtMs(p50)}`),
                  m('span', `p95 ${fmtMs(p95)}`),
                  m('span', `p99 ${fmtMs(p99)}`),
                  m(Sparkline, {values: latencies, width: 240, height: 22, area: true}),
                ]),
              ]
            : m('.sc-empty', 'Run a few searches to populate this chart.'),
        ]),

        // Two columns of bar lists on wide; stack on narrow.
        m(
          '.sc-section',
          {style: {display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '24px'}},
          [
            m('div', [
              m('h3.sc-section__title', 'Queries per command'),
              bars(cmdRows, fmtCount),
            ]),
            m('div', [
              m('h3.sc-section__title', 'On-disk index sidecars'),
              idx
                ? bars(
                    idx.files.map((f) => ({label: f.name, value: f.bytes, color: 'var(--sc-chart-2)'})),
                    fmtBytes,
                  )
                : m('.sc-empty', 'Loading…'),
            ]),
          ],
        ),

        // Roots + manifest facts.
        m('.sc-section', [
          m('h3.sc-section__title', 'Indexed roots'),
          idx && Array.isArray(idx.manifest['roots'])
            ? m(
                'dl.sc-dl',
                (idx.manifest['roots'] as Array<{path: string; profile: string}>).flatMap(
                  (r) => [
                    m('dt', {key: `dt-${r.path}`}, [
                      m('span', {
                        style: {color: langColor(r.profile), marginRight: '6px'},
                      }, '●'),
                      r.profile,
                    ]),
                    m('dd', {key: `dd-${r.path}`}, r.path),
                  ],
                ),
              )
            : m('.sc-empty', '—'),
          version || indexedAt
            ? m('.sc-section__meta', [
                version ? m('span', `index version ${version}`) : null,
                indexedAt ? m('span', `built ${indexedAt}`) : null,
              ])
            : null,
        ]),

        m('.sc-section', [
          m('h3.sc-section__title', 'scry stats (raw)'),
          idx ? m('pre.sc-pre', idx.stats_text || '(empty)') : m('.sc-empty', 'Loading…'),
        ]),
      ]);
    },
  };
};

function kpi(label: string, value: string, sub?: string): m.Vnode {
  return m('.sc-dash__kpi-item', [
    m('span.sc-dash__kpi-label', label),
    m('span.sc-dash__kpi-value', value),
    sub ? m('span', {style: {color: 'var(--sc-text-mute)', fontSize: 'var(--sc-fs-xs)'}}, sub) : null,
  ]);
}
