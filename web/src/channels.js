// Big-library helpers for live TV: countries on/off and one entry per channel.
// Countries come from the provider's group names ("UK | Sports", "[US] News", "DE: Sport"),
// or the channel name if the group has none.

const CTY = {UK:'United Kingdom',GB:'United Kingdom',IE:'Ireland',IRE:'Ireland',US:'United States',USA:'United States',CA:'Canada',CAN:'Canada',AU:'Australia',AUS:'Australia',NZ:'New Zealand',FR:'France',DE:'Germany',GER:'Germany',ES:'Spain',ESP:'Spain',IT:'Italy',ITA:'Italy',PT:'Portugal',NL:'Netherlands',BE:'Belgium',PL:'Poland',TR:'Turkey',TUR:'Turkey',IN:'India',IND:'India',PK:'Pakistan',AR:'Arabic',ARA:'Arabic',ARAB:'Arabic',AF:'Africa',AFR:'Africa',SE:'Sweden',NO:'Norway',DK:'Denmark',FI:'Finland',GR:'Greece',RO:'Romania',AL:'Albania',EXYU:'Ex-Yu',YU:'Ex-Yu',BR:'Brazil',MX:'Mexico',LAT:'Latin America',LATAM:'Latin America',LATINO:'Latin America',RU:'Russia',UA:'Ukraine',CH:'Switzerland',AT:'Austria',HU:'Hungary',CZ:'Czech Republic',SK:'Slovakia',BG:'Bulgaria',IR:'Iran',KU:'Kurdish',KUR:'Kurdish',PH:'Philippines',CN:'China',JP:'Japan',KR:'Korea',TH:'Thailand',VN:'Vietnam',NG:'Nigeria',ZA:'South Africa',CARIB:'Caribbean',SCOT:'Scotland',IL:'Israel',SA:'Saudi Arabia',AE:'UAE',UAE:'UAE',EG:'Egypt',MA:'Morocco',DZ:'Algeria',TN:'Tunisia',LB:'Lebanon',SO:'Somalia',ET:'Ethiopia',BD:'Bangladesh',LK:'Sri Lanka',MY:'Malaysia',ID:'Indonesia',SG:'Singapore',HR:'Croatia',RS:'Serbia',BA:'Bosnia',MK:'Macedonia',SI:'Slovenia',LT:'Lithuania',LV:'Latvia',EE:'Estonia',IS:'Iceland',CY:'Cyprus',MT:'Malta',CL:'Chile',CO:'Colombia',PE:'Peru',VE:'Venezuela'};
const CTYFULL = Object.entries(CTY).map(([k, v]) => [v.toUpperCase(), k]).sort((a, b) => b[0].length - a[0].length);

export function ctyOf(t) {
  const s = String(t || '').toUpperCase().replace(/[^\x20-\x7E]/g, ' ').trim();
  if (!s) return '';
  const m = s.match(/^[[(|{\s]*([A-Z]{2,6})\s*[\])|}:\-–—»▎/]/) || s.match(/^([A-Z]{2,6})\s+/);
  if (m && CTY[m[1]]) return m[1] === 'GB' ? 'UK' : m[1];
  for (const [full, code] of CTYFULL) if (s.startsWith(full)) return code;
  return '';
}
export const ctyName = (k) => (k === 'OTHER' ? 'No country (PPV, events, 24/7 and others)' : CTY[k] || k);

export const QUALITIES = ['FHD', '4K', 'HD', 'SD'];
const QPREF = { FHD: ['FHD', 'HD', '4K', '', 'SD'], '4K': ['4K', 'FHD', 'HD', '', 'SD'], HD: ['HD', 'FHD', '', 'SD', '4K'], SD: ['SD', '', 'HD', 'FHD', '4K'] };

