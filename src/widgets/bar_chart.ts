// Horizontal bar chart. Rows are label/value pairs; the longest value
// pins to 100% width. Used for "calls per command" and
// "files per language" on the dashboard.

import m from 'mithril';

import {fmtCount} from '../base/format.js';

export interface BarRow {
  label: string;
  value: number;
  color?: string;
  /** Optional sub-label rendered after the label. */
  sub?: string;
}

interface Attrs {
  rows: BarRow[];
  /** Override the implicit max (default: max of rows). */
  max?: number;
  fmt?: (v: number) => string;
}

export const BarChart: m.Component<Attrs> = {
  view({attrs}) {
    if (attrs.rows.length === 0) {
      return m('.sc-empty', 'No data yet');
    }
    const max = attrs.max ?? Math.max(...attrs.rows.map((r) => r.value), 1);
    const fmt = attrs.fmt ?? fmtCount;
    return m(
      'div',
      attrs.rows.map((r) =>
        m('.sc-bar-row', {key: r.label, title: `${r.label}: ${fmt(r.value)}`}, [
          m('div', [r.label, r.sub ? m('span', {style: {color: 'var(--sc-text-mute)', marginLeft: '6px'}}, r.sub) : null]),
          m(
            '.sc-bar',
            m('.sc-bar__fill', {
              style: {
                width: `${(r.value / max) * 100}%`,
                background: r.color ?? 'var(--sc-accent)',
              },
            }),
          ),
          m('div', {style: {textAlign: 'right'}}, fmt(r.value)),
        ]),
      ),
    );
  },
};
