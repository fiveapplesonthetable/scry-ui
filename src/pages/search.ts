// Search page: verb-input combobox, optional filters strip,
// file-grouped results, file panel as a side column (or slide-over
// overlay on narrow viewports — handled by CSS).

import m from 'mithril';

import {
  acceptSuggestion,
  dismissSuggestions,
  inputChanged,
  moveSelection,
  moveSuggestion,
  openSelected,
  runQuery,
  setArg,
  store,
  toggleFilters,
} from '../core/store.js';
import {ArgForm, PRIMARY_ARG, PRIMARY_PLACEHOLDER} from '../components/arg_forms.js';
import {Autocomplete} from '../components/autocomplete.js';
import {VerbToken} from '../components/cmd_picker.js';
import {Results, statusLine} from '../components/results.js';

function countActiveFilters(): number {
  let n = 0;
  const primary = PRIMARY_ARG[store.search.cmd];
  for (const [k, v] of Object.entries(store.search.args)) {
    if (k === primary) continue;
    if (v === undefined || v === '' || v === false) continue;
    n++;
  }
  return n;
}

/** Filters that should always be visible inline for the given command. */
const HAS_FILTERS: Record<string, boolean> = {
  def: true,
  ref: true,
  callers: true,
  prefix: true,
  fuzzy: true,
  grep: true,
  coverage: true,
  owner: true,
  diff: true,
};

export const SearchPage: m.ClosureComponent = () => {
  let inputEl: HTMLInputElement | null = null;
  return {
    oncreate() {
      // Focus the input on mount so the user can just start typing.
      inputEl?.focus();
    },
    view() {
      const cmd = store.search.cmd;
      const primary = PRIMARY_ARG[cmd];
      const value = store.search.args[primary];
      const activeFilters = countActiveFilters();
      const r = store.search.response;
      return m('.sc-search', [
        // Verb + input + filters affordance, plus autocomplete dropdown.
        m('.sc-combobox', [
          m(VerbToken),
          m('input.sc-combobox__input', {
            type: 'text',
            placeholder: PRIMARY_PLACEHOLDER[cmd],
            value:
              typeof value === 'string'
                ? value
                : value !== undefined
                  ? String(value)
                  : '',
            'data-test': 'primary-input',
            oncreate: (vnode: m.VnodeDOM) => {
              inputEl = vnode.dom as HTMLInputElement;
            },
            oninput: (e: Event) => {
              const v = (e.target as HTMLInputElement).value;
              setArg(primary, v);
              inputChanged(v);
            },
            onkeydown: (e: KeyboardEvent) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                moveSuggestion(1);
                return;
              }
              if (e.key === 'ArrowUp') {
                e.preventDefault();
                moveSuggestion(-1);
                return;
              }
              if (e.key === 'Escape') {
                dismissSuggestions();
                return;
              }
              if (e.key === 'Enter') {
                if (acceptSuggestion()) return;
                void runQuery();
              }
            },
            onblur: () => {
              // Delay so click on a suggestion still fires.
              window.setTimeout(() => dismissSuggestions(), 120);
            },
          }),
          m(
            'button.sc-filters-btn',
            {
              class: store.search.filtersOpen ? 'sc-filters-btn--on' : '',
              onclick: () => toggleFilters(),
              'data-test': 'filters-toggle',
              title: 'Toggle filter row',
            },
            activeFilters > 0 ? `Filters (${activeFilters})` : 'Filters',
          ),
          m(Autocomplete),
        ]),

        // Filter row: always shown for commands that take filters; the
        // toggle button just collapses or expands it. Commands with no
        // filters (outline / tldr / module-of / ask) hide it entirely.
        HAS_FILTERS[cmd] && store.search.filtersOpen ? m(ArgForm) : null,

        m('.sc-results__col', [
          m(Results),
          r ? m('.sc-results__footer', {'data-test': 'status-line'}, statusLine(r)) : null,
        ]),
      ]);
    },
  };
};

// Page-level keyboard shortcuts — installed once at module load.
window.addEventListener('keydown', (e) => {
  // Ignore when typing into an input/textarea/select (except when our
  // own input handler explicitly returned).
  const tag = (e.target as HTMLElement | null)?.tagName ?? '';
  const editable = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';

  // Esc on the file page goes back to the previous page (usually search).
  if (e.key === 'Escape' && store.page === 'file') {
    e.preventDefault();
    if (history.length > 1) history.back();
    else location.hash = '#/search';
    return;
  }

  // `/` focuses the primary input regardless of page (jumps back to search).
  if (e.key === '/' && !editable) {
    e.preventDefault();
    if (store.page !== 'search') {
      location.hash = '#/search';
    }
    requestAnimationFrame(() => {
      const el = document.querySelector(
        "[data-test='primary-input']",
      ) as HTMLInputElement | null;
      el?.focus();
      el?.select();
    });
    return;
  }

  if (store.page !== 'search') return;

  if (e.key === 'Escape') {
    if (store.search.suggestOpen) {
      dismissSuggestions();
      e.preventDefault();
    }
    return;
  }

  if (!editable) {
    if (e.key === 'j') {
      moveSelection(1);
      e.preventDefault();
    } else if (e.key === 'k') {
      moveSelection(-1);
      e.preventDefault();
    } else if (e.key === 'Enter') {
      openSelected();
      e.preventDefault();
    }
  }
});