export function qualOf(n) {
  const u = String(n || '').toUpperCase();
  if (/\b(4K|UHD|2160P?)\b|ᵁᴴᴰ/.test(u)) return '4K';
  if (/\b(FHD|1080P?)\b|ᶠᴴᴰ/.test(u)) return 'FHD';
  if (/\b(HD|720P?)\b|ᴴᴰ/.test(u)) return 'HD';
  if (/\bSD\b|ˢᴰ/.test(u)) return 'SD';
  return '';
}
function baseName(n) {
  return String(n || '')
    .replace(/^[\s[(|{]*[A-Za-z]{2,6}\s*[\])|}:\-–—»▎/]+\s*/, '')
    .replace(/\b(4K|UHD|2160P?|FHD|1080P?|HD|720P?|SD|HEVC|H\.?26[45]|50 ?FPS|60 ?FPS|RAW|BACKUP|ALT|MULTI ?AUDIO)\b/gi, ' ')
    .replace(/[ᴴᴰᶠᵁˢ]+/g, ' ')
    .replace(/[[\]()|:\-–—_•·*]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

const KEY = 'primotv_liveopts';
export const DEFAULT_LIVE_OPTS = { hidcty: [], merge: true, qpref: 'FHD', openLast: false, asked: false };
export function loadLiveOpts() {
  try { return { ...DEFAULT_LIVE_OPTS, ...(JSON.parse(localStorage.getItem(KEY)) || {}) }; }
  catch (e) { return { ...DEFAULT_LIVE_OPTS }; }
}
export function saveLiveOpts(o) {
  try { localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) {}
}

// Country for every group, worked out once per list.
export function groupCountries(cats) {
  const m = new Map();
  for (const c of cats || []) m.set(String(c.category_id), ctyOf(c.category_name));
  return m;
}

// Countries present, with channel counts, biggest first.
export function countriesFound(raw, gc) {
  const n = new Map();
  for (const ch of raw || []) {
    const k = gc.get(String(ch.category_id)) || ctyOf(ch.name) || 'OTHER';
    n.set(k, (n.get(k) || 0) + 1);
  }
  return [...n.entries()].sort((a, b) => (a[0] === 'OTHER') - (b[0] === 'OTHER') || b[1] - a[1]);
}

const CTYOF = new WeakMap();
const ALTS = new WeakMap();
// Other qualities of a merged channel (looked up by stream id, since saved favourites are copies).
export function altsOf(list, ch) {
  if (!ch) return null;
  const hit = ALTS.get(ch) || (list || []).map((c) => ALTS.get(c)).find((L) => L && L.some((x) => String(x.stream_id) === String(ch.stream_id)));
  return hit && hit.length > 1 ? hit : null;
}

// The list the app shows: hidden countries removed, SD/HD/FHD/4K copies merged into one row.
export function processLive(raw, cats, opts) {
  const gc = groupCountries(cats);
  const hid = new Set(opts.hidcty || []);
  const kept = [];
  for (const ch of raw || []) {
    const cty = gc.get(String(ch.category_id)) || ctyOf(ch.name) || 'OTHER';
    if (hid.has(cty)) continue;
    CTYOF.set(ch, cty);
    kept.push(ch);
  }
  // Groups stay only if they still have channels in them.
  const used = new Set(kept.map((c) => String(c.category_id)));
  const visCats = hid.size ? (cats || []).filter((c) => used.has(String(c.category_id))) : cats || [];
  if (!opts.merge) return { list: kept, cats: visCats };
  const pref = QPREF[opts.qpref] || QPREF.FHD;
  const groups = new Map();
  for (const ch of kept) {
    const b = baseName(ch.name);
    if (!b) continue;
    const k = CTYOF.get(ch) + '|' + b;
    let L = groups.get(k);
    if (!L) groups.set(k, (L = []));
    L.push(ch);
  }
  const drop = new Set();
  const pick = new Map();
  for (const L of groups.values()) {
    if (L.length < 2) continue;
    L.sort((a, b) => pref.indexOf(qualOf(a.name)) - pref.indexOf(qualOf(b.name)) || (Number(a.num) || 0) - (Number(b.num) || 0));
    pick.set(L[0], L);
    for (const c of L.slice(1)) drop.add(c);
  }
  const list = kept.filter((c) => !drop.has(c));
  // Remember the merged copies of the chosen one, so a different quality can be picked.
  for (const [c, L] of pick) ALTS.set(c, L);
  return { list, cats: visCats };
}
