// Tiny SVG line/area sparkline. No axis labels — for at-a-glance trends.

import m from 'mithril';

interface Attrs {
  values: number[];
  width?: number;
  height?: number;
  color?: string;
  /** Filled area under the line. */
  area?: boolean;
}

export const Sparkline: m.Component<Attrs> = {
  view({attrs}) {
    const w = attrs.width ?? 120;
    const h = attrs.height ?? 28;
    const vs = attrs.values;
    if (vs.length === 0) {
      return m('svg', {width: w, height: h});
    }
    const min = Math.min(...vs);
    const max = Math.max(...vs);
    const span = Math.max(1, max - min);
    const step = vs.length > 1 ? w / (vs.length - 1) : 0;
    const pts = vs.map((v, i) => {
      const x = i * step;
      const y = h - ((v - min) / span) * (h - 2) - 1;
      return [x, y] as const;
    });
    const line = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
    const area = attrs.area
      ? `${line} L${w.toFixed(1)},${h} L0,${h} Z`
      : null;
    const stroke = attrs.color ?? 'var(--sc-accent)';
    return m(
      'svg',
      {width: w, height: h, viewBox: `0 0 ${w} ${h}`, preserveAspectRatio: 'none'},
      area
        ? m('path', {d: area, fill: stroke, opacity: 0.15, stroke: 'none'})
        : null,
      m('path', {d: line, fill: 'none', stroke, 'stroke-width': 1.5, 'stroke-linejoin': 'round'}),
    );
  },
};
