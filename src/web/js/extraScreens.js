// Pass 3 screens: Ranks, Materials, Fleet.
import { el, credits, creditsShort, rankTier, shipName } from './format.js';

const SHIP_NAMES = {
  adder: 'Adder', anaconda: 'Anaconda', asp: 'Asp Explorer', asp_scout: 'Asp Scout',
  belugaliner: 'Beluga Liner', cobramkiii: 'Cobra Mk III', cobramkiv: 'Cobra Mk IV',
  cutter: 'Imperial Cutter', diamondback: 'Diamondback Scout', diamondbackxl: 'Diamondback Explorer',
  dolphin: 'Dolphin', eagle: 'Eagle', empire_courier: 'Imperial Courier', empire_eagle: 'Imperial Eagle',
  empire_trader: 'Imperial Clipper', federation_corvette: 'Federal Corvette',
  federation_dropship: 'Federal Dropship', federation_dropship_mkii: 'Federal Assault Ship',
  federation_gunship: 'Federal Gunship', ferdelance: 'Fer-de-Lance', hauler: 'Hauler',
  independant_trader: 'Keelback', krait_mkii: 'Krait Mk II', krait_light: 'Krait Phantom',
  mamba: 'Mamba', mandalay: 'Mandalay', orca: 'Orca', python: 'Python', python_nx: 'Python Mk II',
  sidewinder: 'Sidewinder', type6: 'Type-6 Transporter', type7: 'Type-7 Transporter',
  type8: 'Type-8 Transporter', type9: 'Type-9 Heavy', type9_military: 'Type-10 Defender',
  typex: 'Alliance Chieftain', typex_2: 'Alliance Crusader', typex_3: 'Alliance Challenger',
  viper: 'Viper Mk III', viper_mkiv: 'Viper Mk IV', vulture: 'Vulture', explorer_nx: 'Caspian Explorer',
  cobramkv: 'Cobra Mk V', corsair: 'Corsair',
};
const prettyShip = (t) => SHIP_NAMES[t] || String(t).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
const prettyMat = (t) => String(t).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

function card(title, bodyNodes, opts = {}) {
  return el('section', { class: `card ${opts.class || ''}` }, [
    el('div', { class: 'card-head' }, [
      el('span', { class: 'card-title', text: title }),
      opts.badge ? el('span', { class: 'card-badge', text: opts.badge }) : null,
    ]),
    el('div', { class: 'card-body' }, bodyNodes),
  ]);
}
function kv(label, value) {
  return el('div', { class: 'kv' }, [el('span', { class: 'kv-label', text: label }), el('span', { class: 'kv-value', text: value })]);
}
function bar(pct, cls = '') {
  const c = Math.max(0, Math.min(100, pct || 0));
  return el('div', { class: 'bar' }, [el('div', { class: `bar-fill ${cls}`, style: `width:${c}%` })]);
}

// ---------------------------------------------------------------------------
// Ranks
// ---------------------------------------------------------------------------
const ranks = {
  id: 'ranks',
  label: 'Ranks',
  render(root, ctx) {
    const tracks = ctx.reference?.ranks?.tracks || [];
    const s = ctx.state || {};
    const rankVals = s.ranks || {};
    const prog = s.rankProgress || {};

    const trackRow = (t) => {
      const v = rankVals[t.journalKey] ?? 0;
      const p = prog[t.journalKey] ?? 0;
      const tier = rankTier(tracks, t.journalKey, v);
      const next = v + 1 < t.tiers.length ? t.tiers[v + 1] : null;
      const isElite = v >= 8;
      return el('div', { class: 'track-row' }, [
        el('div', { class: 'track-top' }, [
          el('span', { class: 'track-name', text: t.track }),
          el('span', { class: `track-tier ${isElite ? 'elite' : ''}`, text: tier }),
        ]),
        bar(isElite && !next ? 100 : p, isElite ? 'elite' : ''),
        el('div', { class: 'track-sub muted', text: next ? `${p}% → ${next}` : 'Max rank' }),
      ]);
    };

    const career = tracks.filter((t) => t.kind === 'career');
    const navy = tracks.filter((t) => t.kind === 'navy');

    root.replaceChildren(el('div', { class: 'ranks-wrap' }, [
      el('h2', { class: 'cl-title', text: 'Rank Progress' }),
      el('div', { class: 'ranks-grid' }, [
        card('Career', career.map(trackRow)),
        card('Naval Ranks', navy.map(trackRow)),
      ]),
    ]));
  },
};

