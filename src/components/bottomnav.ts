// Mobile bottom navigation. Five large tap-targets, one per page.
// Always rendered; CSS hides it above 720 px.

import m from 'mithril';

import {cn} from '../base/classnames.js';
import {goto, store} from '../core/store.js';
import {Icon} from '../widgets/icon.js';

const TABS: Array<{
  id: typeof store.page;
  label: string;
  icon: 'search' | 'chart' | 'logs' | 'settings' | 'health';
}> = [
  {id: 'search', label: 'Search', icon: 'search'},
  {id: 'dashboard', label: 'Stats', icon: 'chart'},
  {id: 'logs', label: 'Logs', icon: 'logs'},
  {id: 'settings', label: 'Settings', icon: 'settings'},
  {id: 'health', label: 'Health', icon: 'health'},
];

export const Bottomnav: m.ClosureComponent = () => ({
  view() {
    // When the file viewer is open, the bottom nav is replaced by an
    // implicit "back" via the FilePage's own header. We still render
    // the nav so URL routes stay accessible by tap.
    const current: typeof store.page = store.page === 'file' ? 'search' : store.page;
    return m(
      'nav.sc-bottomnav',
      TABS.map((t) =>
        m(
          'a.sc-bottomnav__tab',
          {
            key: t.id,
            href: `#/${t.id}`,
            class: cn({'sc-bottomnav__tab--active': current === t.id}),
            onclick: (e: MouseEvent) => {
              e.preventDefault();
              goto(t.id);
            },
            'data-test': `bnav-${t.id}`,
          },
          [m(Icon, {icon: t.icon, size: 20}), m('span', t.label)],
        ),
      ),
    );
  },
});
