// PRIMO TV Timeline: a live-TV guide you move through time with.
// One self-contained file. App.jsx passes in data and callbacks (see JOIN.md).
//
// - Swipe / drag / mouse wheel / left-right keys move through time; every channel row follows.
// - Past programmes play from the provider's catch-up where the channel has an archive.
// - "Follow" a team, show or actor: matches glow, and FollowAlert (exported below) taps you on the shoulder.
// - Movies and series sit under the guide as "On demand", and one search box covers everything.
import React, { useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback } from 'react';

const MIN = 60000;
const MAX_ROWS = 40; // channels shown in the guide
const ALERT_LEAD_MIN = 5; // "starts in 5 min" alert
// Catch-up links need the start time in the provider's clock. 0 = UTC.
// If replays start at the wrong time, set this to the difference in minutes (e.g. 60 for UK summer time).
const ARCHIVE_TZ_OFFSET_MIN = 0;

// ---------- small helpers ----------
const p2 = (n) => String(n).padStart(2, '0');
const hm = (ms) => {
  const d = new Date(ms);
  return `${p2(d.getHours())}:${p2(d.getMinutes())}`;
};
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const dayhm = (ms) => {
  const d = new Date(ms);
  const same = d.toDateString() === new Date().toDateString();
  return `${same ? '' : DAYS[d.getDay()] + ' '}${hm(ms)}`;
};
const durText = (min) => {
  const m = Math.round(Math.abs(min));
  const h = Math.floor(m / 60);
  return h ? `${h}h${m % 60 ? ' ' + (m % 60) + 'm' : ''}` : `${m} min`;
};
const decodeB64 = (s) => {
  if (!s) return '';
  try {
    const bin = atob(s);
    return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
  } catch {
    return s;
  }
};
const lsGet = (key, fallback) => {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  } catch {
    return fallback;
  }
};
const lsSet = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
};
const followKey = (u) => `primotv-tl-follows:${u}`;
const remindKey = (u) => `primotv-tl-remind:${u}`;
const CHANGED = 'primotv-tl-change';

const hueOf = (title) => {
  let h = 0;
  for (let i = 0; i < title.length; i++) h = (h * 31 + title.charCodeAt(i)) >>> 0;
  return [215, 175, 285, 150, 42, 340][h % 6];
};
const matchFollow = (follows, ...texts) => {
  const s = texts.join(' ').toLowerCase();
  for (const f of follows) if (s.includes(f.toLowerCase())) return f;
  return null;
};

// ---------- guide data (shared, so FollowAlert can use it anywhere in the app) ----------
const GUIDE = new Map(); // stream_id -> { ch, at, items: [{title, desc, start, end, arch}], failed }
const subs = new Set();
const notify = () => subs.forEach((f) => f());
const FRESH = 15 * MIN;

const parseListings = (data) =>
  (data && Array.isArray(data.epg_listings) ? data.epg_listings : [])
    .map((l) => ({
      title: decodeB64(l.title),
      desc: decodeB64(l.description),
      start: Number(l.start_timestamp) * 1000,
      end: Number(l.stop_timestamp || l.end_timestamp) * 1000,
      arch: l.has_archive == null ? null : Number(l.has_archive) === 1,
    }))
    .filter((p) => p.title && isFinite(p.start) && isFinite(p.end) && p.end > p.start)
    .sort((a, b) => a.start - b.start);

async function loadChannel(api, ch, force) {
  const id = ch.stream_id;
  const e = GUIDE.get(id);
  if (!force && e && Date.now() - e.at < FRESH) return;
  try {
    let items = parseListings(await api('get_simple_data_table', { stream_id: id }));
    if (!items.length) items = parseListings(await api('get_short_epg', { stream_id: id, limit: 20 }));
    GUIDE.set(id, { ch, at: Date.now(), items });
  } catch {
    // try again in about a minute
    GUIDE.set(id, { ch, at: Date.now() - FRESH + MIN, items: e ? e.items : [], failed: true });
  }
  notify();
}

// Three requests at a time, so the provider isn't hammered
async function loadMany(api, chans) {
  let n = 0;
  const worker = async () => {
    while (n < chans.length) await loadChannel(api, chans[n++]);
  };
  await Promise.all([worker(), worker(), worker()]);
}

function useGuideTick() {
  const [t, setT] = useState(0);
  useEffect(() => {
    const f = () => setT((x) => x + 1);
    subs.add(f);
    return () => subs.delete(f);
  }, []);
  return t;
}

const progAt = (items, t) => {
  for (let i = 0; i < items.length; i++) if (items[i].start <= t && t < items[i].end) return items[i];
  return null;
};

// ---------- catch-up ----------
const tsFmt = (ms) => {
  const d = new Date(ms + ARCHIVE_TZ_OFFSET_MIN * MIN);
  return `${d.getUTCFullYear()}-${p2(d.getUTCMonth() + 1)}-${p2(d.getUTCDate())}:${p2(d.getUTCHours())}-${p2(d.getUTCMinutes())}`;
};
function catchupItem(creds, ch, p) {
  const { server: srv, username: u, password: pw } = creds;
  const mins = Math.ceil((p.end - p.start) / MIN) + 2;
  const start = tsFmt(p.start);
  const id = ch.stream_id;
  const U = encodeURIComponent(u);
  const P = encodeURIComponent(pw);
  return {
    ...ch,
    type: 'catchup',
    name: `${ch.name} · ${p.title}`,
    programme: { title: p.title, start: p.start, end: p.end },
    urls: [
      `${srv}/timeshift/${U}/${P}/${mins}/${start}/${id}.m3u8`,
      `${srv}/streaming/timeshift.php?username=${U}&password=${P}&stream=${id}&start=${start}&duration=${mins}`,
      `${srv}/timeshift/${U}/${P}/${mins}/${start}/${id}.ts`,
    ],
  };
}
const hasArchive = (ch, p, now) => {
  if (Number(ch.tv_archive) !== 1 || p.arch === false) return false;
  const days = Number(ch.tv_archive_duration) || 0;
  return !days || p.start >= now - days * 86400000;
};

