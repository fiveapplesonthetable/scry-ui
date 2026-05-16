// Results list — flat by default, can be grouped by file. Each hit
// row carries data-hit-idx so keyboard nav can scroll it into view.

import m from 'mithril';

import type {Hit, QueryResponse} from '../../shared/protocol.js';
import {cn} from '../base/classnames.js';
import {fmtMs, shortPath} from '../base/format.js';
import {openFile, store} from '../core/store.js';

interface FileGroup {
  path: string;
  hits: Array<{hit: Hit; idx: number}>;
}

function groupByFile(hits: Hit[]): FileGroup[] {
  const map = new Map<string, FileGroup>();
  hits.forEach((hit, idx) => {
    const path = hit.path ?? '(unknown)';
    let g = map.get(path);
    if (!g) {
      g = {path, hits: []};
      map.set(path, g);
    }
    g.hits.push({hit, idx});
  });
  return [...map.values()];
}

export const Results: m.ClosureComponent = () => ({
  view() {
    const {response, busy, selected} = store.search;
    if (busy) {
      return m('.sc-results__list', m('.sc-empty', 'Running…'));
    }
    if (!response) {
      return m(
        '.sc-results__list',
        m(
          '.sc-empty',
          [
            m('div', 'Pick a command, type a query, hit Enter.'),
            m(
              'div',
              {style: {marginTop: '8px', fontSize: 'var(--sc-fs-sm)', color: 'var(--sc-text-mute)'}},
              'Examples: grep ZygoteInit · def ActivityManagerService · callers transact',
            ),
          ],
        ),
      );
    }
    if (response.one !== undefined) {
      return m(
        '.sc-results__list',
        m(
          'div',
          {style: {padding: '12px 14px'}},
          m('pre.sc-pre', JSON.stringify(response.one, null, 2)),
        ),
      );
    }
    if (response.hits.length === 0) {
      return m('.sc-results__list', m('.sc-empty', 'No results'));
    }

    const groups = groupByFile(response.hits);
    return m(
      '.sc-results__list',
      {'data-test': 'results-list'},
      groups.map((g) =>
        m('div', {key: g.path}, [
          m(
            '.sc-group-header',
            {title: g.path},
            [
              m('span.sc-group-header__path', shortPath(g.path, 6)),
              m(
                'span.sc-group-header__count',
                `${g.hits.length} ${g.hits.length === 1 ? 'hit' : 'hits'}`,
              ),
            ],
          ),
          g.hits.map(({hit, idx}) =>
            m(HitRow, {key: idx, hit, idx, selected: idx === selected}),
          ),
        ]),
      ),
    );
  },
});

interface HitAttrs {
  hit: Hit;
  idx: number;
  selected: boolean;
}

const HitRow: m.Component<HitAttrs> = {
  view({attrs}) {
    const h = attrs.hit;
    return m(
      '.sc-hit',
      {
        class: cn({'sc-hit--selected': attrs.selected}),
        'data-test': 'hit-row',
        'data-hit-idx': String(attrs.idx),
        onclick: () => void openFile(h, attrs.idx),
      },
      [
        m('.sc-hit__line1', [
          h.line !== undefined
            ? m(
                'span.sc-hit__loc',
                `${h.line}${h.col !== undefined ? `:${h.col}` : ''}`,
              )
            : null,
          h.kind ? m('span.sc-tag', h.kind) : null,
          h.lang ? m('span.sc-tag.sc-tag--lang', h.lang) : null,
          h.distance !== undefined
            ? m('span.sc-tag', `Δ${h.distance}`)
            : null,
          h.name
            ? m('span.sc-hit__name', h.name)
            : null,
        ]),
        h.snippet ? m('.sc-hit__snippet', h.snippet) : null,
      ],
    );
  },
};

export function statusLine(r: QueryResponse): string {
  if (r.one !== undefined) return `${r.cmd} · ${fmtMs(r.elapsed_ms)}`;
  const files = new Set<string>();
  for (const h of r.hits) {
    if (h.path) files.add(h.path);
  }
  return `${r.hits.length} ${r.hits.length === 1 ? 'hit' : 'hits'} in ${files.size} ${
    files.size === 1 ? 'file' : 'files'
  } · ${fmtMs(r.elapsed_ms)} · ${r.cmd}`;
}
