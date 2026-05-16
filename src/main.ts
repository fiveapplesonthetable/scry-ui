// Browser entry. Mount the app, kick off background pollers.

import m from 'mithril';

import {App} from './components/app.js';
import {
  applyTheme,
  refreshHealth,
  refreshIndex,
  refreshSettings,
  startMetricsPolling,
  store,
} from './core/store.js';
import './styles/app.scss';

const root = document.getElementById('app');
if (!root) {
  throw new Error('no #app');
}

// Apply persisted theme (script in index.html set the attribute pre-paint;
// this also wires the system-pref listener for auto mode).
applyTheme(store.theme);
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  if (store.theme === 'auto') applyTheme('auto');
});

m.mount(root, App);

// Hydrate.
void refreshSettings().then(() => {
  document.documentElement.setAttribute('data-density', store.settings.density);
  if (store.settings.theme !== store.theme) {
    applyTheme(store.settings.theme);
  }
});
void refreshIndex();
void refreshHealth();
startMetricsPolling();
