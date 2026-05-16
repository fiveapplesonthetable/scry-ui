// Settings: persisted server-side. Theme is a local override (no
// server round-trip to flip dark mode); density applies via
// data-density on <html>.

import m from 'mithril';

import type {UiSettings} from '../../shared/protocol.js';
import {applyTheme, refreshSettings, saveSettings, store} from '../core/store.js';

interface State {
  busy: boolean;
  message: string;
  draft: UiSettings;
  initd: boolean;
}

export const SettingsPage: m.ClosureComponent = () => {
  const state: State = {
    busy: false,
    message: '',
    draft: {...store.settings},
    initd: false,
  };

  async function init(): Promise<void> {
    if (state.initd) return;
    state.initd = true;
    await refreshSettings();
    state.draft = {...store.settings};
    m.redraw();
  }

  function set<K extends keyof UiSettings>(k: K, v: UiSettings[K]): void {
    state.draft = {...state.draft, [k]: v};
  }

  async function commit(): Promise<void> {
    state.busy = true;
    state.message = 'Saving…';
    m.redraw();
    try {
      await saveSettings(state.draft);
      document.documentElement.setAttribute('data-density', state.draft.density);
      state.message = 'Saved.';
    } catch (e) {
      state.message = `Save failed: ${String(e)}`;
    } finally {
      state.busy = false;
      m.redraw();
    }
  }

  return {
    oninit() {
      void init();
    },
    view() {
      const d = state.draft;
      return m('.sc-settings', [
        row('Index dir', m('input', {
          type: 'text',
          value: d.index_dir,
          'data-test': 'setting-index-dir',
          oninput: (e: Event) => set('index_dir', (e.target as HTMLInputElement).value),
        })),
        row('scry binary path', m('input', {
          type: 'text',
          value: d.scry_bin,
          oninput: (e: Event) => set('scry_bin', (e.target as HTMLInputElement).value),
        })),
        row('scry serve port', m('input', {
          type: 'number',
          value: String(d.scry_port),
          oninput: (e: Event) => set('scry_port', Number((e.target as HTMLInputElement).value)),
        })),
        row('Default result limit', m('input', {
          type: 'number',
          value: String(d.default_limit),
          oninput: (e: Event) => set('default_limit', Number((e.target as HTMLInputElement).value)),
        })),
        row(
          'Theme',
          m(
            'select',
            {
              value: d.theme,
              'data-test': 'setting-theme',
              onchange: (e: Event) => {
                const v = (e.target as HTMLSelectElement).value as UiSettings['theme'];
                set('theme', v);
                applyTheme(v);
              },
            },
            [
              m('option', {value: 'auto'}, 'auto'),
              m('option', {value: 'light'}, 'light'),
              m('option', {value: 'dark'}, 'dark'),
            ],
          ),
        ),
        row(
          'Density',
          m(
            'select',
            {
              value: d.density,
              onchange: (e: Event) => {
                const v = (e.target as HTMLSelectElement).value as UiSettings['density'];
                set('density', v);
                document.documentElement.setAttribute('data-density', v);
              },
            },
            [
              m('option', {value: 'cozy'}, 'cozy'),
              m('option', {value: 'compact'}, 'compact'),
            ],
          ),
        ),

        m('.sc-divider'),

        m(
          'div',
          {style: {display: 'flex', gap: '10px', alignItems: 'center', maxWidth: '720px'}},
          [
            m(
              'button.sc-action',
              {
                disabled: state.busy,
                onclick: () => void commit(),
                'data-test': 'save-settings',
              },
              state.busy ? 'Saving…' : 'Save',
            ),
            m(
              'button.sc-action',
              {
                style: {color: 'var(--sc-text-dim)', borderColor: 'var(--sc-border)'},
                onclick: () => {
                  state.draft = {...store.settings};
                  state.message = '';
                  m.redraw();
                },
              },
              'Reset',
            ),
            m(
              'span',
              {style: {color: 'var(--sc-text-mute)', fontSize: 'var(--sc-fs-sm)'}},
              state.message,
            ),
          ],
        ),
      ]);
    },
  };
};

function row(label: string, control: m.Vnode): m.Vnode {
  return m('.sc-settings__row', [m('label', label), control]);
}
