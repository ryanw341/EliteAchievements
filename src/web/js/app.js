// App core: state store, SSE, boot animation, header, ribbon router.
import { SCREENS } from './screens.js';
import { credits, creditsShort, shipName, el } from './format.js';

const store = {
  state: {},
  meta: {},
  reference: {},
  progress: { manual: {}, notes: {} },
  active: 'dashboard',
  booted: false,
};

const dom = {
  boot: document.getElementById('boot'),
  bootLog: document.getElementById('boot-log'),
  app: document.getElementById('app'),
  ribbon: document.getElementById('ribbon'),
  header: document.getElementById('header'),
  screen: document.getElementById('screen'),
  statusbar: document.getElementById('statusbar'),
};

const ctx = () => ({
  state: store.state,
  meta: store.meta,
  reference: store.reference,
  progress: store.progress,
  actions: {
    async setConfig(journalDir) {
      const r = await fetch('/api/config', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ journalDir }),
      });
      const data = await r.json();
      if (data.meta) store.meta = data.meta;
    },
    async toggle(id, checked) {
      store.progress.manual = store.progress.manual || {};
      store.progress.manual[id] = checked;
      await fetch('/api/progress', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, checked }),
      });
    },
    setActive,
    rerender: renderScreen,
  },
});

// ---------------------------------------------------------------------------
// Ribbon + router
// ---------------------------------------------------------------------------
function renderRibbon() {
  dom.ribbon.replaceChildren(
    el('div', { class: 'brand' }, [
      el('span', { class: 'brand-mark', text: '◆' }),
      el('span', { class: 'brand-text', text: 'ELITE ACHIEVEMENTS' }),
    ]),
    el('nav', { class: 'tabs' }, SCREENS.map((sc) =>
      el('button', {
        class: `tab ${store.active === sc.id ? 'active' : ''}`,
        text: sc.label,
        onclick: () => setActive(sc.id),
      }))),
    el('div', { class: 'link-status', id: 'link-status' }, [
      el('span', { class: 'dot', id: 'link-dot' }),
      el('span', { id: 'link-text', text: 'LINK' }),
    ]),
  );
}

function setActive(id) {
  store.active = id;
  renderRibbon();
  renderScreen();
}

function renderScreen() {
  const sc = SCREENS.find((s) => s.id === store.active) || SCREENS[0];
  const scrollTop = dom.screen.scrollTop;
  try {
    sc.render(dom.screen, ctx());
    dom.screen.scrollTop = scrollTop;
  } catch (err) {
    dom.screen.replaceChildren(el('div', { class: 'placeholder' }, [
      el('h2', { text: 'Screen error' }),
      el('p', { class: 'muted', text: String(err && err.message || err) }),
    ]));
    console.error(err);
  }
}

// ---------------------------------------------------------------------------
// Header (always visible)
// ---------------------------------------------------------------------------
function renderHeader() {
  const s = store.state || {};
  const nav = s.navigation || {};
  const nw = s.netWorth || {};
  const ship = s.ship || {};

  const navBar = (label, value, sub) => el('div', { class: 'navbar' }, [
    el('span', { class: 'navbar-label', text: label }),
    el('span', { class: 'navbar-val', text: value || '—', title: value || '' }),
    sub ? el('span', { class: 'navbar-sub', text: sub }) : null,
  ]);

  dom.header.replaceChildren(
    el('div', { class: 'hdr-left' }, [
      el('div', { class: 'hdr-cmdr', text: `CMDR ${s.commander?.name || '—'}` }),
      el('div', { class: 'hdr-cmdr-sub', text: `${shipName(ship)}${ship.ident ? ' · ' + ship.ident : ''}` }),
    ]),
    el('div', { class: 'hdr-nav' }, [
      navBar('CURRENT', nav.current),
      navBar('TARGET', nav.destination),
      navBar('NEXT', nav.nextJump, nav.remainingJumps != null ? `${nav.remainingJumps} jumps left` : ''),
    ]),
    el('div', { class: 'hdr-right' }, [
      el('div', { class: 'hdr-networth', text: `${credits(nw.total)} CR`, title: 'Net worth (cash + assets)' }),
      el('div', { class: 'hdr-cash', text: `CASH ${credits(nw.cash)} CR` }),
      el('div', { class: 'hdr-networth-short', text: creditsShort(nw.total) }),
    ]),
  );
}

