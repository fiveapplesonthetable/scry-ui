// Logs page: left pane lists scry*.log files, right pane tails the
// selected one via SSE. Severity is heuristic (regex on the line).

import m from 'mithril';

import {cn} from '../base/classnames.js';
import {fmtBytes, fmtRelTime} from '../base/format.js';
import {refreshLogs, store} from '../core/store.js';

interface State {
  selected: string | null;
  lines: string[];
  source: EventSource | null;
  follow: boolean;
}

function classifyLine(line: string): string {
  if (/\b(ERROR|FATAL|panicked|panic:|Traceback)\b/i.test(line)) return 'sc-log-line--err';
  if (/\b(WARN|WARNING|deprecated)\b/i.test(line)) return 'sc-log-line--warn';
  return '';
}

export const LogsPage: m.ClosureComponent = () => {
  const state: State = {selected: null, lines: [], source: null, follow: true};

  function select(path: string): void {
    if (state.selected === path) return;
    state.selected = path;
    state.lines = [];
    if (state.source) {
      state.source.close();
      state.source = null;
    }
    const es = new EventSource(`/api/logs/tail?path=${encodeURIComponent(path)}`);
    state.source = es;
    es.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data) as {type: string; text?: string; message?: string};
        if (msg.type === 'seed' && msg.text) {
          state.lines = msg.text.split('\n');
        } else if (msg.type === 'chunk' && msg.text) {
          state.lines.push(...msg.text.split('\n'));
          if (state.lines.length > 5000) {
            state.lines = state.lines.slice(state.lines.length - 4000);
          }
        } else if (msg.type === 'error' && msg.message) {
          state.lines.push(`-- stream error: ${msg.message} --`);
        }
        m.redraw();
        if (state.follow) {
          requestAnimationFrame(() => {
            const view = document.querySelector('.sc-logs__view');
            if (view) view.scrollTop = view.scrollHeight;
          });
        }
      } catch {
        /* ignore */
      }
    };
  }

  return {
    oninit() {
      void refreshLogs();
    },
    onremove() {
      if (state.source) state.source.close();
    },
    view() {
      return m('.sc-logs', [
        m(
          '.sc-logs__list',
          {'data-test': 'logs-list'},
          store.logs.length === 0
            ? m('.sc-empty', 'No scry*.log files found in /mnt/agent or /var/log.')
            : store.logs.map((f) =>
                m(
                  '.sc-logs__item',
                  {
                    key: f.name,
                    class: cn({'sc-logs__item--active': state.selected === f.name}),
                    'data-test': 'log-item',
                    onclick: () => select(f.name),
                  },
                  [
                    m('.sc-logs__item-name', f.name),
                    m('.sc-logs__item-meta', `${fmtBytes(f.bytes)} · ${fmtRelTime(f.mtime_ms)}`),
                  ],
                ),
              ),
        ),
        state.selected
          ? m(
              '.sc-logs__view',
              {'data-test': 'logs-view'},
              state.lines.map((line, i) =>
                m('.sc-log-line', {key: i, class: classifyLine(line)}, line),
              ),
            )
          : m('.sc-logs__view', m('.sc-empty', 'Pick a log file from the left.')),
      ]);
    },
  };
};
