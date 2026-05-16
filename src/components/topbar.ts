// Top navigation bar: brand, tab strip, scry-connection dot, theme cycler.
// Tab labels collapse to icon-only below 760px (handled by CSS).

import m from 'mithril';

import {cn} from '../base/classnames.js';
import {applyTheme, goto, store, type Theme} from '../core/store.js';
import {Icon} from '../widgets/icon.js';

const TABS: Array<{
  id: typeof store.page;
  label: string;
  icon: 'search' | 'chart' | 'logs' | 'settings' | 'health';
}> = [
  {id: 'search', label: 'Search', icon: 'search'},
  {id: 'dashboard', label: 'Dashboard', icon: 'chart'},
  {id: 'logs', label: 'Logs', icon: 'logs'},
  {id: 'settings', label: 'Settings', icon: 'settings'},
  {id: 'health', label: 'Health', icon: 'health'},
];

const THEME_ORDER: Theme[] = ['auto', 'light', 'dark'];

export const Topbar: m.ClosureComponent = () => ({
  view() {
    const themeIcon =
      store.theme === 'dark' ? 'moon' : store.theme === 'light' ? 'sun' : 'auto';
    const ok = store.health?.scry_connected ?? store.metrics?.scry_connected;
    return m('.sc-topbar', [
      m('.sc-brand', [m('.sc-brand__mark'), m('span', 'scry')]),
      m(
        '.sc-tabs',
        TABS.map((t) =>
          m(
            'a.sc-tab',
            {
              key: t.id,
              href: `#/${t.id}`,
              class: cn({'sc-tab--active': store.page === t.id}),
              title: t.label,
              onclick: (e: MouseEvent) => {
                e.preventDefault();
                goto(t.id);
              },
            },
            [m(Icon, {icon: t.icon, size: 14}), m('span.sc-tab__label', t.label)],
          ),
        ),
      ),
      m('.sc-topbar__right', [
        m('.sc-status', {title: ok ? 'scry serve connected' : 'scry serve down'}, [
          m('span.sc-dot', {class: ok ? 'sc-dot--ok' : 'sc-dot--err'}),
          m('span', ok === undefined ? '…' : ok ? 'connected' : 'down'),
        ]),
        m(
          'button.sc-theme-btn',
          {
            title: `Theme: ${store.theme}`,
            'data-test': 'theme-toggle',
            onclick: () => {
              const idx = THEME_ORDER.indexOf(store.theme);
              const next = THEME_ORDER[(idx + 1) % THEME_ORDER.length];
              if (next) applyTheme(next);
            },
          },
          m(Icon, {icon: themeIcon, size: 14}),
        ),
      ]),
    ]);
  },
});
