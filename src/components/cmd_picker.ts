// Verb-token + dropdown — integrated into the input row in
// search.ts. This file owns just the popup menu; the trigger and
// state live in the page so the input flows correctly.

import m from 'mithril';

import {COMMANDS, type CommandDef, type CommandId} from '../../shared/protocol.js';
import {cn} from '../base/classnames.js';
import {setCmd, store} from '../core/store.js';
import {Icon} from '../widgets/icon.js';

interface State {
  open: boolean;
}

const GROUP_LABEL: Record<CommandDef['kind'], string> = {
  search: 'Search',
  file: 'File',
  repo: 'Repo',
  history: 'History',
};

const KINDS: Array<CommandDef['kind']> = ['search', 'file', 'repo', 'history'];

function byKind(kind: CommandDef['kind']): CommandDef[] {
  return COMMANDS.filter((c) => c.kind === kind);
}

export const VerbToken: m.ClosureComponent = () => {
  const state: State = {open: false};
  const onClickAway = (e: MouseEvent): void => {
    const t = e.target as HTMLElement;
    if (!t.closest('.sc-verb') && !t.closest('.sc-verbmenu')) {
      state.open = false;
      document.removeEventListener('mousedown', onClickAway);
      m.redraw();
    }
  };
  return {
    view() {
      const current = COMMANDS.find((c) => c.id === store.search.cmd) ?? COMMANDS[0]!;
      return m(
        '.sc-verb-wrap',
        m(
          'button.sc-verb',
          {
            'data-test': 'cmd-picker-btn',
            title: 'Switch command',
            onclick: () => {
              state.open = !state.open;
              if (state.open) document.addEventListener('mousedown', onClickAway);
              else document.removeEventListener('mousedown', onClickAway);
            },
          },
          [
            m('span.sc-verb__name', current.id),
            m(Icon, {icon: 'chevronDown', size: 12}),
          ],
        ),
        state.open
          ? m(
              '.sc-verbmenu',
              {'data-test': 'cmd-picker-menu'},
              KINDS.flatMap((k) => [
                m('.sc-verbmenu__group', {key: `g${k}`}, GROUP_LABEL[k]),
                ...byKind(k).map((c) =>
                  m(
                    '.sc-verbmenu__item',
                    {
                      key: c.id,
                      class: cn({'sc-verbmenu__item--active': c.id === current.id}),
                      'data-test': `cmd-item-${c.id}`,
                      onclick: () => {
                        setCmd(c.id as CommandId);
                        state.open = false;
                        document.removeEventListener('mousedown', onClickAway);
                      },
                    },
                    [m('span', c.id), m('span.sc-verbmenu__id', c.label)],
                  ),
                ),
              ]),
            )
          : null,
      );
    },
  };
};