function renderStatusbar() {
  const m = store.meta || {};
  const s = store.state || {};
  dom.statusbar.replaceChildren(
    el('span', { text: `${m.journalCount ?? 0} logs` }),
    el('span', { text: `${s.visited?.length ?? 0} systems visited` }),
    el('span', { text: m.dirExists ? 'journal linked' : 'journal not found' }),
    el('span', { class: 'grow' }),
    el('span', { text: s.lastUpdate ? `last event ${new Date(s.lastUpdate).toLocaleTimeString()}` : 'awaiting events…' }),
  );
}

function renderAll() {
  renderHeader();
  renderStatusbar();
  renderScreen();
}

function setLink(ok) {
  const dot = document.getElementById('link-dot');
  const text = document.getElementById('link-text');
  if (dot) dot.classList.toggle('on', ok);
  if (text) text.textContent = ok ? 'LINKED' : 'RECONNECTING';
}

// ---------------------------------------------------------------------------
// Boot animation
// ---------------------------------------------------------------------------
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function typeLine(text, cls = '') {
  const line = el('div', { class: `boot-line ${cls}` });
  dom.bootLog.appendChild(line);
  const cursor = el('span', { class: 'boot-cursor', text: '█' });
  line.appendChild(cursor);
  for (const ch of text) {
    cursor.insertAdjacentText('beforebegin', ch);
    await sleep(9 + Math.random() * 18);
  }
  cursor.remove();
}

let bootSkipped = false;
async function runBoot() {
  const s = store.state || {};
  const name = (s.commander?.name || 'COMMANDER').toUpperCase();
  const fid = s.commander?.fid || '--------';
  const count = store.meta?.journalCount ?? 0;

  const skip = () => { bootSkipped = true; };
  window.addEventListener('keydown', skip, { once: true });
  dom.boot.addEventListener('click', skip, { once: true });

  const lines = [
    ['PILOTS FEDERATION // REMOTE UPLINK', 'dim'],
    [`> mounting journal directory ................ OK`, ''],
    [`> parsing flight logs [${count}] ................ OK`, ''],
    [`> commander id: ${fid}`, ''],
    [`> synchronising codex, ranks & assets ....... OK`, ''],
  ];
  for (const [t, c] of lines) {
    if (bootSkipped) break;
    await typeLine(t, c);
    await sleep(bootSkipped ? 0 : 90);
  }
  if (!bootSkipped) await sleep(160);

  const greet = el('div', { class: 'boot-greet' });
  dom.bootLog.appendChild(greet);
  const full = `GREETINGS CMDR ${name}`;
  if (bootSkipped) {
    greet.textContent = full;
  } else {
    for (const ch of full) { greet.textContent += ch; await sleep(38); }
  }
  await sleep(bootSkipped ? 120 : 650);

  dom.boot.classList.add('done');
  await sleep(520);
  dom.boot.remove();
  dom.app.hidden = false;
  store.booted = true;
  renderAll();
}

// ---------------------------------------------------------------------------
// Data + stream
// ---------------------------------------------------------------------------
async function loadStatic() {
  try {
    const [ref, prog] = await Promise.all([
      fetch('/api/reference-all').then((r) => r.json()),
      fetch('/api/progress').then((r) => r.json()),
    ]);
    store.reference = ref || {};
    store.progress = prog || { manual: {}, notes: {} };
  } catch (e) { console.error('static load failed', e); }
}

function connectStream() {
  const es = new EventSource('/api/stream');
  es.onopen = () => setLink(true);
  es.onerror = () => setLink(false);
  es.onmessage = (ev) => {
    let msg;
    try { msg = JSON.parse(ev.data); } catch { return; }
    if (msg.type !== 'state') return;
    store.state = msg.state || {};
    store.meta = msg.meta || {};
    setLink(true);
    if (!store.booted) {
      // First state received — kick off the boot sequence once.
      if (!store.bootStarting) { store.bootStarting = true; runBoot(); }
    } else {
      renderAll();
    }
  };
}

async function main() {
  renderRibbon();
  await loadStatic();
  connectStream();
}

main();
