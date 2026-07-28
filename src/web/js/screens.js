// Screen registry. Each screen: { id, label, render(root, ctx) }.
// ctx = { state, meta, reference, progress, actions }.
import { credits, creditsShort, rankTier, shipName, el } from './format.js';
import { CHECKLIST_SCREENS } from './checklistScreens.js';
import { EXTRA_SCREENS } from './extraScreens.js';

function card(title, bodyNodes, opts = {}) {
  const head = el('div', { class: 'card-head' }, [
    el('span', { class: 'card-title', text: title }),
    opts.badge ? el('span', { class: 'card-badge', text: opts.badge }) : null,
  ]);
  return el('section', { class: `card ${opts.class || ''}` }, [head, el('div', { class: 'card-body' }, bodyNodes)]);
}

function kv(label, value, opts = {}) {
  return el('div', { class: `kv ${opts.class || ''}` }, [
    el('span', { class: 'kv-label', text: label }),
    el('span', { class: 'kv-value', text: value }),
  ]);
}

function bar(pct, opts = {}) {
  const clamped = Math.max(0, Math.min(100, pct || 0));
  return el('div', { class: 'bar' }, [
    el('div', { class: `bar-fill ${opts.class || ''}`, style: `width:${clamped}%` }),
  ]);
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------
const dashboard = {
  id: 'dashboard',
  label: 'Dashboard',
  render(root, ctx) {
    const s = ctx.state || {};
    const tracks = ctx.reference?.ranks?.tracks || [];
    const nw = s.netWorth || {};
    const grid = el('div', { class: 'dash-grid' });

    // Commander
    const careerKeys = [
      ['Combat', 'Combat'], ['Trade', 'Trade'], ['Explore', 'Exploration'],
      ['Soldier', 'Mercenary'], ['Exobiologist', 'Exobiology'], ['CQC', 'CQC'],
    ];
    const rankRows = careerKeys.map(([key, label]) =>
      el('div', { class: 'rank-chip' }, [
        el('span', { class: 'rank-chip-label', text: label }),
        el('span', { class: 'rank-chip-val', text: rankTier(tracks, key, s.ranks?.[key]) }),
      ]));
    const navy = el('div', { class: 'rank-navy' }, [
      el('span', { text: `FED: ${rankTier(tracks, 'Federation', s.ranks?.Federation)}` }),
      el('span', { text: `EMP: ${rankTier(tracks, 'Empire', s.ranks?.Empire)}` }),
    ]);
    grid.appendChild(card('Commander', [
      el('div', { class: 'cmdr-name', text: s.commander?.name || 'Unknown Commander' }),
      el('div', { class: 'cmdr-sub', text: `${s.game?.mode || '—'} · ${s.game?.odyssey ? 'Odyssey' : 'Horizons'} · v${s.game?.gameversion || '?'}` }),
      el('div', { class: 'rank-grid' }, rankRows),
      navy,
    ], { class: 'span2' }));

    // Wealth
    grid.appendChild(card('Net Worth', [
      el('div', { class: 'wealth-total', text: `${credits(nw.total)} CR` }),
      kv('Fluid cash', `${credits(nw.cash)} CR`),
      kv('Current ship', `${credits(nw.shipValue)} CR`),
      kv('Stored ships', `${credits(nw.storedShipsValue)} CR`),
      kv('Fleet carrier', `${credits(nw.carrierBalance)} CR`),
      nw.statWealth != null ? kv('Game "wealth" stat', `${credits(nw.statWealth)} CR`, { class: 'muted' }) : null,
    ], { badge: creditsShort(nw.total) }));

    // Ship
    const ship = s.ship || {};
    grid.appendChild(card('Active Ship', [
      el('div', { class: 'ship-name', text: shipName(ship) }),
      el('div', { class: 'ship-ident', text: `${ship.name || '—'}  ${ship.ident ? '· ' + ship.ident : ''}` }),
      kv('Hull value', `${credits(ship.hullValue)} CR`),
      kv('Modules value', `${credits(ship.modulesValue)} CR`),
      kv('Rebuy', `${credits(ship.rebuy)} CR`),
    ]));

    // Navigation
    const nav = s.navigation || {};
    const loc = s.location || {};
    grid.appendChild(card('Navigation', [
      kv('Current system', nav.current || '—'),
      kv('Status', loc.docked ? `Docked · ${loc.station || 'station'}` : (loc.body ? `Near ${loc.body}` : 'In flight')),
      kv('Destination', nav.destination || '—'),
      kv('Next jump', nav.nextJump ? `${nav.nextJump}${nav.remainingJumps != null ? ` (${nav.remainingJumps} left)` : ''}` : '—'),
      kv('Route length', nav.routeLength ? `${nav.routeLength} jumps` : '—'),
    ]));

    // Unsold data (estimated)
    const dh = s.dataHeld || {};
    const cartVal = dh.explorationValue || 0;
    const exoVal = dh.exobiologyValue || 0;
    const dataTotal = cartVal + exoVal;
    grid.appendChild(card('Unsold Data (est.)', [
      el('div', { class: 'wealth-total', text: `${credits(dataTotal)} CR` }),
      kv('Cartographic', `${credits(cartVal)} CR`),
      kv('Exobiology', `${credits(exoVal)} CR`),
      kv('↳ base, no bonus', `${credits(dh.exobiologyBase)} CR`),
      kv('Bodies scanned / mapped', `${dh.bodiesScanned || 0} / ${dh.bodiesMapped || 0}`),
      kv('First discoveries', String(dh.firstDiscoveries || 0)),
      kv('Exobiology samples', String(dh.organicPending || 0)),
      el('div', { class: 'muted', style: 'font-size:11px;margin-top:4px', text: 'Value carried but not yet sold — banked when you sell, lost on rebuy. Exobiology assumes the First Footfall ×5 bonus.' }),
    ], { badge: creditsShort(dataTotal) }));

    // Reputation
    const rep = s.reputation || {};
    const repRows = [['Federation', rep.Federation], ['Empire', rep.Empire], ['Alliance', rep.Alliance], ['Independent', rep.Independent]]
      .map(([name, val]) => el('div', { class: 'rep-row' }, [
        el('span', { class: 'rep-name', text: name }),
        bar(((val ?? 0) + 100) / 2, { class: 'rep' }),
        el('span', { class: 'rep-val', text: val != null ? `${Math.round(val)}%` : '—' }),
      ]));
    grid.appendChild(card('Superpower Reputation', repRows));

    // Exploration snapshot
    grid.appendChild(card('Milestones at a glance', [
      kv('Systems visited', String(s.visited?.length ?? 0)),
      kv('Engineers unlocked', String(countUnlockedEngineers(s))),
      kv('Fleet carrier', s.carrier ? (s.carrier.name || s.carrier.callsign || 'Owned') : 'None'),
      kv('Ships owned', String(s.ownedShips?.length ?? 0)),
    ]));

    // Activity feed
    const feed = (s.feed || []);
    const feedBody = feed.length
      ? el('ul', { class: 'feed' }, feed.slice(0, 14).map((f) =>
          el('li', {}, [
            el('span', { class: 'feed-time', text: shortTime(f.t) }),
            el('span', { class: 'feed-text', text: f.text }),
          ])))
      : el('div', { class: 'muted', text: 'No recent activity yet — jump, dock, or trade to see events here.' });
    grid.appendChild(card('Recent Activity', [feedBody], { class: 'span2' }));

    root.replaceChildren(grid);
  },
};

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------
const settings = {
  id: 'settings',
  label: 'Settings',
  render(root, ctx) {
    const m = ctx.meta || {};
    const input = el('input', { class: 'text-input', type: 'text', value: m.journalDir || '', spellcheck: 'false' });
    const status = el('div', { class: 'settings-status' });

    const save = el('button', {
      class: 'btn',
      text: 'Save & re-scan',
      onclick: async () => {
        status.textContent = 'Re-scanning journals…';
        await ctx.actions.setConfig(input.value.trim());
        status.textContent = 'Done.';
      },
    });

    root.replaceChildren(el('div', { class: 'settings' }, [
      card('Journal folder', [
        el('p', { class: 'muted', text: 'Path to your Elite Dangerous journal + status files. Changing it re-indexes your history.' }),
        el('div', { class: 'settings-row' }, [input, save]),
        status,
      ], { class: 'span2' }),
      card('Status', [
        kv('Folder exists', m.dirExists ? 'Yes' : 'No — check the path'),
        kv('Journals indexed', String(m.journalCount ?? 0)),
        kv('Commander', ctx.state?.commander?.name || '—'),
        kv('Last update', ctx.state?.lastUpdate ? new Date(ctx.state.lastUpdate).toLocaleString() : '—'),
      ]),
      card('About', [
        el('p', { class: 'muted', html: 'ED Companion reads your Player Journal live. Leave it running while you play — the header and dashboard update as events arrive. More screens (Engineers, Permits, Notable Systems, Milestones…) are being added.' }),
      ]),
    ]));
  },
};

// ---------------------------------------------------------------------------
// Placeholder screens (filled in later passes)
// ---------------------------------------------------------------------------
function placeholder(id, label, note) {
  return {
    id,
    label,
    render(root) {
      root.replaceChildren(el('div', { class: 'placeholder' }, [
        el('div', { class: 'placeholder-glyph', text: '⣿' }),
        el('h2', { text: label }),
        el('p', { class: 'muted', text: note }),
        el('p', { class: 'placeholder-tag', text: 'Coming in the next build pass' }),
      ]));
    },
  };
}

export function countUnlockedEngineers(s) {
  const eng = s.engineers || {};
  return Object.values(eng).filter((e) => e.progress === 'Unlocked').length;
}

function shortTime(t) {
  if (!t) return '';
  try { return new Date(t).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }); }
  catch { return ''; }
}

export const SCREENS = [
  dashboard,
  CHECKLIST_SCREENS.engineers,
  CHECKLIST_SCREENS.core,
  CHECKLIST_SCREENS.milestones,
  CHECKLIST_SCREENS.permits,
  CHECKLIST_SCREENS.systems,
  CHECKLIST_SCREENS.racetracks,
  EXTRA_SCREENS.ranks,
  EXTRA_SCREENS.materials,
  EXTRA_SCREENS.fleet,
  settings,
];
