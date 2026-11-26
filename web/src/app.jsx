import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Play, Film, Tv, Settings, User, LogOut, Eye, EyeOff, ArrowLeft, Star, Clock, X, SkipForward,
  Lock, Unlock, Download, Upload, RefreshCw, Calendar, Copy, ExternalLink, ChevronLeft, ChevronRight,
  RotateCcw, RotateCw, Maximize, PictureInPicture2, Search, Check, Trophy, LayoutGrid, Mic,
} from 'lucide-react';
import Hls from 'hls.js';
import Timeline, { FollowAlert, catchupItem, hasArchive } from './Timeline.jsx';
import { processLive, loadLiveOpts, saveLiveOpts, countriesFound, groupCountries, ctyName, QUALITIES, qualOf, altsOf } from './channels.js';
import HelpPanel from './help.jsx';
import { SportView, MultiviewView, ScreenSaver, SpeedTest, CopySetup } from './extras.jsx';
import Appearance from './Appearance.jsx';
import { SERVER, BrandMark, AppUpdate } from './brand.jsx';

// --- Styles ---
const styles = {
  appContainer: {
    fontFamily: 'Segoe UI, Roboto, Helvetica Neue, sans-serif',
    backgroundColor: 'var(--pt-bg, #050a11)',
    color: 'var(--pt-text, #fff)',
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 20px',
    backgroundColor: 'var(--pt-panel, #0a1426)',
    borderBottom: '1px solid var(--pt-line, #1a2c4e)',
  },
  headerLeft: { display: 'flex', alignItems: 'center', gap: '15px' },
  profilePic: { color: 'var(--pt-text, #ddd)' },
  welcomeText: { margin: 0, fontSize: '20px', fontWeight: 'normal' },
  dateTime: { margin: 0, fontSize: '12px', color: 'var(--pt-mut, #aaa)' },
  headerRight: { display: 'flex', alignItems: 'center', gap: '10px' },
  helpButton: {
    background: 'none', border: 'none', color: 'var(--pt-text, #ddd)', cursor: 'pointer', padding: '5px',
  },
  mainContent: { display: 'flex', flex: 1 },
  mainMenu: {
    width: '100px',
    backgroundColor: 'var(--pt-panel, #0a1426)',
    borderRight: '1px solid var(--pt-line, #1a2c4e)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '15px',
    padding: '20px 0',
  },
  menuItem: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
    width: '80%', padding: '15px 10px', border: 'none', background: 'none',
    color: 'var(--pt-mut, #aaa)', cursor: 'pointer', fontSize: '12px',
  },
  menuItemActive: { color: 'var(--pt-acc, #55b2f2)', fontWeight: 'bold' },
  // Phone layout: menu becomes a bar along the bottom
  mainMenuNarrow: {
    position: 'fixed', bottom: 0, left: 0, right: 0, width: '100%', zIndex: 50,
    flexDirection: 'row', justifyContent: 'space-around', alignItems: 'stretch',
    gap: 0, padding: '4px 0', borderRight: 'none', borderTop: '1px solid var(--pt-line, #1a2c4e)',
    boxSizing: 'border-box',
  },
  menuItemNarrow: { width: 'auto', flex: 1, gap: '3px', padding: '6px 2px', fontSize: '10px' },
  contentAreaNarrow: { padding: '14px 12px 90px', overflowY: 'visible' },
  contentArea: { flex: 1, padding: '20px', overflowY: 'auto' },
  sectionHeader: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
    gap: '15px',
  },
  card: {
    position: 'relative',
    backgroundColor: 'var(--pt-card, #11223e)',
    border: '1px solid var(--pt-line, #1a2c4e)',
    borderRadius: '8px',
    padding: '12px',
    cursor: 'pointer',
    textAlign: 'center',
    transition: 'background 0.2s',
  },
  favButton: {
    position: 'absolute',
    top: '8px',
    right: '8px',
    zIndex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '6px',
    border: 'none',
    borderRadius: '50%',
    backgroundColor: 'rgba(5, 10, 17, 0.75)',
    cursor: 'pointer',
  },
  favHeading: { color: 'var(--pt-acc, #55b2f2)', margin: '24px 0 12px' },
  searchInput: {
    width: '100%',
    maxWidth: '420px',
    padding: '12px 14px',
    marginBottom: 0,
    backgroundColor: 'var(--pt-card, #11223e)',
    border: '1px solid var(--pt-line, #1a2c4e)',
    borderRadius: '8px',
    color: 'var(--pt-text, #fff)',
    fontSize: '15px',
    boxSizing: 'border-box',
  },
  poster: {
    width: '100%',
    aspectRatio: '2/3',
    objectFit: 'cover',
    borderRadius: '6px',
    backgroundColor: 'var(--pt-line, #1a2c4e)',
    marginBottom: '8px',
  },
  cardTitle: { fontSize: '13px', margin: '6px 0 2px', lineHeight: 1.3 },
  filterRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '12px',
    marginBottom: '18px',
  },
  select: {
    padding: '12px 14px',
    backgroundColor: 'var(--pt-card, #11223e)',
    border: '1px solid var(--pt-line, #1a2c4e)',
    borderRadius: '8px',
    color: 'var(--pt-text, #fff)',
    fontSize: '15px',
    maxWidth: '100%',
    boxSizing: 'border-box',
  },
  progressTrack: {
    height: '4px',
    backgroundColor: 'var(--pt-line, #1a2c4e)',
    borderRadius: '2px',
    overflow: 'hidden',
    marginTop: '8px',
  },
  progressFill: { height: '100%', backgroundColor: 'var(--pt-acc, #55b2f2)' },
  smallText: { color: 'var(--pt-mut, #aaa)', fontSize: '12px', margin: '4px 0 0' },
  secondaryButton: {
    background: 'none',
    border: '1px solid var(--pt-line, #1a2c4e)',
    color: 'var(--pt-mut, #aaa)',
    borderRadius: '8px',
    padding: '8px 14px',
    cursor: 'pointer',
    fontSize: '13px',
  },
  loginBox: {
    maxWidth: '420px', margin: '60px auto', backgroundColor: 'var(--pt-panel, #0a1426)',
    border: '1px solid var(--pt-line, #1a2c4e)', borderRadius: '12px', padding: '30px',
  },
  input: {
    width: '100%', padding: '12px 14px', marginBottom: '14px',
    backgroundColor: 'var(--pt-card, #11223e)', border: '1px solid var(--pt-line, #1a2c4e)', borderRadius: '8px',
    color: 'var(--pt-text, #fff)', fontSize: '15px', boxSizing: 'border-box',
  },
  button: {
    width: '100%', padding: '13px', backgroundColor: 'var(--pt-acc, #55b2f2)', color: '#000',
    border: 'none', borderRadius: '8px', fontSize: '16px', fontWeight: 'bold',
    cursor: 'pointer', marginTop: '8px',
  },
  passwordWrapper: { position: 'relative' },
  eyeButton: {
    position: 'absolute', right: '12px', top: '12px', background: 'none',
    border: 'none', color: 'var(--pt-mut, #aaa)', cursor: 'pointer',
  },
  error: { color: '#ff6b6b', marginBottom: '12px', fontSize: '14px' },
  banner: {
    textAlign: 'center',
    padding: '14px 20px',
    background: 'linear-gradient(90deg, var(--pt-panel, #0a1426), var(--pt-card, #11223e), var(--pt-panel, #0a1426))',
    borderBottom: '2px solid var(--pt-acc, #55b2f2)',
    color: 'var(--pt-acc, #55b2f2)',
    fontSize: '22px',
    fontWeight: 'bold',
    letterSpacing: '2px',
  },
  playerContainer: {
    backgroundColor: '#000', borderRadius: '10px', overflow: 'hidden',
    marginBottom: '20px', aspectRatio: '16/9', maxHeight: '55vh',
  },
  video: { width: '100%', height: '100%', display: 'block' },
  nowPlaying: { fontSize: '18px', marginBottom: '8px', color: 'var(--pt-acc, #55b2f2)' },
  backButton: {
    display: 'flex', alignItems: 'center', gap: '6px',
    background: 'none', border: 'none', color: 'var(--pt-acc, #55b2f2)',
    cursor: 'pointer', fontSize: '14px', marginBottom: '15px',
  },
  actionButton: {
    display: 'inline-flex', alignItems: 'center', gap: '8px',
    padding: '12px 24px', backgroundColor: 'var(--pt-acc, #55b2f2)', color: '#000',
    border: 'none', borderRadius: '8px', fontSize: '15px', fontWeight: 'bold',
    cursor: 'pointer',
  },
  actionButtonAlt: {
    display: 'inline-flex', alignItems: 'center', gap: '8px',
    padding: '12px 20px', backgroundColor: 'transparent', color: 'var(--pt-text, #ddd)',
    border: '1px solid var(--pt-line, #1a2c4e)', borderRadius: '8px', fontSize: '15px',
    cursor: 'pointer',
  },
  actionRow: { display: 'flex', flexWrap: 'wrap', gap: '12px', margin: '18px 0' },
  detailWrap: { display: 'flex', flexWrap: 'wrap', gap: '24px', alignItems: 'flex-start' },
  detailPoster: {
    width: '200px', maxWidth: '100%', aspectRatio: '2/3', objectFit: 'cover',
    borderRadius: '10px', backgroundColor: 'var(--pt-line, #1a2c4e)',
  },
  detailBody: { flex: 1, minWidth: '260px', maxWidth: '720px' },
  detailMeta: { color: 'var(--pt-mut, #aaa)', fontSize: '14px', margin: '6px 0 14px' },
  detailLabel: { color: 'var(--pt-acc, #55b2f2)', fontWeight: 'bold' },
  epgBox: {
    backgroundColor: 'var(--pt-panel, #0a1426)', border: '1px solid var(--pt-line, #1a2c4e)', borderRadius: '10px',
    padding: '12px 16px', marginBottom: '20px',
  },
  settingsSection: {
    backgroundColor: 'var(--pt-panel, #0a1426)', border: '1px solid var(--pt-line, #1a2c4e)', borderRadius: '10px',
    padding: '16px 18px', margin: '18px 0', maxWidth: '640px',
  },
  settingsTitle: { margin: '0 0 10px', fontSize: '17px', color: 'var(--pt-acc, #55b2f2)' },
  accountRow: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px',
    padding: '10px 12px', marginBottom: '8px', backgroundColor: 'var(--pt-card, #11223e)',
    border: '1px solid var(--pt-line, #1a2c4e)', borderRadius: '8px',
  },
  accountMain: {
    flex: 1, textAlign: 'left', background: 'none', border: 'none', color: 'var(--pt-text, #fff)',
    cursor: 'pointer', fontSize: '14px', padding: 0, minWidth: 0, overflow: 'hidden',
    textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  iconButton: {
    background: 'none', border: 'none', color: 'var(--pt-mut, #aaa)', cursor: 'pointer', padding: '4px',
    display: 'flex', alignItems: 'center',
  },
  pinInput: {
    padding: '12px 14px', backgroundColor: 'var(--pt-card, #11223e)', border: '1px solid var(--pt-line, #1a2c4e)',
    borderRadius: '8px', color: 'var(--pt-text, #fff)', fontSize: '18px', letterSpacing: '6px',
    width: '140px', boxSizing: 'border-box',
  },
  checkList: {
    maxHeight: '260px', overflowY: 'auto', backgroundColor: 'var(--pt-card, #11223e)',
    border: '1px solid var(--pt-line, #1a2c4e)', borderRadius: '8px', padding: '8px 12px', marginTop: '10px',
  },
  checkRow: {
    display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 0',
    color: 'var(--pt-text, #ddd)', fontSize: '14px', cursor: 'pointer',
  },
  note: { color: 'var(--pt-mut, #aaa)', fontSize: '13px', margin: '8px 0 0', lineHeight: 1.4 },
  guideRow: {
    display: 'flex', alignItems: 'center', gap: '14px', padding: '12px 14px',
    marginBottom: '10px', backgroundColor: 'var(--pt-card, #11223e)', border: '1px solid var(--pt-line, #1a2c4e)',
    borderRadius: '8px', cursor: 'pointer',
  },
  guideIcon: {
    width: '52px', height: '52px', objectFit: 'contain', flexShrink: 0,
    borderRadius: '6px', backgroundColor: 'var(--pt-line, #1a2c4e)',
  },
  guideBody: { flex: 1, minWidth: 0 },
};

// --- TV look (inside the PRIMO TV app on a TV box) ---
// Compact, TiviMate-style: darker greys, smaller posters so more fit on screen,
// slimmer header and menu. Phone and computer browsers keep the normal look.
const IS_TV = typeof window !== 'undefined' && !!window.PrimoNative;
if (IS_TV) {
  const bg = 'var(--pt-bg, #111316)';
  const panel = 'var(--pt-panel, #16191d)';
  const line = 'var(--pt-line, #262b33)';
  const card = 'var(--pt-card, #1c2026)';
  Object.assign(styles, {
    appContainer: { ...styles.appContainer, backgroundColor: bg },
    banner: { ...styles.banner, padding: '6px 16px', fontSize: '15px', background: panel, borderBottom: `1px solid ${line}` },
    header: { ...styles.header, padding: '4px 16px', backgroundColor: panel, borderBottom: `1px solid ${line}` },
    welcomeText: { ...styles.welcomeText, fontSize: '15px' },
    dateTime: { ...styles.dateTime, fontSize: '11px' },
    mainMenu: { ...styles.mainMenu, width: '78px', backgroundColor: panel, borderRight: `1px solid ${line}`, gap: '4px', padding: '10px 0' },
    menuItem: { ...styles.menuItem, padding: '10px 4px', gap: '4px', fontSize: '11px', width: '90%', borderRadius: '6px' },
    contentArea: { ...styles.contentArea, padding: '12px 16px' },
    sectionHeader: { ...styles.sectionHeader, marginBottom: '10px' },
    grid: { ...styles.grid, gridTemplateColumns: 'repeat(auto-fill, minmax(84px, 1fr))', gap: '8px' },
    card: { ...styles.card, backgroundColor: card, border: `1px solid ${line}`, borderRadius: '6px', padding: '4px' },
    poster: { ...styles.poster, borderRadius: '4px', marginBottom: '4px', backgroundColor: 'var(--pt-card, #23272e)' },
    cardTitle: { ...styles.cardTitle, fontSize: '11px', margin: '3px 0 1px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
    smallText: { ...styles.smallText, fontSize: '11px' },
    favButton: { ...styles.favButton, top: '4px', right: '4px', padding: '3px' },
    searchInput: { ...styles.searchInput, backgroundColor: card, border: `1px solid ${line}`, padding: '8px 12px', fontSize: '14px' },
    select: { ...styles.select, backgroundColor: card, border: `1px solid ${line}` },
    playerContainer: { ...styles.playerContainer, maxHeight: '45vh' },
    detailPoster: { ...styles.detailPoster, width: '160px' },
    settingsSection: { ...styles.settingsSection, backgroundColor: card },
    guideRow: { ...styles.guideRow },
    guideIcon: { ...styles.guideIcon, width: '40px', height: '40px' },
  });
}

// Every provider request goes to /api/proxy, which the PRIMO TV app answers on the box.
async function apiCall(server, username, password, action = '', extra = {}) {
  const params = new URLSearchParams({ url: server, username, password });
  if (action) params.set('action', action);
  Object.entries(extra).forEach(([k, v]) => params.set(k, v));

  const res = await fetch(`/api/proxy?${params.toString()}`);
  const text = await res.text();

  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`Server replied: ${text.slice(0, 100)}`);
  }
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

// Star button shown on every card
// Loads the next page of a long list when you scroll near the bottom
function AutoLoad({ onVisible }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) onVisible();
      },
      { rootMargin: '600px' }
    );
    io.observe(el);
    return () => io.disconnect();
  });
  return <div ref={ref} style={{ height: 1 }} />;
}

function FavButton({ active, onClick }) {
  return (
    <button
      type="button"
      style={styles.favButton}
      onClick={onClick}
      title={active ? 'Remove from favourites' : 'Add to favourites'}
      aria-label={active ? 'Remove from favourites' : 'Add to favourites'}
    >
      <Star
        size={18}
        color={active ? '#f5c518' : '#aaa'}
        fill={active ? '#f5c518' : 'none'}
      />
    </button>
  );
}

const EMPTY_FAVS = { live: [], movie: [], series: [] };
const PAGE = 100; // how many cards show at a time before "Load more"
const MAX_CONTINUE = 30; // how many items "Continue" remembers

// Live and movies are identified by stream_id, series by series_id
const idOf = (type, item) => (type === 'series' ? item.series_id : item.stream_id);

// Movies and episodes are tracked for "Continue"; live TV is not
// FHD / HD / 4K / SD tag, coloured so the best qualities stand out.
const QCOL = { '4K': '#c084fc', FHD: '#55b2f2', HD: '#3ecf8e', SD: '#9aa3b2' };
function QualityBadge({ name }) {
  const q = qualOf(name);
  if (!q) return null;
  return (
    <span
      style={{
        flexShrink: 0, fontSize: 10, fontWeight: 800, letterSpacing: 0.5, padding: '1px 5px', borderRadius: 4,
        color: '#000', background: QCOL[q] || '#9aa3b2', lineHeight: '14px',
      }}
    >
      {q}
    </span>
  );
}

const progressKeyOf = (item) => {
  if (item.type === 'movie') return `movie:${item.stream_id}`;
  if (item.type === 'episode') return `episode:${item.id}`;
  return null;
};

const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });
const addedOf = (i) => Number(i.added || i.last_modified || 0);

const formatTime = (s) => {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  const mm = String(m).padStart(h ? 2 : 1, '0');
  const ss = String(sec).padStart(2, '0');
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
};

// Provider guide data (titles and descriptions) usually arrives base64-encoded
const decodeB64 = (s) => {
  if (!s) return '';
  try {
    const bin = atob(s);
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return s;
  }
};

const clock = (ms) =>
  new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

// Programme guide entries from the provider, oldest first
const parseEpg = (data) =>
  (data && Array.isArray(data.epg_listings) ? data.epg_listings : [])
    .map((l) => ({
      title: decodeB64(l.title),
      description: decodeB64(l.description),
      start: Number(l.start_timestamp) * 1000,
      end: Number(l.stop_timestamp || l.end_timestamp) * 1000,
    }))
    .sort((a, b) => (a.start || 0) - (b.start || 0));

const dayLabel = (ms) =>
  new Date(ms).toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' });

const GUIDE_MAX = 40; // favourite channels shown in the TV guide

// Stream links to try for whatever is playing, best first.
// If one fails, the player moves on to the next one automatically.
const buildStreamUrls = (creds, item) => {
  if (!creds || !item) return [];
  if (item.type === 'catchup') return item.urls || [];
  const { server: srv } = creds;
  // Encode so characters like # ? / & in a username or password don't break the link
  const u = encodeURIComponent(creds.username);
  const p = encodeURIComponent(creds.password);
  if (item.type === 'live') {
    return [
      `${srv}/live/${u}/${p}/${item.stream_id}.m3u8`,
      `${srv}/${u}/${p}/${item.stream_id}.m3u8`,
    ];
  }
  const kind = item.type === 'movie' ? 'movie' : item.type === 'episode' ? 'series' : '';
  if (!kind) return [];
  const id = item.type === 'movie' ? item.stream_id : item.id;
  const ext = item.container_extension || 'mp4';
  const base = `${srv}/${kind}/${u}/${p}/${id}`;
  // The file as listed, then the streaming version, then a plain mp4 if it wasn't one
  return [...new Set([`${base}.${ext}`, `${base}.m3u8`, `${base}.mp4`])];
};

// On a TV remote, put the cursor on this button when it first appears (once per button)
const tvAutoFocus = (el) => {
  if (el && !el.dataset.tvFocused) {
    el.dataset.tvFocused = '1';
    setTimeout(() => {
      try { el.focus({ preventScroll: true }); } catch (e) { el.focus(); }
    }, 50);
  }
};

// Direct stream link (the first choice, or a later one by number)
const buildStreamUrl = (creds, item, n = 0) => {
  const urls = buildStreamUrls(creds, item);
  return urls[n] || urls[0] || '';
};

// Link that asks VLC to open the stream (Android and iPhone)
const vlcLink = (url) => {
  const ua = navigator.userAgent || '';
  if (/android/i.test(ua)) {
    const m = url.match(/^(https?):\/\/(.*)$/i);
    if (!m) return '';
    return `intent://${m[2]}#Intent;scheme=${m[1].toLowerCase()};package=org.videolan.vlc;type=video/*;end`;
  }
  if (/iphone|ipad|ipod/i.test(ua)) return `vlc-x-callback://x-callback-url/stream?url=${encodeURIComponent(url)}`;
  return `vlc://${url}`;
};

// "Expires in 12 days" style text from a unix-seconds expiry date
const expiryInfo = (exp) => {
  const secs = Number(exp);
  if (!exp || !isFinite(secs) || secs <= 0) return { text: 'No expiry date', days: null };
  const ms = secs * 1000;
  const days = Math.ceil((ms - Date.now()) / 86400000);
  const date = new Date(ms).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
  if (days < 0) return { text: `Expired on ${date}`, days };
  if (days === 0) return { text: `Expires today (${date})`, days };
  return { text: `${date} (${days} day${days === 1 ? '' : 's'} left)`, days };
};

// Saved accounts
const sameAccount = (a, b) => a.server === b.server && a.username === b.username;
const accountLabel = (a) => {
  return a.name ? `${a.name} (${a.username})` : a.username;
};

// Parental PIN: stored as a hash, never as the PIN itself
const hashPin = async (pin) => {
  try {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`primotv:${pin}`));
    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  } catch (e) {
    return `plain:${pin}`;
  }
};
const ADULT_RE = /adult|xxx|18\s*\+|porn|erotic|sexy/i;
const EMPTY_PARENTAL = { pinHash: null, hidden: { live: [], movie: [], series: [] } };

