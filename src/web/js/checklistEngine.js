// Client-side checklist auto-detection. Evaluates `auto` rules against the
// derived commander state so items tick themselves off from your save.

export function buildIndex(state) {
  const lc = (s) => String(s).toLowerCase();
  return {
    visited: new Set((state.visited || []).map(lc)),
    seen: new Set(state.seenEvents || []),
    ships: new Set((state.ownedShips || []).map(lc)),
    modules: state.ownedModules || [],
    ranks: state.ranks || {},
    engineers: state.engineers || {},
  };
}

export function evalRule(rule, idx, reference) {
  if (!rule) return false;
  const lc = (s) => String(s).toLowerCase();
  switch (rule.type) {
    case 'rank': return (idx.ranks[rule.key] ?? -1) >= rule.min;
    case 'anyRank': return rule.keys.some((k) => (idx.ranks[k] ?? -1) >= rule.min);
    case 'allRank': return rule.keys.every((k) => (idx.ranks[k] ?? -1) >= rule.min);
    case 'visited': return idx.visited.has(lc(rule.system));
    case 'visitedAnyOf': return rule.systems.some((s) => idx.visited.has(lc(s)));
    case 'event': return rule.events.some((e) => idx.seen.has(e));
    case 'shipOwned': return idx.ships.has(lc(rule.ship));
    case 'shipOwnedAnyOf': return rule.ships.some((s) => idx.ships.has(lc(s)));
    case 'moduleOwned': return idx.modules.some((m) => m.includes(rule.contains));
    case 'engineerAny': return Object.values(idx.engineers).some((e) => e.progress === 'Unlocked');
    case 'engineerUnlocked': return idx.engineers[rule.name]?.progress === 'Unlocked';
    case 'engineerUnlockedAnyOf': return rule.names.some((n) => idx.engineers[n]?.progress === 'Unlocked');
    case 'engineerGrade': return Object.values(idx.engineers).some((e) => e.progress === 'Unlocked' && (e.rank || 0) >= rule.min);
    case 'engineerUnlockedType': {
      const names = (reference?.engineers?.engineers || []).filter((x) => x.type === rule.engType).map((x) => x.name);
      return names.some((n) => idx.engineers[n]?.progress === 'Unlocked');
    }
    default: return false;
  }
}

// Status for a checklist item: auto-detected, manual, and combined done-state.
export function itemStatus(item, idx, reference, progress) {
  const auto = item.auto ? evalRule(item.auto, idx, reference) : false;
  const manual = !!(progress?.manual && progress.manual[item.id]);
  return { auto, manual, done: auto || manual };
}

export function countDone(items, idx, reference, progress) {
  let done = 0;
  for (const it of items) if (itemStatus(it, idx, reference, progress).done) done++;
  return done;
}
