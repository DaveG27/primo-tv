import React, { useState } from 'react';
import logo from './logo.png';

// The provider address is fixed at build time (GitHub secret PROVIDER_SERVER) and never shown on screen.
export const SERVER = import.meta.env.VITE_PROVIDER_SERVER || '';

// Header / sign-in brand: rabbit + PRIMO with TV beneath.
export function BrandMark() {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, verticalAlign: 'middle' }}>
      <img src={logo} alt="" style={{ width: 34, height: 34, borderRadius: '50%', background: '#1d213c' }} />
      <span style={{ display: 'inline-flex', flexDirection: 'column', lineHeight: 1, textAlign: 'left' }}>
        <b style={{ fontSize: 20, fontWeight: 900, letterSpacing: 1.5, color: 'var(--pt-text, #fff)' }}>PRIMO</b>
        <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: 3, color: 'var(--pt-acc, #55b2f2)', marginTop: 2 }}>TV</span>
      </span>
    </span>
  );
}

// Settings: version and "Check for updates" (the app downloads and installs it).
export function AppUpdate({ sectionStyle, titleStyle, noteStyle, buttonStyle }) {
  const nat = typeof window !== 'undefined' ? window.PrimoNative : null;
  const [msg, setMsg] = useState('');
  if (!nat || typeof nat.checkUpdate !== 'function') return null;
  let ver = '';
  try { ver = nat.version(); } catch (e) {}
  return (
    <div style={sectionStyle}>
      <h3 style={titleStyle}>PRIMO TV {ver}</h3>
      <p style={{ ...noteStyle, marginTop: 0 }}>PRIMO TV checks for updates each time it opens.</p>
      <button
        style={buttonStyle}
        onClick={() => { setMsg('Checking…'); try { nat.checkUpdate(); } catch (e) {} setTimeout(() => setMsg(''), 4000); }}
      >
        Check for updates
      </button>
      {msg && <p style={noteStyle}>{msg}</p>}
    </div>
  );
}
