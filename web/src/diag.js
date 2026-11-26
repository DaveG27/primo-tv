// Small in-memory log of recent problems, sent with "Send a problem report".
const LOG = [];
export function diag(msg) {
  try {
    const t = String(msg || '').replace(/(username|password)=[^&\s]*/gi, '$1=…').replace(/\/(live|movie|series|timeshift)\/[^/\s]+\/[^/\s]+\//g, '/$1/…/…/');
    if (!t) return;
    LOG.push(`${new Date().toLocaleTimeString('en-GB')}  ${t.slice(0, 300)}`);
    if (LOG.length > 40) LOG.shift();
  } catch (e) {}
}
export const diagLog = () => LOG.slice();

if (typeof window !== 'undefined') {
  window.addEventListener('error', (e) => diag(`Error: ${e.message} (${(e.filename || '').split('/').pop()}:${e.lineno})`));
  window.addEventListener('unhandledrejection', (e) => diag(`Failed: ${(e.reason && (e.reason.message || e.reason)) || 'unknown'}`));
  const ce = console.error;
  console.error = (...a) => { diag('console: ' + a.map((x) => (x && x.message) || String(x)).join(' ')); ce.apply(console, a); };
}
