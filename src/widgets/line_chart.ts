// Multi-series line chart. Measures its container on mount + resize
// (ResizeObserver) and re-renders natively at the container width so
// axis labels stay at the same pixel size regardless of viewport.

import m from 'mithril';

export interface Series {
  label: string;
  color: string;
  /** Points sorted by x. */
  points: Array<{x: number; y: number}>;
}

interface Attrs {
  series: Series[];
  /** Default canvas height. */
  height?: number;
  yLabel?: string;
  xLabel?: string;
  yMax?: number;
  yFmt?: (v: number) => string;
  xFmt?: (v: number) => string;
  /** If set, never grow wider than this. */
  maxWidth?: number;
}

const PAD = {top: 8, right: 12, bottom: 24, left: 44};

export const LineChart: m.ClosureComponent<Attrs> = () => {
  let width = 0;
  let ro: ResizeObserver | null = null;
  let outer: HTMLElement | null = null;
  return {
    oncreate(vnode) {
      outer = vnode.dom as HTMLElement;
      const measure = (): void => {
        const next = Math.max(120, Math.floor(outer!.getBoundingClientRect().width));
        if (next !== width) {
          width = next;
          m.redraw();
        }
      };
      measure();
      ro = new ResizeObserver(measure);
      ro.observe(outer);
    },
    onremove() {
      if (ro && outer) ro.unobserve(outer);
      ro = null;
    },
    view({attrs}) {
      const w = attrs.maxWidth ? Math.min(width || 600, attrs.maxWidth) : (width || 600);
      const h = attrs.height ?? 200;
      const innerW = Math.max(40, w - PAD.left - PAD.right);
      const innerH = Math.max(40, h - PAD.top - PAD.bottom);

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
      const xTicks = niceTicks(xMin, xMax, Math.min(5, Math.max(2, Math.floor(innerW / 100))));
      const yFmt = attrs.yFmt ?? ((v: number) => String(Math.round(v)));
      const xFmt = attrs.xFmt ?? ((v: number) => String(Math.round(v)));

      return m(
        'div',
        {style: {width: '100%'}},
        m(
          'svg',
          {
            // Render natively at measured pixel width — no viewBox
            // scaling so axis labels stay at their declared font-size
            // and gridlines stay 1 px regardless of viewport.
            width: w,
            height: h,
            style: {display: 'block'},
          },
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
          attrs.series.map((s, i) => {
            const linePath = s.points
              .map(
                (p, idx) => `${idx === 0 ? 'M' : 'L'}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`,
              )
              .join(' ');
            const areaPath =
              s.points.length > 1
                ? `${linePath} L${sx(s.points[s.points.length - 1]!.x).toFixed(
                    1,
                  )},${(PAD.top + innerH).toFixed(1)} L${sx(s.points[0]!.x).toFixed(
                    1,
                  )},${(PAD.top + innerH).toFixed(1)} Z`
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
                'stroke-linejoin': 'round',
                'stroke-linecap': 'round',
              }),
              s.points.map((p, j) =>
                m('circle', {
                  key: j,
                  cx: sx(p.x),
                  cy: sy(p.y),
                  r: 2,
                  fill: 'var(--sc-bg)',
                  stroke: s.color,
                  'stroke-width': 1.25,
                }),
              ),
            ]);
          }),
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
        ),
      );
    },
  };
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
