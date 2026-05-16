// Autocomplete dropdown anchored under the combobox input.
// Solid background, hairline border, no shadow. Shows symbol name,
// [kind] [lang] chips, and the file path.

import m from 'mithril';

import {cn} from '../base/classnames.js';
import {shortPath} from '../base/format.js';
import {pickSuggestion, store} from '../core/store.js';

export const Autocomplete: m.ClosureComponent = () => ({
  view() {
    const s = store.search;
    if (!s.suggestOpen || s.suggestions.length === 0) return null;
    return m(
      '.sc-autocomplete',
      {'data-test': 'autocomplete'},
      s.suggestions.map((sug, i) =>
        m(
          '.sc-ac-row',
          {
            key: i,
            class: cn({'sc-ac-row--active': i === s.suggestionIdx}),
            'data-test': 'ac-row',
            onclick: () => pickSuggestion(sug),
            onmouseenter: () => {
              s.suggestionIdx = i;
            },
          },
          [
            m('span.sc-ac-row__name', sug.name ?? '(unnamed)'),
            m('span.sc-ac-row__meta', [
              sug.kind ? m('span.sc-tag', sug.kind) : null,
              sug.lang ? m('span.sc-tag.sc-tag--lang', sug.lang) : null,
            ]),
            sug.path
              ? m('span.sc-ac-row__path', shortPath(sug.path, 5))
              : null,
          ],
        ),
      ),
    );
  },
});
