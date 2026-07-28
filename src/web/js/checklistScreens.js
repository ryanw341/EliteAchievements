// Pass 2 screens: Engineers, Core Goals, Milestones, Permits, Notable Systems.
import { el } from './format.js';
import { buildIndex, itemStatus, countDone } from './checklistEngine.js';

// Collapse state persists across re-renders.
const COLLAPSE = new Set();
const ckey = (screenId, groupKey) => `${screenId}::${groupKey}`;

function progressHeader(title, done, total, sub) {
  const pctVal = total ? Math.round((done / total) * 100) : 0;
  return el('div', { class: 'cl-header' }, [
    el('div', { class: 'cl-header-top' }, [
      el('h2', { class: 'cl-title', text: title }),
      el('span', { class: 'cl-count', text: `${done} / ${total}` }),
    ]),
    el('div', { class: 'bar cl-bar' }, [el('div', { class: 'bar-fill', style: `width:${pctVal}%` })]),
    sub ? el('div', { class: 'muted cl-sub', text: sub }) : null,
  ]);
}

function itemRow(item, ctx, idx) {
  const st = itemStatus(item, idx, ctx.reference, ctx.progress);
  const box = el('button', {
    class: `chk ${st.done ? 'done' : ''} ${st.auto ? 'auto' : ''}`,
    title: st.auto ? 'Auto-detected from your journal' : (st.done ? 'Manually marked done' : 'Click to mark done'),
    text: st.done ? '✓' : '',
  });
  if (st.auto) {
    box.setAttribute('disabled', '');
  } else {
    box.addEventListener('click', async () => {
      await ctx.actions.toggle(item.id, !st.manual);
      ctx.actions.rerender();
    });
  }
  return el('div', { class: `cl-row ${st.done ? 'row-done' : ''}` }, [
    el('div', { class: 'cl-box' }, [box, st.auto ? el('span', { class: 'auto-tag', text: 'AUTO' }) : null]),
    el('div', { class: 'cl-main' }, [
      el('div', { class: 'cl-item-top' }, [
        el('span', { class: 'cl-item-title', text: item.title }),
        item.badge ? el('span', { class: 'cl-item-badge', text: item.badge }) : null,
      ]),
      item.desc ? el('div', { class: 'cl-item-desc', text: item.desc }) : null,
      item.detail ? el('div', { class: 'cl-item-detail', text: item.detail }) : null,
    ]),
  ]);
}

function groupSection(screenId, group, ctx, idx) {
  const done = countDone(group.items, idx, ctx.reference, ctx.progress);
  const key = ckey(screenId, group.key);
  const isCollapsed = COLLAPSE.has(key);
  const head = el('button', {
    class: `cl-group-head ${isCollapsed ? 'collapsed' : ''}`,
    onclick: () => { if (COLLAPSE.has(key)) COLLAPSE.delete(key); else COLLAPSE.add(key); ctx.actions.rerender(); },
  }, [
    el('span', { class: 'cl-caret', text: isCollapsed ? '▸' : '▾' }),
    el('span', { class: 'cl-group-title', text: group.title }),
    group.badge ? el('span', { class: 'cl-group-badge', text: group.badge }) : null,
    el('span', { class: 'cl-group-count', text: `${done}/${group.items.length}` }),
  ]);
  const children = [head];
  if (!isCollapsed) {
    if (group.blurb) children.push(el('div', { class: 'muted cl-group-blurb', text: group.blurb }));
    children.push(el('div', { class: 'cl-list' }, group.items.map((it) => itemRow(it, ctx, idx))));
  }
  return el('section', { class: 'cl-group' }, children);
}

function renderChecklist(root, ctx, opts) {
  const idx = buildIndex(ctx.state);
  const allItems = opts.groups.flatMap((g) => g.items);
  const done = countDone(allItems, idx, ctx.reference, ctx.progress);
  const wrap = el('div', { class: 'checklist' }, [
    progressHeader(opts.title, done, allItems.length, opts.sub),
    ...opts.groups.map((g) => groupSection(opts.screenId, g, ctx, idx)),
  ]);
  root.replaceChildren(wrap);
}

