// Multi-series line chart. Renders at a logical 800×height viewBox
// and scales to container via CSS (width: 100%). All keyed elements
// live inside their own <g> wrapper so the SVG's direct children stay
// unkeyed — otherwise Mithril's diff trips the fragment-key rule.

import m from 'mithril';

export interface Series {
  label: string;
  color: string;
  points: Array<{x: number; y: number}>;
}

interface Attrs {
  series: Series[];
  height?: number;
  yLabel?: string;
  xLabel?: string;
  yMax?: number;
  yFmt?: (v: number) => string;
  xFmt?: (v: number) => string;
}

const VBW = 800;
const PAD = {top: 8, right: 14, bottom: 24, left: 44};

export const LineChart: m.Component<Attrs> = {
  view({attrs}) {
    const w = VBW;
    const h = attrs.height ?? 200;
    const innerW = w - PAD.left - PAD.right;
    const innerH = h - PAD.top - PAD.bottom;

    let xMin = Infinity,
      xMax = -Infinity,
      yMin = 0,
      yMax = 0;
    for (const s of attrs.series) {
      for (const p of s.points) {
        if (p.x < xMin) xMin = p.x;
        if (p.x > xMax) xMax = p.x;
        if (p.y > yMax) yMax = p.y;
      }
    }
    if (!isFinite(xMin)) {
      xMin = 0;
      xMax = 1;
    }
    if (attrs.yMax !== undefined) yMax = Math.max(yMax, attrs.yMax);
    if (yMax === yMin) yMax = yMin + 1;

    const sx = (x: number): number =>
      PAD.left + ((x - xMin) / Math.max(1, xMax - xMin)) * innerW;
    const sy = (y: number): number =>
      PAD.top + innerH - ((y - yMin) / Math.max(1, yMax - yMin)) * innerH;

    const yTicks = niceTicks(yMin, yMax, 4);
    const xTicks = niceTicks(xMin, xMax, 5);
    const yFmt = attrs.yFmt ?? ((v: number) => String(Math.round(v)));
    const xFmt = attrs.xFmt ?? ((v: number) => String(Math.round(v)));

    return m(
      'svg',
      {
        viewBox: `0 0 ${w} ${h}`,
        preserveAspectRatio: 'none',
        style: {width: '100%', height: `${h}px`, display: 'block'},
      },
      // Each top-level child of <svg> is a single unkeyed <g>; keyed
      // children live one level deeper so Mithril's diff doesn't see a
      // mixed-key fragment.
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
              yFmt(t),
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
        'g.series',
        attrs.series.map((s, i) => {
          const linePath = s.points
            .map(
              (p, idx) =>
                `${idx === 0 ? 'M' : 'L'}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`,
            )
            .join(' ');
          const last = s.points[s.points.length - 1];
          const first = s.points[0];
          const areaPath =
            s.points.length > 1 && last && first
              ? `${linePath} L${sx(last.x).toFixed(1)},${(PAD.top + innerH).toFixed(
                  1,
                )} L${sx(first.x).toFixed(1)},${(PAD.top + innerH).toFixed(1)} Z`
              : null;
          return m('g', {key: `s${i}`}, [
            areaPath
              ? m('path', {
                  d: areaPath,
                  fill: s.color,
                  opacity: 0.08,
                  stroke: 'none',
                })
              : null,
            m('path', {
              d: linePath,
              fill: 'none',
              stroke: s.color,
              'stroke-width': 1.5,
              'vector-effect': 'non-scaling-stroke',
              'stroke-linejoin': 'round',
              'stroke-linecap': 'round',
            }),
            m(
              'g.dots',
              s.points.map((p, j) =>
                m('circle', {
                  key: j,
                  cx: sx(p.x),
                  cy: sy(p.y),
                  r: 2,
                  fill: 'var(--sc-bg)',
                  stroke: s.color,
                  'vector-effect': 'non-scaling-stroke',
                  'stroke-width': 1.25,
                }),
              ),
            ),
          ]);
        }),
      ),
      m(
        'g.label',
        attrs.yLabel
          ? m(
              'text',
              {
                x: 12,
                y: PAD.top + innerH / 2,
                transform: `rotate(-90 12 ${PAD.top + innerH / 2})`,
                'text-anchor': 'middle',
                'font-size': 10,
                fill: 'var(--sc-text-dim)',
              },
              attrs.yLabel,
            )
          : null,
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
