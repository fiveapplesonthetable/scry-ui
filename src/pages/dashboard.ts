// Dashboard: a KPI strip across the top, then flat sections separated
// by hairlines. Time-window pill picker filters which latency points
// feed the charts. Legend strip under the histogram shows p50/p95/p99
// with coloured swatches.

import m from 'mithril';

import {fmtBytes, fmtCount, fmtMs, fmtRelTime, langColor, percentile} from '../base/format.js';
import {cn} from '../base/classnames.js';
import {refreshIndex, store} from '../core/store.js';
import {CdfChart} from '../widgets/cdf_chart.js';
import {Histogram} from '../widgets/histogram.js';
import {LineChart, type Series} from '../widgets/line_chart.js';

interface Row {
  label: string;
  value: number;
  color?: string;
}

const WINDOWS = [
  {id: '5m', label: '5 min', ms: 5 * 60_000},
  {id: '1h', label: '1 hour', ms: 60 * 60_000},
  {id: '24h', label: '24 hours', ms: 24 * 3600_000},
  {id: 'all', label: 'session', ms: Infinity},
] as const;

type WindowId = (typeof WINDOWS)[number]['id'];

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
  let win: WindowId = 'all';
  return {
    oninit() {
      if (initd) return;
      initd = true;
      void refreshIndex();
    },
    view() {
      const idx = store.index;
      const metrics = store.metrics;
      const all = metrics?.recent ?? [];
      const cutoff = win === 'all' ? 0 : Date.now() - (WINDOWS.find((w) => w.id === win)?.ms ?? 0);
      const recent = all.filter((p) => p.t >= cutoff);
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

      const kpis = m('.sc-dash__kpi', [
        kpi('files', fmtCount(filesTotal), fmtBytes(bytesTotal)),
        kpi('symbols', fmtCount(symbols)),
        kpi('refs', fmtCount(refs)),
        kpi('index', fmtBytes(idx?.total_bytes ?? 0), `${idx?.files.length ?? 0} sidecars`),
        kpi('queries', fmtCount(recent.length), recent.length ? `p50 ${fmtMs(p50)}` : 'session'),
      ]);

      const windowPicker = m(
        '.sc-window',
        WINDOWS.map((w) =>
          m(
            'button.sc-window__pill',
            {
              key: w.id,
              class: cn({'sc-window__pill--on': win === w.id}),
              onclick: () => {
                win = w.id;
              },
            },
            w.label,
          ),
        ),
      );

      const latencyChart = m('.sc-section', [
        m('h3.sc-section__title', 'Query latency over time'),
        windowPicker,
        recent.length
          ? m(LineChart, {
              height: 220,
              series,
              yLabel: 'ms',
              yFmt: (v: number) => `${Math.round(v)}`,
              xFmt: (v: number) => fmtRelTime(v),
            })
          : m('.sc-empty', `No queries in the last ${labelFor(win)}.`),
        recent.length
          ? m('.sc-section__meta', [
              percentileSwatch('p50', p50, 'var(--sc-chart-2)'),
              percentileSwatch('p95', p95, 'var(--sc-chart-3)'),
              percentileSwatch('p99', p99, 'var(--sc-chart-4)'),
              m('span', `n=${recent.length}`),
            ])
          : m('span'),
      ]);

      const distribution = recent.length
        ? m('.sc-section', [
            m('h3.sc-section__title', 'Latency distribution'),
            m(Histogram, {
              values: latencies,
              height: 200,
              xFmt: (v: number) => `${Math.round(v)}ms`,
            }),
            m('.sc-section__meta', [
              percentileSwatch('p50', p50, 'var(--sc-chart-2)'),
              percentileSwatch('p95', p95, 'var(--sc-chart-3)'),
              percentileSwatch('p99', p99, 'var(--sc-chart-4)'),
            ]),
          ])
        : m('div', {style: {display: 'none'}});

      const cdfSection = recent.length
        ? m('.sc-section', [
            m('h3.sc-section__title', 'CDF — cumulative distribution'),
            m(CdfChart, {
              values: latencies,
              height: 200,
              xFmt: (v: number) => `${Math.round(v)}ms`,
            }),
            m('.sc-section__meta', [
              percentileSwatch('p50', p50, 'var(--sc-chart-2)'),
              percentileSwatch('p95', p95, 'var(--sc-chart-3)'),
              percentileSwatch('p99', p99, 'var(--sc-chart-4)'),
              m(
                'span',
                {style: {color: 'var(--sc-text-mute)'}},
                'Y is cumulative fraction; flatter slope = more queries at that latency.',
              ),
            ]),
          ])
        : m('div', {style: {display: 'none'}});

      const cmdSection = m(
        '.sc-section',
        {
          style: {
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
            gap: '24px',
          },
        },
        [
          m('div', [
            m('h3.sc-section__title', 'Queries per command'),
            bars(cmdRows, fmtCount),
          ]),
          m('div', [
            m('h3.sc-section__title', 'On-disk index sidecars'),
            idx
              ? bars(
                  idx.files.map((f) => ({
                    label: f.name,
                    value: f.bytes,
                    color: 'var(--sc-chart-2)',
                  })),
                  fmtBytes,
                )
              : m('.sc-empty', 'Loading…'),
          ]),
        ],
      );

      const roots = m('.sc-section', [
        m('h3.sc-section__title', 'Indexed roots'),
        idx && Array.isArray(idx.manifest['roots'])
          ? m(
              'dl.sc-dl',
              (idx.manifest['roots'] as Array<{path: string; profile: string}>).flatMap(
                (r) => [
                  m(
                    'dt',
                    {key: `dt-${r.path}`},
                    m('span', {style: {color: langColor(r.profile), marginRight: '6px'}}, '●'),
                    r.profile,
                  ),
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
          : m('span'),
      ]);

      const rawStats = m('.sc-section', [
        m('h3.sc-section__title', 'scry stats (raw)'),
        idx ? m('pre.sc-pre', idx.stats_text || '(empty)') : m('.sc-empty', 'Loading…'),
      ]);

      return m('.sc-dash', [
        kpis,
        latencyChart,
        distribution,
        cdfSection,
        cmdSection,
        roots,
        rawStats,
      ]);
    },
  };
};

function kpi(label: string, value: string, sub?: string): m.Vnode {
  return m('.sc-dash__kpi-item', [
    m('span.sc-dash__kpi-label', label),
    m('span.sc-dash__kpi-value', value),
    sub
      ? m('span', {style: {color: 'var(--sc-text-mute)', fontSize: 'var(--sc-fs-xs)'}}, sub)
      : m('span'),
  ]);
}

/** Coloured-dot swatch + label + value; the legend cell used under every chart.
 *  No key on purpose — siblings in the meta strip include plain spans
 *  too, and mixing keyed + unkeyed in one fragment trips Mithril's diff. */
function percentileSwatch(label: string, value: number, color: string): m.Vnode {
  return m(
    'span.sc-swatch',
    {title: `${label} = ${fmtMs(value)}`},
    [
      m('span.sc-swatch__dot', {style: {background: color}}),
      m('span.sc-swatch__label', label),
      m('span.sc-swatch__value', fmtMs(value)),
    ],
  );
}

function labelFor(id: WindowId): string {
  return WINDOWS.find((w) => w.id === id)?.label ?? 'session';
}