// ---------------------------------------------------------------------------
// Engineers (status table, auto from EngineerProgress)
// ---------------------------------------------------------------------------
const engineers = {
  id: 'engineers',
  label: 'Engineers',
  render(root, ctx) {
    const list = ctx.reference?.engineers?.engineers || [];
    const stateEng = ctx.state?.engineers || {};
    const statusOf = (name) => {
      const e = stateEng[name];
      if (!e) return { label: 'LOCKED', cls: 'locked', rank: 0, progress: null };
      const map = { Unlocked: 'unlocked', Invited: 'invited', Known: 'known' };
      return { label: (e.progress || 'KNOWN').toUpperCase(), cls: map[e.progress] || 'known', rank: e.rank || 0, progress: e.progress };
    };

    const makeGroup = (type, title) => {
      const items = list.filter((x) => x.type === type);
      const unlocked = items.filter((x) => statusOf(x.name).progress === 'Unlocked').length;
      const rows = items.map((eng) => {
        const st = statusOf(eng.name);
        const pips = el('div', { class: 'pips' }, Array.from({ length: 5 }, (_, i) =>
          el('span', { class: `pip ${i < st.rank ? 'on' : ''}` })));
        return el('div', { class: `eng-row ${st.cls}` }, [
          el('div', { class: 'eng-main' }, [
            el('div', { class: 'eng-top' }, [
              el('span', { class: 'eng-name', text: eng.name }),
              el('span', { class: `eng-status ${st.cls}`, text: st.progress === 'Unlocked' ? `G${st.rank}` : st.label }),
            ]),
            el('div', { class: 'eng-loc', text: `${eng.system} · ${eng.base}` }),
            el('div', { class: 'eng-prof muted', text: eng.profession }),
            el('div', { class: 'eng-unlock muted', text: st.progress === 'Unlocked' ? `First-unlock gift: ${eng.firstUnlockGift}` : eng.unlock }),
          ]),
          el('div', { class: 'eng-side' }, [pips, el('span', { class: 'eng-grade-label', text: `Grade ${st.rank}/5` })]),
        ]);
      });
      return { title: `${title} — ${unlocked}/${items.length} unlocked`, node: el('div', { class: 'eng-grid' }, rows) };
    };

    const ship = makeGroup('ship', 'Ship Engineers');
    const onfoot = makeGroup('onfoot', 'On-Foot Engineers');
    const totalUnlocked = list.filter((x) => statusOf(x.name).progress === 'Unlocked').length;

    root.replaceChildren(el('div', { class: 'checklist' }, [
      progressHeader('Engineers', totalUnlocked, list.length, 'Unlock state and grade are read live from your EngineerProgress events.'),
      el('h3', { class: 'eng-section-title', text: ship.title }), ship.node,
      el('h3', { class: 'eng-section-title', text: onfoot.title }), onfoot.node,
    ]));
  },
};

// ---------------------------------------------------------------------------
// Core Goals
// ---------------------------------------------------------------------------
const core = {
  id: 'core',
  label: 'Core Goals',
  render(root, ctx) {
    const cats = ctx.reference?.['core-checklists']?.categories || [];
    const groups = cats.map((c) => ({
      key: c.category,
      title: c.category,
      blurb: c.blurb,
      items: c.items.map((it) => ({ id: it.id, title: it.item, desc: it.description, auto: it.auto })),
    }));
    renderChecklist(root, ctx, { screenId: 'core', title: 'Core Gameplay Goals', groups,
      sub: 'Grouped goals across every profession. Green AUTO items are detected from your journal; tap the others to tick them yourself.' });
  },
};