// ---------- one channel row (memoised so only changed rows redraw) ----------
const Row = React.memo(function Row({ ch, entry, r, selected, selStart, follows, nowMs, t0, canArch }) {
  const items = entry ? entry.items : null;
  return (
    <div className={'tl-row' + (selected ? ' sel' : '')} data-r={r}>
      <div className="tl-chl" data-r={r}>
        <b>{ch.num || r + 1}</b>
        <span>{ch.name}</span>
      </div>
      <div className="tl-lane">
        {!entry && <div className="tl-msg">Loading guide…</div>}
        {entry && !items.length && <div className="tl-msg">No guide for this channel. Press OK to watch live.</div>}
        <div className="tl-inner">
          {items &&
            items.map((p, i) => {
              if (p.end <= t0) return null;
              const live = p.start <= nowMs && nowMs < p.end;
              const past = p.end <= nowMs;
              const f = matchFollow(follows, p.title, p.desc);
              const arch = past && canArch && hasArchive(ch, p, nowMs);
              const cl =
                'tl-prog' +
                (live ? ' live' : '') +
                (past ? ' past' + (arch ? '' : ' noarch') : '') +
                (f ? ' fol' : '') +
                (selStart === p.start ? ' sel' : '');
              return (
                <div
                  key={p.start + ':' + i}
                  className={cl}
                  data-r={r}
                  data-i={i}
                  style={{ '--s': (p.start - t0) / MIN, '--d': (p.end - p.start) / MIN, '--h': hueOf(p.title) }}
                >
                  <b>
                    {f && <span className="tl-star">★ </span>}
                    {live && <span className="tl-live">LIVE </span>}
                    {arch && <span className="tl-gold">↺ </span>}
                    {p.title}
                  </b>
                  <small>
                    {hm(p.start)} – {hm(p.end)}
                  </small>
                </div>
              );
            })}
          <div className="tl-nowmark" style={{ '--now': (nowMs - t0) / MIN }} />
        </div>
      </div>
    </div>
  );
});

// ---------- poster card for the On demand rails ----------
function Poster({ img, title, sub, progress, followed, onClick }) {
  const [bad, setBad] = useState(false);
  return (
    <button type="button" className={'tl-poster' + (followed ? ' fol' : '')} onClick={onClick}>
      {img && !bad && <img src={img} alt="" loading="lazy" decoding="async" onError={() => setBad(true)} />}
      {followed && <span className="tl-pstar">★</span>}
      <span className="tl-ptxt">
        <b>{title}</b>
        {sub && <small>{sub}</small>}
      </span>
      {progress > 0 && (
        <span className="tl-pbar">
          <u style={{ width: Math.min(100, progress * 100) + '%' }} />
        </span>
      )}
    </button>
  );
}

