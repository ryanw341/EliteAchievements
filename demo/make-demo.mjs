// Generates a fake Elite Dangerous journal for screenshots: CMDR REDACTED,
// ~50B net worth, near-complete checklists. Writes to demo/journal + demo/user.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const REF = path.join(ROOT, 'data', 'reference');
const OUT_JOURNAL = path.join(ROOT, 'demo', 'journal');
const OUT_USER = path.join(ROOT, 'demo', 'user');

const readRef = (f) => JSON.parse(fs.readFileSync(path.join(REF, f), 'utf8'));
const hash = (s) => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };

export function generate() {
  const systems = readRef('systems.json');
  const permits = readRef('permits.json');
  const racetracks = readRef('racetracks.json');
  const engineers = readRef('engineers.json').engineers;
  const milestones = readRef('milestones.json').milestones;
  const core = readRef('core-checklists.json').categories;

  fs.rmSync(OUT_JOURNAL, { recursive: true, force: true });
  fs.mkdirSync(OUT_JOURNAL, { recursive: true });
  fs.mkdirSync(OUT_USER, { recursive: true });

  const CASH = 18_500_000_000;
  const CARRIER = 30_000_000_000;

  const events = [];
  let t = Date.UTC(2026, 6, 1, 8, 0, 0);
  const ts = () => { t += 4000; return new Date(t).toISOString().replace('.000Z', 'Z'); };
  const add = (ev) => events.push({ timestamp: ts(), ...ev });

  add({ event: 'Fileheader', part: 1, language: 'English/UK', Odyssey: true, gameversion: '4.4.0.3', build: 'r0' });
  add({ event: 'Commander', FID: 'F0000000', Name: 'REDACTED' });
  add({ event: 'LoadGame', Commander: 'REDACTED', FID: 'F0000000', Horizons: true, Odyssey: true, Ship: 'anaconda', Ship_Localised: 'Anaconda', ShipID: 1, ShipName: 'GHOST PROTOCOL', ShipIdent: 'XX-01', FuelLevel: 32, FuelCapacity: 32, GameMode: 'Solo', Credits: CASH, Loan: 0, gameversion: '4.4.0.3' });

  add({ event: 'Rank', Combat: 8, Trade: 8, Explore: 8, Soldier: 8, Exobiologist: 8, Empire: 13, Federation: 13, CQC: 6 });
  add({ event: 'Progress', Combat: 74, Trade: 88, Explore: 63, Soldier: 41, Exobiologist: 57, Empire: 20, Federation: 35, CQC: 12 });
  add({ event: 'Reputation', Empire: 100, Federation: 100, Independent: 100, Alliance: 100 });
  add({ event: 'Statistics', Bank_Account: { Current_Wealth: 50_000_000_000, Spent_On_Ships: 5_000_000_000 } });

  // ~34/38 engineers unlocked at grade 5, the rest merely Known.
  const engList = engineers.map((e, i) => {
    const unlocked = i < engineers.length - 4;
    const row = { Engineer: e.name, EngineerID: 300000 + i, Progress: unlocked ? 'Unlocked' : 'Known', RankProgress: 0 };
    if (unlocked) row.Rank = 5;
    return row;
  });
  add({ event: 'EngineerProgress', Engineers: engList });

  add({ event: 'Loadout', Ship: 'anaconda', ShipID: 1, ShipName: 'GHOST PROTOCOL', ShipIdent: 'XX-01', HullValue: 220_000_000, ModulesValue: 780_000_000, Rebuy: 50_000_000, MaxJumpRange: 78, CargoCapacity: 256, Modules: [
    { Slot: 'FrameShiftDrive', Item: 'int_hyperdrive_size6_class5', On: true },
    { Slot: 'GuardianFSDBooster', Item: 'int_guardianfsdbooster_size5', On: true },
    { Slot: 'Hardpoint1', Item: 'hpt_guardian_gausscannon_fixed_medium', On: true },
    { Slot: 'Hardpoint2', Item: 'hpt_atmulticannon_fixed_large', On: true },
    { Slot: 'Hardpoint3', Item: 'hpt_mininglaser_fixed_medium', On: true },
    { Slot: 'Armour', Item: 'int_guardianhullreinforcement_size5_class2', On: true },
  ] });

  add({ event: 'StoredShips', StationName: 'Jameson Memorial', StarSystem: 'Shinrarta Dezhra', ShipsHere: [
    { ShipID: 2, ShipType: 'cutter', Name: 'BLACKSITE', Value: 180_000_000 },
    { ShipID: 3, ShipType: 'federation_corvette', Name: 'DEADBOLT', Value: 160_000_000 },
    { ShipID: 4, ShipType: 'krait_mkii', Name: 'CIPHER', Value: 60_000_000 },
    { ShipID: 5, ShipType: 'mandalay', Name: 'WHISPER', Value: 45_000_000 },
    { ShipID: 6, ShipType: 'python_nx', Name: 'REDACTED-II', Value: 55_000_000 },
  ], ShipsRemote: [] });

  add({ event: 'CarrierBuy', CarrierID: 9000001, Callsign: 'X0X-0XX', Location: 'Shinrarta Dezhra', Price: 5_000_000_000, Variant: 'Drake' });
  add({ event: 'CarrierStats', CarrierID: 9000001, Callsign: 'X0X-0XX', Name: 'REDACTED ACTUAL', FuelLevel: 1000, Finance: { CarrierBalance: CARRIER, ReserveBalance: 200_000_000, AvailableBalance: CARRIER } });

  // One dummy of every event referenced by an auto rule — ticks event-based items.
  // (Sale/reset events land here, BEFORE the unsold scans below, so held value is non-zero.)
  const eventNames = new Set();
  for (const m of milestones) if (m.auto?.type === 'event') m.auto.events.forEach((e) => eventNames.add(e));
  for (const c of core) for (const it of c.items) if (it.auto?.type === 'event') it.auto.events.forEach((e) => eventNames.add(e));
  for (const name of eventNames) add({ event: name });
  add({ event: 'ShipyardBuy', ShipType: 'anaconda' });

  // Unsold cartographic data — high-value, first-discovered, mapped bodies.
  for (let i = 0; i < 24; i++) {
    const cls = i % 3 === 0 ? 'Earthlike body' : (i % 3 === 1 ? 'Water world' : 'High metal content body');
    add({ event: 'Scan', ScanType: 'Detailed', BodyName: `Demo ${i} a`, BodyID: 100 + i, SystemAddress: 5000 + i, PlanetClass: cls, TerraformState: i % 3 === 2 ? 'Terraformable' : '', MassEM: 0.8 + i * 0.05, WasDiscovered: false, WasMapped: false });
    add({ event: 'SAAScanComplete', BodyName: `Demo ${i} a`, BodyID: 100 + i, SystemAddress: 5000 + i, ProbesUsed: 5, EfficiencyTarget: 6 });
  }

  // Unsold exobiology — valuable species, first-footfall x5.
  const species = ['Stratum Tectonicas', 'Clypeus Speculumi', 'Cactoida Vermis', 'Recepta Deltahedronix', 'Osseus Discus', 'Aleoida Gravis', 'Tubus Cavas', 'Frutexa Flammasis', 'Concha Biconcavis', 'Fonticulua Segmentatus'];
  for (let i = 0; i < 34; i++) {
    const sp = species[i % species.length];
    const genus = sp.split(' ')[0];
    add({ event: 'ScanOrganic', ScanType: 'Analyse', Genus: `$Codex_${genus};`, Genus_Localised: genus, Species: `$Codex_${sp};`, Species_Localised: sp, SystemAddress: 6000 + i, Body: 5 + i });
  }

  // Visited systems: ~90% of matched systems + racetracks, all obtainable permits, key landmarks.
  const visits = new Set(['Sol', 'Colonia', 'Sagittarius A*', 'Ceeckia ZQ-L c24-0', 'Shinrarta Dezhra', 'Deciat']);
  systems.systems.filter((s) => s.match).map((s) => s.match).filter((_, i) => i % 10 !== 0).forEach((m) => visits.add(m));
  permits.permits.filter((p) => !/story-reserved/i.test(p.category)).forEach((p) => visits.add(p.system));
  racetracks.racetracks.filter((r) => r.match).filter((_, i) => i % 12 !== 0).forEach((r) => visits.add(r.match));
  for (const sysName of visits) add({ event: 'FSDJump', StarSystem: sysName, SystemAddress: hash(sysName), StarPos: [0, 0, 0], JumpDist: 20, FuelUsed: 2, FuelLevel: 30 });

  add({ event: 'Materials', Raw: [{ Name: 'iron', Count: 250 }, { Name: 'nickel', Count: 250 }, { Name: 'carbon', Count: 300 }], Manufactured: [{ Name: 'heatvanes', Count: 20 }, { Name: 'protoheatradiators', Count: 12 }], Encoded: [{ Name: 'shielddensityreports', Count: 40 }, { Name: 'dataminedwake', Count: 15 }] });

  // Final location -> Sol (current system) with a plotted route for the header.
  add({ event: 'FSDJump', StarSystem: 'Sol', SystemAddress: hash('Sol'), StarPos: [0, 0, 0], JumpDist: 8, FuelUsed: 1, FuelLevel: 31 });
  add({ event: 'Docked', StationName: 'Galileo', StationType: 'Orbis', StarSystem: 'Sol', SystemAddress: hash('Sol') });
  add({ event: 'FSDTarget', Name: 'LHS 3447', SystemAddress: hash('LHS 3447'), StarClass: 'M', RemainingJumpsInRoute: 18 });

  const iso = new Date(t).toISOString().replace('.000Z', 'Z');
  fs.writeFileSync(path.join(OUT_JOURNAL, 'Journal.2026-07-01T080000.01.log'), events.map((e) => JSON.stringify(e)).join('\n') + '\n');
  fs.writeFileSync(path.join(OUT_JOURNAL, 'Status.json'), JSON.stringify({ timestamp: iso, event: 'Status', Flags: 16777240, Balance: CASH, Pips: [4, 8, 0] }));
  fs.writeFileSync(path.join(OUT_JOURNAL, 'NavRoute.json'), JSON.stringify({ timestamp: iso, event: 'NavRoute', Route: [{ StarSystem: 'Sol' }, { StarSystem: 'LHS 3447' }, { StarSystem: 'Colonia' }] }));

  // Pre-tick most manual-only items so the boards read near-complete.
  const manual = {};
  core.forEach((c) => c.items.forEach((it, i) => { if (it.auto == null && i % 7 !== 0) manual[it.id] = true; }));
  milestones.forEach((m, i) => { if (m.auto == null && i % 9 !== 0) manual[m.id] = true; });
  systems.systems.forEach((s, i) => { if (s.match == null && i % 9 !== 0) manual[s.id] = true; });
  fs.writeFileSync(path.join(OUT_USER, 'progress.json'), JSON.stringify({ manual, notes: {} }, null, 2));

  return { events: events.length, visited: visits.size };
}

if (process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('demo/make-demo.mjs')) {
  console.log('demo journal generated:', generate());
}
