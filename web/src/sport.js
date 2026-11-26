// Sport today: finds live games in the provider's guide on sport channels (same rules as Pitchside).

const TITLE_RULES = [
  ['', /global champions|show ?jumping|equestrian|\bdressage\b/i],
  ['nfl', /\bnfl\b|american football|super bowl/i],
  ['darts', /darts|\bpdc\b/i],
  ['snooker', /snooker/i],
  ['football', /\bfootball\b|soccer|\bwsl\b|women'?s super league/i],
  ['rugby', /rugby|six nations|super league|\burc\b|top 14|nations championship|champions cup/i],
  ['cricket', /cricket|test match|t20|\bodi\b|\bipl\b|big bash|\bw?bbl\b|the ashes|the hundred|blackcaps|\d(st|nd|rd|th) test\b|\btest,? day\b/i],
  ['tennis', /tennis|\batp\b|\bwta\b|davis cup|billie jean king|wimbledon|roland garros/i],
  ['golf', /golf|\bpga\b|dp world tour|\blpga\b|ryder cup|the masters|\bliv\b/i],
  ['motorsport', /formula 1|formula one|\bf1\b|\bf2\b|motogp|grand prix|nascar|indycar|\bwrc\b|\bbtcc\b|superbikes|formula e|speedway/i],
  ['fighting', /boxing|\bufc\b|\bmma\b|bellator|fight night|wrestling|\bwwe\b|\baew\b/i],
  ['racing', /horse racing|live racing|racing from|racecourse|\bitv racing\b|racing tv|cheltenham|ascot|aintree/i],
  ['nba', /\bnba\b|basketball|euroleague|\bwnba\b/i],
  ['hockey', /\bnhl\b|ice hockey|elite league hockey/i],
  ['football', /premier league|\bepl\b|\bpl:|championship|league one|league two|la ?liga|serie a|bundesliga|ligue 1|champions league|europa|conference league|fa cup|\befl\b|carabao|scottish premiership|\bspfl\b|\bmls\b|eredivisie|copa |world cup qualif/i],
];
const CHANNEL_RULES = [
  ['cricket', /cricket/i], ['golf', /golf/i], ['tennis', /tennis/i], ['motorsport', /\bf1\b|motor/i],
  ['racing', /racing/i], ['darts', /darts/i], ['nfl', /\bnfl\b/i], ['nba', /\bnba\b/i], ['hockey', /\bnhl\b/i],
  ['fighting', /boxing|\bufc\b|\bwwe\b/i], ['football', /football|\blfc\b|mutv|la ?liga|premier league|chelsea tv|\bepl\b/i],
];
const VERSUS = /\b[a-z0-9][a-z0-9 .'&-]* (v|vs|v\.|vs\.) [a-z0-9]/i;
const SPORT_CHANNEL = /sport|tnt|dazn|eurosport|premier|racing|golf|cricket|\bf1\b|\bnfl\b|\bnba\b|\bnhl\b|\bmlb\b|espn|bein|viaplay|la ?liga|mutv|lfc|boxing|\bufc\b|darts|\bppv\b|setanta/i;
const SKIP = /\bnews\b|off ?air|no event|no programme|closed?(down)?\b|test card|to be (announced|confirmed)|\btba\b|\btbc\b|programming|information|stand ?by/i;
const FILLER = /\bhls\b|highlights|^\s*\(d\)|\breload(ed)?\b|\barchives?\b|radio commentary|^\s*(19|20)\d\d\/\d\d:|\breview\b|\bpreview\b|\bepisode\b|\bclassics?\b|\bwrap\b|magazine|\bon the fly\b|\bon fire\b|\byears\b|temples of sport|playing lessons|\brewind\b|\bgreatest\b|\blegends\b|\bdocumentar|\bfilm\b|\b(19|20)\d\d final round|\b(19|20)\d\d\/\d\d\s*$|\bquiz\b|\bpodcast\b|\bshow\b/i;
const INTL = /^\s*\((?!uk\b|ie\b|roi\b)[a-z]{2,4}\)|now hk|\bastro\b|\bfubo\b|fox (sports|cricket)|supersport|\btsn\b|sportsnet|\bespn\b|\bsky sport \d|sky sport select|\b(us|usa|au|aus|nz|ca)\s*[:|]/i;
const LIVE_MARK = /ᴸᶦᵛᵉ|ᴸᴵⱽᴱ|🔴/g;
const LIVE_TEST = /ᴸᶦᵛᵉ|ᴸᴵⱽᴱ|🔴|\blive\b|\(l\)|\[l\]/i;

function classify(title, channel) {
  const sportChannel = SPORT_CHANNEL.test(channel);
  const trusted = sportChannel || LIVE_TEST.test(title);
  for (const [id, re] of TITLE_RULES) if (re.test(title)) return trusted && id ? id : null;
  if (!sportChannel) return null;
  for (const [id, re] of CHANNEL_RULES) if (re.test(channel)) return id;
  if (VERSUS.test(title)) return 'football';
  return null;
}
function finish(raw) {
  const live = LIVE_TEST.test(raw);
  let t = raw.replace(LIVE_MARK, ' ').replace(/\s*[\(\[]l[\)\]]\s*/gi, ' ').replace(/^\s*live:?\s+/i, '').replace(/\s+/g, ' ').trim();
  if (!t || SKIP.test(t) || FILLER.test(t)) return null;
  let comp = '';
  const i = t.indexOf(' : ');
  if (i > 0) { comp = t.slice(0, i).trim(); t = t.slice(i + 3).trim(); }
  return { title: t || comp, comp: comp === t ? '' : comp, live };
}
const cleanChannel = n =>
  n.replace(/^\s*(\|?[A-Z]{2,3}\|?\s*[:|\-]\s*)+/, '')
   .replace(/[\s|\-]*(\bF?HD\b|\bSD\b|\bUHD\b|\b4K\b|\bHEVC\b|\b(50|60)\s?FPS\b|ᴴᴰ|ᶠᴴᴰ|ᵁᴴᴰ|\+)+\s*$/i, '')
   .trim() || n.trim();
function b64(s) {
  if (!s) return '';
  try {
    const bin = atob(s);
    const t = new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(bin, c => c.charCodeAt(0)));
    return /[a-z]/i.test(t) ? t : s;
  } catch { return s; }
}

// ---------- Merging the same game listed differently on several channels ----------
const NUMS = { one: '1', two: '2', three: '3', four: '4', five: '5' };
const STOP = new Set(['the', 'v', 'vs', 'at', 'and', 'live', 'fc', 'afc', 'cf']);
function tokens(t) {
  return new Set(t.toLowerCase().replace(/\b(one|two|three|four|five)\b/g, w => NUMS[w]).replace(/@/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ').split(' ').filter(w => w && !STOP.has(w)));
}
function similar(a, b) {
  let shared = 0;
  for (const w of a) if (b.has(w)) shared++;
  return shared / Math.max(a.size, b.size, 1);
}
function mergeDupes(list) {
  const out = [];
  for (const e of list) {
    const tk = tokens(e.title);
    const twin = out.find(o => o.sport === e.sport && Math.abs(o.s - e.s) <= 90 * 60e3 && similar(o.tk, tk) >= 0.75);
    if (twin) {
      for (const c of e.channels) if (!twin.channels.includes(c)) twin.channels.push(c);
      for (const st of e.streams || []) if (!twin.streams.some(x => x.stream_id === st.stream_id)) twin.streams.push(st);
      twin.live = twin.live || e.live; twin.intl = twin.intl && e.intl;
      twin.e = Math.max(twin.e, e.e);
      if (!twin.comp && e.comp) twin.comp = e.comp;
    } else out.push({ ...e, streams: [...(e.streams || [])], tk });
  }
  return out.map(({ tk, ...e }) => ({ ...e, channels: e.channels.slice(0, 5) }));
}

export const SPORTS = [
  { id: 'all', name: 'All sport' }, { id: 'football', name: 'Football' }, { id: 'rugby', name: 'Rugby' },
  { id: 'cricket', name: 'Cricket' }, { id: 'tennis', name: 'Tennis' }, { id: 'golf', name: 'Golf' },
  { id: 'motorsport', name: 'Motorsport' }, { id: 'fighting', name: 'Boxing & UFC' }, { id: 'darts', name: 'Darts' },
  { id: 'snooker', name: 'Snooker' }, { id: 'racing', name: 'Horse racing' }, { id: 'nfl', name: 'NFL' },
  { id: 'nba', name: 'Basketball' }, { id: 'hockey', name: 'Ice hockey' },
];

// Sport channels among the channels the user can see (hidden countries are already gone),
// one per guide id, UK first.
export function sportChannels(chans, cats, max = 220) {
  const catName = {};
  for (const c of cats || []) catName[c.category_id] = c.category_name || '';
  const groups = new Map();
  for (const st of chans || []) {
    const name = st.name || '';
    const cat = catName[st.category_id] || '';
    if (!SPORT_CHANNEL.test(name) && !SPORT_CHANNEL.test(cat)) continue;
    const key = st.epg_channel_id || 'id' + st.stream_id;
    if (!st.epg_channel_id) continue;
    const g = groups.get(key) || { ch: st, raw: name, names: [], uk: /\b(uk|gb|ie|irl)\b/i.test(name + ' ' + cat), intl: INTL.test(name) };
    const clean = cleanChannel(name);
    if (!g.names.includes(clean)) g.names.push(clean);
    groups.set(key, g);
  }
  const all = [...groups.values()];
  return [...all.filter((g) => g.uk), ...all.filter((g) => !g.uk && !g.intl), ...all.filter((g) => !g.uk && g.intl)].slice(0, max);
}

// Scan the guide of each sport channel and return the games, merged across channels.
// getEpg(streamId) resolves to the provider's get_short_epg / get_simple_data_table reply.
export async function buildSport(groups, getEpg, onProgress, workers = 5) {
  const now = Date.now();
  const from = now - 6 * 3600e3;
  const to = now + 2 * 24 * 3600e3;
  const byKey = new Map();
  let next = 0;
  let done = 0;
  async function worker() {
    while (next < groups.length) {
      const g = groups[next++];
      let data = null;
      try { data = await getEpg(g.ch.stream_id); } catch (e) { data = null; }
      done++;
      if (onProgress) onProgress(done, groups.length);
      for (const it of (data && data.epg_listings) || []) {
        const start = new Date(it.start_timestamp ? it.start_timestamp * 1000 : Date.parse(`${it.start}Z`));
        const end = new Date(it.stop_timestamp ? it.stop_timestamp * 1000 : Date.parse(`${it.end}Z`));
        if (isNaN(start) || start < from || start > to) continue;
        const raw = b64(it.title).trim();
        if (!raw) continue;
        const sport = classify(raw, g.raw);
        if (!sport) continue;
        const f = finish(raw);
        if (!f) continue;
        const key = `${f.title.toLowerCase()}|${start.getTime()}`;
        const hit = byKey.get(key);
        if (hit) {
          for (const n of g.names) if (!hit.channels.includes(n)) hit.channels.push(n);
          if (!hit.streams.some((x) => x.stream_id === g.ch.stream_id)) hit.streams.push(g.ch);
          hit.live = hit.live || f.live;
          hit.intl = hit.intl && g.intl;
        } else {
          byKey.set(key, {
            s: start.getTime(), e: isNaN(end) ? start.getTime() + 2 * 3600e3 : end.getTime(),
            sport, title: f.title, comp: f.comp, live: f.live, intl: g.intl,
            channels: [...g.names], streams: [g.ch],
          });
        }
      }
    }
  }
  await Promise.all(Array.from({ length: workers }, worker));
  return mergeDupes([...byKey.values()].sort((a, b) => a.s - b.s || a.title.localeCompare(b.title)));
}