// ---------------------------------------------------------------------------
// Materials
// ---------------------------------------------------------------------------
const materials = {
  id: 'materials',
  label: 'Materials',
  render(root, ctx) {
    const mats = ctx.state?.materials || { Raw: {}, Manufactured: {}, Encoded: {} };
    const section = (title, obj) => {
      const entries = Object.entries(obj || {}).sort((a, b) => b[1] - a[1]);
      const total = entries.reduce((sum, [, c]) => sum + c, 0);
      const body = entries.length
        ? el('div', { class: 'mat-grid' }, entries.map(([name, count]) =>
            el('div', { class: 'mat-cell' }, [
              el('span', { class: 'mat-name', text: prettyMat(name) }),
              el('span', { class: 'mat-count', text: String(count) }),
            ])))
        : el('div', { class: 'muted', text: 'None recorded yet.' });
      return card(title, [body], { badge: `${entries.length} types · ${total}` });
    };
    root.replaceChildren(el('div', { class: 'mats-wrap' }, [
      el('h2', { class: 'cl-title', text: 'Engineering Materials' }),
      el('p', { class: 'muted', style: 'margin-bottom:14px', text: 'Live stockpiles from your last Materials snapshot, updated as you collect.' }),
      section('Raw', mats.Raw),
      section('Manufactured', mats.Manufactured),
      section('Encoded', mats.Encoded),
    ]));
  },
};

// ---------------------------------------------------------------------------
// Fleet
// ---------------------------------------------------------------------------
const fleet = {
  id: 'fleet',
  label: 'Fleet',
  render(root, ctx) {
    const s = ctx.state || {};
    const nw = s.netWorth || {};
    const owned = (s.ownedShips || []).slice().sort();
    const activeType = (s.ship?.type || '').toLowerCase();
    const storedById = {};
    for (const st of (s.storedShips || [])) storedById[String(st.ShipType).toLowerCase()] = st;

    const shipCells = owned.map((t) => {
      const isActive = t === activeType;
      const stored = storedById[t];
      return el('div', { class: `ship-cell ${isActive ? 'active' : ''}` }, [
        el('span', { class: 'ship-cell-name', text: prettyShip(t) }),
        isActive ? el('span', { class: 'ship-tag', text: 'ACTIVE' })
          : (stored ? el('span', { class: 'ship-val', text: `${creditsShort(stored.Value)}` }) : null),
      ]);
    });

    const cards = [
      card('Net Worth', [
        el('div', { class: 'wealth-total', text: `${credits(nw.total)} CR` }),
        kv('Fluid cash', `${credits(nw.cash)} CR`),
        kv('Active ship', `${credits(nw.shipValue)} CR`),
        kv('Stored ships', `${credits(nw.storedShipsValue)} CR`),
        kv('Fleet carrier', `${credits(nw.carrierBalance)} CR`),
        kv('Unsold data (est.)', `${credits(((s.dataHeld || {}).explorationValue || 0) + ((s.dataHeld || {}).exobiologyValue || 0))} CR`),
        nw.statWealth != null ? el('div', { class: 'muted', style: 'margin-top:6px;font-size:11px', text: `Unsold data (cartographic + exobiology) is not counted in net worth — it's lost on rebuy. Game "wealth" stat: ${credits(nw.statWealth)} CR.` }) : null,
      ], { badge: creditsShort(nw.total) }),
      card('Active Ship', [
        el('div', { class: 'ship-name', text: shipName(s.ship) }),
        el('div', { class: 'ship-ident', text: `${s.ship?.name || '—'}${s.ship?.ident ? ' · ' + s.ship.ident : ''}` }),
        kv('Hull', `${credits(s.ship?.hullValue)} CR`),
        kv('Modules', `${credits(s.ship?.modulesValue)} CR`),
        kv('Rebuy', `${credits(s.ship?.rebuy)} CR`),
      ]),
    ];
    if (s.carrier) {
      cards.push(card('Fleet Carrier', [
        el('div', { class: 'ship-name', text: s.carrier.name || s.carrier.callsign || 'Fleet Carrier' }),
        el('div', { class: 'ship-ident', text: s.carrier.callsign || '' }),
        kv('Balance', `${credits(s.carrier.balance)} CR`),
        kv('Reserve', `${credits(s.carrier.reserve)} CR`),
        kv('Fuel (tritium)', s.carrier.fuel != null ? `${s.carrier.fuel} t` : '—'),
      ]));
    }

    root.replaceChildren(el('div', { class: 'fleet-wrap' }, [
      el('h2', { class: 'cl-title', text: 'Fleet & Assets' }),
      el('div', { class: 'fleet-grid' }, cards),
      card(`Ships Owned — ${owned.length}`, [el('div', { class: 'ship-list' }, shipCells)], { class: 'span-full' }),
    ]));
  },
};

export const EXTRA_SCREENS = { ranks, materials, fleet };