// ---------------------------------------------------------------------------
// Milestones
// ---------------------------------------------------------------------------
const milestones = {
  id: 'milestones',
  label: 'Milestones',
  render(root, ctx) {
    const ms = ctx.reference?.milestones?.milestones || [];
    const items = ms.map((m) => ({ id: m.id, title: m.name, desc: m.detail, detail: m.auto ? null : `Detect: ${m.detection}`, auto: m.auto }));
    renderChecklist(root, ctx, { screenId: 'milestones', title: 'Career & Lore Milestones',
      groups: [{ key: 'all', title: 'Milestones', items }],
      sub: 'The signature achievements — Elite ranks, first Thargoid contact, your first colony, Sag A*, Beagle Point and more.' });
  },
};

// ---------------------------------------------------------------------------
// Permits
// ---------------------------------------------------------------------------
const permits = {
  id: 'permits',
  label: 'Permits',
  render(root, ctx) {
    const list = ctx.reference?.permits?.permits || [];
    const byCat = groupBy(list, (p) => p.category);
    const groups = Object.entries(byCat).map(([cat, ps]) => ({
      key: cat,
      title: cat,
      items: ps.map((p) => ({
        id: `permit-${slug(p.system)}`,
        title: p.system,
        desc: p.howToObtain,
        auto: { type: 'visited', system: p.system },
      })),
    }));
    renderChecklist(root, ctx, { screenId: 'permits', title: 'Permit-Locked Systems', groups,
      sub: 'Auto-ticked when a system appears in your visited history. Story-reserved permits cannot be earned in-game.' });
  },
};

// ---------------------------------------------------------------------------
// Notable Systems
// ---------------------------------------------------------------------------
const systems = {
  id: 'systems',
  label: 'Notable Systems',
  render(root, ctx) {
    const data = ctx.reference?.systems;
    const list = data?.systems || [];
    const order = data?.categories || [];
    const byCat = groupBy(list, (s) => s.category);
    const cats = order.length ? order : Object.keys(byCat);
    const groups = cats.filter((c) => byCat[c]).map((cat) => ({
      key: cat,
      title: cat,
      items: byCat[cat].map((s) => ({
        id: s.id,
        title: s.name,
        desc: s.why,
        auto: s.match ? { type: 'visited', system: s.match } : null,
      })),
    }));
    renderChecklist(root, ctx, { screenId: 'systems', title: 'Notable Systems to Visit', groups,
      sub: '115 destinations across the galaxy. Systems are auto-ticked from your visited history; nebulae/regions without a single system are manual.' });
  },
};

// ---------------------------------------------------------------------------
// Racetracks (community racing venues)
// ---------------------------------------------------------------------------
const racetracks = {
  id: 'racetracks',
  label: 'Racetracks',
  render(root, ctx) {
    const data = ctx.reference?.racetracks;
    const list = data?.racetracks || [];
    const order = data?.categories || [];
    const byCat = groupBy(list, (r) => r.category);
    const cats = order.length ? order : Object.keys(byCat);
    const groups = cats.filter((c) => byCat[c]).map((cat) => ({
      key: cat,
      title: cat,
      items: byCat[cat].map((r) => ({
        id: r.id,
        title: r.name,
        badge: r.type,
        desc: r.why,
        detail: r.location,
        auto: r.match ? { type: 'visited', system: r.match } : null,
      })),
    }));
    renderChecklist(root, ctx, {
      screenId: 'racetracks',
      title: 'Community Racetracks',
      groups,
      sub: data?.blurb || 'Community racing venues, auto-ticked when you have visited the venue system.',
    });
  },
};

// ---------------------------------------------------------------------------
function groupBy(arr, fn) {
  const out = {};
  for (const x of arr) { const k = fn(x); (out[k] = out[k] || []).push(x); }
  return out;
}
function slug(s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''); }

export const CHECKLIST_SCREENS = { engineers, core, milestones, permits, systems, racetracks };
