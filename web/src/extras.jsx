import React, { useEffect, useRef, useState } from 'react';
import { SPORTS, sportChannels, buildSport } from './sport.js';
import { BrandMark } from './brand.jsx';
import { loadAppearance } from './theme.js';

const nat = () => (typeof window !== 'undefined' ? window.PrimoNative : null);
const hm = (t) => new Date(t).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
const card = {
  background: 'var(--pt-card, #11223e)', border: '1px solid var(--pt-line, #1a2c4e)', borderRadius: 12,
  padding: '12px 14px', marginBottom: 8, color: 'var(--pt-text, #fff)',
};
const chip = (on) => ({
  padding: '8px 14px', borderRadius: 99, font: 'inherit', fontSize: 14, cursor: 'pointer',
  background: on ? 'var(--pt-acc, #55b2f2)' : 'var(--pt-card, #11223e)', color: on ? '#000' : 'var(--pt-text, #fff)',
  border: '1px solid var(--pt-line, #1a2c4e)', fontWeight: on ? 800 : 500,
});
const small = {
  padding: '6px 12px', borderRadius: 8, font: 'inherit', fontSize: 13, cursor: 'pointer',
  background: 'none', color: 'var(--pt-text, #ddd)', border: '1px solid var(--pt-line, #333a44)',
};

// ---------------------------------------------------------------- Sport today
const SPORT_CACHE = { at: 0, key: '', list: null };

