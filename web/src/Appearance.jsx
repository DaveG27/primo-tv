import React, { useState } from 'react';
import { THEMES, ACCENTS, TEXTS, SIZES, loadAppearance, saveAppearance } from './theme.js';

// Settings > Appearance — Plex-style picker for background, accent, text colour and size.
const row = { display: 'flex', flexWrap: 'wrap', gap: 10, margin: '6px 0 14px' };
const label = { color: 'var(--pt-mut, #aaa)', fontSize: 13, fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase', margin: '10px 0 2px' };

function Choice({ on, onClick, swatch, ring, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      style={{
        display: 'flex', alignItems: 'center', gap: 10, minHeight: 46,
        padding: '8px 14px 8px 10px', borderRadius: 10, cursor: 'pointer', font: 'inherit',
        background: 'var(--pt-card, #11223e)', color: 'var(--pt-text, #fff)',
        border: on ? '2px solid var(--pt-acc, #55b2f2)' : '2px solid var(--pt-line, #1a2c4e)',
        fontWeight: on ? 700 : 500,
      }}
    >
      {swatch && (
        <span
          style={{
            width: 26, height: 26, borderRadius: '50%', flexShrink: 0, background: swatch,
            boxShadow: ring ? `inset 0 0 0 2px ${ring}` : 'inset 0 0 0 1px rgba(255,255,255,.25)',
          }}
        />
      )}
      {children}
    </button>
  );
}

export default function Appearance({ sectionStyle, titleStyle, noteStyle }) {
  const [a, setA] = useState(loadAppearance);
  const set = (k, v) => { const n = { ...a, [k]: v }; setA(n); saveAppearance(n); };
  const light = THEMES[a.theme] && THEMES[a.theme].light;
  return (
    <div style={sectionStyle}>
      <h3 style={titleStyle}>Appearance</h3>

      <p style={label}>Background</p>
      <div style={row}>
        {Object.entries(THEMES).map(([k, t]) => (
          <Choice key={k} on={a.theme === k} onClick={() => set('theme', k)} swatch={t.swatch}>{t.name}</Choice>
        ))}
      </div>

      <p style={label}>Accent colour</p>
      <div style={row}>
        {Object.entries(ACCENTS).map(([k, t]) => (
          <Choice key={k} on={a.accent === k} onClick={() => set('accent', k)} swatch={t.c}>{t.name}</Choice>
        ))}
      </div>

      <p style={label}>Text colour</p>
      <div style={row}>
        {Object.entries(TEXTS).map(([k, t]) => (
          <Choice key={k} on={a.text === k} onClick={() => set('text', k)} swatch={t.c || '#ffffff'}>{t.name}</Choice>
        ))}
      </div>
      {light && <p style={noteStyle}>The Light background always uses dark text so it stays easy to read.</p>}

      <p style={label}>Text size</p>
      <div style={row}>
        {Object.entries(SIZES).map(([k, n]) => (
          <Choice key={k} on={a.size === k} onClick={() => set('size', k)}>
            <span style={{ fontSize: Math.round(15 * Number(k) / 100) }}>{n}</span>
          </Choice>
        ))}
      </div>

      <p style={label}>Screen saver</p>
      <div style={row}>
        {[['0', 'Off'], ['5', 'After 5 min'], ['10', 'After 10 min'], ['20', 'After 20 min'], ['30', 'After 30 min']].map(([k, n]) => (
          <Choice key={k} on={String(a.saver) === k} onClick={() => set('saver', k)}>{n}</Choice>
        ))}
      </div>
      <p style={{ ...noteStyle, marginTop: -6 }}>Dims the menus to black with a slowly moving clock when nothing is pressed. Protects OLED TVs from burn-in. Never shows while you're watching.</p>

      <div>
        <button
          type="button"
          onClick={() => { const n = { theme: 'classic', accent: 'blue', text: 'white', size: '100', saver: '10' }; setA(n); saveAppearance(n); }}
          style={{ background: 'none', border: 'none', color: 'var(--pt-acc, #55b2f2)', cursor: 'pointer', font: 'inherit', padding: '6px 0' }}
        >
          Back to the standard PRIMO TV look
        </button>
      </div>
    </div>
  );
}
