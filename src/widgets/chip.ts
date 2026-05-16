// One-line label chip. Used for language and kind on result rows,
// and as a kbd-style hint in the cmd picker.

import m from 'mithril';

import {langColor} from '../base/format.js';

interface Attrs {
  text: string;
  /** When set, renders a tiny coloured dot using language palette. */
  lang?: string;
  title?: string;
}

export const Chip: m.Component<Attrs> = {
  view({attrs}) {
    return m(
      'span.sc-chip',
      {title: attrs.title ?? attrs.text},
      attrs.lang
        ? m('span', {
            style: {
              display: 'inline-block',
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: langColor(attrs.lang),
              marginRight: '4px',
              verticalAlign: 'middle',
            },
          })
        : null,
      attrs.text,
    );
  },
};
