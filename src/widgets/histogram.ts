// Latency-distribution histogram. Same approach as LineChart:
// fixed 800-unit viewBox, scales to container via CSS, no JS measurement.
// All keyed elements wrapped in <g> groups to avoid Mithril's
// mixed-key fragment diff bug.

import m from 'mithril';

import {percentile} from '../base/format.js';

interface Attrs {
  values: number[];
  height?: number;
  buckets?: number;
  xFmt?: (v: number) => string;
}

const VBW = 800;
const PAD = {top: 8, right: 14, bottom: 24, left: 44};

export const Histogram: m.Component<Attrs> = {
  view({attrs}) {
    const w = VBW;
    const h = attrs.height ?? 160;
    const innerW = w - PAD.left - PAD.right;
    const innerH = h - PAD.top - PAD.bottom;
    const vs = attrs.values;
    if (vs.length === 0) {
      return m('svg', {viewBox: `0 0 ${w} ${h}`, style: {width: '100%', height: `${h}px`}});
    }

    const min = 0;
    const niceStepV = niceStep(Math.max(...vs) / 5);
    const niceMax = niceStepV * Math.ceil(Math.max(...vs) / niceStepV);
    const range = Math.max(1, niceMax - min);
    const nBuckets = attrs.buckets ?? 24;
    const bw = range / nBuckets;
    const counts = new Array<number>(nBuckets).fill(0);
    for (const v of vs) {
      const idx = Math.min(nBuckets - 1, Math.floor((v - min) / bw));
      counts[idx]! += 1;
    }
    const maxCount = Math.max(...counts);

    const sx = (v: number): number => PAD.left + ((v - min) / range) * innerW;
    const sy = (c: number): number =>
      PAD.top + innerH - (c / Math.max(1, maxCount)) * innerH;

    const yTicks = niceTicks(0, maxCount, 3);
    const xTicks = niceTicks(min, niceMax, 5);
    const xFmt = attrs.xFmt ?? ((v: number) => `${Math.round(v)}`);

    const p50 = percentile(vs, 50);
    const p95 = percentile(vs, 95);
    const p99 = percentile(vs, 99);
    const markers: Array<{label: string; v: number; color: string}> = [
      {label: 'p50', v: p50, color: 'var(--sc-chart-2)'},
      {label: 'p95', v: p95, color: 'var(--sc-chart-3)'},
      {label: 'p99', v: p99, color: 'var(--sc-chart-4)'},
    ];

    const barW = Math.max(1, innerW / nBuckets - 2);

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
              String(Math.round(t)),
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
      m(
        'g.bars',
        counts
          .map((c, i) => ({c, i}))
          .filter((b) => b.c > 0)
          .map((b) =>
            m('rect', {
              key: b.i,
              x: sx(min + b.i * bw) + 1,
              y: sy(b.c),
              width: barW,
              height: PAD.top + innerH - sy(b.c),
              fill: 'var(--sc-chart-1)',
              opacity: 0.85,
            }),
          ),
      ),
      m(
        'g.markers',
        markers.map((mk) =>
          m('g', {key: mk.label}, [
            m('line', {
              x1: sx(mk.v),
              x2: sx(mk.v),
              y1: PAD.top,
              y2: PAD.top + innerH,
              stroke: mk.color,
              'vector-effect': 'non-scaling-stroke',
              'stroke-dasharray': '3 3',
            }),
            m(
              'text',
              {
                x: sx(mk.v) + 3,
                y: PAD.top + 10,
                'font-size': 10,
                fill: mk.color,
              },
              `${mk.label} ${xFmt(mk.v)}`,
            ),
          ]),
        ),
      ),
    );
  },
};

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
