// Settings persistence. Stored as JSON under ~/.scry-ui/settings.json.
// Reads merge over DEFAULT_SETTINGS so adding a new field never breaks
// existing installs.

import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {homedir} from 'node:os';
import {join} from 'node:path';

import {DEFAULT_SETTINGS, type UiSettings} from '../shared/protocol.js';

const DIR = join(homedir(), '.scry-ui');
const FILE = join(DIR, 'settings.json');

export function loadSettings(): UiSettings {
  try {
    if (!existsSync(FILE)) return {...DEFAULT_SETTINGS};
    const raw = JSON.parse(readFileSync(FILE, 'utf-8')) as Partial<UiSettings>;
    return {...DEFAULT_SETTINGS, ...raw};
  } catch (e) {
    process.stderr.write(`[settings] load failed, using defaults: ${String(e)}\n`);
    return {...DEFAULT_SETTINGS};
  }
}

export function saveSettings(s: UiSettings): void {
  if (!existsSync(DIR)) mkdirSync(DIR, {recursive: true});
  writeFileSync(FILE, JSON.stringify(s, null, 2));
}
