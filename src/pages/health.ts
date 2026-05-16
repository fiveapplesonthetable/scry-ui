// Health page: backend uptime, RSS, scry-serve connection status,
// recent scry stderr lines.

import m from 'mithril';

import {fmtBytes, fmtMs, fmtRelTime} from '../base/format.js';
import {refreshHealth, store} from '../core/store.js';

export const HealthPage: m.ClosureComponent = () => {
  let timer: number | null = null;
  return {
    oninit() {
      void refreshHealth();
      timer = window.setInterval(() => void refreshHealth(), 4000);
    },
    onremove() {
      if (timer != null) window.clearInterval(timer);
    },
    view() {
      const h = store.health;
      const m_ = store.metrics;
      const totalCalls = m_ ? Object.values(m_.counts).reduce((a, b) => a + b, 0) : 0;
      return m('.sc-health', [
        m('.sc-dash__kpi', [
          kpi('backend', h ? 'up' : '—', h ? `${fmtMs(h.uptime_ms)} uptime` : ''),
          kpi(
            'scry serve',
            h?.scry_connected ? 'connected' : 'disconnected',
            m_?.scry_last_restart_ms
              ? `restart ${fmtRelTime(m_.scry_last_restart_ms)}`
              : 'no restarts',
            h?.scry_connected ? 'var(--sc-ok)' : 'var(--sc-err)',
          ),
          kpi('rss', m_ ? fmtBytes(m_.rss_bytes) : '—', 'node process'),
          kpi('queries', String(totalCalls), 'session'),
        ]),
        m('.sc-section', [
          m('h3.sc-section__title', 'scry stderr (last 200 lines)'),
          m(
            'pre.sc-pre',
            {style: {maxHeight: '460px'}, 'data-test': 'scry-stderr'},
            store.scryStderr.length === 0 ? '(empty)' : store.scryStderr.join('\n'),
          ),
        ]),
      ]);
    },
  };
};

function kpi(label: string, value: string, sub?: string, valueColor?: string): m.Vnode {
  return m('.sc-dash__kpi-item', [
    m('span.sc-dash__kpi-label', label),
    m(
      'span.sc-dash__kpi-value',
      {style: valueColor ? {color: valueColor} : undefined},
      value,
    ),
    sub
      ? m('span', {style: {color: 'var(--sc-text-mute)', fontSize: 'var(--sc-fs-xs)'}}, sub)
      : null,
  ]);
}
