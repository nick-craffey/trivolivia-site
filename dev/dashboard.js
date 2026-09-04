import { firebaseApiKey, apiOrigin } from './config.js';

const $ = (id) => document.getElementById(id);
const number = (value) => new Intl.NumberFormat().format(Number(value) || 0);
const percent = (value) => value == null ? '—' : `${Math.round(value * 100)}%`;
const when = (value) => value ? new Date(value).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—';
const labels = { session_started: 'Session started', screen_view: 'Screen viewed', round_started: 'Round started', question_answered: 'Question answered', round_completed: 'Round completed', daily: 'Daily Five', topic: 'Adaptive Trail', sprint: 'Topic Sprint', mix: 'Endless Mix', daily_news: 'Daily News', review: 'Memory Review', endless: 'Endless Mix', weekly: 'Week in 20', hiddenThread: 'Hidden Thread', generated_topic: 'Generated topics', web: 'Web', ios: 'iOS', android: 'Android', macos: 'macOS', windows: 'Windows', linux: 'Linux', unknown: 'Unknown' };
const pretty = (value) => labels[value] || String(value || 'Unknown').replace(/[_-]/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
let credential = null;
let snapshot = null;
let generation = 0;
let absoluteExpiry = 0;
let expiryTimer;

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function empty(target, title = 'The next discovery starts here.', description = 'Activity will appear when players choose to share analytics.') {
  const box = el('div', 'empty');
  box.append(el('strong', '', title), el('span', '', description));
  target.replaceChildren(box);
}
async function request(url, options = {}) {
  const response = await fetch(url, { ...options, cache: 'no-store', credentials: 'omit', signal: AbortSignal.timeout(25000) });
  const body = await response.json();
  if (!response.ok) {
    const error = new Error(body.error?.message || 'The request could not be completed.');
    error.status = response.status;
    throw error;
  }
  return body;
}
function authRequest(operation, body) {
  return request(`https://identitytoolkit.googleapis.com/v1/accounts:${operation}?key=${encodeURIComponent(firebaseApiKey)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
}
async function token() {
  if (!credential || Date.now() >= absoluteExpiry) throw Object.assign(new Error('Please sign in again.'), { status: 401 });
  if (Date.now() + 60000 < credential.expiresAt) return credential.idToken;
  const current = credential;
  const result = await request(`https://securetoken.googleapis.com/v1/token?key=${encodeURIComponent(firebaseApiKey)}`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: current.refreshToken }) });
  if (credential !== current) throw Object.assign(new Error('Please sign in again.'), { status: 401 });
  credential = { idToken: result.id_token, refreshToken: result.refresh_token, expiresAt: Date.now() + Number(result.expires_in) * 1000 };
  return credential.idToken;
}
function signOut(message = '') {
  generation += 1;
  clearTimeout(expiryTimer);
  credential = null;
  snapshot = null;
  absoluteExpiry = 0;
  $('dashboard').hidden = true;
  $('login').hidden = false;
  $('sign-out').hidden = true;
  $('password').value = '';
  $('login-message').textContent = message;
  $('export').disabled = true;
  for (const id of ['kpis', 'trend', 'journey', 'retention', 'modes', 'topics', 'screens', 'platforms', 'languages', 'versions', 'categories', 'difficulties', 'screen-classes', 'timezones', 'players-table', 'activity-table', 'player-detail', 'social-kpis']) $(id).replaceChildren();
  $('player-detail').hidden = true;
}
$('login-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const attempt = ++generation;
  $('sign-in').disabled = true;
  $('login-message').textContent = 'Signing in…';
  try {
    if (!firebaseApiKey) throw new Error('Dashboard sign-in has not been configured.');
    const result = await authRequest('signInWithPassword', { email: $('email').value.trim(), password: $('password').value, returnSecureToken: true });
    if (attempt !== generation) return;
    credential = { idToken: result.idToken, refreshToken: result.refreshToken, expiresAt: Date.now() + Number(result.expiresIn) * 1000 };
    absoluteExpiry = Date.now() + 8 * 60 * 60 * 1000;
    expiryTimer = setTimeout(() => signOut('Your session ended. Please sign in again.'), 8 * 60 * 60 * 1000);
    $('password').value = '';
    await load();
  } catch (error) {
    if (attempt === generation) signOut(error.message.includes('configured') ? error.message : 'Unable to sign in. Check your email and password, or try again shortly.');
  } finally {
    $('sign-in').disabled = false;
  }
});
$('reset-password').addEventListener('click', async () => {
  if (!$('email').reportValidity()) return;
  $('reset-password').disabled = true;
  try {
    await authRequest('sendOobCode', { requestType: 'PASSWORD_RESET', email: $('email').value.trim() });
    $('login-message').textContent = 'If this email has an account, a password reset link is on its way.';
  } catch {
    $('login-message').textContent = 'Could not request a reset. Please try again shortly.';
  } finally { $('reset-password').disabled = false; }
});
$('sign-out').addEventListener('click', () => signOut());
$('refresh').addEventListener('click', () => load());
$('period').addEventListener('change', () => load());

async function load() {
  const current = ++generation;
  $('refresh').disabled = true;
  $('period').disabled = true;
  $('dashboard-message').textContent = '';
  try {
    const idToken = await token();
    const data = await request(`${apiOrigin}/api/v1/analytics/dashboard?days=${$('period').value}`, { headers: { 'X-Trivolivia-Admin': idToken } });
    if (current !== generation) return;
    snapshot = data;
    $('login').hidden = true;
    $('dashboard').hidden = false;
    $('sign-out').hidden = false;
    $('export').disabled = false;
    render(data);
  } catch (error) {
    if (current !== generation) return;
    if (error.status === 401 || error.status === 403) signOut(error.status === 403 ? 'This account does not have dashboard access.' : 'Please sign in again.');
    else if ($('dashboard').hidden) signOut('The dashboard could not be loaded. Please try again shortly.');
    else $('dashboard-message').textContent = 'Could not refresh the dashboard. The previous snapshot is still shown. Please try again shortly.';
  } finally {
    if (current === generation || !credential) { $('refresh').disabled = false; $('period').disabled = false; }
  }
}
function metric(label, value, note) {
  const box = el('div', 'kpi');
  box.append(el('span', 'kpi-label', label), el('strong', 'kpi-value', value), el('span', 'kpi-note', note));
  return box;
}
function render(data) {
  const k = data.kpis;
  $('updated').textContent = `${data.window.days}-day view · Updated ${when(data.generatedAt)}`;
  $('coverage-text').textContent = data.coverage.truncated ? `Partial data: the ${number(data.coverage.limit)}-event limit was reached. Metrics reflect this bounded sample.` : `${number(data.coverage.windowEventCount)} events in this period · Optional analytics · Anonymous devices · 31-day history`;
  $('kpis').replaceChildren(
    metric('Active devices', number(k.players), `${number(k.activeToday)} active today · UTC`),
    metric('Sessions', number(k.sessions), `${k.players ? (k.sessions / k.players).toFixed(1) : '0'} sessions per active device`),
    metric('Rounds completed', number(k.roundsCompleted), `${percent(k.completionRate)} of observed starts completed`),
    metric('Answer accuracy', percent(k.accuracy), `${number(k.answers)} questions answered`),
    metric('Playing now', number(k.recentlyActive), 'Active in the last 5 minutes'),
    metric('First observed', number(k.newPlayers), 'Devices first seen in retained history'),
    metric('Median round', k.medianRoundSeconds == null ? '—' : `${Math.round(k.medianRoundSeconds)}s`, 'Among matched starts and finishes'),
    metric('Events', number(k.events), 'Bounded activity in this period'),
  );
  renderTrend(data.daily);
  bars($('journey'), [{label:'App sessions',value:k.sessions},{label:'Rounds started',value:k.roundsStarted},{label:'Rounds completed',value:k.roundsCompleted}], 'value');
  $('retention').replaceChildren(...[['Next-day return', data.retention.d1], ['Day-7 return', data.retention.d7]].map(([label, row]) => {
    const node = el('div'); node.append(el('strong', '', percent(row.rate)), el('span', '', label), el('br'), el('span', '', `${number(row.returned)} / ${number(row.eligible)} eligible`)); return node;
  }));
  bars($('modes'), data.breakdowns.modes, 'roundsStarted');
  bars($('topics'), data.breakdowns.topics, 'answers');
  bars($('screens'), data.breakdowns.screens, 'events');
  bars($('platforms'), data.breakdowns.platforms, 'players');
  bars($('languages'), data.breakdowns.languages, 'players');
  bars($('versions'), data.breakdowns.versions, 'players');
  bars($('categories'), data.breakdowns.categories, 'answers');
  bars($('difficulties'), data.breakdowns.difficulties || [], 'answers');
  bars($('screen-classes', 'timezones'), data.breakdowns.screenClasses || [], 'players');
  renderPlayers();
  renderActivity();
  $('player-detail').hidden = true;
  const s = data.social;
  const socialMetrics = [['Guest profiles','guests'], ['Seen in 7 days','active7d'], ['Verified Daily results','dailyResults'], ['Challenges','challenges'], ['Challenge responses','challengeResponses'], ['Braintrusts','braintrusts'], ['Memberships','memberships'], ['Player channels','channels'], ['Open safety reports','openReports'], ['Active blocks','blocks']];
  $('social-kpis').replaceChildren(...socialMetrics.map(([label, field]) => metric(label, number(s[field]), 'Current retained records')));
  $('social-note').textContent = `${s.truncated ? 'Some social collections reached the read limit; counts are partial. ' : ''}Recent social use is approximate: timestamps refresh at most every six hours. Private names, report text, credentials, and social answer histories are not included.`;
}
function renderTrend(rows) {
  const maximum = Math.max(...rows.map((row) => row.players), 0);
  if (!maximum) return empty($('trend'), 'Your first players will light this up.', 'There is no shared gameplay activity in this period yet.');
  const chart = el('div', 'chart');
  chart.setAttribute('role', 'img');
  chart.setAttribute('aria-label', `Daily active devices: ${rows.map((r) => `${r.date}: ${r.players}`).join('; ')}`);
  for (const [index, row] of rows.entries()) {
    const column = el('div', 'chart-col');
    column.title = `${row.date}: ${number(row.players)} devices, ${number(row.sessions)} sessions`;
    if (rows.length <= 14 || row.players === maximum) column.append(el('span', 'chart-value', number(row.players)));
    const bar = el('div', 'bar');
    bar.style.height = `${Math.max(1, row.players / maximum * 83)}%`;
    column.append(bar);
    if (index === 0 || index === rows.length - 1 || index % Math.ceil(rows.length / 6) === 0) column.append(el('span', 'chart-label', row.date.slice(5).replace('-', '/')));
    chart.append(column);
  }
  $('trend').replaceChildren(chart);
}
function bars(target, rows, field) {
  const values = [...rows].filter((row) => row[field] > 0).sort((a,b) => b[field] - a[field]).slice(0, 7);
  if (!values.length) return empty(target, 'No activity yet.', 'Shared activity will appear here.');
  const max = Math.max(...values.map((row) => row[field]));
  target.replaceChildren(...values.map((row) => {
    const node = el('div', 'metric-row'), head = el('div', 'row-head'), track = el('div', 'track'), fill = el('div', 'fill');
    const name = pretty(row.label); head.title = name;
    head.append(el('span','',name), el('b','',number(row[field])));
    fill.style.width = `${row[field] / max * 100}%`;
    track.append(fill); node.append(head, track); return node;
  }));
}
function table(target, headers, rows) {
  if (!rows.length) return empty(target, 'Nothing to show yet.', 'Try another period or return after people have played.');
  const node = el('table'), head = el('thead'), tr = el('tr'), body = el('tbody');
  headers.forEach((title) => {const th=el('th','',title); th.scope='col'; tr.append(th);}); head.append(tr);
  for (const row of rows) { const line = el('tr'); row.forEach((cell) => { const td = el('td'); td.append(cell instanceof Node ? cell : document.createTextNode(String(cell))); line.append(td); }); body.append(line); }
  node.append(head,body); target.replaceChildren(node);
}
function device(id) {
  const button = el('button', 'device-button', id);
  button.addEventListener('click', () => { selectTab('players'); showPlayer(id); }); return button;
}
function renderPlayers() {
  if (!snapshot) return;
  const needle = $('player-search').value.trim().toLowerCase();
  table($('players-table'), ['Device','Platform','Last seen','Sessions','Finished rounds','Answers','Accuracy'], snapshot.players.filter((p) => p.id.toLowerCase().includes(needle)).map((p) => [device(p.id),pretty(p.platform),when(p.lastSeenAt),number(p.sessions),number(p.roundsCompleted),number(p.answers),percent(p.accuracy)]));
}
function eventDetails(event) {
  return [event.screen && pretty(event.screen), event.kind && pretty(event.kind), event.topic && pretty(event.topic), typeof event.correct === 'boolean' && (event.correct ? 'Correct' : 'Incorrect'), event.durationSeconds != null && `${Math.round(event.durationSeconds)}s`].filter(Boolean).join(' · ') || '—';
}
function renderActivity() {
  if (!snapshot) return;
  const filter = $('event-filter').value;
  table($('activity-table'), ['When','Device','Event','Details'], snapshot.activity.filter((e) => filter === 'all' || e.event === filter).map((e) => [when(e.at),device(e.playerId),pretty(e.event),eventDetails(e)]));
}
function showPlayer(id) {
  const player = snapshot?.players.find((p) => p.id === id);
  if (!player) return;
  const panel = $('player-detail'); panel.hidden=false;
  panel.replaceChildren(el('h2','',`Device ${id}`),el('p','muted',`${pretty(player.platform)} · ${player.language || 'Unknown language'} · Version ${player.appVersion || 'Unknown'} · First seen in retained history ${when(player.firstSeenAt)}`));
  const scroll=el('div','table-scroll'); panel.append(scroll);
  table(scroll,['When','Event','Details'],player.timeline.map((e)=>[when(e.at),pretty(e.event),eventDetails(e)]));
  panel.scrollIntoView({block:'nearest',behavior:'instant'});
}
function selectTab(name) {
  document.querySelectorAll('.tab').forEach((tab)=> { const active = tab.dataset.tab === name; tab.classList.toggle('active',active); tab.setAttribute('aria-pressed',String(active)); });
  document.querySelectorAll('.tab-panel').forEach((panel)=>{panel.hidden=panel.id!==`panel-${name}`;});
}
document.querySelectorAll('.tab').forEach((tab)=>tab.addEventListener('click',()=>selectTab(tab.dataset.tab)));
$('player-search').addEventListener('input',renderPlayers);
$('event-filter').addEventListener('change',renderActivity);
$('export').textContent = 'Export daily CSV';
$('export').addEventListener('click',()=>{
  if(!snapshot) return;
  const headers=['date_utc','active_devices','sessions','rounds_started','rounds_completed','answers','accuracy_fraction'];
  const rows=snapshot.daily.map((r)=>[r.date,r.players,r.sessions,r.roundsStarted,r.roundsCompleted,r.answers,r.accuracy ?? '']);
  const cell=(value)=>`"${String(value).replace(/^[=+@-]/,"'$&").replaceAll('"','""')}"`;
  const csv=[headers,...rows].map((row)=>row.map(cell).join(',')).join('\r\n');
  const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
  const link=el('a');link.href=url;link.download=`trivolivia-daily-${snapshot.window.days}d.csv`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
});
// Keep credentials in memory only; also clear sensitive views before entering the back/forward cache.
window.addEventListener('pagehide',()=>signOut());
