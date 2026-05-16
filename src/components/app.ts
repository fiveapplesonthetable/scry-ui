// App shell: top bar + page outlet + bottom nav (mobile).

import m from 'mithril';

import {store} from '../core/store.js';

import {DashboardPage} from '../pages/dashboard.js';
import {FilePage} from '../pages/file.js';
import {HealthPage} from '../pages/health.js';
import {LogsPage} from '../pages/logs.js';
import {SearchPage} from '../pages/search.js';
import {SettingsPage} from '../pages/settings.js';
import {Bottomnav} from './bottomnav.js';
import {Topbar} from './topbar.js';

export const App: m.ClosureComponent = () => ({
  view() {
    let page: m.Vnode;
    switch (store.page) {
      case 'search':
        page = m(SearchPage);
        break;
      case 'dashboard':
        page = m(DashboardPage);
        break;
      case 'logs':
        page = m(LogsPage);
        break;
      case 'settings':
        page = m(SettingsPage);
        break;
      case 'health':
        page = m(HealthPage);
        break;
      case 'file':
        page = m(FilePage);
        break;
    }
    return m('.sc-app', [m(Topbar), m('.sc-page', page), m(Bottomnav)]);
  },
});