export function SportView({ chans, cats, getEpg, onPlay, onCatchup, canCatch, isReminded, onRemind }) {
  const [list, setList] = useState(SPORT_CACHE.list);
  const [prog, setProg] = useState(null);
  const [day, setDay] = useState(0);
  const [sport, setSport] = useState('all');
  const key = `${chans.length}|${cats.length}`;

  const load = async (force) => {
    if (!force && SPORT_CACHE.list && SPORT_CACHE.key === key && Date.now() - SPORT_CACHE.at < 30 * 60e3) {
      setList(SPORT_CACHE.list);
      return;
    }
    const groups = sportChannels(chans, cats);
    setProg([0, groups.length]);
    const res = await buildSport(groups, getEpg, (d, n) => setProg([d, n]));
    Object.assign(SPORT_CACHE, { at: Date.now(), key, list: res });
    setList(res);
    setProg(null);
  };
  useEffect(() => {
    if (chans.length) load(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const now = Date.now();
  const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0);
  const from = dayStart.getTime() + day * 864e5;
  const to = from + 864e5;
  const shown = (list || []).filter(
    (e) => e.e > (day === 0 ? now - 3 * 3600e3 : from) && e.s < to && (sport === 'all' || e.sport === sport)
  );
  const present = new Set((list || []).map((e) => e.sport));

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        <h2 style={{ margin: 0 }}>Sport</h2>
        <button type="button" style={chip(day === 0)} onClick={() => setDay(0)}>Today</button>
        <button type="button" style={chip(day === 1)} onClick={() => setDay(1)}>Tomorrow</button>
        <button type="button" style={small} onClick={() => load(true)} disabled={!!prog}>↻ Refresh</button>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        {SPORTS.filter((s) => s.id === 'all' || present.has(s.id)).map((s) => (
          <button key={s.id} type="button" style={chip(sport === s.id)} onClick={() => setSport(s.id)}>{s.name}</button>
        ))}
      </div>
      {prog && (
        <p style={{ color: 'var(--pt-mut, #aaa)' }}>
          Checking sport channels for games… {prog[0]} of {prog[1]}
        </p>
      )}
      {!prog && list && shown.length === 0 && (
        <p style={{ color: 'var(--pt-mut, #aaa)' }}>
          No games found{sport !== 'all' ? ' for this sport' : ''}. Games come from the TV guide of your sport channels,
          so hidden countries aren't searched.
        </p>
      )}
      {shown.map((e) => {
        const live = e.s <= now && now < e.e;
        const past = e.e <= now;
        const future = e.s > now;
        const main = e.streams[0];
        return (
          <div key={`${e.title}|${e.s}`} style={{ ...card, display: 'flex', gap: 14, alignItems: 'center' }}>
            <div style={{ width: 64, flexShrink: 0, textAlign: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 800 }}>{hm(e.s)}</div>
              {live && <div style={{ fontSize: 11, fontWeight: 800, color: '#ff5d73', marginTop: 2 }}>● LIVE</div>}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 17, fontWeight: 700 }}>{e.title}</div>
              <div style={{ fontSize: 13, color: 'var(--pt-mut, #aab)', marginTop: 2 }}>
                {[e.comp, e.channels.slice(0, 3).join(' · ')].filter(Boolean).join('  —  ')}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end', maxWidth: '45%' }}>
              {!future &&
                e.streams.slice(0, 3).map((ch) =>
                  past ? (
                    canCatch(ch, e) && (
                      <button key={ch.stream_id} type="button" style={small} onClick={() => onCatchup(ch, e)}>
                        ↺ {ch.name}
                      </button>
                    )
                  ) : (
                    <button key={ch.stream_id} type="button" style={small} onClick={() => onPlay(ch)}>
                      ▶ {ch.name}
                    </button>
                  )
                )}
              {future && (
                <button type="button" style={small} onClick={() => onRemind(main, { start: e.s, end: e.e, title: e.title })}>
                  {isReminded(main, e.s) ? '🔔 Reminder set' : '🔔 Remind me'}
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------- Multiview
export function MultiviewView({ list, onRemove, onClear, onStart }) {
  return (
    <div>
      <h2>Multiview</h2>
      <p style={{ color: 'var(--pt-mut, #aaa)', marginTop: 0 }}>
        Watch up to 4 channels at once. Add channels from Live TV (press Right on a channel, then “Add to Multiview”).
        In Multiview, use the arrows to pick which screen you hear, OK to make it full screen, Back to leave.
        Works best on stronger boxes; a Fire TV stick may struggle with 4. Each screen uses one connection.
      </p>
      {list.length === 0 && <p>No channels added yet.</p>}
      {list.map((c, i) => (
        <div key={c.stream_id} style={{ ...card, display: 'flex', alignItems: 'center', gap: 12 }}>
          <b style={{ width: 24 }}>{i + 1}</b>
          <span style={{ flex: 1 }}>{c.name}</span>
          <button type="button" style={small} onClick={() => onRemove(c)}>Remove</button>
        </div>
      ))}
      <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
        <button type="button" style={chip(true)} disabled={list.length < 2} onClick={onStart}>
          ▶ Start Multiview ({list.length})
        </button>
        {list.length > 0 && <button type="button" style={small} onClick={onClear}>Clear all</button>}
      </div>
      {list.length === 1 && <p style={{ color: 'var(--pt-mut, #aaa)' }}>Add at least one more channel.</p>}
    </div>
  );
}

// ---------------------------------------------------------------- Screen saver (OLED friendly)
export function ScreenSaver({ blocked }) {
  const [on, setOn] = useState(false);
  const [pos, setPos] = useState({ x: 30, y: 30 });
  const [, setTick] = useState(0);
  const last = useRef(Date.now());
  const onRef = useRef(false);
  onRef.current = on;

  useEffect(() => {
    const wake = (e) => {
      last.current = Date.now();
      if (onRef.current) {
        setOn(false);
        if (e && e.type === 'keydown') { e.preventDefault(); e.stopPropagation(); }
      }
    };
    const evs = ['keydown', 'mousemove', 'mousedown', 'touchstart', 'wheel'];
    evs.forEach((t) => window.addEventListener(t, wake, true));
    const vis = () => { last.current = Date.now(); };
    document.addEventListener('visibilitychange', vis);
    window.addEventListener('focus', vis);
    const iv = setInterval(() => {
      const mins = Number(loadAppearance().saver || 0);
      if (!mins || blocked || document.hidden) { if (!onRef.current) last.current = Date.now(); return; }
      if (!onRef.current && Date.now() - last.current > mins * 60e3) setOn(true);
      if (onRef.current) {
        setPos({ x: 5 + Math.random() * 60, y: 8 + Math.random() * 70 });
        setTick((t) => t + 1);
      }
    }, 15000);
    return () => {
      evs.forEach((t) => window.removeEventListener(t, wake, true));
      document.removeEventListener('visibilitychange', vis);
      window.removeEventListener('focus', vis);
      clearInterval(iv);
    };
  }, [blocked]);

  if (!on) return null;
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 999, background: '#000', cursor: 'none' }}>
      <div style={{ position: 'absolute', left: `${pos.x}%`, top: `${pos.y}%`, transition: 'left 3s ease, top 3s ease', opacity: 0.55, textAlign: 'center' }}>
        <BrandMark />
        <div style={{ color: '#fff', fontSize: 48, fontWeight: 300, marginTop: 10 }}>{hm(Date.now())}</div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Speed test
export function SpeedTest({ sectionStyle, titleStyle, noteStyle, buttonStyle }) {
  const [state, setState] = useState(null);
  useEffect(() => {
    window.__ptSpeed = (mbps, err) => setState(err ? { err } : { mbps: Number(mbps) });
    return () => { window.__ptSpeed = null; };
  }, []);
  const n = nat();
  if (!n || typeof n.speedTest !== 'function') return null;
  const verdict = (m) =>
    m >= 25 ? '4K and Full HD should play smoothly.' : m >= 10 ? 'Full HD and HD should be fine; 4K may buffer.' : m >= 5 ? 'HD should be OK; set Preferred quality to HD.' : 'Too slow for smooth TV. Restart the router, move the box closer or use a cable.';
  return (
    <div style={sectionStyle}>
      <h3 style={titleStyle}>Test my connection</h3>
      <p style={{ ...noteStyle, marginTop: 0 }}>Measures this box's download speed (takes about 10 seconds and uses roughly 50 MB).</p>
      <button style={buttonStyle} disabled={state === 'run'} onClick={() => { setState('run'); try { n.speedTest(); } catch (e) { setState({ err: 'Could not start the test' }); } }}>
        {state === 'run' ? 'Testing…' : 'Start the test'}
      </button>
      {state && state !== 'run' && (
        <p style={{ fontSize: 16, marginTop: 12 }}>
          {state.err ? state.err : (<><b style={{ fontSize: 26 }}>{state.mbps.toFixed(1)} Mbps</b> — {verdict(state.mbps)}</>)}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- Copy setup to another box
const SHARE = 'https://primo-updates.vercel.app/api/share';
const SKIP = /^primotv_(accounts|xtream)|^primotv_prog/;

function collect(acct) {
  const out = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k || !/^primotv[_-]/.test(k) || SKIP.test(k)) continue;
    if (k.includes('|') && acct && !k.endsWith(acct)) continue; // other logins' lists stay here
    out[acct && k.endsWith(acct) ? k.slice(0, -acct.length) + '{ACCT}' : k] = localStorage.getItem(k);
  }
  return out;
}

export function CopySetup({ credentials, sectionStyle, titleStyle, noteStyle, buttonStyle, inputStyle }) {
  const [code, setCode] = useState('');
  const [mine, setMine] = useState('');
  const [msg, setMsg] = useState('');
  const acct = credentials ? `${credentials.server}|${credentials.username}` : '';

  const make = async () => {
    setMsg('Getting a code…');
    try {
      const r = await fetch(SHARE, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data: collect(acct) }) });
      const j = await r.json();
      if (!r.ok || !j.code) throw new Error(j.error || 'failed');
      setMine(j.code);
      setMsg('');
    } catch (e) { setMsg("Couldn't get a code. Check the box is online and try again."); }
  };
  const use = async () => {
    const c = code.trim().toUpperCase();
    if (c.length !== 6) { setMsg('Enter the 6-character code from the other box.'); return; }
    setMsg('Copying…');
    try {
      const r = await fetch(`${SHARE}?code=${encodeURIComponent(c)}`);
      const j = await r.json();
      if (!r.ok || !j.data) throw new Error(j.error || 'Code not found');
      for (const [k, v] of Object.entries(j.data)) {
        if (typeof v !== 'string' || !/^primotv[_-]/.test(k) || SKIP.test(k)) continue;
        localStorage.setItem(k.replace('{ACCT}', acct), v);
      }
      setMsg('Copied. PRIMO TV is restarting with the new setup…');
      setTimeout(() => window.location.reload(), 1500);
    } catch (e) { setMsg(String(e.message || e)); }
  };
  return (
    <div style={sectionStyle}>
      <h3 style={titleStyle}>Copy setup to another box</h3>
      <p style={{ ...noteStyle, marginTop: 0 }}>
        Copies favourites, hidden countries and groups, appearance and other settings. Your password is not included.
      </p>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <button style={buttonStyle} onClick={make}>On this box: get a code</button>
        {mine && <b style={{ fontSize: 30, letterSpacing: 6 }}>{mine}</b>}
      </div>
      {mine && <p style={noteStyle}>On the other box, sign in, then enter this code here. It works once, within 24 hours.</p>}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginTop: 12 }}>
        <input style={{ ...inputStyle, width: 180, textTransform: 'uppercase', letterSpacing: 3, margin: 0 }} maxLength={6} placeholder="Code" value={code} onChange={(e) => setCode(e.target.value)} />
        <button style={buttonStyle} onClick={use}>On the new box: copy</button>
      </div>
      {msg && <p style={noteStyle}>{msg}</p>}
    </div>
  );
}
