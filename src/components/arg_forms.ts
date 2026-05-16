// Per-command argument forms. Each command has its own arg set;
// rather than one giant union, we render a small subset of fields
// keyed off `store.search.cmd`. The query box (the big primary input)
// always takes the "main" arg of the command — `pattern`, `name`,
// `prefix`, `query`, `path`, or `since` depending on the cmd.

import m from 'mithril';

import type {CommandId} from '../../shared/protocol.js';
import {setArg, store} from '../core/store.js';

/** Which arg name is the primary text input for this command. */
export const PRIMARY_ARG: Record<CommandId, string> = {
  def: 'name',
  ref: 'name',
  callers: 'name',
  prefix: 'prefix',
  fuzzy: 'query',
  grep: 'pattern',
  ask: 'query',
  outline: 'path',
  tldr: 'path',
  coverage: 'path',
  owner: 'path',
  'module-of': 'path',
  recall: 'window',
  diff: 'since',
};

/** Human placeholder for the primary input. */
export const PRIMARY_PLACEHOLDER: Record<CommandId, string> = {
  def: 'Symbol name (e.g. ActivityManagerService)',
  ref: 'Symbol name to find references for',
  callers: 'Function name (callers will be listed)',
  prefix: 'Symbol prefix',
  fuzzy: 'Typo-tolerant query',
  grep: 'Substring or regex',
  ask: 'Natural-language question',
  outline: 'Absolute file path',
  tldr: 'Absolute file path',
  coverage: 'Directory path inside an indexed root',
  owner: 'Absolute file path',
  'module-of': 'Absolute file path',
  recall: 'Window, e.g. "10 minutes"',
  diff: 'Git ref (since), e.g. main',
};

const LANGS = [
  '',
  'Java',
  'Kotlin',
  'Cpp',
  'C',
  'Rust',
  'Go',
  'Python',
  'Shell',
  'Aidl',
  'Hidl',
  'Soong',
  'Bazel',
  'Make',
  'CMake',
  'Gn',
];

const KINDS_BY_LANG = [
  '',
  'class',
  'struct',
  'fn',
  'method',
  'enum',
  'trait',
  'interface',
  'ctor',
  'macro',
  'var',
];

interface Field {
  key: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'check';
  options?: string[];
  placeholder?: string;
  // Derived value resolver
  get?: () => string | number | boolean | undefined;
}

function fields(cmd: CommandId): Field[] {
  const common: Field[] = [
    {
      key: 'limit',
      label: 'limit',
      type: 'number',
      placeholder: String(store.settings.default_limit),
    },
  ];
  switch (cmd) {
    case 'def':
      return [
        {key: 'kind', label: 'kind', type: 'select', options: KINDS_BY_LANG},
        {key: 'lang', label: 'lang', type: 'select', options: LANGS},
        {key: 'in', label: 'in path', type: 'text', placeholder: 'frameworks/base/'},
        ...common,
      ];
    case 'ref':
    case 'callers':
      return [
        {key: 'lang', label: 'lang', type: 'select', options: LANGS},
        {key: 'in', label: 'in path', type: 'text', placeholder: ''},
        ...common,
      ];
    case 'prefix':
      return [{key: 'lang', label: 'lang', type: 'select', options: LANGS}, ...common];
    case 'fuzzy':
      return [
        {key: 'distance', label: 'distance', type: 'number', placeholder: '2'},
        {key: 'lang', label: 'lang', type: 'select', options: LANGS},
        ...common,
      ];
    case 'grep':
      return [
        {key: 'regex', label: 'regex', type: 'check'},
        {key: 'lang', label: 'lang', type: 'select', options: LANGS},
        {key: 'in', label: 'in path', type: 'text', placeholder: ''},
        ...common,
      ];
    case 'ask':
      return [...common];
    case 'coverage':
      return [...common];
    case 'owner':
      return [{key: 'includeDeep', label: 'include deep', type: 'check'}];
    case 'outline':
    case 'tldr':
    case 'module-of':
      return [];
    case 'recall':
      return [...common];
    case 'diff':
      return [{key: 'thenCallers', label: 'then callers', type: 'check'}, ...common];
  }
}

export const ArgForm: m.ClosureComponent = () => ({
  view() {
    const cmd = store.search.cmd;
    const fs = fields(cmd);
    if (fs.length === 0) return null;
    return m(
      '.sc-filters',
      fs.map((f) => {
        const v = store.search.args[f.key];
        if (f.type === 'check') {
          return m(
            '.sc-filter',
            {key: f.key},
            m('label', [
              m('input', {
                type: 'checkbox',
                checked: Boolean(v),
                'data-test': `arg-${f.key}`,
                onchange: (e: Event) => setArg(f.key, (e.target as HTMLInputElement).checked),
              }),
              ' ',
              f.label,
            ]),
          );
        }
        if (f.type === 'select') {
          return m('.sc-filter', {key: f.key}, [
            m('label', f.label),
            m(
              'select',
              {
                'data-test': `arg-${f.key}`,
                value: typeof v === 'string' ? v : '',
                onchange: (e: Event) =>
                  setArg(f.key, (e.target as HTMLSelectElement).value || undefined),
              },
              (f.options ?? []).map((o) => m('option', {key: o, value: o}, o || 'any')),
            ),
          ]);
        }
        return m('.sc-filter', {key: f.key}, [
          m('label', f.label),
          m('input', {
            type: f.type === 'number' ? 'number' : 'text',
            placeholder: f.placeholder ?? '',
            value: v ?? '',
            'data-test': `arg-${f.key}`,
            style: {width: f.type === 'number' ? '70px' : '160px'},
            oninput: (e: Event) => {
              const raw = (e.target as HTMLInputElement).value;
              if (raw === '') setArg(f.key, undefined);
              else if (f.type === 'number') setArg(f.key, Number(raw));
              else setArg(f.key, raw);
            },
          }),
        ]);
      }),
    );
  },
});
