// Appearance: background theme, accent colour, text colour and text size.
// The app's colours are CSS variables (--pt-*) whose fallbacks are the
// standard PRIMO TV colours.

export const THEMES = {
  classic:  { name: 'PRIMO',      swatch: '#0a1426', vars: null },
  oled:     { name: 'OLED black', swatch: '#000000', vars: { bg: '#000000', panel: '#000000', card: '#0d0d0d', line: '#1c1c1c', mut: '#8a8a8a' } },
  plex:     { name: 'Plex grey',  swatch: '#1f2326', vars: { bg: '#1a1d20', panel: '#1f2326', card: '#282c30', line: '#33383d', mut: '#a0a4a8' } },
  charcoal: { name: 'Charcoal',   swatch: '#121212', vars: { bg: '#121212', panel: '#181818', card: '#212121', line: '#2c2c2c', mut: '#9e9e9e' } },
  midnight: { name: 'Midnight',   swatch: '#140f24', vars: { bg: '#0d0a17', panel: '#140f24', card: '#1d1633', line: '#2b2247', mut: '#a39cbd' } },
  forest:   { name: 'Forest',     swatch: '#0f1c17', vars: { bg: '#09120e', panel: '#0f1c17', card: '#162720', line: '#21382e', mut: '#98ada3' } },
  light:    { name: 'Light',      swatch: '#f1f3f6', vars: { bg: '#f1f3f6', panel: '#ffffff', card: '#ffffff', line: '#d6dbe3', mut: '#5c6573', text: '#14181f' }, light: true },
};

export const ACCENTS = {
  blue:   { name: 'PRIMO blue',  c: '#55b2f2' },
  gold:   { name: 'Plex gold',   c: '#e5a00d' },
  green:  { name: 'Green',       c: '#3ecf8e' },
  purple: { name: 'Purple',      c: '#a78bfa' },
  red:    { name: 'Red',         c: '#ff5d73' },
  orange: { name: 'Orange',      c: '#ff8a3d' },
  teal:   { name: 'Teal',        c: '#2dd4bf' },
};

export const TEXTS = {
  white: { name: 'White',      c: null },
  soft:  { name: 'Soft white', c: '#e6e6e6' },
  cream: { name: 'Cream',      c: '#f3ead7' },
  ice:   { name: 'Ice blue',   c: '#dcebff' },
  grey:  { name: 'Light grey', c: '#c4c8ce' },
};

export const SIZES = {
  '90':  'Small',
  '100': 'Normal',
  '115': 'Large',
  '130': 'Extra large',
};

const KEY = 'primotv_appearance';
const DEFAULTS = { theme: 'classic', accent: 'blue', text: 'white', size: '100' };

export function loadAppearance() {
  try { return { ...DEFAULTS, ...(JSON.parse(localStorage.getItem(KEY)) || {}) }; }
  catch (e) { return { ...DEFAULTS }; }
}

export function saveAppearance(a) {
  try { localStorage.setItem(KEY, JSON.stringify(a)); } catch (e) {}
  applyAppearance(a);
}

export function applyAppearance(a = loadAppearance()) {
  const root = document.documentElement;
  const st = root.style;
  ['bg', 'panel', 'card', 'line', 'mut', 'text', 'acc'].forEach((k) => st.removeProperty('--pt-' + k));
  const th = THEMES[a.theme] || THEMES.classic;
  if (th.vars) Object.entries(th.vars).forEach(([k, v]) => st.setProperty('--pt-' + k, v));
  // Text colour: the light theme always uses dark text so it stays readable.
  const tx = TEXTS[a.text];
  if (!th.light && tx && tx.c) st.setProperty('--pt-text', tx.c);
  const ac = ACCENTS[a.accent];
  if (ac && a.accent !== 'blue') st.setProperty('--pt-acc', ac.c);
  st.colorScheme = th.light ? 'light' : 'dark';
  document.body && (document.body.style.background = (th.vars && th.vars.bg) || '');
  st.zoom = a.size && a.size !== '100' ? String(Number(a.size) / 100) : '';
}
