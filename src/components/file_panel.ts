// Side panel showing the file around a clicked hit, with line numbers.
// Becomes a slide-over overlay on narrow viewports via CSS media query.

import m from 'mithril';

import {cn} from '../base/classnames.js';
import {shortPath} from '../base/format.js';
import {closeFile, store} from '../core/store.js';
import {Icon} from '../widgets/icon.js';

export const FilePanel: m.ClosureComponent = () => ({
  view() {
    const p = store.filePeek;
    if (!p.open) return null;
    return m('.sc-filepanel', [
      m('.sc-filepanel__head', [
        m('.sc-filepanel__path', {title: p.path}, shortPath(p.path, 6)),
        m('span.sc-filepanel__loc', `:${p.line}`),
        m(
          'button.sc-iconbtn',
          {
            title: 'Copy path:line',
            onclick: () =>
              navigator.clipboard?.writeText(`${p.path}:${p.line}`).catch(() => undefined),
          },
          m(Icon, {icon: 'copy', size: 12}),
        ),
        m(
          'button.sc-iconbtn',
          {
            title: 'Close (Esc)',
            'data-test': 'close-file',
            onclick: closeFile,
          },
          m(Icon, {icon: 'close', size: 12}),
        ),
      ]),
      m(
        '.sc-filepanel__body',
        p.busy
          ? m('.sc-empty', 'Loading…')
          : p.lines.map((text, i) => {
              const n = p.startLine + i;
              return m(
                '.sc-codeline',
                {key: n, class: cn({'sc-codeline--hit': n === p.line})},
                [m('.sc-codeline__num', n), m('.sc-codeline__txt', text)],
              );
            }),
      ),
    ]);
  },
});