// =====================================================================
export default function Timeline({
  api, // (action, extra) => Promise  (wraps apiCall with the current login)
  creds, // { server, username, password }
  channels = [], // visible live channels (favourites first is best)
  movies = [],
  series = [],
  continueList = [], // from App: [{ key, type, item, position, duration }]
  onPlayLive, // (ch)
  onPlayCatchup, // (item)  optional: hides replay / start over when missing
  onOpenMovie, // (movie)
  onOpenSeries, // (series)
  onOpenContinue, // (record)
  narrow = false,
}) {
  const user = (creds && creds.username) || '';
  const apiRef = useRef(api);
  apiRef.current = api;
  const chans = useMemo(() => channels.slice(0, MAX_ROWS), [channels]);
  const chansRef = useRef(chans);
  chansRef.current = chans;
  const tick = useGuideTick();

  const range = useRef(null);
  if (!range.current) {
    const t0 = Math.floor(Date.now() / (60 * MIN)) * 60 * MIN - 12 * 60 * MIN;
    range.current = { t0, t1: t0 + 48 * 60 * MIN };
  }
  const { t0, t1 } = range.current;

  const [follows, setFollowsState] = useState(() => lsGet(followKey(user), []));
  const [remind, setRemindState] = useState(() => lsGet(remindKey(user), {}));
  const setFollows = (next) => {
    setFollowsState(next);
    lsSet(followKey(user), next);
    window.dispatchEvent(new Event(CHANGED));
  };
  const setRemind = (next) => {
    setRemindState(next);
    lsSet(remindKey(user), next);
    window.dispatchEvent(new Event(CHANGED));
  };

  const [sel, setSel] = useState(0);
  const selRef = useRef(0);
  const [selProg, setSelProg] = useState(null);
  const [nowMs, setNowMs] = useState(Date.now());
  const [q, setQ] = useState('');
  const [dq, setDq] = useState('');
  const [fi, setFi] = useState('');
  const [toast, setToast] = useState('');

  const gridRef = useRef(null);
  const wrapRef = useRef(null);
  const lineRef = useRef(null);
  const bubbleRef = useRef(null);
  const cursorRef = useRef(Date.now());
  const dims = useRef({ ppm: 2, cx: 100 });
  const rafRef = useRef(0);
  const dragRef = useRef(null);
  const suppress = useRef(false);

  // ----- load guides -----
  useEffect(() => {
    const run = () => loadMany((a, b) => apiRef.current(a, b), chansRef.current);
    run();
    const id = setInterval(run, 5 * MIN);
    return () => clearInterval(id);
  }, [chans]);
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    const id = setTimeout(() => setDq(q.trim().toLowerCase()), 180);
    return () => clearTimeout(id);
  }, [q]);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(''), 2600);
    return () => clearTimeout(id);
  }, [toast]);

  // ----- time engine -----
  const clampC = (c) => Math.max(t0 + 20 * MIN, Math.min(t1 - 20 * MIN, c));
  const applyTx = useCallback(() => {
    const g = gridRef.current;
    if (!g) return;
    const tx = (-(cursorRef.current - t0) / MIN) * dims.current.ppm + dims.current.cx;
    const v = `translateX(${tx}px)`;
    g.querySelectorAll('.tl-inner').forEach((el) => (el.style.transform = v));
  }, [t0]);

  const updateSel = useCallback(() => {
    const ch = chansRef.current[selRef.current];
    const e = ch ? GUIDE.get(ch.stream_id) : null;
    const p = e ? progAt(e.items, cursorRef.current) : null;
    setSelProg(p);
    if (bubbleRef.current) {
      const d = (cursorRef.current - Date.now()) / MIN;
      bubbleRef.current.textContent =
        Math.abs(d) < 2
          ? `LIVE · ${hm(cursorRef.current)}`
          : `${dayhm(cursorRef.current)} · ${d < 0 ? durText(d) + ' ago' : 'in ' + durText(d)}`;
    }
  }, []);

  const setCursor = useCallback(
    (c) => {
      cursorRef.current = clampC(c);
      applyTx();
      updateSel();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [applyTx, updateSel]
  );
  const stopMotion = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = 0;
  };
  const animateTo = (target, ms) => {
    stopMotion();
    target = clampC(target);
    const from = cursorRef.current;
    const t = performance.now();
    const total = ms || Math.min(700, 220 + (Math.abs(target - from) / MIN) * 1.2);
    const step = (now) => {
      const k = Math.min(1, (now - t) / total);
      setCursor(from + (target - from) * (1 - Math.pow(1 - k, 3)));
      rafRef.current = k < 1 ? requestAnimationFrame(step) : 0;
    };
    rafRef.current = requestAnimationFrame(step);
  };

  const layout = useCallback(() => {
    const g = gridRef.current;
    if (!g) return;
    const lw = narrow ? 56 : 76;
    const laneW = Math.max(200, g.clientWidth - lw);
    const ppm = laneW / (narrow ? 140 : 210);
    dims.current = { ppm, cx: laneW * 0.26 };
    g.style.setProperty('--lw', lw + 'px');
    g.style.setProperty('--ppm', ppm + 'px');
    if (lineRef.current) lineRef.current.style.left = lw + laneW * 0.26 + 'px';
    applyTx();
  }, [narrow, applyTx]);

  useLayoutEffect(() => {
    layout();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(layout) : null;
    if (ro && wrapRef.current) ro.observe(wrapRef.current);
    return () => ro && ro.disconnect();
  }, [layout]);
  useLayoutEffect(() => {
    applyTx(); // rows drawn after the last move still need to be in position
  });
  useEffect(() => {
    selRef.current = sel;
    updateSel();
  }, [sel, tick, chans, updateSel]);
  useEffect(() => () => stopMotion(), []);

  const scrollRow = (r) => {
    const el = gridRef.current && gridRef.current.querySelector(`.tl-row[data-r="${r}"]`);
    if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest' });
  };
  const goTo = (r, p) => {
    selRef.current = r;
    setSel(r);
    const n = Date.now();
    animateTo(p.start <= n && n < p.end ? n : p.start + 1000);
    scrollRow(r);
  };

  // ----- pointer: drag, glide, wheel -----
  const onPointerDown = (e) => {
    if (e.target.closest('.tl-chl')) return;
    stopMotion();
    dragRef.current = { id: e.pointerId, x: e.clientX, y: e.clientY, lx: e.clientX, lt: performance.now(), v: 0, on: false };
  };
  const onPointerMove = (e) => {
    const d = dragRef.current;
    if (!d || e.pointerId !== d.id) return;
    if (!d.on) {
      const ax = Math.abs(e.clientX - d.x);
      const ay = Math.abs(e.clientY - d.y);
      if (ax > 8 && ax > ay) {
        d.on = true;
        try {
          gridRef.current.setPointerCapture(e.pointerId);
        } catch {}
      } else return;
    }
    const now = performance.now();
    const dx = e.clientX - d.lx;
    d.v = 0.75 * d.v + 0.25 * (dx / Math.max(1, now - d.lt));
    d.lx = e.clientX;
    d.lt = now;
    setCursor(cursorRef.current - (dx / dims.current.ppm) * MIN);
  };
  const endDrag = (e) => {
    const d = dragRef.current;
    if (!d || e.pointerId !== d.id) return;
    dragRef.current = null;
    if (!d.on) return;
    suppress.current = true;
    setTimeout(() => (suppress.current = false), 80);
    let vel = (-d.v / dims.current.ppm) * MIN; // ms of time per ms of drag
    const glide = () => {
      if (Math.abs(vel) < 0.0015 * MIN) {
        rafRef.current = 0;
        return;
      }
      setCursor(cursorRef.current + vel * 16);
      vel *= 0.94;
      rafRef.current = requestAnimationFrame(glide);
    };
    glide();
  };
  useEffect(() => {
    const g = gridRef.current;
    if (!g) return;
    const onWheel = (e) => {
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY) || e.shiftKey) {
        e.preventDefault();
        stopMotion();
        setCursor(cursorRef.current + ((e.deltaX || e.deltaY) / dims.current.ppm) * MIN);
      }
    };
    g.addEventListener('wheel', onWheel, { passive: false });
    return () => g.removeEventListener('wheel', onWheel);
  }, [setCursor]);

  const onGridClick = (e) => {
    if (suppress.current) return;
    const t = e.target.closest('[data-r]');
    if (!t) return;
    const r = +t.dataset.r;
    if (gridRef.current) gridRef.current.focus({ preventScroll: true });
    if (t.dataset.i !== undefined) {
      const entry = GUIDE.get(chansRef.current[r].stream_id);
      if (entry && entry.items[+t.dataset.i]) goTo(r, entry.items[+t.dataset.i]);
    } else {
      selRef.current = r;
      setSel(r);
    }
  };

  // ----- actions on the selected programme -----
  const selCh = chans[sel] || null;
  const status = selProg ? (selProg.start <= nowMs && nowMs < selProg.end ? 'live' : selProg.end <= nowMs ? 'past' : 'future') : null;
  const canReplay = !!(selCh && selProg && onPlayCatchup && status === 'past' && hasArchive(selCh, selProg, nowMs));
  const canStartOver = !!(
    selCh && selProg && onPlayCatchup && status === 'live' && nowMs - selProg.start > 5 * MIN && hasArchive(selCh, selProg, nowMs)
  );
  const remindId = selCh && selProg ? `${selCh.stream_id}:${selProg.start}` : '';
  const folTitle = selProg ? follows.find((f) => f.toLowerCase() === selProg.title.toLowerCase()) : null;

  const toggleFollowTitle = (title) => {
    const hit = follows.find((f) => f.toLowerCase() === title.toLowerCase());
    setFollows(hit ? follows.filter((f) => f !== hit) : [...follows, title]);
  };
  const toggleRemind = () => {
    if (!remindId) return;
    const next = { ...remind };
    if (next[remindId]) delete next[remindId];
    else next[remindId] = selProg.start;
    setRemind(next);
    setToast(next[remindId] ? `Reminder set for ${hm(selProg.start)}` : 'Reminder removed');
  };
  const primary = () => {
    if (!selCh) return;
    if (!selProg || status === 'live') return onPlayLive && onPlayLive(selCh);
    if (status === 'past') {
      if (canReplay) return onPlayCatchup(catchupItem(creds, selCh, selProg));
      return setToast('This channel keeps no archive');
    }
    return toggleRemind();
  };

  // keep the latest handlers reachable from the key listener
  const keyAct = useRef({});
  keyAct.current = { primary, toggleFollowTitle, selProg, animateTo, scrollRow, setToast };
  useEffect(() => {
    // Capture phase on window, so this runs before the Fire TV remote handling (tvnav.js).
    const h = (e) => {
      const g = gridRef.current;
      if (!g || document.activeElement !== g) return;
      const k = e.key;
      const a = keyAct.current;
      const list = chansRef.current;
      const eat = () => {
        e.preventDefault();
        e.stopPropagation();
      };
      const items = () => {
        const en = list[selRef.current] && GUIDE.get(list[selRef.current].stream_id);
        return en ? en.items : [];
      };
      if (k === 'ArrowRight') {
        eat();
        const p = progAt(items(), cursorRef.current);
        a.animateTo(p ? p.end + 1000 : cursorRef.current + 30 * MIN, 260);
      } else if (k === 'ArrowLeft') {
        eat();
        const p = progAt(items(), cursorRef.current);
        if (p && cursorRef.current - p.start > 60000) a.animateTo(p.start + 1000, 260);
        else {
          const prev = progAt(items(), (p ? p.start : cursorRef.current) - 1000);
          a.animateTo(prev ? prev.start + 1000 : cursorRef.current - 30 * MIN, 260);
        }
      } else if (k === 'ArrowDown') {
        if (selRef.current < list.length - 1) {
          eat();
          selRef.current += 1;
          setSel(selRef.current);
          a.scrollRow(selRef.current);
        } // else let the remote move on to what is below
      } else if (k === 'ArrowUp') {
        if (selRef.current > 0) {
          eat();
          selRef.current -= 1;
          setSel(selRef.current);
          a.scrollRow(selRef.current);
        }
      } else if (k === 'Enter') {
        eat();
        a.primary();
      } else if (k === 'ContextMenu' || e.keyCode === 82 || k === 'f' || k === 'F') {
        eat();
        if (a.selProg) a.toggleFollowTitle(a.selProg.title);
      } else if (k === 'n' || k === 'N') {
        eat();
        a.animateTo(Date.now());
      }
    };
    window.addEventListener('keydown', h, true);
    return () => window.removeEventListener('keydown', h, true);
  }, []);

  // ----- follow box -----
  const addFollow = (e) => {
    e.preventDefault();
    const v = fi.trim();
    setFi('');
    if (!v || follows.some((f) => f.toLowerCase() === v.toLowerCase())) return;
    setFollows([...follows, v]);
    setToast(`Following “${v}”`);
  };

  // ----- "Tonight for you" strip -----
  const tonight = useMemo(() => {
    const out = [];
    const seen = new Set();
    const n = Date.now();
    if (follows.length) {
      chans.forEach((ch, r) => {
        const en = GUIDE.get(ch.stream_id);
        if (!en) return;
        en.items.forEach((p) => {
          if (p.end <= n || p.start > n + 8 * 60 * MIN) return;
          const f = matchFollow(follows, p.title, p.desc);
          const key = p.title.toLowerCase();
          if (!f || seen.has(key)) return;
          seen.add(key);
          out.push({ kind: 'tv', r, p, ch, f, at: p.start });
        });
      });
    }
    out.sort((a, b) => a.at - b.at);
    const res = out.slice(0, 6);
    continueList.slice(0, 3).forEach((rec) => res.push({ kind: 'cont', rec }));
    if (follows.length) {
      let m = 0;
      let s = 0;
      for (const mv of movies) {
        if (m >= 2) break;
        const f = matchFollow(follows, mv.name);
        if (f) {
          res.push({ kind: 'movie', item: mv, f });
          m++;
        }
      }
      for (const sr of series) {
        if (s >= 2) break;
        const f = matchFollow(follows, sr.name);
        if (f) {
          res.push({ kind: 'series', item: sr, f });
          s++;
        }
      }
    }
    return res;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [follows, chans, movies, series, continueList, tick, nowMs]);

  // ----- On demand rails -----
  const newMovies = useMemo(
    () => movies.slice().sort((a, b) => Number(b.added || 0) - Number(a.added || 0)).slice(0, 24),
    [movies]
  );
  const newSeries = useMemo(
    () => series.slice().sort((a, b) => Number(b.last_modified || 0) - Number(a.last_modified || 0)).slice(0, 24),
    [series]
  );

  // ----- search everything -----
  const results = useMemo(() => {
    if (!dq) return null;
    const parts = dq.split(/\s+/);
    const hit = (s) => {
      s = (s || '').toLowerCase();
      return parts.every((w) => s.includes(w));
    };
    const mv = [];
    for (const m of movies) {
      if (hit(m.name)) {
        mv.push(m);
        if (mv.length >= 24) break;
      }
    }
    const sr = [];
    for (const s of series) {
      if (hit(s.name)) {
        sr.push(s);
        if (sr.length >= 24) break;
      }
    }
    const ch = [];
    for (const c of channels) {
      if (hit(c.name)) {
        ch.push(c);
        if (ch.length >= 12) break;
      }
    }
    const n = Date.now();
    const tvMap = new Map();
    chans.forEach((c, r) => {
      const en = GUIDE.get(c.stream_id);
      if (!en) return;
      en.items.forEach((p) => {
        const past = p.end <= n;
        if (past && !hasArchive(c, p, n)) return;
        if (!hit(p.title + ' ' + p.desc)) return;
        const rank = p.start <= n && n < p.end ? 0 : past ? 2 : 1;
        const key = c.stream_id + p.title;
        const old = tvMap.get(key);
        if (old && (old.rank < rank || (old.rank === rank && old.p.start <= p.start))) return;
        tvMap.set(key, { r, p, c, rank });
      });
    });
    const tv = Array.from(tvMap.values())
      .sort((a, b) => a.rank - b.rank || a.p.start - b.p.start)
      .slice(0, 12);
    return { mv, sr, ch, tv };
  }, [dq, movies, series, channels, chans, tick]);
  const clearSearch = () => {
    setQ('');
    setDq('');
  };

  // ----- render -----
  const gridRows = useMemo(
    () =>
      chans.map((ch, r) => (
        <Row
          key={ch.stream_id}
          ch={ch}
          entry={GUIDE.get(ch.stream_id)}
          r={r}
          selected={r === sel}
          selStart={r === sel && selProg ? selProg.start : 0}
          follows={follows}
          nowMs={nowMs}
          t0={t0}
          canArch={!!onPlayCatchup && Number(ch.tv_archive) === 1}
        />
      )),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [chans, tick, sel, selProg, follows, nowMs, t0, onPlayCatchup]
  );

  const ticks = useMemo(() => {
    const out = [];
    for (let t = t0; t < t1; t += 30 * MIN) {
      const hour = new Date(t).getMinutes() === 0;
      const mid = hour && new Date(t).getHours() === 0;
      out.push(
        <div key={t} className={'tl-tick' + (hour ? ' h' : '')} style={{ '--s': (t - t0) / MIN }}>
          {mid ? DAYS[new Date(t).getDay()] + ' ' : ''}
          {hm(t)}
        </div>
      );
    }
    return out;
  }, [t0, t1]);

  const statusLine = () => {
    if (!selProg) return selCh ? 'No guide information for this channel' : '';
    if (status === 'live') return <><span className="tl-live">LIVE</span> · {durText((selProg.end - nowMs) / MIN)} left</>;
    if (status === 'past')
      return canReplay ? (
        <><span className="tl-gold">Replay available</span> · aired {durText((nowMs - selProg.end) / MIN)} ago</>
      ) : (
        <>Aired {durText((nowMs - selProg.end) / MIN)} ago · no replay</>
      );
    return <>Starts in {durText((selProg.start - nowMs) / MIN)}</>;
  };

  return (
    <div className={'tl' + (narrow ? ' narrow' : '')}>
      <style>{CSS}</style>

      <div className="tl-head">
        <h2>Timeline</h2>
        <input
          className="tl-in"
          type="search"
          placeholder="Search channels, films, series"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === 'Escape' && clearSearch()}
          aria-label="Search"
        />
        <span className="tl-sp" />
        <button type="button" className="tl-btn" onClick={() => animateTo(Date.now())}>
          Back to now
        </button>
        <button
          type="button"
          className="tl-btn"
          onClick={() => {
            const el = wrapRef.current && wrapRef.current.parentNode.querySelector('.tl-vod');
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }}
        >
          On demand ↓
        </button>
      </div>

      <div className="tl-follow">
        <span className="tl-hint">Following</span>
        <div className="tl-chips">
          {follows.length === 0 && <span className="tl-hint">Nothing yet. Add a team, show or actor.</span>}
          {follows.map((f) => (
            <span key={f} className="tl-chip">
              ★ {f}
              <button type="button" aria-label={`Stop following ${f}`} onClick={() => setFollows(follows.filter((x) => x !== f))}>
                ×
              </button>
            </span>
          ))}
        </div>
        <form onSubmit={addFollow}>
          <input className="tl-in" value={fi} onChange={(e) => setFi(e.target.value)} placeholder="Follow a team, show, actor" />
          <button type="submit" className="tl-btn gold">
            Follow
          </button>
        </form>
      </div>

      {tonight.length > 0 && (
        <div className="tl-tonight">
          <h3>Tonight for you</h3>
          {tonight.map((it, i) => {
            if (it.kind === 'tv')
              return (
                <button key={i} type="button" className="tl-card" onClick={() => goTo(it.r, it.p)}>
                  <em>★ Following “{it.f}”</em>
                  <b>{it.p.title}</b>
                  <small>
                    {it.p.start <= nowMs ? 'LIVE now' : dayhm(it.p.start)} · {it.ch.name}
                  </small>
                </button>
              );
            if (it.kind === 'cont')
              return (
                <button key={i} type="button" className="tl-card" onClick={() => onOpenContinue && onOpenContinue(it.rec)}>
                  <em>Pick up where you left off</em>
                  <b>{it.rec.item.seriesName ? `${it.rec.item.seriesName}` : it.rec.item.name}</b>
                  <small>{it.rec.type === 'movie' ? 'Film' : it.rec.item.name}</small>
                </button>
              );
            const isM = it.kind === 'movie';
            return (
              <button key={i} type="button" className="tl-card" onClick={() => (isM ? onOpenMovie && onOpenMovie(it.item) : onOpenSeries && onOpenSeries(it.item))}>
                <em>★ Following “{it.f}”</em>
                <b>{it.item.name}</b>
                <small>{isM ? 'Film' : 'Series'} · watch now</small>
              </button>
            );
          })}
        </div>
      )}

      <div className="tl-wrap" ref={wrapRef}>
        <div
          className="tl-grid"
          ref={gridRef}
          tabIndex={0}
          role="application"
          aria-label="TV guide. Left and right move through time, up and down change channel, OK to watch."
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onClick={onGridClick}
        >
          <div className="tl-ruler">
            <div className="tl-spacer" />
            <div className="tl-lane">
              <div className="tl-inner">{ticks}</div>
            </div>
          </div>
          {gridRows}
          {chans.length === 0 && <p className="tl-hint" style={{ padding: 16 }}>No live channels to show yet.</p>}
        </div>
        <div className="tl-cursor" ref={lineRef}>
          <div className="tl-bubble" ref={bubbleRef} />
        </div>

        {results && (
          <div className="tl-results">
            <div className="tl-rhead">
              <b>Results for “{dq}”</b>
              <button type="button" className="tl-btn" onClick={clearSearch}>
                Close
              </button>
            </div>
            {results.mv.length + results.sr.length + results.ch.length + results.tv.length === 0 && (
              <p className="tl-hint">No matches. Try a title, an actor, a team or a channel.</p>
            )}
            {results.mv.length > 0 && <h3>Movies · {results.mv.length}</h3>}
            {results.mv.map((m) => (
              <button key={'m' + m.stream_id} type="button" className="tl-res" onClick={() => onOpenMovie && onOpenMovie(m)}>
                <span className="tl-rk">Film</span>
                <span className="tl-rt"><b>{m.name}</b></span>
                <span className="tl-go">Open</span>
              </button>
            ))}
            {results.sr.length > 0 && <h3>Series · {results.sr.length}</h3>}
            {results.sr.map((s) => (
              <button key={'s' + s.series_id} type="button" className="tl-res" onClick={() => onOpenSeries && onOpenSeries(s)}>
                <span className="tl-rk">Series</span>
                <span className="tl-rt"><b>{s.name}</b></span>
                <span className="tl-go">Open</span>
              </button>
            ))}
            {results.tv.length > 0 && <h3>On TV · your channels</h3>}
            {results.tv.map((o) => (
              <button
                key={o.c.stream_id + ':' + o.p.start}
                type="button"
                className="tl-res"
                onClick={() => {
                  clearSearch();
                  goTo(o.r, o.p);
                }}
              >
                <span className="tl-rk">TV</span>
                <span className="tl-rt">
                  <b>{o.p.title}</b>
                  <span className="tl-rm">{o.c.name} · {hm(o.p.start)} – {hm(o.p.end)}</span>
                </span>
                <span className={'tl-go' + (o.rank === 0 ? ' lv' : '')}>{o.rank === 0 ? 'LIVE' : o.rank === 2 ? '↺ Replay' : dayhm(o.p.start)}</span>
              </button>
            ))}
            {results.ch.length > 0 && <h3>Channels · {results.ch.length}</h3>}
            {results.ch.map((c) => (
              <button key={'c' + c.stream_id} type="button" className="tl-res" onClick={() => onPlayLive && onPlayLive(c)}>
                <span className="tl-rk">Live</span>
                <span className="tl-rt"><b>{c.name}</b></span>
                <span className="tl-go lv">Watch</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="tl-detail">
        <div className="tl-txt">
          <h1>
            {selProg && matchFollow(follows, selProg.title, selProg.desc) && <span className="tl-star">★ </span>}
            {selProg ? selProg.title : selCh ? selCh.name : 'Timeline'}
          </h1>
          <div className="tl-meta">
            {selCh && <>{selCh.num || sel + 1} {selCh.name}{selProg ? ` · ${hm(selProg.start)} – ${hm(selProg.end)}` : ''} · </>}
            {statusLine()}
          </div>
          {selProg && selProg.desc && <p className="tl-desc">{selProg.desc}</p>}
        </div>
        <div className="tl-acts">
          {selCh && (!selProg || status === 'live') && (
            <button type="button" className="tl-btn main" onClick={() => onPlayLive && onPlayLive(selCh)}>
              ▶ Watch live
            </button>
          )}
          {canStartOver && (
            <button type="button" className="tl-btn" onClick={() => onPlayCatchup(catchupItem(creds, selCh, selProg))}>
              ↺ Start over
            </button>
          )}
          {status === 'past' && (
            <button type="button" className={'tl-btn' + (canReplay ? ' main' : '')} disabled={!canReplay} onClick={primary}>
              {canReplay ? '▶ Watch replay' : 'No replay'}
            </button>
          )}
          {status === 'future' && (
            <button type="button" className="tl-btn main" onClick={toggleRemind}>
              {remind[remindId] ? 'Reminder on ✓' : '⏰ Remind me'}
            </button>
          )}
          {selProg && (
            <button type="button" className="tl-btn gold" onClick={() => toggleFollowTitle(selProg.title)}>
              {folTitle ? 'Following ✓' : '★ Follow this show'}
            </button>
          )}
        </div>
      </div>
      <p className="tl-hint tl-kb">Drag the guide sideways, or on a remote: ← → move through time, ↑ ↓ change channel, OK to watch, Menu to follow.</p>

      <div className="tl-vod">
        {continueList.length > 0 && (
          <>
            <h3>On demand · Continue watching</h3>
            <div className="tl-rail">
              {continueList.slice(0, 20).map((rec) => (
                <Poster
                  key={rec.key}
                  img={rec.item.stream_icon}
                  title={rec.item.seriesName || rec.item.name}
                  sub={rec.type === 'episode' ? rec.item.name : 'Film'}
                  progress={rec.duration ? rec.position / rec.duration : 0}
                  followed={!!matchFollow(follows, rec.item.seriesName || rec.item.name)}
                  onClick={() => onOpenContinue && onOpenContinue(rec)}
                />
              ))}
            </div>
          </>
        )}
        {newMovies.length > 0 && (
          <>
            <h3>On demand · New films</h3>
            <div className="tl-rail">
              {newMovies.map((m) => (
                <Poster key={m.stream_id} img={m.stream_icon} title={m.name} sub="Film" followed={!!matchFollow(follows, m.name)} onClick={() => onOpenMovie && onOpenMovie(m)} />
              ))}
            </div>
          </>
        )}
        {newSeries.length > 0 && (
          <>
            <h3>On demand · New series</h3>
            <div className="tl-rail">
              {newSeries.map((s) => (
                <Poster key={s.series_id} img={s.cover} title={s.name} sub="Series" followed={!!matchFollow(follows, s.name)} onClick={() => onOpenSeries && onOpenSeries(s)} />
              ))}
            </div>
          </>
        )}
      </div>

      {toast && <div className="tl-toast">{toast}</div>}
    </div>
  );
}

// =====================================================================
// FollowAlert: mount once in App.jsx. When something you follow (or set a reminder for)
// is about to start on another channel, a small "Switch" prompt appears, even while you watch.
// It uses the guide data Timeline has loaded, so open Timeline once per session to fill it.
export function FollowAlert({ creds, currentStreamId, onSwitch }) {
  const user = (creds && creds.username) || '';
  const [item, setItem] = useState(null);
  const shown = useRef(new Set());

  useEffect(() => {
    const check = () => {
      const follows = lsGet(followKey(user), []);
      const remind = lsGet(remindKey(user), {});
      const n = Date.now();
      let best = null;
      GUIDE.forEach((entry, id) => {
        if (String(id) === String(currentStreamId)) return;
        entry.items.forEach((p) => {
          if (p.start < n - 60000 || p.start > n + ALERT_LEAD_MIN * MIN + 30000) return;
          const key = `${id}:${p.start}`;
          if (shown.current.has(key)) return;
          const f = remind[key] ? 'reminder' : matchFollow(follows, p.title, p.desc);
          if (!f) return;
          if (!best || p.start < best.p.start) best = { key, p, ch: entry.ch, f };
        });
      });
      if (best) {
        shown.current.add(best.key);
        setItem(best);
      }
    };
    check();
    const id = setInterval(check, 20000);
    window.addEventListener(CHANGED, check);
    return () => {
      clearInterval(id);
      window.removeEventListener(CHANGED, check);
    };
  }, [user, currentStreamId]);

  useEffect(() => {
    if (!item) return;
    const id = setTimeout(() => setItem(null), 30000);
    return () => clearTimeout(id);
  }, [item]);

  if (!item) return null;
  const mins = Math.max(0, Math.round((item.p.start - Date.now()) / MIN));
  return (
    <div className="tl-alert" role="alert">
      <style>{CSS}</style>
      <div>
        <b>★ {item.p.title}</b> {mins <= 0 ? 'is starting' : `starts in ${mins} min`} on {item.ch.name}.
        <br />
        <small>{item.f === 'reminder' ? 'You set a reminder.' : `You follow “${item.f}”.`}</small>
      </div>
      <button
        type="button"
        className="tl-btn main"
        data-tv-autofocus
        onClick={() => {
          setItem(null);
          onSwitch && onSwitch(item.ch);
        }}
      >
        Switch
      </button>
      <button type="button" className="tl-btn" onClick={() => setItem(null)}>
        Not now
      </button>
    </div>
  );
}

// ---------- styles (matches the app's navy and blue; classes are all tl- prefixed) ----------
const CSS = `
.tl{--tl-bg:var(--pt-panel, #0b1730);--tl-s1:var(--pt-card, #11223e);--tl-s2:var(--pt-card, #162a4d);--tl-line:var(--pt-line, #1f3358);--tl-fg:var(--pt-text, #fff);--tl-mut:var(--pt-mut, #9fb0cf);--tl-now:#ff5d73;--tl-gold:#f5c518;--tl-acc:var(--pt-acc, #55b2f2);color:var(--tl-fg);display:flex;flex-direction:column;gap:12px}
.tl *{box-sizing:border-box}
.tl-head{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
.tl-head h2{margin:0;font-size:22px}
.tl-sp{flex:1}
.tl-in{background:var(--tl-s1,#11223e);border:1px solid var(--tl-line,#1f3358);color:var(--pt-text, #fff);border-radius:10px;padding:9px 12px;min-height:42px;font:inherit;min-width:0}
.tl-head .tl-in{flex:1 1 220px;max-width:360px}
.tl-btn{background:var(--tl-s2,#162a4d);border:1px solid var(--tl-line,#1f3358);color:var(--pt-text, #fff);border-radius:10px;padding:9px 13px;font:inherit;font-weight:600;min-height:42px;cursor:pointer}
.tl-btn:hover{border-color:var(--pt-mut, #9fb0cf)}
.tl-btn.main{background:#ff5d73;border-color:#ff5d73;color:#16060a}
.tl-btn.gold{border-color:#f5c518;color:#f5c518}
.tl-btn[disabled]{opacity:.45;cursor:default}
.tl button:focus-visible,.tl input:focus-visible,.tl-grid:focus-visible,.tl-alert button:focus-visible{outline:3px solid #f5c518;outline-offset:2px}
.tl-hint{color:var(--tl-mut,#9fb0cf);font-size:13px;margin:0}
.tl-follow{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.tl-chips{display:flex;gap:6px;overflow-x:auto;flex:1;min-width:0;padding:2px 0}
.tl-chip{white-space:nowrap;border:1px solid #f5c518;color:#f5c518;border-radius:99px;padding:3px 6px 3px 10px;font-size:13px;display:flex;gap:4px;align-items:center;background:rgba(245,197,24,.08)}
.tl-chip button{background:none;border:0;color:inherit;font-size:17px;line-height:1;padding:0 4px;cursor:pointer}
.tl-follow form{display:flex;gap:6px}
.tl-follow .tl-in{width:200px}
.tl-tonight{display:flex;gap:8px;overflow-x:auto;padding-bottom:2px;align-items:stretch}
.tl-tonight h3,.tl-vod h3,.tl-results h3{margin:0;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--tl-mut,#9fb0cf);font-weight:600}
.tl-tonight h3{writing-mode:vertical-rl;transform:rotate(180deg);align-self:center}
.tl-card{flex:0 0 auto;width:200px;text-align:left;background:var(--tl-s1,#11223e);border:1px solid var(--tl-line,#1f3358);border-radius:12px;padding:8px 10px;color:var(--pt-text, #fff);display:flex;flex-direction:column;gap:2px;cursor:pointer;font:inherit}
.tl-card:hover{border-color:#f5c518}
.tl-card b{font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tl-card small{color:var(--tl-mut,#9fb0cf);font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tl-card em{font-style:normal;color:#f5c518;font-size:11px}
.tl-wrap{position:relative;border:1px solid var(--tl-line,#1f3358);border-radius:14px;background:var(--tl-s1,#11223e);overflow:hidden}
.tl-grid{--lw:76px;--ppm:2px;max-height:56vh;min-height:200px;overflow-y:auto;overflow-x:hidden;touch-action:pan-y;user-select:none;-webkit-user-select:none;cursor:grab}
.tl.narrow .tl-grid{max-height:50vh}
.tl-ruler,.tl-row{display:flex}
.tl-ruler{position:sticky;top:0;z-index:3;background:var(--tl-s2,#162a4d);border-bottom:1px solid var(--tl-line,#1f3358);height:30px}
.tl-spacer,.tl-chl{flex:0 0 var(--lw);width:var(--lw)}
.tl-chl{padding:6px 8px;background:var(--tl-s1,#11223e);border-right:1px solid var(--tl-line,#1f3358);border-bottom:1px solid var(--tl-line,#1f3358);z-index:2;display:flex;flex-direction:column;justify-content:center;min-width:0;cursor:default}
.tl-chl b{font-size:13px;color:var(--tl-mut,#9fb0cf)}
.tl-chl span{font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.tl.narrow .tl-chl span{display:none}
.tl-row.sel .tl-chl{background:var(--tl-s2,#162a4d)}
.tl-row.sel .tl-chl b{color:#ff5d73}
.tl-lane{flex:1;position:relative;overflow:hidden;height:62px;border-bottom:1px solid var(--tl-line,#1f3358)}
.tl-ruler .tl-lane{height:30px;border:0}
.tl-inner{position:absolute;left:0;top:0;height:100%;will-change:transform;width:calc(2880 * var(--ppm))}
.tl-msg{position:absolute;left:10px;top:50%;transform:translateY(-50%);color:var(--tl-mut,#9fb0cf);font-size:12px;z-index:1}
.tl-tick{position:absolute;top:0;height:100%;left:calc(var(--s) * var(--ppm));border-left:1px solid var(--tl-line,#1f3358);padding:7px 0 0 5px;font-size:11px;color:var(--tl-mut,#9fb0cf);white-space:nowrap}
.tl-tick.h{color:var(--pt-text, #fff)}
.tl-nowmark{position:absolute;top:0;bottom:0;left:calc(var(--now) * var(--ppm));border-left:1px dashed rgba(255,93,115,.55);pointer-events:none}
.tl-prog{position:absolute;top:5px;bottom:5px;left:calc(var(--s) * var(--ppm));width:calc(var(--d) * var(--ppm) - 3px);background:hsl(var(--h) 34% 17%);border:1px solid hsl(var(--h) 30% 26%);border-left:3px solid hsl(var(--h) 62% 56%);border-radius:8px;padding:5px 7px;overflow:hidden;display:flex;flex-direction:column;justify-content:center;gap:1px}
.tl-prog b{font-size:13px;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tl-prog small{font-size:11px;color:var(--tl-mut,#9fb0cf);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tl-prog.past{opacity:.6}
.tl-prog.past.noarch{opacity:.3}
.tl-prog.live{background:hsl(var(--h) 38% 22%)}
.tl-prog.fol{border-color:#f5c518;box-shadow:0 0 0 1px #f5c518,0 0 16px rgba(245,197,24,.45);opacity:1}
.tl-prog.sel{background:hsl(var(--h) 45% 28%);outline:2px solid var(--pt-text, #fff);outline-offset:-2px;opacity:1}
.tl-live{color:#ff5d73;font-size:10px;font-weight:700;letter-spacing:.06em}
.tl-star,.tl-gold{color:#f5c518}
.tl-cursor{position:absolute;top:0;bottom:0;width:2px;background:#ff5d73;pointer-events:none;z-index:4}
.tl-bubble{position:absolute;top:3px;left:50%;transform:translateX(-50%);background:#ff5d73;color:#16060a;font-size:12px;font-weight:700;border-radius:99px;padding:3px 10px;white-space:nowrap}
.tl-results{position:absolute;inset:0;z-index:6;background:var(--tl-s1,#11223e);overflow-y:auto;padding:10px 12px 14px;display:flex;flex-direction:column;gap:6px}
.tl-rhead{display:flex;justify-content:space-between;align-items:center;gap:8px}
.tl-results h3{margin-top:8px}
.tl-res{display:flex;gap:10px;align-items:center;width:100%;text-align:left;background:var(--tl-s2,#162a4d);border:1px solid var(--tl-line,#1f3358);border-radius:10px;padding:8px 10px;color:var(--pt-text, #fff);cursor:pointer;font:inherit}
.tl-res:hover{border-color:var(--pt-mut, #9fb0cf)}
.tl-rk{flex:0 0 auto;font-size:10px;letter-spacing:.06em;text-transform:uppercase;background:rgba(255,255,255,.08);border-radius:5px;padding:2px 6px;color:var(--tl-mut,#9fb0cf)}
.tl-rt{flex:1;min-width:0;display:flex;flex-direction:column}
.tl-rt b{font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tl-rm{font-size:12px;color:var(--tl-mut,#9fb0cf);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tl-go{flex:0 0 auto;font-size:12px;font-weight:600;color:#f5c518}
.tl-go.lv{color:#ff5d73}
.tl-detail{background:var(--tl-s1,#11223e);border:1px solid var(--tl-line,#1f3358);border-radius:14px;padding:12px 14px;display:flex;gap:12px;align-items:center;flex-wrap:wrap}
.tl-txt{flex:1 1 260px;min-width:0}
.tl-detail h1{font-size:20px;line-height:1.15;margin:0 0 2px}
.tl-meta{color:var(--tl-mut,#9fb0cf);font-size:13px}
.tl-desc{margin:4px 0 0;font-size:13px}
.tl-acts{display:flex;gap:8px;flex-wrap:wrap}
.tl-vod{display:flex;flex-direction:column;gap:6px;padding-top:4px}
.tl-rail{display:flex;gap:10px;overflow-x:auto;padding:4px 2px 10px}
.tl-poster{flex:0 0 120px;height:176px;position:relative;overflow:hidden;border-radius:10px;border:1px solid var(--tl-line,#1f3358);background:linear-gradient(160deg,var(--pt-line, #234070),var(--pt-panel, #0e1c36));color:var(--pt-text, #fff);text-align:left;padding:0;cursor:pointer;font:inherit}
.tl-poster img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.tl-ptxt{position:absolute;left:0;right:0;bottom:0;padding:22px 8px 7px;background:linear-gradient(transparent,rgba(5,10,22,.92));display:flex;flex-direction:column;gap:1px}
.tl-ptxt b{font-size:12px;line-height:1.2;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.tl-ptxt small{font-size:11px;color:var(--pt-text, #c3cde6);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tl-pstar{position:absolute;top:5px;right:8px;color:#f5c518}
.tl-poster.fol{border-color:#f5c518;box-shadow:0 0 0 1px #f5c518,0 0 14px rgba(245,197,24,.4)}
.tl-pbar{position:absolute;left:0;right:0;bottom:0;height:4px;background:rgba(255,255,255,.2)}
.tl-pbar u{display:block;height:100%;background:#ff5d73}
.tl-toast{position:fixed;left:50%;bottom:18px;transform:translateX(-50%);background:var(--pt-card, #162a4d);border:1px solid var(--pt-line, #1f3358);border-radius:99px;padding:8px 16px;z-index:60;font-weight:600;color:var(--pt-text, #fff)}
.tl-alert{position:fixed;right:16px;bottom:16px;z-index:70;max-width:min(460px,calc(100vw - 32px));background:var(--pt-card, #162a4d);color:var(--pt-text, #fff);border:1px solid #f5c518;border-radius:14px;padding:12px 14px;display:flex;gap:10px;align-items:center;flex-wrap:wrap;box-shadow:0 0 28px rgba(245,197,24,.28)}
.tl-alert>div{flex:1 1 200px}
.tl-alert b{color:#f5c518}
.tl-alert .tl-btn{background:var(--pt-card, #162a4d);border:1px solid var(--pt-line, #1f3358);color:var(--pt-text, #fff);border-radius:10px;padding:9px 13px;font:inherit;font-weight:600;min-height:42px;cursor:pointer}
.tl-alert .tl-btn.main{background:#ff5d73;border-color:#ff5d73;color:#16060a}
@media (max-width:640px){.tl-follow>.tl-hint,.tl-chips .tl-hint{display:none}.tl-follow .tl-in{width:130px}.tl-head h2{font-size:18px}.tl-desc{display:none}.tl-kb{display:none}.tl-tonight h3{display:none}.tl-card{width:150px}.tl-card small{display:none}.tl-lane{height:54px}}
@media (prefers-reduced-motion:reduce){.tl *{transition:none!important;animation:none!important}}
`;
