// File viewer page. Fetches the whole file from /api/file, runs
// highlight.js for syntax colours, renders line numbers in a sticky
// gutter, highlights the hit line and scrolls it into view.
//
// Mounted on hash `#/file?path=<abs path>&line=<n>`.

import hljs from 'highlight.js/lib/core';
import bash from 'highlight.js/lib/languages/bash';
import c from 'highlight.js/lib/languages/c';
import cpp from 'highlight.js/lib/languages/cpp';
import diff from 'highlight.js/lib/languages/diff';
import go from 'highlight.js/lib/languages/go';
import java from 'highlight.js/lib/languages/java';
import json from 'highlight.js/lib/languages/json';
import kotlin from 'highlight.js/lib/languages/kotlin';
import markdown from 'highlight.js/lib/languages/markdown';
import python from 'highlight.js/lib/languages/python';
import rust from 'highlight.js/lib/languages/rust';
import scss from 'highlight.js/lib/languages/scss';
import typescript from 'highlight.js/lib/languages/typescript';
import xml from 'highlight.js/lib/languages/xml';
import yaml from 'highlight.js/lib/languages/yaml';
import m from 'mithril';

import {closeFile, loadFileFromHash, store} from '../core/store.js';
import {Icon} from '../widgets/icon.js';

// Register languages once — keeps the bundle deterministic vs full
// highlight.js which would pull every grammar in unconditionally.
hljs.registerLanguage('bash', bash);
hljs.registerLanguage('c', c);
hljs.registerLanguage('cpp', cpp);
hljs.registerLanguage('diff', diff);
hljs.registerLanguage('go', go);
hljs.registerLanguage('java', java);
hljs.registerLanguage('json', json);
hljs.registerLanguage('kotlin', kotlin);
hljs.registerLanguage('markdown', markdown);
hljs.registerLanguage('python', python);
hljs.registerLanguage('rust', rust);
hljs.registerLanguage('scss', scss);
hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('xml', xml);
hljs.registerLanguage('yaml', yaml);

const EXT_TO_LANG: Record<string, string> = {
  c: 'c',
  h: 'c',
  cc: 'cpp',
  cpp: 'cpp',
  cxx: 'cpp',
  hh: 'cpp',
  hpp: 'cpp',
  java: 'java',
  kt: 'kotlin',
  kts: 'kotlin',
  rs: 'rust',
  go: 'go',
  py: 'python',
  pyi: 'python',
  ts: 'typescript',
  tsx: 'typescript',
  js: 'typescript',
  jsx: 'typescript',
  mjs: 'typescript',
  cjs: 'typescript',
  sh: 'bash',
  bash: 'bash',
  zsh: 'bash',
  json: 'json',
  yaml: 'yaml',
  yml: 'yaml',
  md: 'markdown',
  markdown: 'markdown',
  scss: 'scss',
  css: 'scss',
  xml: 'xml',
  html: 'xml',
  bp: 'json', // Soong: close enough
  bzl: 'python', // Bazel skylark
  patch: 'diff',
  diff: 'diff',
};

function langOf(path: string): string | null {
  const dot = path.lastIndexOf('.');
  if (dot === -1) return null;
  const ext = path.slice(dot + 1).toLowerCase();
  return EXT_TO_LANG[ext] ?? null;
}

function highlightLine(line: string, lang: string | null): string {
  // Treat blank lines as a single non-breaking space so the row keeps height.
  if (line === '') return ' ';
  if (lang) {
    try {
      return hljs.highlight(line, {language: lang, ignoreIllegals: true}).value;
    } catch {
      /* fall through */
    }
  }
  // Escape minimally; no highlighting.
  return escapeHtml(line);
}

function escapeHtml(s: string): string {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function crumbs(path: string): m.Children {
  const parts = path.split('/').filter(Boolean);
  return parts.map((seg, i) =>
    m('span.sc-fileview__crumb', {key: i}, [
      i > 0 ? m('span.sc-fileview__crumb-sep', '/') : null,
      i === parts.length - 1
        ? m('span.sc-fileview__crumb-current', seg)
        : m('span', seg),
    ]),
  );
}

export const FilePage: m.ClosureComponent = () => {
  let scrolled = false;
  return {
    oninit() {
      scrolled = false;
      void loadFileFromHash().then(() => {
        // Scroll the hit line into view once content lands.
        requestAnimationFrame(() => {
          if (scrolled) return;
          const target = document.querySelector(
            `[data-line='${store.filePeek.line}']`,
          );
          if (target) {
            (target as HTMLElement).scrollIntoView({block: 'center'});
            scrolled = true;
          }
        });
      });
    },
    onbeforeremove() {
      // Free memory — file lines can be large.
      store.filePeek.lines = [];
    },
    view() {
      const p = store.filePeek;
      const lang = langOf(p.path);
      return m('.sc-fileview', [
        m('.sc-fileview__head', [
          m(
            'button.sc-iconbtn',
            {
              title: 'Back (Esc)',
              'data-test': 'file-back',
              onclick: closeFile,
              style: {marginRight: '6px'},
            },
            m(Icon, {icon: 'close', size: 14}),
          ),
          m('.sc-fileview__crumbs', {title: p.path}, crumbs(p.path)),
          m('span.sc-fileview__meta', [
            lang ? m('span.sc-tag.sc-tag--lang', lang) : null,
            p.totalLines ? m('span.sc-tag', `${p.totalLines} lines`) : null,
            p.line ? m('span.sc-tag', `:${p.line}`) : null,
            p.truncated ? m('span.sc-tag', {style: {color: 'var(--sc-warn)'}}, 'truncated') : null,
          ]),
          m(
            'button.sc-iconbtn',
            {
              title: 'Copy path',
              onclick: () =>
                navigator.clipboard?.writeText(`${p.path}:${p.line}`).catch(() => undefined),
            },
            m(Icon, {icon: 'copy', size: 12}),
          ),
        ]),
        p.busy
          ? m('.sc-empty', 'Loading…')
          : m(
              '.sc-fileview__body',
              {'data-test': 'fileview-body'},
              p.lines.map((text, i) => {
                const n = p.startLine + i;
                return m(
                  '.sc-codeline',
                  {
                    key: n,
                    'data-line': String(n),
                    class: n === p.line ? 'sc-codeline--hit' : '',
                  },
                  [
                    m('.sc-codeline__num', n),
                    m('.sc-codeline__txt', {
                      // Pre-highlighted HTML is safe here: hljs's output is
                      // escaped + only adds <span> wrappers; no user-supplied
                      // markup reaches innerHTML.
                      innerHTML: highlightLine(text, lang),
                    }),
                  ],
                );
              }),
            ),
        p.truncated
          ? m(
              '.sc-fileview__truncated',
              `File too large; showing first ${p.lines.length} of ${p.totalLines} lines.`,
            )
          : null,
      ]);
    },
  };
};
