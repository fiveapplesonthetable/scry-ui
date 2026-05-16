// Multi-series line chart with axes, gridlines, and hover-readouts.
// Pure SVG — no chart library. Designed for latency-over-time.

import m from 'mithril';

export interface Series {
  label: string;
  color: string;
  /** Points sorted by x. */
  points: Array<{x: number; y: number}>;
}

interface Attrs {
  series: Series[];
  /** Total SVG size; chart area is inset by `pad`. */
  width?: number;
  height?: number;
  yLabel?: string;
  xLabel?: string;
  /** Force a max on Y (e.g. clamp to 99th percentile). */
  yMax?: number;
  /** Format y-tick values. */
  yFmt?: (v: number) => string;
  /** Format x-tick values. */
  xFmt?: (v: number) => string;
}

const PAD = {top: 8, right: 8, bottom: 22, left: 44};

export const LineChart: m.Component<Attrs> = {
  view({attrs}) {
    const w = attrs.width ?? 520;
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
    const xTicks = niceXTicks(xMin, xMax, 4);
    const yFmt = attrs.yFmt ?? ((v: number) => String(Math.round(v)));
    const xFmt = attrs.xFmt ?? ((v: number) => String(Math.round(v)));

    return m(
      'svg',
      {width: w, height: h, viewBox: `0 0 ${w} ${h}`},
      // Gridlines + y labels
      yTicks.map((t) =>
        m('g', {key: `y${t}`}, [
          m('line', {
            x1: PAD.left,
            x2: PAD.left + innerW,
            y1: sy(t),
            y2: sy(t),
            stroke: 'var(--sc-chart-grid)',
            'stroke-width': 1,
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
      // x axis baseline
      m('line', {
        x1: PAD.left,
        x2: PAD.left + innerW,
        y1: PAD.top + innerH,
        y2: PAD.top + innerH,
        stroke: 'var(--sc-chart-axis)',
        'stroke-width': 1,
      }),
      xTicks.map((t) =>
        m('g', {key: `x${t}`}, [
          m('line', {
            x1: sx(t),
            x2: sx(t),
            y1: PAD.top + innerH,
            y2: PAD.top + innerH + 3,
            stroke: 'var(--sc-chart-axis)',
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
      // Series lines + dots
      attrs.series.map((s, i) =>
        m('g', {key: `s${i}`}, [
          m('path', {
            d: s.points
              .map((p, idx) => `${idx === 0 ? 'M' : 'L'}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`)
              .join(' '),
            fill: 'none',
            stroke: s.color,
            'stroke-width': 1.5,
            'stroke-linejoin': 'round',
          }),
          s.points.map((p, j) =>
            m('circle', {
              key: j,
              cx: sx(p.x),
              cy: sy(p.y),
              r: 1.8,
              fill: s.color,
            }),
          ),
        ]),
      ),
      // axis labels
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
      attrs.xLabel
        ? m(
            'text',
            {
              x: PAD.left + innerW / 2,
              y: h - 2,
              'text-anchor': 'middle',
              'font-size': 10,
              fill: 'var(--sc-text-dim)',
            },
            attrs.xLabel,
          )
        : null,
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

function niceXTicks(min: number, max: number, target: number): number[] {
  return niceTicks(min, max, target);
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
