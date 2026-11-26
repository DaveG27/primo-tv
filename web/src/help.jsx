import React, { useEffect, useState } from 'react';
import qrcode from 'qrcode-generator';
import { HELP } from './helpTopics.js';

// Settings › Help: how-to answers, with a QR code and a button that opens the video in YouTube on the TV.
const nat = () => (typeof window !== 'undefined' ? window.PrimoNative : null);
const isFire = () => {
  try { const n = nat(); return n && typeof n.isFireTV === 'function' ? !!n.isFireTV() : null; } catch (e) { return null; }
};

function QR({ text }) {
  const [src, setSrc] = useState('');
  useEffect(() => {
    try {
      const q = qrcode(0, 'M');
      q.addData(text);
      q.make();
      setSrc(q.createDataURL(5, 2));
    } catch (e) { setSrc(''); }
  }, [text]);
  if (!src) return <div style={{ fontSize: 12, wordBreak: 'break-all' }}>{text}</div>;
  return <img src={src} alt="" style={{ width: 170, height: 170, background: '#fff', borderRadius: 8, imageRendering: 'pixelated' }} />;
}

export default function HelpPanel({ sectionStyle, titleStyle, noteStyle, buttonStyle }) {
  const fire = isFire();
  const topics = HELP.filter((t) => t.dev === 'all' || fire === null || (fire ? t.dev === 'firetv' : t.dev === 'android'));
  const [open, setOpen] = useState(null);
  const t = open && HELP.find((x) => x.id === open);
  const btn = {
    display: 'block', width: '100%', textAlign: 'left', padding: '12px 14px', marginBottom: 6, borderRadius: 10,
    background: 'var(--pt-card, #11223e)', color: 'var(--pt-text, #fff)', border: '1px solid var(--pt-line, #1a2c4e)',
    font: 'inherit', fontSize: 15, cursor: 'pointer',
  };
  if (t) {
    const canOpen = t.video && nat() && typeof nat().openUrl === 'function';
    return (
      <div style={sectionStyle}>
        <h3 style={titleStyle}>{t.q}</h3>
        <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <ol style={{ flex: 1, minWidth: 260, margin: 0, paddingLeft: 22, lineHeight: 1.55, color: 'var(--pt-text, #ddd)' }}>
            {t.steps.map((s, i) => <li key={i} style={{ marginBottom: 6 }}>{s}</li>)}
          </ol>
          {t.video && (
            <div style={{ textAlign: 'center', width: 190 }}>
              <QR text={t.video} />
              <p style={{ ...noteStyle, marginTop: 6 }}>Scan to watch on your phone</p>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
          {canOpen && (
            <button style={buttonStyle} onClick={() => { try { nat().openUrl(t.video); } catch (e) {} }}>
              ▶ Watch the video on TV
            </button>
          )}
          <button style={buttonStyle} onClick={() => setOpen(null)}>
            ← All help topics
          </button>
        </div>
      </div>
    );
  }
  return (
    <div style={sectionStyle}>
      <h3 style={titleStyle}>Help &amp; how-to</h3>
      <p style={{ ...noteStyle, marginTop: 0, marginBottom: 12 }}>Pick a topic. Ones with ▶ have a video.</p>
      {topics.map((x) => (
        <button key={x.id} type="button" style={btn} onClick={() => setOpen(x.id)}>
          {x.video ? '▶ ' : ''}{x.q}
        </button>
      ))}
    </div>
  );
}
