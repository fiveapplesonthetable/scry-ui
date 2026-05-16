// Cumulative-distribution chart for a list of latency values.
// X axis is latency (ms), Y axis is the cumulative fraction (0–100%).
// Renders the empirical CDF as a step path, with the same chrome as
// the other charts (gridlines, hairline axes, 800-unit viewBox + CSS
// scaling).

import m from 'mithril';

import {percentile} from '../base/format.js';

interface Attrs {
  values: number[];
  height?: number;
  xFmt?: (v: number) => string;
}

const VBW = 800;
const PAD = {top: 8, right: 14, bottom: 24, left: 44};

export const CdfChart: m.Component<Attrs> = {
  view({attrs}) {
    const w = VBW;
    const h = attrs.height ?? 200;
    const innerW = w - PAD.left - PAD.right;
    const innerH = h - PAD.top - PAD.bottom;

    const vs = attrs.values;
    if (vs.length === 0) {
      return m('svg', {
        viewBox: `0 0 ${w} ${h}`,
        style: {width: '100%', height: `${h}px`},
      });
    }

    const sorted = [...vs].sort((a, b) => a - b);
    const min = 0;
    const niceStepV = niceStep((sorted[sorted.length - 1] ?? 1) / 5);
    const niceMax = niceStepV * Math.ceil((sorted[sorted.length - 1] ?? 1) / niceStepV);
    const range = Math.max(1, niceMax - min);

    const sx = (v: number): number => PAD.left + ((v - min) / range) * innerW;
    const sy = (frac: number): number =>
      PAD.top + innerH - frac * innerH;

    // Build a step path: each (value, i/N) becomes a horizontal then
    // vertical move, so the line steps up exactly at each measurement.
    const segments: string[] = [];
    segments.push(`M${sx(0).toFixed(1)},${sy(0).toFixed(1)}`);
    for (let i = 0; i < sorted.length; i++) {
      const x = sx(sorted[i] ?? 0);
      const yPrev = sy(i / sorted.length);
      const yCur = sy((i + 1) / sorted.length);
      segments.push(`L${x.toFixed(1)},${yPrev.toFixed(1)}`);
      segments.push(`L${x.toFixed(1)},${yCur.toFixed(1)}`);
    }
    segments.push(`L${sx(niceMax).toFixed(1)},${sy(1).toFixed(1)}`);
    const linePath = segments.join(' ');
    const areaPath = `${linePath} L${sx(niceMax).toFixed(
      1,
    )},${(PAD.top + innerH).toFixed(1)} L${sx(0).toFixed(1)},${(PAD.top + innerH).toFixed(
      1,
    )} Z`;

    const yTicks = [0, 0.25, 0.5, 0.75, 1];
    const xTicks = niceTicks(min, niceMax, 5);
    const xFmt = attrs.xFmt ?? ((v: number) => `${Math.round(v)}`);

    const p50 = percentile(vs, 50);
    const p95 = percentile(vs, 95);
    const p99 = percentile(vs, 99);

    return m(
      'svg',
      {
        viewBox: `0 0 ${w} ${h}`,
        preserveAspectRatio: 'none',
        style: {width: '100%', height: `${h}px`, display: 'block'},
      },
      m(
        'g.grid',
        yTicks.map((t) =>
          m('g', {key: `y${t}`}, [
            m('line', {
              x1: PAD.left,
              x2: PAD.left + innerW,
              y1: sy(t),
              y2: sy(t),
              stroke: 'var(--sc-chart-grid)',
              'vector-effect': 'non-scaling-stroke',
            }),
            m(
              'text',
              {
                x: PAD.left - 6,
                y: sy(t) + 4,
                'text-anchor': 'end',
                'font-size': 10,
                fill: 'var(--sc-text-mute)',
              },
              `${Math.round(t * 100)}%`,
            ),
          ]),
        ),
      ),
      m('g.axis', [
        m('line', {
          x1: PAD.left,
          x2: PAD.left + innerW,
          y1: PAD.top + innerH,
          y2: PAD.top + innerH,
          stroke: 'var(--sc-chart-axis)',
          'vector-effect': 'non-scaling-stroke',
        }),
        m(
          'g.xticks',
          xTicks.map((t) =>
            m('g', {key: `x${t}`}, [
              m('line', {
                x1: sx(t),
                x2: sx(t),
                y1: PAD.top + innerH,
                y2: PAD.top + innerH + 3,
                stroke: 'var(--sc-chart-axis)',
                'vector-effect': 'non-scaling-stroke',
              }),
              m(
                'text',
                {
                  x: sx(t),
                  y: PAD.top + innerH + 14,
                  'text-anchor': 'middle',
                  'font-size': 10,
                  fill: 'var(--sc-text-mute)',
                },
                xFmt(t),
              ),
            ]),
          ),
        ),
      ]),
      m('g.area', [
        m('path', {
          d: areaPath,
          fill: 'var(--sc-chart-1)',
          opacity: 0.08,
          stroke: 'none',
        }),
        m('path', {
          d: linePath,
          fill: 'none',
          stroke: 'var(--sc-chart-1)',
          'stroke-width': 1.5,
          'vector-effect': 'non-scaling-stroke',
          'stroke-linejoin': 'round',
        }),
      ]),
      // Percentile markers — same colours as the histogram for consistency.
      m('g.markers', [
        marker('p50', p50, 'var(--sc-chart-2)', sx, PAD.top, innerH),
        marker('p95', p95, 'var(--sc-chart-3)', sx, PAD.top, innerH),
        marker('p99', p99, 'var(--sc-chart-4)', sx, PAD.top, innerH),
      ]),
    );
  },
};

function marker(
  label: string,
  v: number,
  color: string,
  sx: (v: number) => number,
  top: number,
  innerH: number,
): m.Vnode {
  return m('g', {key: label}, [
    m('line', {
      x1: sx(v),
      x2: sx(v),
      y1: top,
      y2: top + innerH,
      stroke: color,
      'vector-effect': 'non-scaling-stroke',
      'stroke-dasharray': '3 3',
    }),
  ]);
}

function niceTicks(min: number, max: number, target: number): number[] {
  const range = max - min;
  if (range <= 0) return [min];
  const step = niceStep(range / target);
  const start = Math.ceil(min / step) * step;
  const out: number[] = [];
  for (let v = start; v <= max + 1e-9; v += step) out.push(round(v));
  return out;
}

function niceStep(rough: number): number {
  if (rough <= 0) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(rough)));
  const f = rough / pow;
  let nice = 1;
  if (f >= 5) nice = 5;
  else if (f >= 2) nice = 2;
  return nice * pow;
}

function round(v: number): number {
  return Math.round(v * 1e6) / 1e6;
}