// Saved copy of the channel, movie and series lists (in the browser's IndexedDB,
// which has room for large lists). If it isn't available the app still works.
const idbOpen = () =>
  new Promise((resolve, reject) => {
    const req = indexedDB.open('primotv-cache', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('lists');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

const idbRun = async (mode, work) => {
  let db;
  try {
    db = await idbOpen();
    return await new Promise((resolve) => {
      const tx = db.transaction('lists', mode);
      const request = work(tx.objectStore('lists'));
      tx.oncomplete = () => resolve(request ? request.result || null : null);
      tx.onerror = () => resolve(null);
      tx.onabort = () => resolve(null);
    });
  } catch (e) {
    return null;
  } finally {
    if (db) db.close();
  }
};

const cacheGet = (key) => idbRun('readonly', (store) => store.get(key));
const cacheSet = (key, value) => idbRun('readwrite', (store) => store.put(value, key));
const cacheDelete = (key) => idbRun('readwrite', (store) => store.delete(key));

function App() {
  const [activeView, setActiveView] = useState('live');
  const [credentials, setCredentials] = useState(null);
  const [server, setServer] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Data
  const [liveRaw, setLiveChannels] = useState([]);
  const [vodList, setVodList] = useState([]);
  const [seriesList, setSeriesList] = useState([]);
  const [seriesInfo, setSeriesInfo] = useState(null);

  // Search, category, sort and paging
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [sortMode, setSortMode] = useState('default');
  const [visibleCount, setVisibleCount] = useState(PAGE);
  const [liveCatsRaw, setLiveCats] = useState([]);
  const [vodCats, setVodCats] = useState([]);
  const [seriesCats, setSeriesCats] = useState([]);
  // Big-library helpers: hidden countries and one entry per channel (SD/HD/FHD/4K merged)
  const [liveOpts, setLiveOptsState] = useState(loadLiveOpts);
  const setLiveOpts = (patch) =>
    setLiveOptsState((o) => {
      const n = { ...o, ...patch };
      saveLiveOpts(n);
      return n;
    });
  const liveView = useMemo(
    () => processLive(liveRaw, liveCatsRaw, liveOpts),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [liveRaw, liveCatsRaw, liveOpts.hidcty, liveOpts.merge, liveOpts.qpref]
  );
  const liveChannels = liveView.list;
  const liveCats = liveView.cats;
  const ctyList = useMemo(() => countriesFound(liveRaw, groupCountries(liveCatsRaw)), [liveRaw, liveCatsRaw]);
  const [setTab, setSetTab] = useState('account');
  const [numBuf, setNumBuf] = useState('');
  const [numMsg, setNumMsg] = useState('');

  // Favourites
  const [favs, setFavs] = useState(EMPTY_FAVS);

  // Continue watching
  const [progress, setProgress] = useState({});
  const progressRef = useRef({});
  const lastSaveRef = useRef(0);

  // Player
  const [currentItem, setCurrentItem] = useState(null);
  const [playbackError, setPlaybackError] = useState('');
  const videoRef = useRef(null);
  const hlsRef = useRef(null);

  // Next episode
  const [nextEp, setNextEp] = useState(null);
  const [autoNext, setAutoNext] = useState(() => {
    try {
      return localStorage.getItem('primotv_autonext') !== '0';
    } catch (e) {
      return true;
    }
  });
  const seriesCacheRef = useRef({});

  // What's on now (live channels)
  const [epg, setEpg] = useState(null);

  // Phone layout, account details and the copy-link message
  const [narrow, setNarrow] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 700px)').matches
  );
  const [accountInfo, setAccountInfo] = useState(null);
  const [infoLoading, setInfoLoading] = useState(false);
  const [linkMsg, setLinkMsg] = useState('');
  // Stream fallback: which of the stream links is being tried for the current item
  const [attempt, setAttempt] = useState({ item: null, n: 0, run: 0 });
  const sameItem = attempt.item === currentItem;
  const attemptN = sameItem ? attempt.n : 0;
  const attemptRun = sameItem ? attempt.run : 0;
  const streamUrls = buildStreamUrls(credentials, currentItem);

  const [speed, setSpeed] = useState(1);
  const [audioTracks, setAudioTracks] = useState([]);
  const [audioSel, setAudioSel] = useState(0);
  const [subTracks, setSubTracks] = useState([]);
  const [subSel, setSubSel] = useState(-1);
  // Episodes you've watched (saved per account on this device)
  const [watched, setWatched] = useState({});
  const watchedRef = useRef({});
  const watchedKey = credentials
    ? `primotv_watched_${credentials.server}|${credentials.username}`
    : null;
  useEffect(() => {
    let saved = {};
    if (watchedKey) {
      try {
        saved = JSON.parse(localStorage.getItem(watchedKey)) || {};
      } catch (e) {
        saved = {};
      }
    }
    watchedRef.current = saved;
    setWatched(saved);
  }, [watchedKey]);

  // Search everything: what's typed, the delayed copy used for searching, and how many to show
  const [gq, setGq] = useState('');
  const [gqApplied, setGqApplied] = useState('');
  const [gLimit, setGLimit] = useState({ live: 20, movie: 20, series: 20 });
  useEffect(() => {
    const t = setTimeout(() => {
      setGqApplied(gq);
      setGLimit({ live: 20, movie: 20, series: 20 });
    }, 250);
    return () => clearTimeout(t);
  }, [gq]);

  // Channel zapping: the list the playing channel came from, and recently watched channels
  const zapListRef = useRef([]);
  const memoRef = useRef({});
  const [recents, setRecents] = useState([]);
  const recentKey = credentials
    ? `primotv_recent_${credentials.server}|${credentials.username}`
    : null;

  useEffect(() => {
    if (!recentKey) {
      setRecents([]);
      return;
    }
    try {
      const saved = JSON.parse(localStorage.getItem(recentKey) || '[]');
      setRecents(Array.isArray(saved) ? saved : []);
    } catch (e) {
      setRecents([]);
    }
  }, [recentKey]);

  // Remember each live channel you open (newest first, up to 12)
  useEffect(() => {
    if (!currentItem || currentItem.type !== 'live' || !recentKey) return;
    const slim = {
      stream_id: currentItem.stream_id,
      name: currentItem.name,
      stream_icon: currentItem.stream_icon,
      category_id: currentItem.category_id,
    };
    setRecents((prev) => {
      const next = [slim, ...prev.filter((c) => String(c.stream_id) !== String(slim.stream_id))].slice(0, 12);
      try {
        localStorage.setItem(recentKey, JSON.stringify(next));
      } catch (e) {}
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentItem]);

  // Bring the player into view whenever something starts playing
  useEffect(() => {
    if (currentItem) window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentItem]);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 700px)');
    const onChange = (e) => setNarrow(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  // Full schedule for the playing channel, and the favourites guide
  const [fullGuide, setFullGuide] = useState(null);
  const [showEarlier, setShowEarlier] = useState(false);
  const [guideTick, setGuideTick] = useState(0);
  const [guideLoading, setGuideLoading] = useState(false);
  const guideCacheRef = useRef({});

  // TV (TiviMate-style) Live TV screen
  const [tvCat, setTvCat] = useState('fav'); // 'fav', 'all' or a category id
  const [tvSel, setTvSel] = useState(null); // channel the remote is on
  const [tvLimit, setTvLimit] = useState(150);
  const [tvVodFav, setTvVodFav] = useState(false); // Films/Series: showing favourites
  // Live TV layout: group order, hidden groups and hidden channels (saved on this device)
  const [tvLayout, setTvLayout] = useState(() => {
    try {
      const v = JSON.parse(localStorage.getItem('primotv_tvlayout')) || {};
      return { order: v.order || [], hiddenGroups: v.hiddenGroups || [], hiddenChannels: v.hiddenChannels || [] };
    } catch (e) {
      return { order: [], hiddenGroups: [], hiddenChannels: [] };
    }
  });
  const saveTvLayout = (next) => {
    setTvLayout(next);
    try {
      localStorage.setItem('primotv_tvlayout', JSON.stringify(next));
    } catch (e) {
      // storage full or unavailable: keep for this session
    }
  };
  // TV grid guide
  const [gridCat, setGridCat] = useState('fav');
  const [gridSel, setGridSel] = useState(null);
  const [gridLimit, setGridLimit] = useState(60);
  const [gridTick, setGridTick] = useState(0);
  const gridCacheRef = useRef({});

  // Movie details
  const [movieDetail, setMovieDetail] = useState(null);

  // Saved accounts
  const [accounts, setAccounts] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('primotv_accounts')) || [];
    } catch (e) {
      return [];
    }
  });

  // Parental controls (PIN lock and hidden categories)
  const [parental, setParental] = useState(EMPTY_PARENTAL);
  const [unlocked, setUnlocked] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinMsg, setPinMsg] = useState('');
  const [catPickType, setCatPickType] = useState('live');
  const [catSearch, setCatSearch] = useState('');
  const locked = Boolean(parental.pinHash) && !unlocked;

  // Backup
  const [backupMsg, setBackupMsg] = useState('');

  // Refreshing the lists
  const [refreshing, setRefreshing] = useState(false);
  const [refreshMsg, setRefreshMsg] = useState('');
  const [lastRefreshed, setLastRefreshed] = useState(null);
  const refreshingRef = useRef(false);
  const lastRefreshedRef = useRef(0);
  // How long a saved copy of the lists is used before downloading fresh ones (0 = off)
  const [cacheHours, setCacheHours] = useState(() => {
    try {
      const saved = localStorage.getItem('primotv_cachehours');
      return saved === null ? 6 : Number(saved) || 0;
    } catch (e) {
      return 6;
    }
  });
  const [autoRefreshHours, setAutoRefreshHours] = useState(() => {
    try {
      return Number(localStorage.getItem('primotv_autorefresh')) || 0;
    } catch (e) {
      return 0;
    }
  });

  // Favourites and progress are saved per server + username on this device
  const favKey = credentials
    ? `primotv_favs_${credentials.server}|${credentials.username}`
    : null;
  const progKey = credentials
    ? `primotv_progress_${credentials.server}|${credentials.username}`
    : null;

  const parKey = credentials
    ? `primotv_parental_${credentials.server}|${credentials.username}`
    : null;

  const persistAccounts = (list) => {
    setAccounts(list);
    try {
      localStorage.setItem('primotv_accounts', JSON.stringify(list));
    } catch (e) {}
  };

  // Newest login goes to the top of the saved list
  const saveAccount = (creds) => {
    persistAccounts([creds, ...accounts.filter((a) => !sameAccount(a, creds))]);
  };

  const removeAccount = (acc) => {
    persistAccounts(accounts.filter((a) => !sameAccount(a, acc)));
    cacheDelete(`${acc.server}|${acc.username}`);
  };

  const resetFilters = () => {
    setSearch('');
    setCategory('');
    setVisibleCount(PAGE);
    setTvVodFav(false);
  };

  // ---------- Install-as-app support ----------
  useEffect(() => {
    const addToHead = (tag, attrs, selector) => {
      if (document.head.querySelector(selector)) return;
      const el = document.createElement(tag);
      Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
      document.head.appendChild(el);
    };
    addToHead('link', { rel: 'manifest', href: '/manifest.webmanifest' }, 'link[rel="manifest"]');
    addToHead('link', { rel: 'apple-touch-icon', href: '/icon-192.png' }, 'link[rel="apple-touch-icon"]');
    addToHead('meta', { name: 'theme-color', content: 'var(--pt-panel, #0a1426)' }, 'meta[name="theme-color"]');
    addToHead('meta', { name: 'mobile-web-app-capable', content: 'yes' }, 'meta[name="mobile-web-app-capable"]');
    document.title = 'PRIMO TV';

    if (false) {
    }
  }, []);

  const applyLists = (d) => {
    setLiveChannels(d.live || []);
    setVodList(d.vod || []);
    setSeriesList(d.series || []);
    setLiveCats(d.liveCats || []);
    setVodCats(d.vodCats || []);
    setSeriesCats(d.seriesCats || []);
  };

  // ---------- Login ----------
  const login = async (srv, user, pass, silent = false) => {
    if (!silent) setLoading(true);
    setError('');

    try {
      let base = srv.trim().replace(/\/+$/, '');
      if (!base.startsWith('http')) base = 'https://' + base;

      const authData = await apiCall(base, user, pass);
      if (!authData.user_info || authData.user_info.auth !== 1) {
        throw new Error('Invalid username or password');
      }

      setAccountInfo({ ...authData.user_info, checkedAt: Date.now() });
      try { window.__ptServerTz = (authData.server_info && authData.server_info.timezone) || ''; } catch (e) {}
      const creds = { server: base, username: user, password: pass };
      localStorage.setItem('primotv_xtream', JSON.stringify(creds));
      setCredentials(creds);
      saveAccount(creds);

      // Use the saved copy of the lists if it's recent enough, otherwise download them
      const cacheKey = `${base}|${user}`;
      const cached = cacheHours > 0 ? await cacheGet(cacheKey) : null;

      if (cached && Date.now() - cached.savedAt < cacheHours * 3600000) {
        applyLists(cached);
        lastRefreshedRef.current = cached.savedAt;
        setLastRefreshed(cached.savedAt);
      } else {
        try {
          // Categories are optional: if a provider fails here, login still works
          const loadCats = (action) =>
            apiCall(base, user, pass, action)
              .then((c) => (Array.isArray(c) ? c : []))
              .catch(() => []);
          // Channels first so you can start watching straight away...
          const [live, liveCatsNew] = await Promise.all([
            apiCall(base, user, pass, 'get_live_streams').then((x) => x || []),
            loadCats('get_live_categories'),
          ]);
          const savedAt = Date.now();
          setLiveChannels(live);
          setLiveCats(liveCatsNew);
          if (cached) {
            setVodList(cached.vod || []);
            setSeriesList(cached.series || []);
            setVodCats(cached.vodCats || []);
            setSeriesCats(cached.seriesCats || []);
          }
          lastRefreshedRef.current = savedAt;
          setLastRefreshed(savedAt);
          // ...then films and series in the background
          (async () => {
            try {
              // Films and series load separately, so one failing doesn't leave the other empty.
              const [vodR, serR, vodCatsNew, seriesCatsNew] = await Promise.all([
                apiCall(base, user, pass, 'get_vod_streams').then((x) => (Array.isArray(x) ? x : null)).catch(() => null),
                apiCall(base, user, pass, 'get_series').then((x) => (Array.isArray(x) ? x : null)).catch(() => null),
                loadCats('get_vod_categories'),
                loadCats('get_series_categories'),
              ]);
              const vod = vodR || (cached && cached.vod) || [];
              const ser = serR || (cached && cached.series) || [];
              setVodList(vod);
              setSeriesList(ser);
              if (vodCatsNew.length || !cached) setVodCats(vodCatsNew);
              if (seriesCatsNew.length || !cached) setSeriesCats(seriesCatsNew);
              if (!vodR || !serR) {
                setRefreshMsg(!vodR ? "Films didn't load from your provider. Try Refresh." : "Series didn't load from your provider. Try Refresh.");
              }
              if (cacheHours > 0) {
                cacheSet(cacheKey, {
                  savedAt, live, liveCats: liveCatsNew, vod, series: ser, vodCats: vodCatsNew, seriesCats: seriesCatsNew,
                });
              }
            } catch (e) {}
          })();
        } catch (err) {
          if (!cached) throw err;
          // The provider couldn't be reached, so fall back to the older saved copy
          applyLists(cached);
          lastRefreshedRef.current = cached.savedAt;
          setLastRefreshed(cached.savedAt);
          setRefreshMsg(
            `Could not reach the provider. Showing lists saved ${new Date(
              cached.savedAt
            ).toLocaleString()}.`
          );
          setTimeout(() => setRefreshMsg(''), 8000);
        }
      }

      setActiveView('live');
    } catch (err) {
      setError(err.message || 'Login failed');
      setCredentials(null);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  // Auto-login with saved details
  useEffect(() => {
    const saved = localStorage.getItem('primotv_xtream');
    if (saved) {
      try {
        const data = JSON.parse(saved);
        setServer(data.server);
        setUsername(data.username);
        setPassword(data.password);
        login(SERVER, data.username, data.password, true);
      } catch (e) {
        localStorage.removeItem('primotv_xtream');
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load saved favourites whenever someone logs in
  useEffect(() => {
    if (!favKey) {
      setFavs(EMPTY_FAVS);
      return;
    }
    try {
      const saved = JSON.parse(localStorage.getItem(favKey));
      setFavs({
        live: saved?.live || [],
        movie: saved?.movie || [],
        series: saved?.series || [],
      });
    } catch (e) {
      setFavs(EMPTY_FAVS);
    }
  }, [favKey]);

  // Load saved "continue watching" progress whenever someone logs in
  useEffect(() => {
    let saved = {};
    if (progKey) {
      try {
        saved = JSON.parse(localStorage.getItem(progKey)) || {};
      } catch (e) {
        saved = {};
      }
    }
    progressRef.current = saved;
    setProgress(saved);
  }, [progKey]);

  // Load this account's parental settings (always starts locked)
  useEffect(() => {
    setUnlocked(false);
    setPinInput('');
    setPinMsg('');
    if (!parKey) {
      setParental(EMPTY_PARENTAL);
      return;
    }
    try {
      const saved = JSON.parse(localStorage.getItem(parKey));
      setParental({
        pinHash: saved?.pinHash || null,
        hidden: {
          live: saved?.hidden?.live || [],
          movie: saved?.hidden?.movie || [],
          series: saved?.hidden?.series || [],
        },
      });
    } catch (e) {
      setParental(EMPTY_PARENTAL);
    }
  }, [parKey]);

  const persistParental = (next) => {
    setParental(next);
    try {
      localStorage.setItem(parKey, JSON.stringify(next));
    } catch (e) {}
  };

  const setNewPin = async () => {
    if (!/^\d{4}$/.test(pinInput)) {
      setPinMsg('The PIN must be exactly 4 digits.');
      return;
    }
    persistParental({ ...parental, pinHash: await hashPin(pinInput) });
    setUnlocked(true);
    setPinInput('');
    setPinMsg('PIN set. Choose the categories to hide, then tap Lock now.');
  };

  const tryUnlock = async () => {
    if ((await hashPin(pinInput)) === parental.pinHash) {
      setUnlocked(true);
      setPinInput('');
      setPinMsg('');
    } else {
      setPinMsg('Wrong PIN.');
      setPinInput('');
    }
  };

  const lockNow = () => {
    setUnlocked(false);
    setPinInput('');
    setPinMsg('');
    setCategory('');
    setMovieDetail(null);
    setCurrentItem(null);
  };

  const removePin = () => {
    persistParental(EMPTY_PARENTAL);
    setUnlocked(false);
    setPinMsg('PIN removed. Nothing is hidden now.');
  };

  const toggleHiddenCat = (type, id) => {
    const key = String(id);
    const list = parental.hidden[type];
    const next = list.includes(key) ? list.filter((x) => x !== key) : [...list, key];
    persistParental({ ...parental, hidden: { ...parental.hidden, [type]: next } });
  };

  const catsOf = (type) => (type === 'live' ? liveCats : type === 'movie' ? vodCats : seriesCats);

  const hideAdultCats = () => {
    const hidden = { ...parental.hidden };
    ['live', 'movie', 'series'].forEach((t) => {
      const found = catsOf(t)
        .filter((c) => ADULT_RE.test(c.category_name || ''))
        .map((c) => String(c.category_id));
      hidden[t] = Array.from(new Set([...hidden[t], ...found]));
    });
    persistParental({ ...parental, hidden });
    setPinMsg('Categories with adult-style names are now ticked. Check the list and untick any that should stay visible.');
  };

  // Hidden only while locked
  const isHidden = (type, categoryId) =>
    locked && parental.hidden[type].includes(String(categoryId));

  // ---------- Backup ----------
  const exportBackup = () => {
    const data = {
      app: 'primo-tv',
      version: 1,
      exportedAt: new Date().toISOString(),
      provider: 'PRIMO TV',
      username: credentials.username,
      favourites: favs,
      progress: progressRef.current,
      watched: watchedRef.current,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `primotv-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setBackupMsg('Backup saved to your Downloads folder.');
  };

  const importBackup = async (file) => {
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (data.app !== 'primo-tv' || !data.favourites) throw new Error('Not a backup');
      if (
        data.username &&
        data.username !== credentials.username &&
        !window.confirm(
          `This backup is from "${data.username}", not "${credentials.username}". Import it anyway?`
        )
      ) {
        return;
      }

      // Add favourites that aren't already saved
      let added = 0;
      const merged = {};
      ['live', 'movie', 'series'].forEach((type) => {
        const have = new Set(favs[type].map((f) => String(idOf(type, f))));
        const extra = (data.favourites[type] || []).filter((f) => {
          const id = f && idOf(type, f);
          return id !== undefined && id !== null && !have.has(String(id));
        });
        added += extra.length;
        merged[type] = [...favs[type], ...extra];
      });
      setFavs(merged);
      try {
        localStorage.setItem(favKey, JSON.stringify(merged));
      } catch (e) {}

      // Keep the most recent position for each movie or episode
      const prog = { ...progressRef.current };
      Object.values(data.progress || {}).forEach((r) => {
        if (r && r.key && r.position > 0 && (!prog[r.key] || prog[r.key].updatedAt < r.updatedAt)) {
          prog[r.key] = r;
        }
      });
      const entries = Object.values(prog)
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .slice(0, MAX_CONTINUE);
      persistProgress(Object.fromEntries(entries.map((r) => [r.key, r])));

      // Add watched episodes from the backup
      if (data.watched && typeof data.watched === 'object') {
        setWatchedFor(Object.keys(data.watched), true);
      }

      setBackupMsg(`Imported ${added} new favourite${added === 1 ? '' : 's'} and your watch progress.`);
    } catch (e) {
      setBackupMsg('That file could not be read as a PRIMO TV backup.');
    }
  };

  // ---------- Refresh the lists without logging out ----------
  const refreshLists = async () => {
    if (!credentials || refreshingRef.current) return;
    refreshingRef.current = true;
    setRefreshing(true);
    setRefreshMsg('');
    const { server: srv, username: u, password: p } = credentials;

    try {
      const live = await apiCall(srv, u, p, 'get_live_streams');
      const vod = await apiCall(srv, u, p, 'get_vod_streams');
      const ser = await apiCall(srv, u, p, 'get_series');

      // Keep what's on screen if the provider sends something odd or empty
      if (!Array.isArray(live) || !Array.isArray(vod) || !Array.isArray(ser)) {
        throw new Error('The provider sent an unexpected reply');
      }
      if (!live.length && !vod.length && !ser.length) {
        throw new Error('The provider sent empty lists');
      }

      setLiveChannels(live);
      setVodList(vod);
      setSeriesList(ser);

      const loadCats = (action) =>
        apiCall(srv, u, p, action)
          .then((c) => (Array.isArray(c) ? c : []))
          .catch(() => []);
      const lc = await loadCats('get_live_categories');
      const vc = await loadCats('get_vod_categories');
      const sc = await loadCats('get_series_categories');
      if (lc.length) setLiveCats(lc);
      if (vc.length) setVodCats(vc);
      if (sc.length) setSeriesCats(sc);

      seriesCacheRef.current = {}; // so "next episode" sees new episodes
      lastRefreshedRef.current = Date.now();
      setLastRefreshed(lastRefreshedRef.current);
      if (cacheHours > 0) {
        cacheSet(`${srv}|${u}`, {
          savedAt: lastRefreshedRef.current,
          live,
          vod,
          series: ser,
          liveCats: lc.length ? lc : liveCats,
          vodCats: vc.length ? vc : vodCats,
          seriesCats: sc.length ? sc : seriesCats,
        });
      }
      setRefreshMsg('Lists updated.');
    } catch (e) {
      setRefreshMsg(`Could not refresh: ${e.message}`);
    } finally {
      refreshingRef.current = false;
      setRefreshing(false);
      setTimeout(() => setRefreshMsg(''), 6000);
    }
  };

  const clearSavedLists = async () => {
    await cacheDelete(`${credentials.server}|${credentials.username}`);
    setRefreshMsg('Saved lists cleared. They will download again next time you open the app.');
    setTimeout(() => setRefreshMsg(''), 6000);
  };

  // Automatic refresh: checks every 5 minutes and when you return to the tab
  useEffect(() => {
    if (!credentials || !autoRefreshHours) return;
    const check = () => {
      if (document.visibilityState === 'hidden') return;
      if (Date.now() - lastRefreshedRef.current > autoRefreshHours * 3600000) refreshLists();
    };
    const timer = setInterval(check, 5 * 60 * 1000);
    document.addEventListener('visibilitychange', check);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', check);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [credentials, autoRefreshHours, cacheHours]);

  // ---------- Switch account ----------
  const switchAccount = (acc) => {
    saveProgress(true);
    setCredentials(null);
    setLiveChannels([]);
    setVodList([]);
    setSeriesList([]);
    setLiveCats([]);
    setVodCats([]);
    setSeriesCats([]);
    resetFilters();
    setSeriesInfo(null);
    setCurrentItem(null);
    setMovieDetail(null);
    seriesCacheRef.current = {};
    setServer(acc.server);
    setUsername(acc.username);
    setPassword(acc.password);
    setActiveView('live');
    login(SERVER, acc.username, acc.password);
  };

  const isFav = (type, item) =>
    favs[type].some((f) => idOf(type, f) === idOf(type, item));

  const toggleFav = (type, item) => {
    const exists = isFav(type, item);
    const list = exists
      ? favs[type].filter((f) => idOf(type, f) !== idOf(type, item))
      : [...favs[type], item];
    const next = { ...favs, [type]: list };
    setFavs(next);
    try {
      localStorage.setItem(favKey, JSON.stringify(next));
    } catch (e) {}
  };

  // ---------- Continue watching ----------
  const persistProgress = (next) => {
    progressRef.current = next;
    setProgress(next);
    try {
      localStorage.setItem(progKey, JSON.stringify(next));
    } catch (e) {}
  };

  // Saves the current playback position (at most every 5 seconds unless forced)
  const saveProgress = (force = false) => {
    const video = videoRef.current;
    if (!video || !currentItem || !progKey) return;
    const key = progressKeyOf(currentItem);
    if (!key) return;

    const position = video.currentTime;
    const duration = video.duration;
    if (!isFinite(duration) || duration <= 0) return;

    const now = Date.now();
    if (!force && now - lastSaveRef.current < 5000) return;
    lastSaveRef.current = now;

    // Tick off an episode once you're nearly at the end
    if (
      currentItem.type === 'episode' &&
      currentItem.id !== undefined &&
      position / duration > 0.9 &&
      !watchedRef.current[currentItem.id]
    ) {
      setWatchedFor([currentItem.id], true);
    }

    const next = { ...progressRef.current };

    if (position / duration > 0.95) {
      // Finished, so take it off the list
      delete next[key];
    } else if (position > 10) {
      const slim =
        currentItem.type === 'movie'
          ? {
              stream_id: currentItem.stream_id,
              name: currentItem.name,
              stream_icon: currentItem.stream_icon,
              container_extension: currentItem.container_extension,
              category_id: currentItem.category_id,
            }
          : {
              id: currentItem.id,
              name: currentItem.name,
              stream_icon: currentItem.info?.movie_image,
              container_extension: currentItem.container_extension,
              episode_num: currentItem.episode_num,
              seriesId: currentItem.seriesId,
              seriesName: currentItem.seriesName,
              seasonNum: currentItem.seasonNum,
              category_id: currentItem.seriesCategoryId,
              seriesCategoryId: currentItem.seriesCategoryId,
            };
      next[key] = {
        key,
        type: currentItem.type,
        item: slim,
        position,
        duration,
        updatedAt: now,
      };
    } else {
      return;
    }

    const entries = Object.values(next)
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, MAX_CONTINUE);
    persistProgress(Object.fromEntries(entries.map((e) => [e.key, e])));
  };

  const removeProgress = (key) => {
    const next = { ...progressRef.current };
    delete next[key];
    persistProgress(next);
  };

  // ---------- Watched marks ----------
  const setWatchedFor = (ids, on) => {
    if (!watchedKey) return;
    const next = { ...watchedRef.current };
    ids.forEach((id) => {
      if (on) next[id] = 1;
      else delete next[id];
    });
    watchedRef.current = next;
    setWatched(next);
    try {
      localStorage.setItem(watchedKey, JSON.stringify(next));
    } catch (e) {}
  };

  // The full item to play for an episode of the series that's open
  const episodeItem = (ep, seasonNum, series) => ({
    ...ep,
    type: 'episode',
    name: `${series.name} - S${seasonNum}E${ep.episode_num}`,
    seriesId: series.series_id,
    seriesName: series.name,
    seriesCategoryId: series.category_id,
    seasonNum,
  });

  // ---------- Account details ----------
  const refreshAccountInfo = async () => {
    if (!credentials) return;
    setInfoLoading(true);
    try {
      const { server: srv, username: u, password: p } = credentials;
      const data = await apiCall(srv, u, p);
      if (data && data.user_info) setAccountInfo({ ...data.user_info, checkedAt: Date.now() });
    } catch (e) {
      // keep showing what we had
    }
    setInfoLoading(false);
  };

  // ---------- Copy / open in another player ----------
  const copyStreamLink = async () => {
    const url = buildStreamUrl(credentials, currentItem, attemptN);
    if (!url) return;
    let ok = false;
    try {
      await navigator.clipboard.writeText(url);
      ok = true;
    } catch (e) {
      try {
        const ta = document.createElement('textarea');
        ta.value = url;
        document.body.appendChild(ta);
        ta.select();
        ok = document.execCommand('copy');
        document.body.removeChild(ta);
      } catch (e2) {
        ok = false;
      }
    }
    setLinkMsg(ok ? 'Link copied. Paste it into any player.' : 'Could not copy the link.');
    setTimeout(() => setLinkMsg(''), 5000);
  };

  const openInVlc = () => {
    const url = buildStreamUrl(credentials, currentItem, attemptN);
    if (!url) return;
    const link = vlcLink(url);
    if (!link) return;
    videoRef.current && videoRef.current.pause();
    window.location.href = link;
    setLinkMsg('If nothing opened, VLC may not be installed. Use Copy link instead.');
    setTimeout(() => setLinkMsg(''), 6000);
  };

  useEffect(() => setLinkMsg(''), [currentItem]);

  // ---------- Playback controls ----------
  const isLiveNow = currentItem && currentItem.type === 'live';

  const skip = (secs) => {
    const v = videoRef.current;
    if (!v) return;
    const max = isFinite(v.duration) ? v.duration : Infinity;
    v.currentTime = Math.max(0, Math.min(max, v.currentTime + secs));
  };

  const changeSpeed = (value) => {
    const rate = Number(value) || 1;
    setSpeed(rate);
    if (videoRef.current) videoRef.current.playbackRate = rate;
  };

  const goFullscreen = () => {
    const v = videoRef.current;
    if (!v) return;
    try {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else if (v.requestFullscreen) {
        v.requestFullscreen();
      } else if (v.webkitEnterFullscreen) {
        v.webkitEnterFullscreen(); // iPhone Safari
      }
    } catch (e) {}
  };

  const canPip =
    typeof document !== 'undefined' &&
    document.pictureInPictureEnabled &&
    typeof HTMLVideoElement !== 'undefined' &&
    'requestPictureInPicture' in HTMLVideoElement.prototype;

  const togglePip = async () => {
    try {
      if (document.pictureInPictureElement) await document.exitPictureInPicture();
      else if (videoRef.current) await videoRef.current.requestPictureInPicture();
    } catch (e) {}
  };

  const pickAudio = (value) => {
    const i = Number(value);
    setAudioSel(i);
    if (hlsRef.current) {
      hlsRef.current.audioTrack = i;
    } else {
      const at = videoRef.current && videoRef.current.audioTracks;
      if (at) for (let k = 0; k < at.length; k++) at[k].enabled = k === i;
    }
  };

  const pickSubs = (value) => {
    const i = Number(value);
    setSubSel(i);
    if (hlsRef.current) {
      hlsRef.current.subtitleTrack = i;
      hlsRef.current.subtitleDisplay = i >= 0;
    } else if (videoRef.current) {
      const texts = Array.from(videoRef.current.textTracks || []).filter(
        (t) => t.kind === 'subtitles' || t.kind === 'captions'
      );
      texts.forEach((t, k) => {
        t.mode = k === i ? 'showing' : 'disabled';
      });
    }
  };

  // Keyboard shortcuts (tablet or computer): arrows skip, space plays or pauses, F is fullscreen
  useEffect(() => {
    if (!currentItem) return;
    const onKey = (e) => {
      const tag = (e.target && e.target.tagName) || '';
      if (['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON'].includes(tag)) return;
      const v = videoRef.current;
      if (!v) return;
      if (e.key === 'ArrowLeft' && currentItem.type !== 'live') skip(-10);
      else if (e.key === 'ArrowRight' && currentItem.type !== 'live') skip(10);
      else if (e.key === ' ') {
        e.preventDefault();
        if (v.paused) v.play().catch(() => {});
        else v.pause();
      } else if (e.key === 'f' || e.key === 'F') goFullscreen();
      else return;
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentItem]);

  // ---------- Playback ----------
  // When a stream fails, move to the next link. After the last one, show the error.
  const failAttempt = (msg) => {
    if (!currentItem) return;
    if (attemptN + 1 < streamUrls.length) {
      setAttempt({ item: currentItem, n: attemptN + 1, run: attemptRun });
    } else {
      setPlaybackError(msg);
    }
  };

  const retryPlayback = () => {
    setPlaybackError('');
    setAttempt({ item: currentItem, n: 0, run: attemptRun + 1 });
  };

  useEffect(() => {
    if (!currentItem || !videoRef.current || !credentials) return;

    setPlaybackError('');
    lastSaveRef.current = 0;
    const streamUrl = streamUrls[attemptN] || '';
    if (!streamUrl) return;

    // Inside the PRIMO TV app: hand the stream to the app's
    // native player, which plays everything TiviMate can (and isn't blocked like browsers).
    if (attemptN === 0 && typeof window !== 'undefined' && window.PrimoNative &&
        typeof window.PrimoNative.play === 'function') {
      try {
        const nat = window.PrimoNative;
        const list = zapListRef.current || [];
        const idx = list.findIndex((c) => String(c.stream_id) === String(currentItem.stream_id));
        if (currentItem.type === 'live' && idx >= 0 && typeof nat.playChannels === 'function') {
          // Send the channel list too, so Up/Down can change channel in the native player
          // Up to 300 channels either side (big lists are too large to pass to the app)
          const from = Math.max(0, idx - 300);
          const chans = list.slice(from, idx + 301).map((c, k) => ({
            num: Number(c.num) || from + k + 1,
            id: String(c.stream_id),
            name: c.name,
            url: buildStreamUrls(credentials, { ...c, type: 'live' })[0],
          }));
          if (typeof nat.playChannelsGuide === 'function') {
            const epgBase = `${credentials.server}/player_api.php?username=${encodeURIComponent(credentials.username)}` +
              `&password=${encodeURIComponent(credentials.password)}&action=get_short_epg&limit=4&stream_id=`;
            nat.playChannelsGuide(streamUrl, JSON.stringify(chans), idx - from, epgBase);
          } else nat.playChannels(streamUrl, JSON.stringify(chans), idx - from);
        } else if (typeof nat.playDirect === 'function') nat.playDirect(streamUrl);
        else nat.play(streamUrl);
        return;
      } catch (e) {
        // fall through to the web player
      }
    }

    const video = videoRef.current;
    let onMeta = null;

    // If nothing arrives within 20 seconds, treat it as a failed stream
    let started = false;
    const onStarted = () => {
      started = true;
      clearTimeout(startTimer);
    };
    const startTimer = setTimeout(() => {
      if (!started) failAttempt('The stream did not start. The provider may be blocking browser playback.');
    }, 20000);
    video.addEventListener('playing', onStarted);
    video.addEventListener('loadeddata', onStarted);

    // Resume where you left off (movies and episodes)
    const resumeKey = progressKeyOf(currentItem);
    const savedPos = resumeKey ? progressRef.current[resumeKey] : null;
    if (savedPos && savedPos.position > 10) {
      onMeta = () => {
        video.currentTime = savedPos.position;
      };
      video.addEventListener('loadedmetadata', onMeta, { once: true });
    }

    // Fresh start for speed, audio and subtitle choices
    setSpeed(1);
    video.defaultPlaybackRate = 1;
    video.playbackRate = 1;
    setAudioTracks([]);
    setAudioSel(0);
    setSubTracks([]);
    setSubSel(-1);

    // Tracks inside a plain file (works in some browsers only)
    const readNativeTracks = () => {
      try {
        const at = video.audioTracks;
        if (at && at.length > 1) {
          const list = [];
          let sel = 0;
          for (let k = 0; k < at.length; k++) {
            list.push({ id: k, name: at[k].label || at[k].language || `Track ${k + 1}` });
            if (at[k].enabled) sel = k;
          }
          setAudioTracks(list);
          setAudioSel(sel);
        }
        const texts = Array.from(video.textTracks || []).filter(
          (t) => t.kind === 'subtitles' || t.kind === 'captions'
        );
        if (texts.length) {
          setSubTracks(
            texts.map((t, k) => ({ id: k, name: t.label || t.language || `Subtitles ${k + 1}` }))
          );
        }
      } catch (e) {}
    };

    if (streamUrl.includes('.m3u8') && Hls.isSupported()) {
      const hls = new Hls();
      hlsRef.current = hls;
      hls.on(Hls.Events.AUDIO_TRACKS_UPDATED, (_e, d) => {
        const list = d.audioTracks || [];
        if (list.length > 1) {
          setAudioTracks(
            list.map((t, k) => ({ id: k, name: t.name || t.lang || `Track ${k + 1}` }))
          );
          setAudioSel(hls.audioTrack);
        }
      });
      hls.on(Hls.Events.SUBTITLE_TRACKS_UPDATED, (_e, d) => {
        const list = d.subtitleTracks || [];
        if (list.length) {
          setSubTracks(
            list.map((t, k) => ({ id: k, name: t.name || t.lang || `Subtitles ${k + 1}` }))
          );
          hls.subtitleTrack = -1;
        }
      });
      // Try to recover from small glitches first, then fall back to the next stream link
      let netTries = 0;
      let mediaTries = 0;
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (!data.fatal) return;
        if (data.type === Hls.ErrorTypes.MEDIA_ERROR && mediaTries < 2) {
          mediaTries += 1;
          hls.recoverMediaError();
          return;
        }
        if (
          data.type === Hls.ErrorTypes.NETWORK_ERROR &&
          netTries < 2 &&
          !/manifest/i.test(data.details || '')
        ) {
          netTries += 1;
          hls.startLoad();
          return;
        }
        failAttempt(
          `Playback failed (${data.details}). The provider may be blocking browser playback.`
        );
      });
      hls.loadSource(streamUrl);
      hls.attachMedia(video);
    } else {
      // Safari plays HLS natively; movies and episodes use a plain source
      video.src = streamUrl;
      video.addEventListener('loadedmetadata', readNativeTracks, { once: true });
    }

    return () => {
      saveProgress(true);
      clearTimeout(startTimer);
      video.removeEventListener('playing', onStarted);
      video.removeEventListener('loadeddata', onStarted);
      if (onMeta) video.removeEventListener('loadedmetadata', onMeta);
      video.removeEventListener('loadedmetadata', readNativeTracks);
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentItem, credentials, attemptN, attemptRun]);

  // ---------- Next episode ----------
  // Ordered list of every episode in a series (fetched once, then cached)
  const getEpisodeList = async (seriesId) => {
    let data = seriesCacheRef.current[seriesId];
    if (!data) {
      data =
        seriesInfo && String(seriesInfo.series_id) === String(seriesId) && seriesInfo.episodes
          ? seriesInfo
          : await apiCall(
              credentials.server,
              credentials.username,
              credentials.password,
              'get_series_info',
              { series_id: seriesId }
            );
      seriesCacheRef.current[seriesId] = data;
    }
    const episodes = data.episodes || {};
    return Object.keys(episodes)
      .sort((a, b) => Number(a) - Number(b))
      .flatMap((sn) =>
        [...episodes[sn]]
          .sort((a, b) => Number(a.episode_num) - Number(b.episode_num))
          .map((ep) => ({ ...ep, seasonNum: sn }))
      );
  };

  const findNextEpisode = async (item) => {
    const list = await getEpisodeList(item.seriesId);
    const idx = list.findIndex((e) => String(e.id) === String(item.id));
    if (idx < 0 || idx + 1 >= list.length) return null;
    const ep = list[idx + 1];
    return {
      ...ep,
      type: 'episode',
      name: `${item.seriesName} - S${ep.seasonNum}E${ep.episode_num}`,
      seriesId: item.seriesId,
      seriesName: item.seriesName,
      seriesCategoryId: item.seriesCategoryId,
    };
  };

  // Work out what comes next whenever an episode starts
  useEffect(() => {
    setNextEp(null);
    if (!currentItem || currentItem.type !== 'episode' || !currentItem.seriesId || !credentials) {
      return;
    }
    let cancelled = false;
    findNextEpisode(currentItem)
      .then((n) => {
        if (!cancelled) setNextEp(n);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentItem, credentials]);

  const playNext = () => {
    if (!nextEp) return;
    saveProgress(true);
    setCurrentItem(nextEp);
  };

  // ---------- Full schedule for the playing channel ----------
  useEffect(() => {
    setFullGuide(null);
    setShowEarlier(false);
  }, [currentItem]);

  const openFullGuide = async () => {
    if (!credentials || !currentItem || currentItem.type !== 'live') return;
    const id = currentItem.stream_id;
    setFullGuide({ streamId: id, loading: true, items: [] });

    let items = [];
    try {
      const { server: srv, username: u, password: p } = credentials;
      items = parseEpg(await apiCall(srv, u, p, 'get_simple_data_table', { stream_id: id }));
      if (!items.length) {
        items = parseEpg(await apiCall(srv, u, p, 'get_short_epg', { stream_id: id, limit: 10 }));
      }
    } catch (e) {
      items = [];
    }
    setFullGuide((g) => (g && g.streamId === id ? { ...g, loading: false, items } : g));
  };

  // ---------- Guide for favourite live channels ----------
  // Fetches a few channels at a time and keeps results for 5 minutes
  const loadFavGuide = async (force = false) => {
    if (!credentials) return;
    const { server: srv, username: u, password: p } = credentials;
    const channels = favs.live
      .filter((c) => !isHidden('live', c.category_id))
      .slice(0, GUIDE_MAX);
    const stale = channels.filter((c) => {
      const entry = guideCacheRef.current[c.stream_id];
      return force || !entry || Date.now() - entry.at > 5 * 60 * 1000;
    });
    if (!stale.length) return;

    setGuideLoading(true);
    let next = 0;
    const worker = async () => {
      while (next < stale.length) {
        const ch = stale[next++];
        try {
          const data = await apiCall(srv, u, p, 'get_short_epg', {
            stream_id: ch.stream_id,
            limit: 3,
          });
          guideCacheRef.current[ch.stream_id] = { at: Date.now(), items: parseEpg(data) };
        } catch (e) {
          guideCacheRef.current[ch.stream_id] = { at: Date.now(), items: [], failed: true };
        }
        setGuideTick((t) => t + 1);
      }
    };
    await Promise.all([worker(), worker(), worker()]);
    setGuideLoading(false);
  };

  useEffect(() => {
    if (activeView !== 'guide' || !credentials) return;
    loadFavGuide();
    const timer = setInterval(() => loadFavGuide(), 5 * 60 * 1000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeView, credentials, favs.live.length, locked]);

  // ---------- What's on now ----------
  useEffect(() => {
    if (!currentItem || currentItem.type !== 'live' || !credentials) {
      setEpg(null);
      return;
    }
    let cancelled = false;

    const load = async () => {
      try {
        const data = await apiCall(
          credentials.server,
          credentials.username,
          credentials.password,
          'get_short_epg',
          { stream_id: currentItem.stream_id, limit: 4 }
        );
        const items = parseEpg(data);
        if (!cancelled) setEpg({ items, loading: false });
      } catch (e) {
        if (!cancelled) setEpg({ items: [], loading: false });
      }
    };

    setEpg({ items: [], loading: true });
    load();
    const timer = setInterval(load, 60000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [currentItem, credentials]);

  // ---------- TV Live screen: guide data ----------
  // Channels in the chosen TV category (favourites, all, or one category)
  const tvHiddenCh = new Set(tvLayout.hiddenChannels.map((c) => String(c.stream_id)));
  const tvHiddenGrp = new Set(tvLayout.hiddenGroups.map(String));
  const tvChannelsFor = (cat) => {
    const ok = (i) => !isHidden('live', i.category_id) && !tvHiddenCh.has(String(i.stream_id));
    if (cat === 'fav') return favs.live.filter(ok);
    const all = liveChannels.filter((i) => ok(i) && !tvHiddenGrp.has(String(i.category_id)));
    if (cat === 'all') return all;
    return all.filter((i) => String(i.category_id) === String(cat));
  };

  // Live groups in your chosen order (groups you haven't moved keep the provider's order, after yours)
  const tvGroupsOrdered = (includeHidden = false) => {
    const cats = visCats('live', liveCats);
    const pos = new Map(tvLayout.order.map((id, i) => [String(id), i]));
    return [...cats]
      .map((c, i) => ({ c, i }))
      .sort((a, b) => {
        const pa = pos.has(String(a.c.category_id)) ? pos.get(String(a.c.category_id)) : 1e6 + a.i;
        const pb = pos.has(String(b.c.category_id)) ? pos.get(String(b.c.category_id)) : 1e6 + b.i;
        return pa - pb;
      })
      .map((x) => x.c)
      .filter((c) => includeHidden || !tvHiddenGrp.has(String(c.category_id)));
  };

  const moveGroup = (id, step) => {
    const ids = tvGroupsOrdered(true).map((c) => String(c.category_id));
    const i = ids.indexOf(String(id));
    const j = i + step;
    if (i < 0 || j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    saveTvLayout({ ...tvLayout, order: ids });
  };
  const toggleGroupHidden = (id) => {
    const k = String(id);
    const hiddenGroups = tvHiddenGrp.has(k)
      ? tvLayout.hiddenGroups.filter((g) => String(g) !== k)
      : [...tvLayout.hiddenGroups, k];
    saveTvLayout({ ...tvLayout, hiddenGroups });
  };
  const hideChannel = (ch) => {
    if (tvHiddenCh.has(String(ch.stream_id))) return;
    saveTvLayout({
      ...tvLayout,
      hiddenChannels: [...tvLayout.hiddenChannels, { stream_id: ch.stream_id, name: ch.name }],
    });
    setTvSel(null);
  };
  const unhideChannel = (id) =>
    saveTvLayout({
      ...tvLayout,
      hiddenChannels: tvLayout.hiddenChannels.filter((c) => String(c.stream_id) !== String(id)),
    });

  // Fetch now/next for a set of channels, a few at a time, cached for 5 minutes
  const loadTvGuide = async (channels) => {
    if (!credentials || !channels.length) return;
    const { server: srv, username: u, password: p } = credentials;
    const stale = channels.filter((c) => {
      const e = guideCacheRef.current[c.stream_id];
      return !e || Date.now() - e.at > 5 * 60 * 1000;
    });
    let next = 0;
    const worker = async () => {
      while (next < stale.length) {
        const ch = stale[next++];
        try {
          const data = await apiCall(srv, u, p, 'get_short_epg', { stream_id: ch.stream_id, limit: 4 });
          guideCacheRef.current[ch.stream_id] = { at: Date.now(), items: parseEpg(data) };
        } catch (e) {
          guideCacheRef.current[ch.stream_id] = { at: Date.now(), items: [], failed: true };
        }
        setGuideTick((t) => t + 1);
      }
    };
    await Promise.all([worker(), worker(), worker(), worker()]);
  };

  useEffect(() => {
    if (!IS_TV || activeView !== 'live' || !credentials) return;
    setTvLimit(150);
    loadTvGuide(tvChannelsFor(tvCat).slice(0, 40));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeView, tvCat, credentials, liveChannels.length, favs.live.length, locked]);

  // Grid guide: several hours of programmes per channel, cached for 10 minutes
  const loadGridGuide = async (channels) => {
    if (!credentials || !channels.length) return;
    const { server: srv, username: u, password: p } = credentials;
    const stale = channels.filter((c) => {
      const e = gridCacheRef.current[c.stream_id];
      return !e || Date.now() - e.at > 10 * 60 * 1000;
    });
    let next = 0;
    const worker = async () => {
      while (next < stale.length) {
        const ch = stale[next++];
        try {
          const data = await apiCall(srv, u, p, 'get_short_epg', { stream_id: ch.stream_id, limit: 12 });
          gridCacheRef.current[ch.stream_id] = { at: Date.now(), items: parseEpg(data) };
        } catch (e) {
          gridCacheRef.current[ch.stream_id] = { at: Date.now(), items: [], failed: true };
        }
        setGridTick((t) => t + 1);
      }
    };
    await Promise.all([worker(), worker(), worker(), worker()]);
  };

  useEffect(() => {
    if (!IS_TV || activeView !== 'guide' || !credentials) return undefined;
    const effCat = gridCat === 'fav' && !favs.live.length ? 'all' : gridCat;
    loadGridGuide(tvChannelsFor(effCat).slice(0, gridLimit));
    // Keep the now line and blocks moving
    const t = setInterval(() => setGridTick((n) => n + 1), 60000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeView, gridCat, gridLimit, credentials, liveChannels.length, favs.live.length, locked]);

  // Remote: Right from the group list goes to the channels/posters, Left comes back.
  // Runs before the app's general remote handling so it always wins.
  useEffect(() => {
    if (!IS_TV) return undefined;
    const onKey = (e) => {
      const a = document.activeElement;
      if (!a || !a.dataset) return;
      let target = null;
      if (e.key === 'ArrowRight' && a.dataset.tvCat) {
        target =
          document.querySelector('[data-tv-row][data-sel="1"]') ||
          document.querySelector('[data-tv-row]') ||
          document.querySelector('[data-tv-grid] > *');
      } else if (e.key === 'ArrowLeft' && (a.dataset.tvRow || (a.parentElement && a.parentElement.dataset.tvGrid))) {
        // Only from the first column of the poster grid
        if (!a.dataset.tvRow) {
          const r = a.getBoundingClientRect();
          const left = Array.from(a.parentElement.children).some(
            (el) => el !== a && el.getBoundingClientRect().right <= r.left + 1 && Math.abs(el.getBoundingClientRect().top - r.top) < 4
          );
          if (left) return;
        }
        target = document.querySelector('[data-tv-cat][data-on="1"]') || document.querySelector('[data-tv-cat]');
      }
      if (target) {
        e.preventDefault();
        e.stopPropagation();
        // Posters are plain boxes: make them focusable so the remote's highlight follows
        if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '0');
        target.focus();
        target.scrollIntoView({ block: 'nearest' });
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);

  // Live preview: the app's own player sits over the box in the top right
  useEffect(() => {
    const nat = typeof window !== 'undefined' ? window.PrimoNative : null;
    if (!IS_TV || !nat || typeof nat.preview !== 'function') return undefined;
    if (activeView !== 'live' || !credentials) {
      nat.previewStop();
      return undefined;
    }
    const effCat = tvCat === 'fav' && !favs.live.length ? 'all' : tvCat;
    const ch = tvSel || tvChannelsFor(effCat)[0];
    if (!ch) return undefined;
    const url = buildStreamUrls(credentials, { ...ch, type: 'live' })[0];
    const send = () => {
      const box = document.getElementById('tv-preview-box');
      if (!box) return;
      const r = box.getBoundingClientRect();
      nat.preview(url, r.left, r.top, r.width, r.height);
    };
    window.__ptPreviewRefresh = () => setTimeout(send, 400);
    const t = setTimeout(send, 600); // wait until the remote rests on a channel
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tvSel, tvCat, activeView, credentials, liveChannels.length]);

  useEffect(() => {
    if (!IS_TV || !tvSel) return;
    loadTvGuide([tvSel]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tvSel]);

  // ---------- Movie details ----------
  const openMovie = async (movie) => {
    saveProgress(true);
    setCurrentItem(null);
    setMovieDetail({ movie, info: null, ext: null, loading: true });
    try {
      const data = await apiCall(
        credentials.server,
        credentials.username,
        credentials.password,
        'get_vod_info',
        { vod_id: movie.stream_id }
      );
      const info = data.info && !Array.isArray(data.info) ? data.info : {};
      setMovieDetail((d) =>
        d && d.movie.stream_id === movie.stream_id
          ? { ...d, info, ext: data.movie_data?.container_extension || null, loading: false }
          : d
      );
    } catch (e) {
      setMovieDetail((d) =>
        d && d.movie.stream_id === movie.stream_id ? { ...d, info: {}, loading: false } : d
      );
    }
  };

  const closeMovie = () => {
    saveProgress(true);
    setCurrentItem(null);
    setMovieDetail(null);
  };

  const handleLogin = (e) => {
    e.preventDefault();
    login(SERVER, username, password);
  };

  const logout = () => {
    saveProgress(true);
    localStorage.removeItem('primotv_xtream');
    setCredentials(null);
    setAccountInfo(null);
    setLiveChannels([]);
    setVodList([]);
    setSeriesList([]);
    setLiveCats([]);
    setVodCats([]);
    setSeriesCats([]);
    resetFilters();
    setSeriesInfo(null);
    setCurrentItem(null);
    setMovieDetail(null);
    seriesCacheRef.current = {};
  };

  const openSeries = async (series) => {
    setLoading(true);
    try {
      const data = await apiCall(
        credentials.server,
        credentials.username,
        credentials.password,
        'get_series_info',
        { series_id: series.series_id }
      );
      setSeriesInfo({ ...series, ...data });
    } catch (err) {
      setError('Failed to load series: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // ---------- Cards (used by the lists, Favourites and Continue) ----------
  const renderLiveCard = (ch) => (
    <div
      key={ch.stream_id}
      style={styles.card}
      onClick={() => playLive(ch)}
    >
      <FavButton
        active={isFav('live', ch)}
        onClick={(e) => {
          e.stopPropagation();
          toggleFav('live', ch);
        }}
      />
      {ch.stream_icon ? (
        <img
          src={ch.stream_icon}
          alt=""
          loading="lazy"
          decoding="async"
          style={{ ...styles.poster, aspectRatio: '1/1' }}
          onError={(e) => (e.target.style.display = 'none')}
        />
      ) : (
        <div
          style={{
            ...styles.poster,
            aspectRatio: '1/1',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Tv size={40} color="#666" />
        </div>
      )}
      <p style={styles.cardTitle}>{ch.name}</p>
    </div>
  );

  const renderMovieCard = (movie) => (
    <div
      key={movie.stream_id}
      style={styles.card}
      onClick={() => openMovie(movie)}
    >
      <FavButton
        active={isFav('movie', movie)}
        onClick={(e) => {
          e.stopPropagation();
          toggleFav('movie', movie);
        }}
      />
      {movie.stream_icon ? (
        <img
          src={movie.stream_icon}
          alt=""
          loading="lazy"
          decoding="async"
          style={styles.poster}
          onError={(e) => (e.target.style.display = 'none')}
        />
      ) : (
        <div
          style={{
            ...styles.poster,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Film size={40} color="#666" />
        </div>
      )}
      <p style={styles.cardTitle}>{movie.name}</p>
    </div>
  );

  const renderSeriesCard = (s) => (
    <div
      key={s.series_id}
      style={styles.card}
      onClick={() => {
        if (activeView !== 'series') resetFilters();
        setActiveView('series');
        setCurrentItem(null);
        openSeries(s);
      }}
    >
      <FavButton
        active={isFav('series', s)}
        onClick={(e) => {
          e.stopPropagation();
          toggleFav('series', s);
        }}
      />
      {s.cover ? (
        <img
          src={s.cover}
          alt=""
          loading="lazy"
          decoding="async"
          style={styles.poster}
          onError={(e) => (e.target.style.display = 'none')}
        />
      ) : (
        <div
          style={{
            ...styles.poster,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Play size={40} color="#666" />
        </div>
      )}
      <p style={styles.cardTitle}>{s.name}</p>
    </div>
  );

  const renderContinueCard = (r) => (
    <div
      key={r.key}
      style={styles.card}
      onClick={() => setCurrentItem({ ...r.item, type: r.type })}
    >
      <button
        type="button"
        style={styles.favButton}
        onClick={(e) => {
          e.stopPropagation();
          removeProgress(r.key);
        }}
        title="Remove from Continue"
        aria-label="Remove from Continue"
      >
        <X size={18} color="#aaa" />
      </button>
      {r.item.stream_icon ? (
        <img
          src={r.item.stream_icon}
          alt=""
          loading="lazy"
          decoding="async"
          style={{ ...styles.poster, aspectRatio: r.type === 'movie' ? '2/3' : '16/9' }}
          onError={(e) => (e.target.style.display = 'none')}
        />
      ) : (
        <div
          style={{
            ...styles.poster,
            aspectRatio: '16/9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Play size={32} color="#55b2f2" />
        </div>
      )}
      <p style={styles.cardTitle}>{r.item.name}</p>
      <div style={styles.progressTrack}>
        <div
          style={{
            ...styles.progressFill,
            width: `${Math.min(100, Math.round((r.position / r.duration) * 100))}%`,
          }}
        />
      </div>
      <p style={styles.smallText}>Resume from {formatTime(r.position)}</p>
    </div>
  );

  // ---------- Update available (the app tells us after its start-up check) ----------
  const [updAvail, setUpdAvail] = useState('');
  useEffect(() => {
    window.__ptUpdate = (v) => setUpdAvail(String(v || 'new'));
    return () => { window.__ptUpdate = null; };
  }, []);
  const canUpdate = typeof window !== 'undefined' && window.PrimoNative && typeof window.PrimoNative.checkUpdate === 'function';

  // ---------- TV: after picking a menu item, move the remote into that screen ----------
  const focusContent = () => {
    let tries = 0;
    const go = () => {
      const main = document.querySelector('main');
      // Screens with a category list (Live TV, Movies, Series) start on the chosen category.
      const pick =
        document.querySelector('[data-tv-cat][data-on="1"]') ||
        document.querySelector('[data-tv-cat]') ||
        document.querySelector('[data-tv-row][data-sel="1"]') ||
        document.querySelector('[data-tv-row]') ||
        document.querySelector('[data-tv-grid] > *') ||
        document.querySelector('[data-sport-row]') ||
        document.querySelector('[data-set-tab]') ||
        (main &&
          Array.from(main.querySelectorAll('[role="button"], button')).find((el) => {
            const r = el.getBoundingClientRect();
            return r.width > 0 && r.height > 0 && r.top < window.innerHeight;
          }));
      if (pick) {
        if (!pick.hasAttribute('tabindex')) pick.setAttribute('tabindex', '0');
        pick.focus();
        pick.scrollIntoView({ block: 'nearest' });
      } else if (++tries < 12) setTimeout(go, 150);
    };
    setTimeout(go, 120);
  };

  // TV: OK on a category moves the remote onto the first channel or poster in it.
  const focusList = () => {
    let tries = 0;
    const go = () => {
      const el = document.querySelector('[data-tv-row]') || document.querySelector('[data-tv-grid] > *');
      if (el) {
        if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '0');
        el.focus();
        el.scrollIntoView({ block: 'nearest' });
      } else if (++tries < 12) setTimeout(go, 150);
    };
    setTimeout(go, 200);
  };

  // ---------- Reminders (stored and fired by the app, a minute before the start) ----------
  const nativeOK = typeof window !== 'undefined' && !!window.PrimoNative;
  const readRem = () => {
    try { return JSON.parse((window.PrimoNative && window.PrimoNative.reminders && window.PrimoNative.reminders()) || '{}'); }
    catch (e) { return {}; }
  };
  const [rems, setRems] = useState(readRem);
  const remId = (ch, start) => `${ch.stream_id}|${start}`;
  const isReminded = (ch, start) => !!rems[remId(ch, start)];
  const toggleRemind = (ch, p) => {
    const n = window.PrimoNative;
    if (!n || typeof n.remind !== 'function' || !credentials) return;
    const id = remId(ch, p.start);
    if (rems[id]) n.cancelRemind(id);
    else {
      const t = new Date(p.start).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
      n.remind(id, String(p.start), `${p.title} is starting`, `${t} on ${ch.name}`, buildStreamUrls(credentials, { ...ch, type: 'live' })[0]);
    }
    setRems(readRem());
  };

  // ---------- Multiview list ----------
  const [mvList, setMvList] = useState(() => {
    try { return JSON.parse(localStorage.getItem('primotv_multiview') || '[]'); } catch (e) { return []; }
  });
  const saveMv = (L) => {
    setMvList(L);
    try { localStorage.setItem('primotv_multiview', JSON.stringify(L)); } catch (e) {}
  };
  const toggleMv = (ch) => {
    const has = mvList.some((c) => String(c.stream_id) === String(ch.stream_id));
    if (has) saveMv(mvList.filter((c) => String(c.stream_id) !== String(ch.stream_id)));
    else if (mvList.length < 4) saveMv([...mvList, { stream_id: ch.stream_id, name: ch.name, num: ch.num }]);
  };

  // ---------- Voice search ----------
  const [hasVoice] = useState(() => {
    try { return !!(window.PrimoNative && window.PrimoNative.hasVoice && window.PrimoNative.hasVoice()); } catch (e) { return false; }
  });
  const startVoice = () => {
    try { if (window.PrimoNative && window.PrimoNative.voiceSearch) window.PrimoNative.voiceSearch(); } catch (e) {}
  };

  // ---------- Open on the last channel, and number keys jump to a channel (TV) ----------
  const playLiveRef = useRef(null);
  const autoPlayedRef = useRef(false);
  useEffect(() => {
    if (!IS_TV || !liveOpts.openLast || autoPlayedRef.current || !credentials || !liveChannels.length) return;
    autoPlayedRef.current = true;
    const last = recents[0];
    if (!last || currentItem || !playLiveRef.current) return;
    const ch = liveChannels.find((c) => String(c.stream_id) === String(last.stream_id)) || last;
    playLiveRef.current(ch, liveChannels);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [credentials, liveChannels.length, recents.length]);

  useEffect(() => {
    window.__ptVoice = (t) => {
      if (!t) return;
      setActiveView('search');
      setGq(String(t));
    };
    window.__ptVoiceKey = () => {
      setActiveView('search');
      startVoice();
    };
    window.__ptOpenChannel = (id) => {
      const ch = liveRawRef.current.find((c) => String(c.stream_id) === String(id));
      if (ch && playLiveRef.current) playLiveRef.current(ch, liveRawRef.current);
      else window.__ptPendingOpen = id;
    };
    return () => { window.__ptVoice = null; window.__ptVoiceKey = null; window.__ptOpenChannel = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const liveRawRef = useRef([]);
  liveRawRef.current = liveRaw;
  useEffect(() => {
    const id = window.__ptPendingOpen;
    if (!id || !liveRaw.length || !playLiveRef.current) return;
    window.__ptPendingOpen = null;
    const ch = liveRaw.find((c) => String(c.stream_id) === String(id));
    if (ch) playLiveRef.current(ch, liveChannels);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveRaw.length]);
  // Google TV home screen row of favourite channels
  useEffect(() => {
    const n = window.PrimoNative;
    if (!n || typeof n.setHomeRow !== 'function' || !credentials) return;
    try { if (n.homeRowSupported && !n.homeRowSupported()) return; } catch (e) { return; }
    const t = setTimeout(() => {
      n.setHomeRow(JSON.stringify((favs.live || []).slice(0, 20).map((c) => ({ id: String(c.stream_id), name: c.name, logo: c.stream_icon || '' }))));
    }, 3000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [credentials, favs.live]);

  const jumpRef = useRef(null);
  jumpRef.current = (n) => {
    const ch = liveChannels.find((c) => String(c.num) === n) || liveRaw.find((c) => String(c.num) === n);
    if (ch && playLiveRef.current) {
      setNumMsg('');
      playLiveRef.current(ch, liveChannels);
    } else {
      setNumMsg(`No channel ${n}`);
      setTimeout(() => setNumMsg(''), 2500);
    }
  };
  useEffect(() => {
    if (!IS_TV || !credentials) return undefined;
    let buf = '';
    let t = null;
    const onKey = (e) => {
      const a = document.activeElement;
      if (a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA')) return;
      if (!/^[0-9]$/.test(e.key)) return;
      e.preventDefault();
      e.stopPropagation();
      buf = (buf + e.key).slice(0, 5);
      setNumBuf(buf);
      clearTimeout(t);
      t = setTimeout(() => {
        const n = String(Number(buf));
        buf = '';
        setNumBuf('');
        jumpRef.current(n);
      }, 1500);
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      clearTimeout(t);
    };
  }, [credentials]);

  // ========== LOGIN SCREEN ==========
  if (!credentials) {
    return (
      <div style={styles.appContainer}>
        <div style={styles.banner}><BrandMark /></div>
        <div style={styles.loginBox}>
          <h2 style={{ textAlign: 'center', marginBottom: 25, color: 'var(--pt-acc, #55b2f2)' }}>
            Sign in to PRIMO TV
          </h2>
          {error && <div style={styles.error}>{error}</div>}
          <form onSubmit={handleLogin}>
            <input
              style={styles.input}
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
            <div style={styles.passwordWrapper}>
              <input
                style={styles.input}
                type={showPassword ? 'text' : 'password'}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                style={styles.eyeButton}
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
            <button style={styles.button} type="submit" disabled={loading}>
              {loading ? 'Connecting...' : 'Login / Add'}
            </button>
          </form>

          {accounts.length > 0 && (
            <div style={{ marginTop: 26 }}>
              <h3 style={{ ...styles.settingsTitle, fontSize: 15 }}>Saved accounts</h3>
              {accounts.map((a) => (
                <div key={`${a.server}|${a.username}`} style={styles.accountRow}>
                  <button
                    type="button"
                    style={styles.accountMain}
                    disabled={loading}
                    onClick={() => switchAccount(a)}
                  >
                    {accountLabel(a)}
                  </button>
                  <button
                    type="button"
                    style={styles.iconButton}
                    onClick={() => removeAccount(a)}
                    title="Remove this saved account"
                    aria-label="Remove this saved account"
                  >
                    <X size={18} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // While locked, anything in a hidden category is left out everywhere
  const visFavs = {
    live: favs.live.filter((i) => !isHidden('live', i.category_id)),
    movie: favs.movie.filter((i) => !isHidden('movie', i.category_id)),
    series: favs.series.filter((i) => !isHidden('series', i.category_id)),
  };
  const totalFavs = visFavs.live.length + visFavs.movie.length + visFavs.series.length;
  const continueList = Object.values(progress)
    .filter((r) => !isHidden(r.type === 'movie' ? 'movie' : 'series', r.item.category_id))
    .sort((a, b) => b.updatedAt - a.updatedAt);

  // Big lists are only re-worked when something they depend on changes
  const memo = (key, deps, fn) => {
    const m = memoRef.current[key];
    if (m && m.deps.length === deps.length && m.deps.every((d, i) => d === deps[i])) {
      return m.value;
    }
    const value = fn();
    memoRef.current[key] = { deps, value };
    return value;
  };

  const liveVis = memo('liveVis', [liveChannels, locked, parental.hidden], () =>
    liveChannels.filter((i) => !isHidden('live', i.category_id))
  );
  const vodVis = memo('vodVis', [vodList, locked, parental.hidden], () =>
    vodList.filter((i) => !isHidden('movie', i.category_id))
  );
  const seriesVis = memo('seriesVis', [seriesList, locked, parental.hidden], () =>
    seriesList.filter((i) => !isHidden('series', i.category_id))
  );
  // Timeline shows your favourite channels, or the first 40 channels if you have none
  const timelineChannels = memo('tlChans', [favs.live, liveVis, locked, parental.hidden], () => {
    const f = favs.live.filter((i) => !isHidden('live', i.category_id));
    return f.length ? f : liveVis.slice(0, 40);
  });
  const visCats = (type, cats) =>
    locked ? cats.filter((c) => !parental.hidden[type].includes(String(c.category_id))) : cats;

  // ---------- Search, category, sort and paging ----------
  const q = search.trim().toLowerCase();
  const filtering = Boolean(q || category);

  const filterByName = (list) =>
    q ? list.filter((i) => (i.name || '').toLowerCase().includes(q)) : list;

  const sortList = (list) => {
    if (sortMode === 'az') return [...list].sort((a, b) => collator.compare(a.name || '', b.name || ''));
    if (sortMode === 'za') return [...list].sort((a, b) => collator.compare(b.name || '', a.name || ''));
    if (sortMode === 'new') return [...list].sort((a, b) => addedOf(b) - addedOf(a));
    return list;
  };

  // Filtered and sorted result for one list, kept until the list, search, category or sort changes
  const matches = (list, tag) => {
    const filtered = memo(`matches-${tag}`, [list, q, category, sortMode], () => {
      let out = filterByName(list);
      if (category) out = out.filter((i) => String(i.category_id) === category);
      return sortList(out);
    });
    return { items: filtered.slice(0, visibleCount), total: filtered.length, all: filtered };
  };

  // Only the screen you're on needs its list worked out
  const NO_RESULTS = { items: [], total: 0, all: [] };
  const liveShown = activeView === 'live' ? matches(liveVis, 'live') : NO_RESULTS;
  const movieShown = activeView === 'movies' ? matches(vodVis, 'movie') : NO_RESULTS;
  const seriesShown = activeView === 'series' ? matches(seriesVis, 'series') : NO_RESULTS;

  const favLive = filterByName(visFavs.live);
  const favMovie = filterByName(visFavs.movie);
  const favSeries = filterByName(visFavs.series);
  const favShownCount = favLive.length + favMovie.length + favSeries.length;

  const countLabel = (shown, all) => (filtering ? `${shown.total} of ${all}` : all);

  // ---------- Search everything ----------
  const gWords = gqApplied.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const gPhrase = gWords.join(' ');
  const gReady = activeView === 'search' && gPhrase.length >= 2;
  const gFind = (list) => {
    if (!gReady) return [];
    const hits = list.filter((i) => {
      const n = (i.name || '').toLowerCase();
      return gWords.every((w) => n.includes(w));
    });
    // Names that start with what you typed come first
    return [
      ...hits.filter((i) => (i.name || '').toLowerCase().startsWith(gPhrase)),
      ...hits.filter((i) => !(i.name || '').toLowerCase().startsWith(gPhrase)),
    ];
  };
  const gLive = gFind(liveVis);
  const gMovie = gFind(vodVis);
  const gSeries = gFind(seriesVis);

  const openSearch = () => {
    saveProgress(true);
    setActiveView('search');
    setSeriesInfo(null);
    setCurrentItem(null);
    setMovieDetail(null);
  };

  const renderGroup = (title, key, items, renderCard) =>
    items.length === 0 ? null : (
      <>
        <h3 style={styles.favHeading}>
          {title} ({items.length})
        </h3>
        <div style={styles.grid}>{items.slice(0, gLimit[key]).map(renderCard)}</div>
        {items.length > gLimit[key] && (
          <div style={{ textAlign: 'center', margin: '16px 0' }}>
            <button
              style={styles.secondaryButton}
              onClick={() => setGLimit((l) => ({ ...l, [key]: l[key] + 20 }))}
            >
              Show more {title.toLowerCase()}
            </button>
          </div>
        )}
      </>
    );

  // ---------- Channel zapping ----------
  // The list to step through is whatever list the channel was opened from
  const zapSource = () => {
    if (activeView === 'search') return gLive;
    if (activeView === 'live') return liveShown.all;
    if (activeView === 'favourites') return favLive;
    if (activeView === 'guide') return filterByName(visFavs.live.slice(0, GUIDE_MAX));
    return [];
  };

  const playLive = (ch, list) => {
    zapListRef.current = list || zapSource();
    setCurrentItem({ ...ch, type: 'live' });
  };
  playLiveRef.current = playLive;
  const playCatchup = (item) => {
    zapListRef.current = [];
    setCurrentItem(item);
  };

  const zap = (step) => {
    const list = zapListRef.current;
    const i = list.findIndex((c) => String(c.stream_id) === String(currentItem.stream_id));
    if (i < 0 || list.length < 2) return;
    const target = list[(i + step + list.length) % list.length];
    setCurrentItem({ ...target, type: 'live' });
  };

  // ---------- TV Live screen (TiviMate style) ----------
  const tvTime = (ms) => new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const tvNowNext = (ch) => {
    const e = ch && guideCacheRef.current[ch.stream_id];
    const items = (e && e.items) || [];
    const now = Date.now();
    const i = items.findIndex((x) => x.start <= now && now < x.end);
    return {
      now: i >= 0 ? items[i] : null,
      next: i >= 0 ? items[i + 1] : items.find((x) => x.start > now),
      loaded: !!e,
    };
  };
  const tvPct = (x) => Math.max(0, Math.min(100, ((Date.now() - x.start) / (x.end - x.start)) * 100));

  const renderTvLive = () => {
    const effCat = tvCat === 'fav' && !visFavs.live.length ? 'all' : tvCat;
    const list = tvChannelsFor(effCat);
    const cats = [
      { id: 'fav', name: `★ Favourites (${visFavs.live.length})` },
      { id: 'all', name: `All channels (${tvChannelsFor('all').length})` },
      ...tvGroupsOrdered().map((c) => ({ id: String(c.category_id), name: c.category_name })),
    ];
    const sel =
      tvSel && list.some((c) => String(c.stream_id) === String(tvSel.stream_id)) ? tvSel : list[0];
    const selNN = tvNowNext(sel);
    const col = { overflowY: 'auto', height: 'calc(100vh - 110px)', boxSizing: 'border-box' };

    return (
      <div style={{ display: 'flex', margin: '-12px -16px' }} data-guide-tick={guideTick}>
        {/* Categories */}
        <div
          style={{
            ...col, width: 190, flexShrink: 0, background: 'var(--pt-panel, #16191d)',
            borderRight: '1px solid var(--pt-line, #262b33)', padding: '6px 0',
          }}
        >
          {cats.map((c) => {
            const on = String(effCat) === String(c.id);
            return (
              <button
                key={c.id}
                type="button"
                data-tv-cat="1"
                data-on={on ? '1' : '0'}
                onClick={() => {
                  setTvCat(c.id);
                  setTvSel(null);
                  if (IS_TV) focusList();
                }}
                style={{
                  display: 'block', width: '100%', textAlign: 'left', padding: '7px 12px',
                  background: on ? 'var(--pt-card, #24303d)' : 'none', border: 'none',
                  borderLeft: on ? '3px solid var(--pt-acc, #55b2f2)' : '3px solid transparent',
                  color: on ? 'var(--pt-text, #fff)' : 'var(--pt-mut, #aab)', fontSize: 12, cursor: 'pointer',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}
              >
                {c.name}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => {
              setActiveView('settings');
              setSetTab('channels');
              setTimeout(() => {
                const el = document.getElementById('settings-groups');
                if (el) el.scrollIntoView({ block: 'start' });
              }, 100);
            }}
            style={{
              display: 'block', width: '100%', textAlign: 'left', padding: '10px 12px', marginTop: 8,
              background: 'none', border: 'none', borderTop: '1px solid var(--pt-line, #262b33)', color: 'var(--pt-acc, #55b2f2)',
              fontSize: 12, cursor: 'pointer',
            }}
          >
            ⚙ Manage groups
          </button>
        </div>

        {/* Channels with what's on now */}
        <div style={{ ...col, flex: 1, minWidth: 0, padding: '4px 0' }}>
          {list.length === 0 && <p style={{ ...styles.note, padding: 12 }}>No channels here.</p>}
          {list.slice(0, tvLimit).map((ch, i) => {
            const nn = tvNowNext(ch);
            const on = sel && String(sel.stream_id) === String(ch.stream_id);
            const fav = isFav('live', ch);
            return (
              <div
                key={ch.stream_id}
                role="button"
                tabIndex={0}
                data-tv-row="1"
                data-sel={on ? '1' : '0'}
                onFocus={() => setTvSel(ch)}
                onClick={() => playLive(ch, list)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '5px 10px',
                  borderBottom: '1px solid var(--pt-card, #1f2329)', cursor: 'pointer',
                  background: on ? 'var(--pt-card, #1f2833)' : 'none',
                }}
              >
                <span style={{ width: 30, textAlign: 'right', color: 'var(--pt-mut, #778)', fontSize: 12, flexShrink: 0 }}>
                  {i + 1}
                </span>
                <div
                  style={{
                    width: 44, height: 30, flexShrink: 0, display: 'flex',
                    alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  {ch.stream_icon ? (
                    <img
                      src={ch.stream_icon}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      style={{ maxWidth: 44, maxHeight: 30, objectFit: 'contain' }}
                      onError={(e) => (e.target.style.display = 'none')}
                    />
                  ) : (
                    <Tv size={18} color="#555" />
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{ch.name.replace(/\s*\b(4K|UHD|FHD|HD|SD)\b\s*$/i, '')}</span>
                    <QualityBadge name={ch.name} />
                  </div>
                  <div
                    style={{
                      fontSize: 11, color: 'var(--pt-mut, #9aa)', whiteSpace: 'nowrap',
                      overflow: 'hidden', textOverflow: 'ellipsis',
                    }}
                  >
                    {nn.now ? nn.now.title : nn.loaded ? 'No programme information' : ''}
                  </div>
                  {nn.now && (
                    <div style={{ height: 2, background: 'var(--pt-line, #2a2f37)', marginTop: 3 }}>
                      <div style={{ height: '100%', width: `${tvPct(nn.now)}%`, background: 'var(--pt-acc, #55b2f2)' }} />
                    </div>
                  )}
                </div>
                {fav && <Star size={12} color="#f5c518" fill="#f5c518" style={{ flexShrink: 0 }} />}
                {/* Hidden: the remote's Menu button presses this to add/remove the favourite */}
                <button
                  type="button"
                  tabIndex={-1}
                  className="fav-toggle"
                  aria-label={fav ? 'Remove from favourites' : 'Add to favourites'}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleFav('live', ch);
                  }}
                  style={{ width: 5, height: 5, padding: 0, border: 0, opacity: 0.01, flexShrink: 0 }}
                />
              </div>
            );
          })}
          {list.length > tvLimit && <AutoLoad onVisible={() => setTvLimit((n) => n + 150)} />}
        </div>

        {/* Selected channel details */}
        <div
          style={{
            ...col, width: 320, flexShrink: 0, background: 'var(--pt-panel, #16191d)',
            borderLeft: '1px solid var(--pt-line, #262b33)', padding: 16,
          }}
        >
          {sel && (
            <>
              <div
                id="tv-preview-box"
                style={{
                  aspectRatio: '16/9', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: '#000', borderRadius: 6, marginBottom: 12, overflow: 'hidden',
                }}
              >
                {sel.stream_icon ? (
                  <img
                    src={sel.stream_icon}
                    alt=""
                    style={{ maxWidth: '70%', maxHeight: 70, objectFit: 'contain' }}
                    onError={(e) => (e.target.style.display = 'none')}
                  />
                ) : (
                  <Tv size={36} color="#555" />
                )}
              </div>
              <div style={{ fontSize: 16, fontWeight: 'bold', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>{sel.name}</span>
              </div>
              {selNN.now ? (
                <>
                  <div style={{ fontSize: 11, color: 'var(--pt-acc, #55b2f2)' }}>
                    NOW · {tvTime(selNN.now.start)} – {tvTime(selNN.now.end)}
                  </div>
                  <div style={{ fontSize: 14, margin: '2px 0 4px' }}>{selNN.now.title}</div>
                  <div style={{ height: 3, background: 'var(--pt-line, #2a2f37)', marginBottom: 8 }}>
                    <div style={{ height: '100%', width: `${tvPct(selNN.now)}%`, background: 'var(--pt-acc, #55b2f2)' }} />
                  </div>
                  {selNN.now.description && (
                    <div
                      style={{
                        fontSize: 12, color: 'var(--pt-mut, #aab)', lineHeight: 1.4, marginBottom: 12,
                        maxHeight: 120, overflow: 'hidden',
                      }}
                    >
                      {selNN.now.description}
                    </div>
                  )}
                </>
              ) : (
                <div style={{ fontSize: 12, color: 'var(--pt-mut, #778)' }}>
                  {selNN.loaded ? 'No programme information' : 'Loading guide…'}
                </div>
              )}
              {selNN.next && (
                <>
                  <div style={{ fontSize: 11, color: 'var(--pt-mut, #778)', marginTop: 8 }}>NEXT · {tvTime(selNN.next.start)}</div>
                  <div style={{ fontSize: 13, color: 'var(--pt-text, #ccd)' }}>{selNN.next.title}</div>
                </>
              )}
              <div style={{ fontSize: 11, color: 'var(--pt-mut, #667)', marginTop: 18 }}>
                OK to watch · ☰ to add or remove favourite · number keys jump to a channel
              </div>
              {(() => {
                const alts = altsOf(liveChannels, sel);
                if (!alts) return null;
                return (
                  <div style={{ marginTop: 12 }}>
                    <div style={{ fontSize: 11, color: 'var(--pt-mut, #778)', marginBottom: 6 }}>QUALITY</div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {alts.map((a) => (
                        <button
                          key={a.stream_id}
                          type="button"
                          onClick={() => playLive(a, liveChannels)}
                          style={{
                            padding: '5px 10px', borderRadius: 6, fontSize: 12, cursor: 'pointer',
                            background: String(a.stream_id) === String(sel.stream_id) ? 'var(--pt-acc, #55b2f2)' : 'none',
                            color: String(a.stream_id) === String(sel.stream_id) ? '#000' : 'var(--pt-text, #ddd)',
                            border: '1px solid var(--pt-line, #333a44)',
                          }}
                        >
                          {qualOf(a.name) || 'Standard'}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })()}
              <button
                type="button"
                onClick={() => hideChannel(sel)}
                style={{
                  marginTop: 14, padding: '6px 12px', background: 'none', color: 'var(--pt-mut, #aab)',
                  border: '1px solid var(--pt-line, #333a44)', borderRadius: 6, fontSize: 12, cursor: 'pointer',
                }}
              >
                <EyeOff size={13} style={{ verticalAlign: '-2px', marginRight: 6 }} />
                Hide this channel
              </button>
              {nativeOK && (
                <button
                  type="button"
                  onClick={() => toggleMv(sel)}
                  style={{
                    marginTop: 8, marginLeft: 8, padding: '6px 12px', background: 'none', color: 'var(--pt-mut, #aab)',
                    border: '1px solid var(--pt-line, #333a44)', borderRadius: 6, fontSize: 12, cursor: 'pointer',
                  }}
                >
                  <LayoutGrid size={13} style={{ verticalAlign: '-2px', marginRight: 6 }} />
                  {mvList.some((c) => String(c.stream_id) === String(sel.stream_id))
                    ? 'Remove from Multiview'
                    : `Add to Multiview (${mvList.length}/4)`}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    );
  };

  // ---------- TV grid guide (TiviMate style) ----------
  const GRID_BEFORE = 30 * 60 * 1000; // show 30 minutes back
  const GRID_SPAN = 3.5 * 60 * 60 * 1000; // 3½ hours wide
  const GRID_ROW = 44;
  const GRID_CH_W = 170;

  const renderTvGrid = () => {
    const effCat = gridCat === 'fav' && !visFavs.live.length ? 'all' : gridCat;
    const list = tvChannelsFor(effCat);
    const rows = list.slice(0, gridLimit);
    const now = Date.now();
    // Window starts on the half hour before "30 minutes ago"
    const start = Math.floor((now - GRID_BEFORE) / (30 * 60 * 1000)) * 30 * 60 * 1000;
    const end = start + GRID_SPAN;
    const pctOf = (t) => ((Math.min(Math.max(t, start), end) - start) / GRID_SPAN) * 100;
    const slots = [];
    for (let t = start; t < end; t += 30 * 60 * 1000) slots.push(t);
    const cats = [
      { id: 'fav', name: `★ Favourites (${visFavs.live.length})` },
      { id: 'all', name: `All channels (${liveVis.length})` },
      ...tvGroupsOrdered().map((c) => ({ id: String(c.category_id), name: c.category_name })),
    ];
    const sel = gridSel;

    return (
      <div style={{ margin: '-12px -16px', display: 'flex', flexDirection: 'column', height: 'calc(100vh - 110px)' }}
        data-grid-tick={gridTick}>
        {/* Details of the programme the remote is on */}
        <div
          style={{
            display: 'flex', gap: 14, alignItems: 'flex-start', padding: '10px 16px',
            background: 'var(--pt-panel, #16191d)', borderBottom: '1px solid var(--pt-line, #262b33)', minHeight: 74, boxSizing: 'border-box',
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            {sel ? (
              <>
                <div style={{ fontSize: 11, color: 'var(--pt-acc, #55b2f2)' }}>
                  {sel.ch.name}
                  {sel.p && ` · ${tvTime(sel.p.start)} – ${tvTime(sel.p.end)}`}
                </div>
                <div style={{ fontSize: 16, fontWeight: 'bold', margin: '2px 0' }}>
                  {sel.p ? sel.p.title : 'No programme information'}
                </div>
                {sel.p && sel.p.start > Date.now() && nativeOK && (
                  <div style={{ fontSize: 12, color: 'var(--pt-acc, #55b2f2)', margin: '2px 0' }}>
                    {isReminded(sel.ch, sel.p.start) ? '🔔 Reminder set · press OK to cancel it' : '🔔 Press OK to be reminded when this starts'}
                  </div>
                )}
                {sel.p && sel.p.end <= Date.now() && (
                  <div style={{ fontSize: 12, color: 'var(--pt-acc, #55b2f2)', margin: '2px 0' }}>
                    {hasArchive(sel.ch, sel.p, Date.now()) ? '↺ Catch up: press OK to watch this from the start' : 'Already shown · catch up not available on this channel'}
                  </div>
                )}
                {sel.p && sel.p.description && (
                  <div
                    style={{
                      fontSize: 12, color: 'var(--pt-mut, #aab)', lineHeight: 1.35, maxHeight: 34, overflow: 'hidden',
                    }}
                  >
                    {sel.p.description}
                  </div>
                )}
              </>
            ) : (
              <div style={{ fontSize: 13, color: 'var(--pt-mut, #778)' }}>Move onto a programme to see details · OK to watch</div>
            )}
          </div>
          <select
            style={{ ...styles.select, padding: '6px 8px', fontSize: 13, maxWidth: 220 }}
            value={effCat}
            onChange={(e) => {
              setGridCat(e.target.value);
              setGridLimit(60);
              setGridSel(null);
            }}
            aria-label="Channel group"
          >
            {cats.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        {/* Time ruler */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--pt-line, #262b33)', background: 'var(--pt-panel, #16191d)' }}>
          <div style={{ width: GRID_CH_W, flexShrink: 0, fontSize: 11, color: 'var(--pt-mut, #778)', padding: '4px 10px' }}>
            {new Date(now).toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' })}
          </div>
          <div style={{ position: 'relative', flex: 1, height: 22 }}>
            {slots.map((t) => (
              <div
                key={t}
                style={{
                  position: 'absolute', left: `${pctOf(t)}%`, top: 0, bottom: 0,
                  borderLeft: '1px solid var(--pt-line, #2a2f37)', paddingLeft: 4, fontSize: 11, color: 'var(--pt-mut, #99a)', lineHeight: '22px',
                }}
              >
                {tvTime(t)}
              </div>
            ))}
          </div>
        </div>

        {/* Channel rows */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {rows.length === 0 && <p style={{ ...styles.note, padding: 12 }}>No channels here.</p>}
          {rows.map((ch, ri) => {
            const e = gridCacheRef.current[ch.stream_id];
            const progs = ((e && e.items) || []).filter((x) => x.end > start && x.start < end);
            return (
              <div key={ch.stream_id} style={{ display: 'flex', height: GRID_ROW, borderBottom: '1px solid var(--pt-card, #1f2329)' }}>
                <div
                  style={{
                    width: GRID_CH_W, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8,
                    padding: '0 8px', background: 'var(--pt-panel, #16191d)', borderRight: '1px solid var(--pt-line, #262b33)', boxSizing: 'border-box',
                  }}
                >
                  <span style={{ width: 24, textAlign: 'right', fontSize: 11, color: 'var(--pt-mut, #778)', flexShrink: 0 }}>{ri + 1}</span>
                  {ch.stream_icon ? (
                    <img
                      src={ch.stream_icon}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      style={{ width: 34, height: 24, objectFit: 'contain', flexShrink: 0 }}
                      onError={(ev) => (ev.target.style.display = 'none')}
                    />
                  ) : (
                    <Tv size={16} color="#555" style={{ flexShrink: 0 }} />
                  )}
                  <span style={{ fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {ch.name}
                  </span>
                </div>
                <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
                  {progs.length === 0 && (
                    <div
                      role="button"
                      tabIndex={0}
                      onFocus={() => setGridSel({ ch, p: null })}
                      onClick={() => playLive(ch, list)}
                      style={{
                        position: 'absolute', left: 1, right: 1, top: 2, bottom: 2, background: 'var(--pt-panel, #1a1e24)',
                        borderRadius: 3, fontSize: 11, color: 'var(--pt-mut, #667)', padding: '0 8px', lineHeight: `${GRID_ROW - 4}px`,
                        cursor: 'pointer',
                      }}
                    >
                      {e ? 'No programme information' : 'Loading…'}
                    </div>
                  )}
                  {progs.map((p) => {
                    const live = p.start <= now && now < p.end;
                    const left = pctOf(p.start);
                    const width = pctOf(p.end) - left;
                    return (
                      <div
                        key={`${p.start}-${p.title}`}
                        role="button"
                        tabIndex={0}
                        onFocus={() => setGridSel({ ch, p })}
                        onClick={() =>
                          p.end <= Date.now() && hasArchive(ch, p, Date.now())
                            ? playCatchup(catchupItem(credentials, ch, p))
                            : p.start > Date.now() && nativeOK
                              ? toggleRemind(ch, p)
                              : playLive(ch, list)
                        }
                        style={{
                          position: 'absolute', left: `calc(${left}% + 1px)`, width: `calc(${width}% - 2px)`,
                          top: 2, bottom: 2, borderRadius: 3, padding: '3px 6px', boxSizing: 'border-box',
                          background: live ? 'var(--pt-line, #24364a)' : 'var(--pt-card, #1c2026)', overflow: 'hidden', cursor: 'pointer',
                        }}
                      >
                        <div style={{ fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {isReminded(ch, p.start) ? '🔔 ' : ''}{p.title}
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--pt-mut, #889)', whiteSpace: 'nowrap' }}>{tvTime(p.start)}</div>
                      </div>
                    );
                  })}
                  {/* Now line */}
                  <div
                    style={{
                      position: 'absolute', left: `${pctOf(now)}%`, top: 0, bottom: 0, width: 2,
                      background: '#e50914', opacity: 0.8, pointerEvents: 'none',
                    }}
                  />
                </div>
              </div>
            );
          })}
          {list.length > gridLimit && <AutoLoad onVisible={() => setGridLimit((n) => n + 40)} />}
        </div>
      </div>
    );
  };

  // ---------- TV Films / Series browse screen (categories left, posters right) ----------
  const renderTvBrowse = (kind) => {
    const isMovie = kind === 'movie';
    const cats = visCats(kind, isMovie ? vodCats : seriesCats);
    const shown = isMovie ? movieShown : seriesShown;
    const total = isMovie ? vodVis.length : seriesVis.length;
    const favList = visFavs[kind];
    const card = isMovie ? renderMovieCard : renderSeriesCard;
    const col = { overflowY: 'auto', height: 'calc(100vh - 110px)', boxSizing: 'border-box' };
    const pick = (id, fav) => {
      setTvVodFav(fav);
      setCategory(id);
      setVisibleCount(PAGE);
      if (IS_TV) focusList();
    };
    const entries = [
      { id: '', fav: false, name: `All (${total})` },
      { id: '', fav: true, name: `★ Favourites (${favList.length})` },
      ...cats.map((c) => ({ id: String(c.category_id), fav: false, name: c.category_name })),
    ];
    const smallSelect = { ...styles.select, padding: '6px 8px', fontSize: 13 };

    return (
      <div style={{ display: 'flex', margin: '-12px -16px' }}>
        <div
          style={{
            ...col, width: 190, flexShrink: 0, background: 'var(--pt-panel, #16191d)',
            borderRight: '1px solid var(--pt-line, #262b33)', padding: '6px 0',
          }}
        >
          {entries.map((c) => {
            const on = c.fav ? tvVodFav : !tvVodFav && String(category) === c.id;
            return (
              <button
                key={`${c.fav ? 'fav' : 'cat'}-${c.id}`}
                type="button"
                data-tv-cat="1"
                data-on={on ? '1' : '0'}
                onClick={() => pick(c.id, c.fav)}
                style={{
                  display: 'block', width: '100%', textAlign: 'left', padding: '7px 12px',
                  background: on ? 'var(--pt-card, #24303d)' : 'none', border: 'none',
                  borderLeft: on ? '3px solid var(--pt-acc, #55b2f2)' : '3px solid transparent',
                  color: on ? 'var(--pt-text, #fff)' : 'var(--pt-mut, #aab)', fontSize: 12, cursor: 'pointer',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}
              >
                {c.name}
              </button>
            );
          })}
        </div>

        <div style={{ ...col, flex: 1, minWidth: 0, padding: '10px 14px' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
            <input
              type="search"
              style={{ ...styles.searchInput, maxWidth: 260, padding: '6px 10px', fontSize: 13 }}
              placeholder={isMovie ? 'Search films' : 'Search series'}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setVisibleCount(PAGE);
              }}
            />
            {!tvVodFav && (
              <select
                style={smallSelect}
                value={sortMode}
                onChange={(e) => {
                  setSortMode(e.target.value);
                  setVisibleCount(PAGE);
                }}
                aria-label="Sort order"
              >
                <option value="default">Default order</option>
                <option value="az">A to Z</option>
                <option value="za">Z to A</option>
                <option value="new">Recently added</option>
              </select>
            )}
            <span style={{ color: 'var(--pt-mut, #778)', fontSize: 12, marginLeft: 'auto' }}>
              {tvVodFav ? `${favList.length} favourites` : countLabel(shown, total)}
            </span>
          </div>
          {tvVodFav ? (
            favList.length ? (
              <div style={styles.grid} data-tv-grid="1">
                {favList
                  .filter((i) => !q || (i.name || '').toLowerCase().includes(q))
                  .map(card)}
              </div>
            ) : (
              <p style={styles.note}>No favourites yet. Press ☰ on a poster to add one.</p>
            )
          ) : (
            <>
              {renderResultsNote(shown)}
              <div style={styles.grid} data-tv-grid="1">{shown.items.map(card)}</div>
              {renderLoadMore(shown)}
            </>
          )}
        </div>
      </div>
    );
  };

  const recentsVisible = recents.filter(
    (c) => !isHidden('live', c.category_id) && liveChannels.some((l) => String(l.stream_id) === String(c.stream_id))
  );

  // Search box, plus optional category and sort dropdowns
  const renderSearch = (placeholder, cats = [], sortable = false) => (
    <div style={styles.filterRow}>
      <input
        type="search"
        style={styles.searchInput}
        placeholder={placeholder}
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setVisibleCount(PAGE);
        }}
      />
      {cats.length > 0 && (
        <select
          style={styles.select}
          value={category}
          onChange={(e) => {
            setCategory(e.target.value);
            setVisibleCount(PAGE);
          }}
          aria-label="Filter by category"
        >
          <option value="">All categories</option>
          {cats.map((c) => (
            <option key={c.category_id} value={String(c.category_id)}>
              {c.category_name}
            </option>
          ))}
        </select>
      )}
      {sortable && (
        <select
          style={styles.select}
          value={sortMode}
          onChange={(e) => {
            setSortMode(e.target.value);
            setVisibleCount(PAGE);
          }}
          aria-label="Sort order"
        >
          <option value="default">Default order</option>
          <option value="az">A to Z</option>
          <option value="za">Z to A</option>
          <option value="new">Recently added</option>
        </select>
      )}
    </div>
  );

  const renderResultsNote = (shown) =>
    filtering && shown.total === 0 ? (
      <p style={{ color: 'var(--pt-mut, #aaa)' }}>No matches found.</p>
    ) : null;

  const renderLoadMore = (shown) =>
    shown.total > shown.items.length ? (
      <div style={{ textAlign: 'center', margin: '24px 0' }}>
        <AutoLoad onVisible={() => setVisibleCount((n) => n + PAGE)} />
        <p style={{ color: 'var(--pt-mut, #aaa)', fontSize: 13 }}>
          Showing {shown.items.length} of {shown.total}
        </p>
        <button
          style={{ ...styles.button, width: 'auto', padding: '12px 28px' }}
          onClick={() => setVisibleCount((n) => n + PAGE)}
        >
          Load more
        </button>
      </div>
    ) : null;

  // ---------- What's on now (shown under a playing live channel) ----------
  const renderEpg = () => {
    const box = (children) => <div style={styles.epgBox}>{children}</div>;

    if (epg.loading) {
      return box(<p style={{ ...styles.smallText, margin: 0 }}>Loading guide...</p>);
    }
    if (!epg.items.length) {
      return box(
        <p style={{ ...styles.smallText, margin: 0 }}>
          No programme guide is available for this channel.
        </p>
      );
    }

    const now = Date.now();
    const timed = epg.items.every((i) => isFinite(i.start) && isFinite(i.end));
    const current = timed ? epg.items.find((i) => i.start <= now && i.end > now) : epg.items[0];
    const following = (timed ? epg.items.filter((i) => i.start > now) : epg.items.slice(1))[0];

    return box(
      <>
        {current ? (
          <>
            <div style={styles.detailLabel}>On now</div>
            <div style={{ fontSize: 16, margin: '4px 0' }}>
              {current.title}
              {timed && (
                <span style={{ color: 'var(--pt-mut, #aaa)', fontSize: 13 }}>
                  {'  '}
                  {clock(current.start)} to {clock(current.end)}
                </span>
              )}
            </div>
            {timed && (
              <div style={styles.progressTrack}>
                <div
                  style={{
                    ...styles.progressFill,
                    width: `${Math.max(
                      0,
                      Math.min(100, ((now - current.start) / (current.end - current.start)) * 100)
                    )}%`,
                  }}
                />
              </div>
            )}
            {current.description && (
              <p style={{ ...styles.smallText, marginTop: 8 }}>
                {current.description.length > 220
                  ? `${current.description.slice(0, 220)}...`
                  : current.description}
              </p>
            )}
          </>
        ) : (
          <p style={{ ...styles.smallText, margin: 0 }}>Nothing is listed for right now.</p>
        )}
        {following && (
          <p style={{ ...styles.smallText, marginTop: 10 }}>
            <span style={styles.detailLabel}>Next</span>
            {'  '}
            {timed ? `${clock(following.start)} ` : ''}
            {following.title}
          </p>
        )}
      </>
    );
  };

  // ---------- Movie details ----------
  const renderMovieDetail = () => {
    const { movie, info, ext, loading: detailLoading } = movieDetail;
    const i = info || {};
    const title = i.name || movie.name;
    const poster = i.movie_image || movie.stream_icon;
    const year = String(i.releasedate || i.release_date || movie.year || '').slice(0, 4);
    const rating = i.rating || movie.rating;
    const meta = [
      year,
      i.duration,
      i.genre,
      rating && Number(rating) > 0 ? `Rating ${rating}` : null,
    ]
      .filter(Boolean)
      .join('  •  ');
    const plot = i.plot || i.description;
    const saved = progress[`movie:${movie.stream_id}`];
    const trailer = i.youtube_trailer
      ? String(i.youtube_trailer).startsWith('http')
        ? i.youtube_trailer
        : `https://www.youtube.com/watch?v=${i.youtube_trailer}`
      : null;
    const faved = isFav('movie', movie);

    return (
      <div>
        <button style={styles.backButton} onClick={closeMovie}>
          <ArrowLeft size={18} /> Back
        </button>
        <div style={styles.detailWrap}>
          {poster ? (
            <img
              src={poster}
              alt=""
              style={styles.detailPoster}
              onError={(e) => (e.target.style.display = 'none')}
            />
          ) : (
            <div
              style={{
                ...styles.detailPoster,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Film size={48} color="#666" />
            </div>
          )}
          <div style={styles.detailBody}>
            <h2 style={{ margin: 0 }}>{title}</h2>
            {meta && <p style={styles.detailMeta}>{meta}</p>}
            {detailLoading && <p style={styles.smallText}>Loading details...</p>}
            {plot && <p style={{ color: 'var(--pt-text, #ddd)', lineHeight: 1.5 }}>{plot}</p>}
            {!detailLoading && !plot && (
              <p style={styles.smallText}>No description is available for this title.</p>
            )}
            {i.director && (
              <p style={{ margin: '8px 0', color: 'var(--pt-text, #ccc)' }}>
                <span style={styles.detailLabel}>Director</span>
                {'  '}
                {i.director}
              </p>
            )}
            {i.cast && (
              <p style={{ margin: '8px 0', color: 'var(--pt-text, #ccc)' }}>
                <span style={styles.detailLabel}>Cast</span>
                {'  '}
                {i.cast}
              </p>
            )}
            <div style={styles.actionRow}>
              <button
                style={styles.actionButton}
                data-tv-autofocus="true"
                ref={tvAutoFocus}
                onClick={() =>
                  setCurrentItem({
                    ...movie,
                    type: 'movie',
                    container_extension: movie.container_extension || ext,
                  })
                }
              >
                <Play size={18} />
                {saved ? `Resume from ${formatTime(saved.position)}` : 'Play'}
              </button>
              <button style={styles.actionButtonAlt} onClick={() => toggleFav('movie', movie)}>
                <Star
                  size={18}
                  color={faved ? '#f5c518' : '#aaa'}
                  fill={faved ? '#f5c518' : 'none'}
                />
                {faved ? 'In favourites' : 'Add to favourites'}
              </button>
              {trailer && (
                <a
                  href={trailer}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ ...styles.actionButtonAlt, textDecoration: 'none' }}
                >
                  Trailer
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ---------- Full schedule (shown under a playing live channel) ----------
  const renderFullGuide = () => {
    const now = Date.now();
    const timed = fullGuide.items.filter((i) => isFinite(i.start) && isFinite(i.end));
    const upcoming = timed.filter((i) => i.end > now);
    const list = (showEarlier ? timed : upcoming).slice(0, 100);
    let lastDay = '';

    return (
      <div style={styles.epgBox}>
        <div
          style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            gap: 10, marginBottom: 8,
          }}
        >
          <span style={styles.detailLabel}>Schedule</span>
          <span style={{ display: 'flex', gap: 8 }}>
            {timed.length > upcoming.length && (
              <button style={styles.secondaryButton} onClick={() => setShowEarlier(!showEarlier)}>
                {showEarlier ? 'Hide earlier' : 'Show earlier'}
              </button>
            )}
            <button style={styles.secondaryButton} onClick={() => setFullGuide(null)}>
              Close
            </button>
          </span>
        </div>

        {fullGuide.loading ? (
          <p style={{ ...styles.smallText, margin: 0 }}>Loading schedule...</p>
        ) : list.length === 0 ? (
          <p style={{ ...styles.smallText, margin: 0 }}>
            No schedule is available for this channel.
          </p>
        ) : (
          <div style={{ maxHeight: 320, overflowY: 'auto' }}>
            {list.map((i, idx) => {
              const day = dayLabel(i.start);
              const heading =
                day !== lastDay ? (
                  <div style={{ ...styles.detailLabel, margin: '10px 0 4px' }}>{day}</div>
                ) : null;
              lastDay = day;
              const isNow = i.start <= now && i.end > now;
              return (
                <React.Fragment key={idx}>
                  {heading}
                  <div style={{ padding: '6px 0', borderBottom: '1px solid var(--pt-line, #1a2c4e)' }}>
                    <div style={{ fontSize: 14, color: isNow ? 'var(--pt-acc, #55b2f2)' : 'var(--pt-text, #ddd)' }}>
                      <span style={{ color: isNow ? 'var(--pt-acc, #55b2f2)' : 'var(--pt-mut, #aaa)', marginRight: 10 }}>
                        {clock(i.start)} to {clock(i.end)}
                      </span>
                      {i.title}
                      {isNow ? '  (on now)' : ''}
                      {i.end <= now && currentItem && hasArchive(currentItem, i, now) && (
                        <button
                          style={{ ...styles.secondaryButton, marginLeft: 10, padding: '2px 8px' }}
                          onClick={() => playCatchup(catchupItem(credentials, currentItem, i))}
                        >
                          ↺ Watch
                        </button>
                      )}
                    </div>
                    {i.description && (
                      <div style={styles.smallText}>
                        {i.description.length > 160
                          ? `${i.description.slice(0, 160)}...`
                          : i.description}
                      </div>
                    )}
                  </div>
                </React.Fragment>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  // ---------- One row of the favourites TV guide ----------
  const renderGuideRow = (ch) => {
    const entry = guideCacheRef.current[ch.stream_id];
    const now = Date.now();
    const items = entry ? entry.items : [];
    const timed = items.every((i) => isFinite(i.start) && isFinite(i.end));
    const current = timed ? items.find((i) => i.start <= now && i.end > now) : items[0];
    const following = (timed ? items.filter((i) => i.start > now) : items.slice(1))[0];

    return (
      <div
        key={ch.stream_id}
        style={styles.guideRow}
        onClick={() => playLive(ch)}
      >
        {ch.stream_icon ? (
          <img
            src={ch.stream_icon}
            alt=""
            loading="lazy"
            decoding="async"
            style={styles.guideIcon}
            onError={(e) => (e.target.style.display = 'none')}
          />
        ) : (
          <div
            style={{
              ...styles.guideIcon,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Tv size={24} color="#666" />
          </div>
        )}
        <div style={styles.guideBody}>
          <div style={{ fontSize: 14, fontWeight: 'bold' }}>{ch.name}</div>
          {!entry ? (
            <div style={styles.smallText}>Loading...</div>
          ) : !current ? (
            <div style={styles.smallText}>
              {!items.length ? 'No guide data for this channel.' : 'Nothing listed right now.'}
            </div>
          ) : (
            <>
              <div style={{ fontSize: 14, margin: '4px 0' }}>
                {current.title}
                {timed && (
                  <span style={{ color: 'var(--pt-mut, #aaa)', fontSize: 12 }}>
                    {'  '}
                    {clock(current.start)} to {clock(current.end)}
                  </span>
                )}
              </div>
              {timed && (
                <div style={styles.progressTrack}>
                  <div
                    style={{
                      ...styles.progressFill,
                      width: `${Math.max(
                        0,
                        Math.min(100, ((now - current.start) / (current.end - current.start)) * 100)
                      )}%`,
                    }}
                  />
                </div>
              )}
            </>
          )}
          {following && (
            <div style={styles.smallText}>
              Next: {timed ? `${clock(following.start)} ` : ''}
              {following.title}
            </div>
          )}
        </div>
      </div>
    );
  };

  // ---------- Parental controls: pick categories to hide ----------
  const renderCategoryPicker = () => {
    const needle = catSearch.trim().toLowerCase();
    const all = catsOf(catPickType);
    const list = all.filter((c) => (c.category_name || '').toLowerCase().includes(needle));

    return (
      <div style={{ marginTop: 14 }}>
        <div style={styles.filterRow}>
          <select
            style={styles.select}
            value={catPickType}
            onChange={(e) => setCatPickType(e.target.value)}
            aria-label="Category type"
          >
            <option value="live">Live TV</option>
            <option value="movie">Movies</option>
            <option value="series">Series</option>
          </select>
          <input
            type="search"
            style={{ ...styles.searchInput, maxWidth: 260 }}
            placeholder="Find a category"
            value={catSearch}
            onChange={(e) => setCatSearch(e.target.value)}
          />
        </div>
        <p style={{ ...styles.note, marginTop: 0 }}>
          {parental.hidden[catPickType].length} hidden in this section
        </p>
        {all.length === 0 ? (
          <p style={styles.note}>Your provider didn't supply categories for this section.</p>
        ) : (
          <div style={styles.checkList}>
            {list.map((c) => (
              <label key={c.category_id} style={styles.checkRow}>
                <input
                  type="checkbox"
                  checked={parental.hidden[catPickType].includes(String(c.category_id))}
                  onChange={() => toggleHiddenCat(catPickType, c.category_id)}
                />
                {c.category_name}
              </label>
            ))}
            {list.length === 0 && <p style={styles.note}>No matches.</p>}
          </div>
        )}
      </div>
    );
  };

  // ========== MAIN APP ==========
  return (
    <div style={styles.appContainer}>
      <div style={styles.banner}><BrandMark /></div>
      <header style={styles.header}>
        <div style={styles.headerLeft}>
          <User size={32} style={styles.profilePic} />
          <div>
            <h1 style={styles.welcomeText}>Welcome, {credentials.username}</h1>
            {!narrow && (
              <p style={styles.dateTime}>
                {new Date().toLocaleTimeString()} — {new Date().toLocaleDateString()}
              </p>
            )}
          </div>
        </div>
        <div style={styles.headerRight}>
          <button
            style={{ ...styles.helpButton, color: activeView === 'search' ? 'var(--pt-acc, #55b2f2)' : 'var(--pt-text, #ddd)' }}
            onClick={openSearch}
            title="Search everything"
            aria-label="Search everything"
          >
            <Search size={22} />
          </button>
          <button
            style={{ ...styles.helpButton, opacity: refreshing ? 0.4 : 1 }}
            onClick={refreshLists}
            disabled={refreshing}
            title="Refresh channels, movies and series"
            aria-label="Refresh channels, movies and series"
          >
            <RefreshCw size={22} />
          </button>
          {parental.pinHash && (
            <button
              style={styles.helpButton}
              onClick={() => {
                if (unlocked) {
                  lockNow();
                } else {
                  setActiveView('settings');
                  setSetTab('playback');
                  setSeriesInfo(null);
                  setCurrentItem(null);
                  setMovieDetail(null);
                  resetFilters();
                }
              }}
              title={locked ? 'Locked. Open Settings to unlock' : 'Lock now'}
              aria-label={locked ? 'Locked. Open Settings to unlock' : 'Lock now'}
            >
              {locked ? <Lock size={22} /> : <Unlock size={22} />}
            </button>
          )}
          {canUpdate && (
            <button
              style={
                updAvail
                  ? { ...styles.helpButton, background: 'var(--pt-acc, #55b2f2)', color: '#000', borderRadius: 99, padding: '6px 14px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 6 }
                  : styles.helpButton
              }
              onClick={() => { try { window.PrimoNative.checkUpdate(); } catch (e) {} }}
              title={updAvail ? `Update to ${updAvail}` : 'Check for updates'}
              aria-label={updAvail ? `Update to ${updAvail}` : 'Check for updates'}
            >
              <Download size={22} />
              {updAvail && <span>Update {updAvail}</span>}
            </button>
          )}
          <button style={styles.helpButton} onClick={logout} title="Logout">
            <LogOut size={22} />
          </button>
        </div>
      </header>

      <div style={{ ...styles.mainContent, ...(narrow ? { flexDirection: 'column' } : {}) }}>
        <nav style={{ ...styles.mainMenu, ...(narrow ? styles.mainMenuNarrow : {}) }}>
          {[
            { name: 'Live TV', icon: Tv, view: 'live' },
            { name: 'Sport', icon: Trophy, view: 'sport' },
            { name: 'Movies', icon: Film, view: 'movies' },
            { name: 'Series', icon: Play, view: 'series' },
            { name: 'Continue', icon: Clock, view: 'continue' },
            { name: 'Favourites', icon: Star, view: 'favourites' },
            { name: 'Timeline', icon: Calendar, view: 'timeline' },
            { name: 'Guide', icon: Calendar, view: 'guide' },
            ...(nativeOK ? [{ name: 'Multiview', icon: LayoutGrid, view: 'multiview' }] : []),
            { name: 'Settings', icon: Settings, view: 'settings' },
          ].map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.view;
            return (
              <button
                key={item.view}
                style={{
                  ...styles.menuItem,
                  ...(narrow ? styles.menuItemNarrow : {}),
                  ...(isActive ? styles.menuItemActive : {}),
                }}
                onClick={() => {
                  saveProgress(true);
                  setActiveView(item.view);
                  setSeriesInfo(null);
                  setCurrentItem(null);
                  setMovieDetail(null);
                  resetFilters();
                  if (IS_TV) focusContent();
                }}
              >
                <Icon size={narrow ? 22 : 28} />
                <span>{item.name}</span>
              </button>
            );
          })}
        </nav>

        <main style={{ ...styles.contentArea, ...(narrow ? styles.contentAreaNarrow : {}) }}>
          {error && <div style={styles.error}>{error}</div>}
          {accountInfo && expiryInfo(accountInfo.exp_date).days !== null &&
            expiryInfo(accountInfo.exp_date).days <= 7 && (
              <div style={styles.error}>
                Your subscription: {expiryInfo(accountInfo.exp_date).text}
              </div>
            )}
          {refreshing && <div style={{ ...styles.note, marginTop: 0 }}>Refreshing lists...</div>}
          {refreshMsg && (
            <div
              style={{
                marginBottom: 12,
                fontSize: 14,
                color: refreshMsg.startsWith('Could not') ? '#ff6b6b' : 'var(--pt-acc, #55b2f2)',
              }}
            >
              {refreshMsg}
            </div>
          )}

          {/* PLAYER */}
          {currentItem && (
            <div style={IS_TV ? { display: 'none' } : undefined}>
              <div style={styles.nowPlaying}>
                Now Playing: {currentItem.name || currentItem.title}
              </div>
              <div style={styles.playerContainer}>
                <video
                  ref={videoRef}
                  style={styles.video}
                  controls
                  autoPlay
                  playsInline
                  onTimeUpdate={() => saveProgress()}
                  onPause={() => saveProgress(true)}
                  onEnded={() => {
                    saveProgress(true);
                    if (autoNext && nextEp) playNext();
                  }}
                  onError={() =>
                    failAttempt(
                      'This video could not be played in the browser (format or provider restriction).'
                    )
                  }
                />
              </div>
              {attemptN > 0 && !playbackError && (
                <div style={{ ...styles.note, marginTop: 0, marginBottom: 10 }}>
                  The first stream link didn't work, so this is backup link {attemptN + 1} of{' '}
                  {streamUrls.length}.
                </div>
              )}
              {playbackError && (
                <div style={styles.error}>
                  {playbackError}
                  {streamUrls.length > 1 && ` I tried ${streamUrls.length} stream links.`}
                  <div style={{ marginTop: 10 }}>
                    <button style={styles.secondaryButton} onClick={retryPlayback}>
                      Try again
                    </button>
                  </div>
                </div>
              )}

              {/* PLAYBACK CONTROLS */}
              <div
                style={{
                  display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center',
                  marginBottom: 14,
                }}
              >
                {!isLiveNow && (
                  <>
                    <button style={styles.secondaryButton} onClick={() => skip(-10)}>
                      <RotateCcw size={14} style={{ verticalAlign: '-2px' }} /> 10s
                    </button>
                    <button style={styles.secondaryButton} onClick={() => skip(10)}>
                      10s <RotateCw size={14} style={{ verticalAlign: '-2px' }} />
                    </button>
                    <select
                      style={{ ...styles.select, padding: '8px 10px', fontSize: 13 }}
                      value={speed}
                      onChange={(e) => changeSpeed(e.target.value)}
                      aria-label="Playback speed"
                    >
                      {[0.5, 0.75, 1, 1.25, 1.5, 2].map((s) => (
                        <option key={s} value={s}>
                          {s === 1 ? 'Speed: Normal' : `Speed: ${s}x`}
                        </option>
                      ))}
                    </select>
                  </>
                )}
                {audioTracks.length > 1 && (
                  <select
                    style={{ ...styles.select, padding: '8px 10px', fontSize: 13 }}
                    value={audioSel}
                    onChange={(e) => pickAudio(e.target.value)}
                    aria-label="Audio track"
                  >
                    {audioTracks.map((t) => (
                      <option key={t.id} value={t.id}>
                        Audio: {t.name}
                      </option>
                    ))}
                  </select>
                )}
                {subTracks.length > 0 && (
                  <select
                    style={{ ...styles.select, padding: '8px 10px', fontSize: 13 }}
                    value={subSel}
                    onChange={(e) => pickSubs(e.target.value)}
                    aria-label="Subtitles"
                  >
                    <option value={-1}>Subtitles: Off</option>
                    {subTracks.map((t) => (
                      <option key={t.id} value={t.id}>
                        Subtitles: {t.name}
                      </option>
                    ))}
                  </select>
                )}
                <button style={styles.secondaryButton} onClick={goFullscreen}>
                  <Maximize size={14} style={{ verticalAlign: '-2px' }} /> Fullscreen
                </button>
                {canPip && (
                  <button style={styles.secondaryButton} onClick={togglePip}>
                    <PictureInPicture2 size={14} style={{ verticalAlign: '-2px' }} /> Pop out
                  </button>
                )}
              </div>

              {/* CHANNEL ZAPPING */}
              {currentItem.type === 'live' && (() => {
                const list = zapListRef.current;
                const i = list.findIndex(
                  (c) => String(c.stream_id) === String(currentItem.stream_id)
                );
                if (i < 0 || list.length < 2) return null;
                return (
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 14 }}>
                    <button style={{ ...styles.actionButtonAlt, flex: 1, justifyContent: 'center' }} onClick={() => zap(-1)}>
                      <ChevronLeft size={18} /> Prev
                    </button>
                    <span style={{ ...styles.smallText, whiteSpace: 'nowrap' }}>
                      {i + 1} of {list.length}
                    </span>
                    <button style={{ ...styles.actionButtonAlt, flex: 1, justifyContent: 'center' }} onClick={() => zap(1)}>
                      Next <ChevronRight size={18} />
                    </button>
                  </div>
                );
              })()}

              {/* OPEN IN ANOTHER PLAYER — off in PRIMO TV: links would show the server */}
              {false && <div style={{ ...styles.actionRow, margin: '0 0 14px' }}>
                <button style={styles.secondaryButton} onClick={openInVlc}>
                  <ExternalLink size={14} style={{ verticalAlign: '-2px' }} /> Open in VLC
                </button>
                <button style={styles.secondaryButton} onClick={copyStreamLink}>
                  <Copy size={14} style={{ verticalAlign: '-2px' }} /> Copy link
                </button>
              </div>}
              {linkMsg && (
                <div style={{ ...styles.note, marginTop: 0, marginBottom: 14 }}>{linkMsg}</div>
              )}

              {/* NEXT EPISODE */}
              {currentItem.type === 'episode' && nextEp && (
                <div style={styles.actionRow}>
                  <button style={styles.actionButton} onClick={playNext}>
                    <SkipForward size={18} /> Next: S{nextEp.seasonNum}E{nextEp.episode_num}
                    {nextEp.title ? ` ${nextEp.title}` : ''}
                  </button>
                </div>
              )}

              {/* WHAT'S ON NOW */}
              {currentItem.type === 'live' && epg && renderEpg()}
              {currentItem.type === 'live' &&
                (fullGuide ? (
                  renderFullGuide()
                ) : (
                  <div style={{ marginBottom: 20 }}>
                    <button style={styles.actionButtonAlt} onClick={openFullGuide}>
                      <Calendar size={18} /> Full schedule
                    </button>
                  </div>
                ))}
            </div>
          )}

          {/* MOVIE DETAILS */}
          {movieDetail && renderMovieDetail()}

          {/* LIVE TV */}
          {activeView === 'live' && IS_TV && renderTvLive()}
          {activeView === 'live' && !IS_TV && (
            <>
              <div style={styles.sectionHeader}>
                <h2>Live Channels ({countLabel(liveShown, liveVis.length)})</h2>
              </div>
              {recentsVisible.length > 0 && !filtering && (
                <div style={{ marginBottom: 16 }}>
                  <div style={styles.detailLabel}>Recently watched</div>
                  <div style={{ display: 'flex', gap: 10, overflowX: 'auto', padding: '8px 0' }}>
                    {recentsVisible.map((c) => (
                      <div
                        key={c.stream_id}
                        style={{
                          flex: '0 0 auto', width: 84, textAlign: 'center', cursor: 'pointer',
                        }}
                        onClick={() => playLive(c, recentsVisible)}
                      >
                        {c.stream_icon ? (
                          <img
                            src={c.stream_icon}
                            alt=""
                            loading="lazy"
                            decoding="async"
                            style={styles.guideIcon}
                            onError={(e) => (e.target.style.display = 'none')}
                          />
                        ) : (
                          <div
                            style={{
                              ...styles.guideIcon,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              margin: '0 auto',
                            }}
                          >
                            <Tv size={22} color="#666" />
                          </div>
                        )}
                        <div
                          style={{
                            fontSize: 11, color: 'var(--pt-text, #ccc)', marginTop: 4, overflow: 'hidden',
                            textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}
                        >
                          {c.name}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {renderSearch('Search live channels', visCats('live', liveCats), true)}
              {renderResultsNote(liveShown)}
              <div style={styles.grid}>{liveShown.items.map(renderLiveCard)}</div>
              {renderLoadMore(liveShown)}
            </>
          )}

          {/* SEARCH EVERYTHING */}
          {activeView === 'search' && !movieDetail && (
            <>
              <div style={styles.sectionHeader}>
                <h2>Search everything</h2>
              </div>
              <div style={styles.filterRow}>
                <input
                  type="search"
                  autoFocus
                  style={styles.searchInput}
                  placeholder="Channels, movies and series"
                  value={gq}
                  onChange={(e) => setGq(e.target.value)}
                />
                {hasVoice && (
                  <button style={{ ...styles.actionButton, marginLeft: 8 }} onClick={startVoice} title="Voice search" aria-label="Voice search">
                    <Mic size={18} style={{ verticalAlign: '-3px' }} /> Speak
                  </button>
                )}
              </div>
              {gq.trim().length < 2 ? (
                <p style={{ color: 'var(--pt-mut, #aaa)' }}>
                  Type at least 2 letters to search live channels, movies and series together.
                </p>
              ) : gqApplied !== gq ? (
                <p style={{ color: 'var(--pt-mut, #aaa)' }}>Searching...</p>
              ) : gLive.length + gMovie.length + gSeries.length === 0 ? (
                <p style={{ color: 'var(--pt-mut, #aaa)' }}>No matches for "{gqApplied}".</p>
              ) : (
                <>
                  {renderGroup('Live channels', 'live', gLive, renderLiveCard)}
                  {renderGroup('Movies', 'movie', gMovie, renderMovieCard)}
                  {renderGroup('Series', 'series', gSeries, renderSeriesCard)}
                </>
              )}
            </>
          )}

          {/* MOVIES */}
          {activeView === 'movies' && !movieDetail && IS_TV && renderTvBrowse('movie')}
          {activeView === 'movies' && !movieDetail && !IS_TV && (
            <>
              <div style={styles.sectionHeader}>
                <h2>Movies ({countLabel(movieShown, vodVis.length)})</h2>
              </div>
              {renderSearch('Search movies', visCats('movie', vodCats), true)}
              {renderResultsNote(movieShown)}
              <div style={styles.grid}>{movieShown.items.map(renderMovieCard)}</div>
              {renderLoadMore(movieShown)}
            </>
          )}

          {/* SERIES */}
          {activeView === 'series' && (
            <>
              {seriesInfo ? (
                <div>
                  <button style={styles.backButton} onClick={() => setSeriesInfo(null)}>
                    <ArrowLeft size={18} /> Back to Series
                  </button>
                  <h2 style={{ marginBottom: 10 }}>{seriesInfo.name}</h2>
                  {seriesInfo.info?.plot && (
                    <p style={{ color: 'var(--pt-mut, #aaa)', marginBottom: 20, maxWidth: 700 }}>
                      {seriesInfo.info.plot}
                    </p>
                  )}

                  {/* WATCHED SUMMARY */}
                  {seriesInfo.episodes && (() => {
                    const seasons = Object.keys(seriesInfo.episodes).sort(
                      (a, b) => Number(a) - Number(b)
                    );
                    const all = seasons.flatMap((sn) =>
                      [...seriesInfo.episodes[sn]]
                        .sort((a, b) => Number(a.episode_num) - Number(b.episode_num))
                        .map((ep) => ({ ep, sn }))
                    );
                    if (all.length === 0) return null;
                    const done = all.filter((x) => watched[x.ep.id]).length;
                    const nextUp = all.find((x) => !watched[x.ep.id]);
                    const ids = all.map((x) => x.ep.id);
                    return (
                      <div style={{ ...styles.actionRow, margin: '0 0 22px', alignItems: 'center' }}>
                        <span style={{ color: 'var(--pt-text, #ddd)', fontSize: 14 }}>
                          Watched {done} of {all.length}
                        </span>
                        {nextUp ? (
                          <button
                            style={styles.actionButton}
                            data-tv-autofocus="true"
                ref={tvAutoFocus}
                            onClick={() =>
                              setCurrentItem(episodeItem(nextUp.ep, nextUp.sn, seriesInfo))
                            }
                          >
                            <Play size={18} /> {done === 0 ? 'Start' : 'Play next unwatched'}: S
                            {nextUp.sn}E{nextUp.ep.episode_num}
                          </button>
                        ) : (
                          <span style={{ color: 'var(--pt-acc, #55b2f2)', fontSize: 14 }}>All watched</span>
                        )}
                        <button
                          style={styles.secondaryButton}
                          onClick={() => setWatchedFor(ids, done < all.length)}
                        >
                          {done < all.length ? 'Mark all watched' : 'Clear all marks'}
                        </button>
                      </div>
                    );
                  })()}

                  {seriesInfo.episodes &&
                    Object.keys(seriesInfo.episodes).map((seasonNum) => {
                      const seasonEps = seriesInfo.episodes[seasonNum];
                      const seasonDone = seasonEps.filter((e) => watched[e.id]).length;
                      const seasonAll = seasonDone === seasonEps.length && seasonEps.length > 0;
                      return (
                      <div key={seasonNum} style={{ marginBottom: 30 }}>
                        <div
                          style={{
                            display: 'flex', justifyContent: 'space-between',
                            alignItems: 'center', gap: 10, marginBottom: 12,
                          }}
                        >
                          <h3 style={{ color: 'var(--pt-acc, #55b2f2)', margin: 0 }}>
                            Season {seasonNum}{' '}
                            <span style={{ color: 'var(--pt-mut, #aaa)', fontSize: 13, fontWeight: 'normal' }}>
                              ({seasonDone}/{seasonEps.length})
                            </span>
                          </h3>
                          <button
                            style={styles.secondaryButton}
                            onClick={() => setWatchedFor(seasonEps.map((e) => e.id), !seasonAll)}
                          >
                            {seasonAll ? 'Unmark season' : 'Mark season watched'}
                          </button>
                        </div>
                        <div style={styles.grid}>
                          {seasonEps.map((ep) => (
                            <div
                              key={ep.id}
                              style={{ ...styles.card, opacity: watched[ep.id] ? 0.6 : 1 }}
                              onClick={() =>
                                setCurrentItem(episodeItem(ep, seasonNum, seriesInfo))
                              }
                            >
                              <button
                                style={styles.favButton}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setWatchedFor([ep.id], !watched[ep.id]);
                                }}
                                title={watched[ep.id] ? 'Mark as not watched' : 'Mark as watched'}
                                aria-label={
                                  watched[ep.id] ? 'Mark as not watched' : 'Mark as watched'
                                }
                              >
                                <Check size={18} color={watched[ep.id] ? '#55b2f2' : '#aaa'} />
                              </button>
                              <div
                                style={{
                                  ...styles.poster,
                                  aspectRatio: '16/9',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                }}
                              >
                                <Play size={32} color="#55b2f2" />
                              </div>
                              <p style={styles.cardTitle}>
                                E{ep.episode_num} {ep.title || ''}
                              </p>
                              {progress[`episode:${ep.id}`] && (
                                <div style={styles.progressTrack}>
                                  <div
                                    style={{
                                      ...styles.progressFill,
                                      width: `${Math.min(
                                        100,
                                        Math.round(
                                          (progress[`episode:${ep.id}`].position /
                                            progress[`episode:${ep.id}`].duration) *
                                            100
                                        )
                                      )}%`,
                                    }}
                                  />
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                      );
                    })}
                </div>
              ) : IS_TV ? (
                renderTvBrowse('series')
              ) : (
                <>
                  <div style={styles.sectionHeader}>
                    <h2>Series ({countLabel(seriesShown, seriesVis.length)})</h2>
                  </div>
                  {renderSearch('Search series', visCats('series', seriesCats), true)}
                  {renderResultsNote(seriesShown)}
                  <div style={styles.grid}>{seriesShown.items.map(renderSeriesCard)}</div>
                  {renderLoadMore(seriesShown)}
                </>
              )}
            </>
          )}

          {/* CONTINUE WATCHING */}
          {activeView === 'continue' && (
            <>
              <div style={styles.sectionHeader}>
                <h2>Continue watching ({continueList.length})</h2>
                {continueList.length > 0 && (
                  <button style={styles.secondaryButton} onClick={() => persistProgress({})}>
                    Clear all
                  </button>
                )}
              </div>
              {continueList.length === 0 ? (
                <p style={{ color: 'var(--pt-mut, #aaa)' }}>
                  Nothing here yet. Movies and episodes you start will appear here so you can
                  pick up where you stopped.
                </p>
              ) : (
                <div style={styles.grid}>{continueList.map(renderContinueCard)}</div>
              )}
            </>
          )}

          {/* FAVOURITES */}
          {activeView === 'favourites' && !movieDetail && (
            <>
              <div style={styles.sectionHeader}>
                <h2>Favourites ({q ? `${favShownCount} of ${totalFavs}` : totalFavs})</h2>
              </div>
              {totalFavs > 0 && renderSearch('Search favourites')}
              {totalFavs > 0 && q && favShownCount === 0 && (
                <p style={{ color: 'var(--pt-mut, #aaa)' }}>No matches for "{search}".</p>
              )}

              {totalFavs === 0 && (
                <p style={{ color: 'var(--pt-mut, #aaa)' }}>
                  No favourites yet. Tap the star on any channel, movie or series to add it here.
                </p>
              )}

              {favLive.length > 0 && (
                <>
                  <h3 style={styles.favHeading}>Live channels ({favLive.length})</h3>
                  <div style={styles.grid}>{favLive.map(renderLiveCard)}</div>
                </>
              )}

              {favMovie.length > 0 && (
                <>
                  <h3 style={styles.favHeading}>Movies ({favMovie.length})</h3>
                  <div style={styles.grid}>{favMovie.map(renderMovieCard)}</div>
                </>
              )}

              {favSeries.length > 0 && (
                <>
                  <h3 style={styles.favHeading}>Series ({favSeries.length})</h3>
                  <div style={styles.grid}>{favSeries.map(renderSeriesCard)}</div>
                </>
              )}
            </>
          )}

          {/* TIMELINE */}
          {activeView === 'sport' && credentials && (
            <SportView
              chans={liveChannels}
              cats={liveCats}
              getEpg={(id) => apiCall(credentials.server, credentials.username, credentials.password, 'get_short_epg', { stream_id: id, limit: 30 })}
              onPlay={(ch) => playLive(ch, liveChannels)}
              canCatch={(ch, e) => hasArchive(ch, { start: e.s, end: e.e }, Date.now())}
              onCatchup={(ch, e) => playCatchup(catchupItem(credentials, ch, { start: e.s, end: e.e, title: e.title }))}
              isReminded={isReminded}
              onRemind={toggleRemind}
            />
          )}

          {activeView === 'multiview' && credentials && (
            <MultiviewView
              list={mvList}
              onRemove={toggleMv}
              onClear={() => saveMv([])}
              onStart={() => {
                try {
                  window.PrimoNative.multiview(JSON.stringify(mvList.map((c) => ({ name: c.name, url: buildStreamUrls(credentials, { ...c, type: 'live' })[0] }))));
                } catch (e) {}
              }}
            />
          )}

          {activeView === 'timeline' && credentials && (
            <Timeline
              api={(action, extra) =>
                apiCall(credentials.server, credentials.username, credentials.password, action, extra)
              }
              creds={credentials}
              channels={timelineChannels}
              movies={vodVis}
              series={seriesVis}
              continueList={continueList}
              narrow={narrow}
              onPlayLive={(ch) => playLive(ch, timelineChannels)}
              onPlayCatchup={(item) => {
                zapListRef.current = [];
                setCurrentItem(item);
              }}
              onOpenMovie={openMovie}
              onOpenSeries={(sr) => {
                setActiveView('series');
                openSeries(sr);
              }}
              onOpenContinue={(r) => setCurrentItem({ ...r.item, type: r.type })}
            />
          )}

          {/* TV GUIDE (favourite live channels) */}
          {activeView === 'guide' && IS_TV && renderTvGrid()}
          {activeView === 'guide' && !IS_TV && (
            <>
              <div style={styles.sectionHeader}>
                <h2>TV guide ({visFavs.live.length})</h2>
                {visFavs.live.length > 0 && (
                  <button
                    style={styles.secondaryButton}
                    onClick={() => loadFavGuide(true)}
                    disabled={guideLoading}
                  >
                    {guideLoading ? 'Updating...' : 'Update guide'}
                  </button>
                )}
              </div>

              {visFavs.live.length === 0 ? (
                <p style={{ color: 'var(--pt-mut, #aaa)' }}>
                  Star some live channels and they'll appear here with what's on now and what's
                  next. Tap a channel to watch it.
                </p>
              ) : (
                <>
                  {renderSearch('Search your channels')}
                  {visFavs.live.length > GUIDE_MAX && (
                    <p style={{ ...styles.note, marginTop: 0, marginBottom: 14 }}>
                      Showing the first {GUIDE_MAX} of your {visFavs.live.length} favourite
                      channels, to keep the guide quick to load.
                    </p>
                  )}
                  {filterByName(visFavs.live.slice(0, GUIDE_MAX)).length === 0 && (
                    <p style={{ color: 'var(--pt-mut, #aaa)' }}>No matches found.</p>
                  )}
                  <div>
                    {filterByName(visFavs.live.slice(0, GUIDE_MAX)).map(renderGuideRow)}
                  </div>
                </>
              )}
            </>
          )}

          {/* SETTINGS */}
          {activeView === 'settings' && (
            <div>
              <h2>Settings</h2>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '0 0 16px' }}>
                {[['account', 'Account'], ['channels', 'Channels'], ['appearance', 'Appearance'], ['playback', 'Playback'], ['help', 'Help']].map(([k, n]) => (
                  <button
                    key={k}
                    type="button"
                    data-set-tab={k}
                    onClick={() => setSetTab(k)}
                    onFocus={() => setSetTab(k)}
                    style={{
                      padding: '10px 18px', borderRadius: 99, font: 'inherit', fontSize: 15, cursor: 'pointer',
                      fontWeight: setTab === k ? 800 : 500,
                      background: setTab === k ? 'var(--pt-acc, #55b2f2)' : 'var(--pt-card, #11223e)',
                      color: setTab === k ? '#000' : 'var(--pt-text, #fff)',
                      border: '1px solid var(--pt-line, #1a2c4e)',
                    }}
                  >
                    {n}
                  </button>
                ))}
              </div>

              {setTab === 'account' && (<>
              {/* APP VERSION + UPDATES */}
              <AppUpdate sectionStyle={styles.settingsSection} titleStyle={styles.settingsTitle} noteStyle={styles.note} buttonStyle={styles.actionButton} />

              {/* ACCOUNTS */}
              <div style={styles.settingsSection}>
                <h3 style={styles.settingsTitle}>Subscription</h3>
                {!accountInfo ? (
                  <p style={{ ...styles.note, marginTop: 0 }}>No details available yet.</p>
                ) : (
                  <div style={{ fontSize: 14, lineHeight: 1.8, color: 'var(--pt-text, #ddd)' }}>
                    <div>
                      Status: <strong>{accountInfo.status || 'Unknown'}</strong>
                      {String(accountInfo.is_trial) === '1' ? ' (trial)' : ''}
                    </div>
                    <div>
                      Expires: <strong>{expiryInfo(accountInfo.exp_date).text}</strong>
                    </div>
                    <div>
                      Connections in use:{' '}
                      <strong>
                        {accountInfo.active_cons ?? '?'} of {accountInfo.max_connections ?? '?'}
                      </strong>
                    </div>
                    {accountInfo.created_at && Number(accountInfo.created_at) > 0 && (
                      <div>
                        Started:{' '}
                        {new Date(Number(accountInfo.created_at) * 1000).toLocaleDateString()}
                      </div>
                    )}
                    <div style={styles.note}>
                      Checked {new Date(accountInfo.checkedAt).toLocaleTimeString()}
                    </div>
                  </div>
                )}
                <div style={styles.actionRow}>
                  <button
                    style={styles.actionButtonAlt}
                    onClick={refreshAccountInfo}
                    disabled={infoLoading}
                  >
                    <RefreshCw size={16} /> {infoLoading ? 'Checking...' : 'Check again'}
                  </button>
                </div>
              </div>

              <div style={styles.settingsSection}>
                <h3 style={styles.settingsTitle}>Accounts</h3>
                <p style={{ ...styles.note, marginTop: 0 }}>
                  Logged in as <strong>{credentials.username}</strong>
                  <br />
                  Provider: PRIMO TV
                </p>
                {accounts.filter((a) => !sameAccount(a, credentials)).length > 0 && (
                  <div style={{ marginTop: 14 }}>
                    <p style={{ ...styles.note, marginTop: 0, marginBottom: 8 }}>
                      Switch to another saved account:
                    </p>
                    {accounts
                      .filter((a) => !sameAccount(a, credentials))
                      .map((a) => (
                        <div key={`${a.server}|${a.username}`} style={styles.accountRow}>
                          <button
                            type="button"
                            style={styles.accountMain}
                            onClick={() => switchAccount(a)}
                          >
                            {accountLabel(a)}
                          </button>
                          <button
                            type="button"
                            style={styles.iconButton}
                            onClick={() => removeAccount(a)}
                            title="Remove this saved account"
                            aria-label="Remove this saved account"
                          >
                            <X size={18} />
                          </button>
                        </div>
                      ))}
                  </div>
                )}
                <div style={styles.actionRow}>
                  <button style={styles.actionButtonAlt} onClick={logout}>
                    Add another account
                  </button>
                </div>
                <p style={styles.note}>
                  Saved logins stay in this browser only. Favourites, Continue and parental
                  settings are kept separately for each account.
                </p>
              </div>

              </>)}

              {setTab === 'channels' && (<>
              {/* COUNTRIES AND ONE ENTRY PER CHANNEL */}
              <div style={styles.settingsSection}>
                <h3 style={styles.settingsTitle}>Countries</h3>
                <p style={{ ...styles.note, marginTop: 0 }}>
                  Switch off the countries you never watch. Their channels and groups disappear everywhere,
                  which makes the lists much shorter.
                  {' '}{liveChannels.length.toLocaleString()} of {liveRaw.length.toLocaleString()} channels shown.
                </p>
                <div style={{ ...styles.actionRow, margin: '10px 0' }}>
                  <button style={styles.actionButton} onClick={() => setLiveOpts({ hidcty: [] })}>Show all</button>
                  <button style={styles.actionButton} onClick={() => setLiveOpts({ hidcty: ctyList.map(([k]) => k) })}>Hide all</button>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {ctyList.map(([k, n]) => {
                    const on = !liveOpts.hidcty.includes(k);
                    return (
                      <button
                        key={k}
                        type="button"
                        aria-pressed={on}
                        onClick={() =>
                          setLiveOpts({ hidcty: on ? [...liveOpts.hidcty, k] : liveOpts.hidcty.filter((x) => x !== k) })
                        }
                        style={{
                          padding: '8px 12px', borderRadius: 10, font: 'inherit', fontSize: 14, cursor: 'pointer',
                          background: on ? 'var(--pt-card, #11223e)' : 'none',
                          color: on ? 'var(--pt-text, #fff)' : 'var(--pt-mut, #778)',
                          border: on ? '2px solid var(--pt-acc, #55b2f2)' : '2px solid var(--pt-line, #1a2c4e)',
                          textDecoration: on ? 'none' : 'line-through',
                        }}
                      >
                        {ctyName(k)} <span style={{ opacity: 0.6 }}>{n}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div style={styles.settingsSection}>
                <h3 style={styles.settingsTitle}>One entry per channel</h3>
                <label style={styles.checkRow}>
                  <input
                    type="checkbox"
                    checked={liveOpts.merge}
                    onChange={(e) => setLiveOpts({ merge: e.target.checked })}
                  />
                  Merge the SD, HD, FHD and 4K copies of a channel into one row
                </label>
                <label style={{ ...styles.checkRow, cursor: 'default', marginTop: 8 }}>
                  Preferred quality
                  <select
                    style={styles.select}
                    value={liveOpts.qpref}
                    onChange={(e) => setLiveOpts({ qpref: e.target.value })}
                  >
                    {QUALITIES.map((q) => (
                      <option key={q} value={q}>{q === 'FHD' ? 'Full HD (best for Fire TV sticks)' : q === '4K' ? '4K (fast connection and 4K box)' : q}</option>
                    ))}
                  </select>
                </label>
                <p style={styles.note}>
                  The merged row plays your preferred quality. On Live TV the other versions are under Quality on the side panel.
                </p>
              </div>

              {/* LIVE TV GROUPS (order, hide) AND HIDDEN CHANNELS */}
              <div style={styles.settingsSection} id="settings-groups">
                <h3 style={styles.settingsTitle}>Channel groups</h3>
                <p style={{ ...styles.note, marginTop: 0 }}>
                  Move groups up or down to put your favourites first, or hide groups you never use.
                  Saved on this device.
                </p>
                <div style={{ maxHeight: 420, overflowY: 'auto', marginTop: 10 }}>
                  {tvGroupsOrdered(true).map((c, i, arr) => {
                    const hidden = tvHiddenGrp.has(String(c.category_id));
                    const btn = {
                      background: 'var(--pt-card, #1c2026)', color: 'var(--pt-text, #ddd)', border: '1px solid var(--pt-line, #333a44)', borderRadius: 6,
                      padding: '4px 10px', fontSize: 12, cursor: 'pointer',
                    };
                    return (
                      <div
                        key={c.category_id}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 6, padding: '5px 0',
                          borderBottom: '1px solid var(--pt-card, #1f2329)', opacity: hidden ? 0.5 : 1,
                        }}
                      >
                        <span style={{ width: 28, color: 'var(--pt-mut, #778)', fontSize: 12 }}>{i + 1}</span>
                        <span style={{ flex: 1, minWidth: 0, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {c.category_name}
                        </span>
                        <button type="button" style={btn} disabled={i === 0} aria-label="Move up"
                          onClick={() => moveGroup(c.category_id, -1)}>▲</button>
                        <button type="button" style={btn} disabled={i === arr.length - 1} aria-label="Move down"
                          onClick={() => moveGroup(c.category_id, 1)}>▼</button>
                        <button type="button" style={{ ...btn, minWidth: 54 }}
                          onClick={() => toggleGroupHidden(c.category_id)}>
                          {hidden ? 'Show' : 'Hide'}
                        </button>
                      </div>
                    );
                  })}
                </div>
                {(tvLayout.order.length > 0 || tvLayout.hiddenGroups.length > 0) && (
                  <div style={styles.actionRow}>
                    <button
                      style={styles.secondaryButton}
                      onClick={() => saveTvLayout({ ...tvLayout, order: [], hiddenGroups: [] })}
                    >
                      Reset group order
                    </button>
                  </div>
                )}

                <h3 style={{ ...styles.settingsTitle, marginTop: 18 }}>
                  Hidden channels ({tvLayout.hiddenChannels.length})
                </h3>
                {tvLayout.hiddenChannels.length === 0 ? (
                  <p style={{ ...styles.note, marginTop: 0 }}>
                    None. On Live TV, press Right from a channel and choose "Hide this channel".
                  </p>
                ) : (
                  tvLayout.hiddenChannels.map((c) => (
                    <div
                      key={c.stream_id}
                      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderBottom: '1px solid var(--pt-card, #1f2329)' }}
                    >
                      <span style={{ flex: 1, fontSize: 13 }}>{c.name}</span>
                      <button
                        type="button"
                        style={{
                          background: 'var(--pt-card, #1c2026)', color: 'var(--pt-text, #ddd)', border: '1px solid var(--pt-line, #333a44)', borderRadius: 6,
                          padding: '4px 10px', fontSize: 12, cursor: 'pointer',
                        }}
                        onClick={() => unhideChannel(c.stream_id)}
                      >
                        Unhide
                      </button>
                    </div>
                  ))
                )}
              </div>

              {/* LISTS */}
              <div style={styles.settingsSection}>
                <h3 style={styles.settingsTitle}>Channels, movies and series</h3>
                <p style={{ ...styles.note, marginTop: 0 }}>
                  The lists load when you open the app. Refresh to pick up anything your provider
                  has added since.
                  {lastRefreshed && ` Last updated ${new Date(lastRefreshed).toLocaleString()}.`}
                </p>
                <div style={styles.actionRow}>
                  <button style={styles.actionButton} onClick={refreshLists} disabled={refreshing}>
                    <RefreshCw size={18} /> {refreshing ? 'Refreshing...' : 'Refresh now'}
                  </button>
                </div>
                <label style={{ ...styles.checkRow, cursor: 'default' }}>
                  Refresh automatically
                  <select
                    style={styles.select}
                    value={autoRefreshHours}
                    onChange={(e) => {
                      const hours = Number(e.target.value);
                      setAutoRefreshHours(hours);
                      try {
                        localStorage.setItem('primotv_autorefresh', String(hours));
                      } catch (err) {}
                    }}
                  >
                    <option value={0}>Off</option>
                    <option value={1}>Every hour</option>
                    <option value={3}>Every 3 hours</option>
                    <option value={6}>Every 6 hours</option>
                    <option value={12}>Every 12 hours</option>
                    <option value={24}>Every 24 hours</option>
                  </select>
                </label>
                <p style={styles.note}>
                  Automatic refresh only runs while the app is open, and it won't interrupt
                  anything you're watching.
                </p>
                <label style={{ ...styles.checkRow, cursor: 'default', marginTop: 8 }}>
                  Use saved lists for up to
                  <select
                    style={styles.select}
                    value={cacheHours}
                    onChange={(e) => {
                      const hours = Number(e.target.value);
                      setCacheHours(hours);
                      try {
                        localStorage.setItem('primotv_cachehours', String(hours));
                      } catch (err) {}
                      if (hours === 0) {
                        cacheDelete(`${credentials.server}|${credentials.username}`);
                      }
                    }}
                  >
                    <option value={0}>Off (always download)</option>
                    <option value={1}>1 hour</option>
                    <option value={3}>3 hours</option>
                    <option value={6}>6 hours</option>
                    <option value={12}>12 hours</option>
                    <option value={24}>24 hours</option>
                  </select>
                </label>
                <p style={styles.note}>
                  When you open the app, it shows the copy saved in this browser if it's newer
                  than this, and only downloads fresh lists once it's older. Refresh now always
                  downloads fresh ones.
                </p>
                <div style={styles.actionRow}>
                  <button style={styles.actionButtonAlt} onClick={clearSavedLists}>
                    Clear saved lists
                  </button>
                </div>

              </div>

              </>)}


              {setTab === 'appearance' && (<>
              {/* APPEARANCE */}
              <Appearance sectionStyle={styles.settingsSection} titleStyle={styles.settingsTitle} noteStyle={styles.note} />

              </>)}

              {setTab === 'playback' && (<>
              {/* PLAYBACK */}
              <div style={styles.settingsSection}>
                <h3 style={styles.settingsTitle}>Playback</h3>
                {IS_TV && (
                  <label style={{ ...styles.checkRow, marginBottom: 8 }}>
                    <input
                      type="checkbox"
                      checked={liveOpts.openLast}
                      onChange={(e) => setLiveOpts({ openLast: e.target.checked })}
                    />
                    Start PRIMO TV on the last channel I watched
                  </label>
                )}
                <label
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    color: 'var(--pt-text, #ddd)', cursor: 'pointer',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={autoNext}
                    onChange={(e) => {
                      setAutoNext(e.target.checked);
                      try {
                        localStorage.setItem('primotv_autonext', e.target.checked ? '1' : '0');
                      } catch (err) {}
                    }}
                  />
                  Play the next episode automatically
                </label>
              </div>

              {/* PARENTAL CONTROLS */}
              <div style={styles.settingsSection}>
                <h3 style={styles.settingsTitle}>Parental controls</h3>
                {!parental.pinHash ? (
                  <>
                    <p style={{ ...styles.note, marginTop: 0 }}>
                      Set a 4-digit PIN, then choose categories to hide. Hidden categories stay
                      out of lists, search, favourites and Continue until you unlock. The app
                      starts locked every time it opens.
                    </p>
                    <div style={styles.actionRow}>
                      <input
                        type="password"
                        inputMode="numeric"
                        maxLength={4}
                        style={styles.pinInput}
                        placeholder="PIN"
                        value={pinInput}
                        onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ''))}
                      />
                      <button style={styles.actionButton} onClick={setNewPin}>
                        Set PIN
                      </button>
                    </div>
                  </>
                ) : locked ? (
                  <>
                    <p style={{ ...styles.note, marginTop: 0 }}>
                      Locked. Enter your PIN to show hidden categories or change these settings.
                    </p>
                    <div style={styles.actionRow}>
                      <input
                        type="password"
                        inputMode="numeric"
                        maxLength={4}
                        style={styles.pinInput}
                        placeholder="PIN"
                        value={pinInput}
                        onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ''))}
                        onKeyDown={(e) => e.key === 'Enter' && tryUnlock()}
                      />
                      <button style={styles.actionButton} onClick={tryUnlock}>
                        <Unlock size={18} /> Unlock
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <p style={{ ...styles.note, marginTop: 0 }}>
                      Unlocked. Tick the categories to hide, then tap Lock now.
                    </p>
                    <div style={styles.actionRow}>
                      <button style={styles.actionButton} onClick={lockNow}>
                        <Lock size={18} /> Lock now
                      </button>
                      <button style={styles.actionButtonAlt} onClick={hideAdultCats}>
                        Hide adult categories
                      </button>
                      <button style={styles.actionButtonAlt} onClick={removePin}>
                        Remove PIN
                      </button>
                    </div>
                    {renderCategoryPicker()}
                  </>
                )}
                {pinMsg && <p style={styles.note}>{pinMsg}</p>}
                <p style={styles.note}>
                  This is a simple lock to keep casual viewers out, not strong security. Anyone
                  who can clear this browser's data can remove it.
                </p>
              </div>

              </>)}

              {setTab === 'help' && (
                <SpeedTest sectionStyle={styles.settingsSection} titleStyle={styles.settingsTitle} noteStyle={styles.note} buttonStyle={styles.actionButton} />
              )}
              {setTab === 'help' && (
                <HelpPanel sectionStyle={styles.settingsSection} titleStyle={styles.settingsTitle} noteStyle={styles.note} buttonStyle={styles.actionButton} />
              )}

              {setTab === 'account' && (<>
              <CopySetup credentials={credentials} sectionStyle={styles.settingsSection} titleStyle={styles.settingsTitle} noteStyle={styles.note} buttonStyle={styles.actionButton} inputStyle={styles.input} />

              {/* BACKUP */}
              <div style={styles.settingsSection}>
                <h3 style={styles.settingsTitle}>Backup</h3>
                <p style={{ ...styles.note, marginTop: 0 }}>
                  Save your favourites and watch progress to a file, or restore them on another
                  device or after clearing your browser. Login details and your PIN are not
                  included. Importing adds to what you already have.
                </p>
                <div style={styles.actionRow}>
                  <button style={styles.actionButton} onClick={exportBackup}>
                    <Download size={18} /> Export
                  </button>
                  <label style={{ ...styles.actionButtonAlt, cursor: 'pointer' }}>
                    <Upload size={18} /> Import
                    <input
                      type="file"
                      accept="application/json,.json"
                      style={{ display: 'none' }}
                      onChange={(e) => {
                        importBackup(e.target.files[0]);
                        e.target.value = '';
                      }}
                    />
                  </label>
                </div>
                {backupMsg && <p style={styles.note}>{backupMsg}</p>}
              </div>

              <button
                style={{ ...styles.button, width: 'auto', marginTop: 20 }}
                onClick={logout}
              >
                Logout
              </button>
              </>)}
            </div>
          )}
          <ScreenSaver blocked={!!currentItem && !nativeOK} />
          {(numBuf || numMsg) && (
            <div
              style={{
                position: 'fixed', top: 18, right: 24, zIndex: 90, padding: '10px 18px', borderRadius: 12,
                background: 'var(--pt-panel, #0a1426)', border: '2px solid var(--pt-acc, #55b2f2)',
                color: 'var(--pt-text, #fff)', fontSize: numBuf ? 34 : 18, fontWeight: 800, letterSpacing: 2,
                boxShadow: '0 10px 30px rgba(0,0,0,.5)',
              }}
            >
              {numBuf || numMsg}
            </div>
          )}
          {credentials && (
            <FollowAlert
              creds={credentials}
              currentStreamId={currentItem && currentItem.type === 'live' ? currentItem.stream_id : null}
              onSwitch={(ch) => playLive(ch, timelineChannels)}
            />
          )}
        </main>
      </div>
    </div>
  );
}

export default App;