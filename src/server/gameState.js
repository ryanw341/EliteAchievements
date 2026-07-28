// Derived commander state, built by folding journal events through apply().
// Also consumes the live Status.json / NavRoute.json snapshots.
import { organicValue } from './exobiology.js';

export class GameState {
  constructor() {
    this.commander = { name: null, fid: null };
    this.game = { horizons: null, odyssey: null, gameversion: null, mode: null };
    this.ship = {
      type: null, typeLocalised: null, name: null, ident: null, id: null,
      hullValue: 0, modulesValue: 0, rebuy: 0,
    };
    this.balance = 0;          // liquid credits
    this.loan = 0;
    this.statWealth = null;    // Statistics -> Bank_Account.Current_Wealth (cross-check)

    this.location = {
      system: null, systemAddress: null, starPos: null,
      body: null, docked: false, station: null, stationType: null,
    };
    this.nav = { targetSystem: null, remainingJumps: null };
    this.route = [];           // from NavRoute.json: [{StarSystem, StarClass, ...}]

    this.ranks = {};           // Combat, Trade, Explore, Soldier, Exobiologist, Empire, Federation, CQC
    this.rankProgress = {};
    this.reputation = {};      // Empire, Federation, Independent, Alliance

    this.engineers = {};       // name -> { id, progress, rank, rankProgress }
    this.materials = { Raw: {}, Manufactured: {}, Encoded: {} };

    this.carrier = null;       // { id, callsign, name, balance, reserve, fuel }
    this.storedShips = [];     // [{ ShipID, ShipType, Value, Name }]
    this.storedShipsValue = 0;

    // Derived accumulators used by the checklist engine.
    this.visited = new Set();        // system names visited
    this.seenEvents = new Set();     // event names ever seen
    this.ownedShips = new Set();     // ship types (lowercased) owned/flown
    this.ownedModules = new Set();   // module Item strings (lowercased) ever equipped

    this.feed = [];            // recent notable events for the UI: [{ t, event, text }]
    this.stats = {};           // last full Statistics event
    this.lastUpdate = null;    // timestamp of last applied event

    // Estimated value of exploration/exobiology data not yet sold. Reset on a
    // data sale or on death (unsold data is lost on rebuy, as in-game).
    this.dataHeld = {
      explorationValue: 0, bodiesScanned: 0, bodiesMapped: 0, firstDiscoveries: 0,
      organicPending: 0, exobiologyValue: 0, exobiologyBase: 0,
    };
    this._bodies = new Map();      // bodyKey -> { base, fd, mapped, value }
    this._mappedKeys = new Set();  // bodies mapped before their Scan arrived
  }

  // ---- main reducer -------------------------------------------------------
  apply(e) {
    if (!e || !e.event) return;
    this.seenEvents.add(e.event);
    if (e.timestamp) this.lastUpdate = e.timestamp;

    switch (e.event) {
      case 'Fileheader':
        if (typeof e.Odyssey === 'boolean') this.game.odyssey = e.Odyssey;
        if (e.gameversion) this.game.gameversion = e.gameversion;
        break;

      case 'Commander':
        if (e.Name) this.commander.name = e.Name;
        if (e.FID) this.commander.fid = e.FID;
        break;

      case 'LoadGame':
        if (e.Commander) this.commander.name = e.Commander;
        if (e.FID) this.commander.fid = e.FID;
        if (typeof e.Credits === 'number') this.balance = e.Credits;
        if (typeof e.Loan === 'number') this.loan = e.Loan;
        if (typeof e.Horizons === 'boolean') this.game.horizons = e.Horizons;
        if (typeof e.Odyssey === 'boolean') this.game.odyssey = e.Odyssey;
        if (e.gameversion) this.game.gameversion = e.gameversion;
        if (e.GameMode) this.game.mode = e.GameMode;
        if (e.Ship && isRealVessel(e.Ship)) {
          this.ship.type = e.Ship;
          this.ship.typeLocalised = e.Ship_Localised || e.Ship;
          this.ship.id = e.ShipID ?? this.ship.id;
          this.ship.name = e.ShipName || this.ship.name;
          this.ship.ident = e.ShipIdent || this.ship.ident;
          this.ownedShips.add(String(e.Ship).toLowerCase());
        }
        break;

      case 'Loadout':
        // Ignore taxis, SRVs and on-foot suits — they also emit Loadout events.
        if (e.Ship && !isRealVessel(e.Ship)) break;
        if (e.Ship) {
          this.ship.type = e.Ship;
          this.ship.typeLocalised = e.Ship_Localised || this.ship.typeLocalised || e.Ship;
          this.ownedShips.add(String(e.Ship).toLowerCase());
        }
        if (e.ShipID != null) this.ship.id = e.ShipID;
        if (e.ShipName) this.ship.name = e.ShipName;
        if (e.ShipIdent) this.ship.ident = e.ShipIdent;
        if (typeof e.HullValue === 'number') this.ship.hullValue = e.HullValue;
        if (typeof e.ModulesValue === 'number') this.ship.modulesValue = e.ModulesValue;
        if (typeof e.Rebuy === 'number') this.ship.rebuy = e.Rebuy;
        if (Array.isArray(e.Modules)) {
          for (const m of e.Modules) {
            if (m && m.Item) this.ownedModules.add(String(m.Item).toLowerCase());
          }
        }
        break;

      case 'Rank':
        this.ranks = { ...this.ranks, ...numericFields(e) };
        break;
      case 'Progress':
        this.rankProgress = { ...this.rankProgress, ...numericFields(e) };
        break;
      case 'Promotion':
        this.ranks = { ...this.ranks, ...numericFields(e) };
        break;
      case 'Reputation':
        this.reputation = { ...this.reputation, ...numericFields(e) };
        break;

      case 'Statistics':
        this.stats = e;
        if (e.Bank_Account && typeof e.Bank_Account.Current_Wealth === 'number') {
          this.statWealth = e.Bank_Account.Current_Wealth;
        }
        break;

      case 'Location':
      case 'FSDJump':
      case 'CarrierJump':
        if (e.StarSystem) {
          this.location.system = e.StarSystem;
          this.visited.add(e.StarSystem);
        }
        if (e.SystemAddress != null) this.location.systemAddress = e.SystemAddress;
        if (e.StarPos) this.location.starPos = e.StarPos;
        this.location.body = e.Body || null;
        this.location.docked = !!e.Docked;
        this.location.station = e.StationName || null;
        this.location.stationType = e.StationType || null;
        if (e.event === 'FSDJump' || e.event === 'CarrierJump') {
          this.pushFeed(e.timestamp, e.event, `Jumped to ${e.StarSystem}`);
        }
        break;

      case 'FSDTarget':
        this.nav.targetSystem = e.Name || null;
        this.nav.remainingJumps = e.RemainingJumpsInRoute ?? null;
        break;

      case 'NavRouteClear':
        this.route = [];
        this.nav.targetSystem = null;
        this.nav.remainingJumps = null;
        break;

      case 'Docked':
        this.location.docked = true;
        this.location.station = e.StationName || null;
        this.location.stationType = e.StationType || null;
        if (e.StarSystem) { this.location.system = e.StarSystem; this.visited.add(e.StarSystem); }
        this.pushFeed(e.timestamp, e.event, `Docked at ${e.StationName || 'station'}`);
        break;
      case 'Undocked':
        this.location.docked = false;
        this.location.station = null;
        break;

      case 'EngineerProgress': {
        const list = Array.isArray(e.Engineers) ? e.Engineers : [e];
        for (const en of list) {
          if (!en || !en.Engineer) continue;
          this.engineers[en.Engineer] = {
            id: en.EngineerID ?? null,
            progress: en.Progress ?? null,
            rank: en.Rank ?? null,
            rankProgress: en.RankProgress ?? null,
          };
        }
        break;
      }

      case 'Materials':
        for (const cat of ['Raw', 'Manufactured', 'Encoded']) {
          if (Array.isArray(e[cat])) {
            const bucket = {};
            for (const m of e[cat]) if (m && m.Name) bucket[m.Name] = m.Count || 0;
            this.materials[cat] = bucket;
          }
        }
        break;
      case 'MaterialCollected': {
        const cat = e.Category;
        if (cat && this.materials[cat] && e.Name) {
          this.materials[cat][e.Name] = (this.materials[cat][e.Name] || 0) + (e.Count || 1);
        }
        break;
      }

      case 'ShipyardBuy':
        if (e.ShipType) this.ownedShips.add(String(e.ShipType).toLowerCase());
        this.pushFeed(e.timestamp, e.event, `Bought a ${e.ShipType}`);
        break;
      case 'ShipyardNew':
        if (e.ShipType) this.ownedShips.add(String(e.ShipType).toLowerCase());
        break;
      case 'StoredShips': {
        const here = Array.isArray(e.ShipsHere) ? e.ShipsHere : [];
        const remote = Array.isArray(e.ShipsRemote) ? e.ShipsRemote : [];
        const all = [...here, ...remote];
        this.storedShips = all.map((s) => ({
          ShipID: s.ShipID, ShipType: s.ShipType, Value: s.Value || 0, Name: s.Name || null,
        }));
        for (const s of all) if (s.ShipType) this.ownedShips.add(String(s.ShipType).toLowerCase());
        // Exclude the currently-active ship from the stored-value sum to avoid double counting.
        this.storedShipsValue = this.storedShips
          .filter((s) => s.ShipID !== this.ship.id)
          .reduce((sum, s) => sum + (s.Value || 0), 0);
        break;
      }

      case 'CarrierBuy':
        this.carrier = this.carrier || {};
        this.carrier.id = e.CarrierID ?? this.carrier.id;
        this.carrier.callsign = e.Callsign ?? this.carrier.callsign;
        this.pushFeed(e.timestamp, e.event, 'Purchased a Fleet Carrier');
        break;
      case 'CarrierStats':
        this.carrier = this.carrier || {};
        this.carrier.id = e.CarrierID ?? this.carrier.id;
        this.carrier.callsign = e.Callsign ?? this.carrier.callsign;
        this.carrier.name = e.Name ?? this.carrier.name;
        if (e.Finance) {
          this.carrier.balance = e.Finance.CarrierBalance ?? this.carrier.balance ?? 0;
          this.carrier.reserve = e.Finance.ReserveBalance ?? this.carrier.reserve ?? 0;
        }
        if (typeof e.FuelLevel === 'number') this.carrier.fuel = e.FuelLevel;
        break;

      case 'Scan': {
        const parts = bodyBaseValue(e);
        if (!parts) break;
        const key = `${e.SystemAddress}:${e.BodyID}`;
        if (this._bodies.has(key)) break;          // avoid double-counting re-scans
        const fd = e.WasDiscovered === false;
        const odyssey = this.game.odyssey !== false;
        const alreadyMapped = this._mappedKeys.has(key);
        const val = alreadyMapped ? mappedValue(parts.base, fd, odyssey) : fssValue(parts.base);
        this._bodies.set(key, { base: parts.base, fd, mapped: alreadyMapped, value: val });
        this.dataHeld.explorationValue += val;
        this.dataHeld.bodiesScanned += 1;
        if (fd) this.dataHeld.firstDiscoveries += 1;
        if (alreadyMapped) this.dataHeld.bodiesMapped += 1;
        break;
      }
      case 'SAAScanComplete': {
        const key = `${e.SystemAddress}:${e.BodyID}`;
        const b = this._bodies.get(key);
        const odyssey = this.game.odyssey !== false;
        if (b && !b.mapped) {
          const nv = mappedValue(b.base, b.fd, odyssey);
          this.dataHeld.explorationValue += (nv - b.value);
          b.value = nv; b.mapped = true;
          this.dataHeld.bodiesMapped += 1;
        } else if (!b) {
          this._mappedKeys.add(key);              // Scan will arrive later
        }
        break;
      }
      case 'ScanOrganic': {
        if (e.ScanType !== 'Analyse') break;              // only completed samples are sellable
        const base = organicValue(e.Genus_Localised || e.Genus, e.Species_Localised || e.Species);
        // First Footfall pays x5. Assume it when we know the body was first-discovered
        // by this commander, and default to x5 in deep space when unknown.
        const b = this._bodies.get(`${e.SystemAddress}:${e.Body}`);
        const firstFootfall = b ? b.fd : true;
        this.dataHeld.organicPending += 1;
        this.dataHeld.exobiologyBase += base;
        this.dataHeld.exobiologyValue += base * (firstFootfall ? 5 : 1);
        break;
      }
      case 'SellExplorationData':
      case 'MultiSellExplorationData':
        this.resetExplorationHeld();
        this.pushFeed(e.timestamp, e.event, `Sold exploration data${typeof e.TotalEarnings === 'number' ? ` (+${e.TotalEarnings.toLocaleString('en-US')} CR)` : ''}`);
        break;
      case 'SellOrganicData':
        this.resetExobiologyHeld();
        this.pushFeed(e.timestamp, e.event, 'Sold organic data at Vista Genomics');
        break;
      case 'Died':
        this.resetExplorationHeld();
        this.resetExobiologyHeld();
        break;

      default:
        break;
    }
  }

  resetExplorationHeld() {
    this.dataHeld.explorationValue = 0;
    this.dataHeld.bodiesScanned = 0;
    this.dataHeld.bodiesMapped = 0;
    this.dataHeld.firstDiscoveries = 0;
    this._bodies.clear();
    this._mappedKeys.clear();
  }

  resetExobiologyHeld() {
    this.dataHeld.organicPending = 0;
    this.dataHeld.exobiologyValue = 0;
    this.dataHeld.exobiologyBase = 0;
  }

  pushFeed(t, event, text) {
    this.feed.push({ t: t || null, event, text });
    if (this.feed.length > 120) this.feed.shift();
  }

  // ---- live status files --------------------------------------------------
  applyStatus(status) {
    if (!status) return;
    if (typeof status.Balance === 'number') this.balance = status.Balance;
  }

  setRoute(navRouteJson) {
    if (navRouteJson && Array.isArray(navRouteJson.Route)) {
      this.route = navRouteJson.Route.map((r) => ({
        StarSystem: r.StarSystem, StarClass: r.StarClass, StarPos: r.StarPos,
      }));
    } else {
      this.route = [];
    }
  }

  // ---- derived ------------------------------------------------------------
  netWorth() {
    const cash = this.balance || 0;
    const shipValue = (this.ship.hullValue || 0) + (this.ship.modulesValue || 0);
    const storedShipsValue = this.storedShipsValue || 0;
    const carrierBalance = (this.carrier && this.carrier.balance) || 0;
    const total = cash + shipValue + storedShipsValue + carrierBalance;
    return { cash, shipValue, storedShipsValue, carrierBalance, total, statWealth: this.statWealth };
  }

  navigation() {
    const current = this.location.system;
    const destination = this.route.length ? this.route[this.route.length - 1].StarSystem
      : (this.nav.targetSystem || null);
    return {
      current,
      destination,
      nextJump: this.nav.targetSystem || null,
      remainingJumps: this.nav.remainingJumps,
      routeLength: this.route.length,
    };
  }

  snapshot() {
    return {
      commander: this.commander,
      game: this.game,
      ship: this.ship,
      balance: this.balance,
      loan: this.loan,
      netWorth: this.netWorth(),
      location: this.location,
      navigation: this.navigation(),
      route: this.route,
      ranks: this.ranks,
      rankProgress: this.rankProgress,
      reputation: this.reputation,
      engineers: this.engineers,
      materials: this.materials,
      carrier: this.carrier,
      storedShips: this.storedShips,
      dataHeld: this.dataHeld,
      stats: this.stats,
      feed: this.feed.slice(-40).reverse(),
      // accumulators the client checklist engine needs
      visited: [...this.visited],
      seenEvents: [...this.seenEvents],
      ownedShips: [...this.ownedShips],
      ownedModules: [...this.ownedModules],
      lastUpdate: this.lastUpdate,
    };
  }
}

// ---- Exploration value estimate ------------------------------------------
// Base cartographic value (before mapping/first-discovery bonuses). Constants
// are the community-reverse-engineered post-3.3 values. Result is an estimate.
function bodyBaseValue(e) {
  if (e.StarType) {
    const m = e.StellarMass || 0;
    const st = String(e.StarType);
    let k = 2880;                                   // regular stars
    if (/^D/.test(st)) k = 33737;                   // white dwarfs (DA, DB, ...)
    else if (st === 'N') k = 54309;                 // neutron stars
    else if (st === 'H' || /black ?hole/i.test(st)) k = 54309; // black holes
    return { base: k + (m * k / 66.25) };
  }
  if (e.PlanetClass) {
    const pc = String(e.PlanetClass).toLowerCase();
    const m = e.MassEM || 0;
    let k = 720;
    if (pc.includes('metal rich')) k = 52292;
    else if (pc.includes('ammonia')) k = 232619;
    else if (pc.includes('class i gas giant')) k = 3974;
    else if (pc.includes('class ii gas giant') || pc.includes('high metal content')) k = 23168;
    else if (pc.includes('water world') || pc.includes('earthlike')) k = 155581;
    let kt = 0;                                     // terraformable bonus
    if (/terraform/i.test(e.TerraformState || '')) {
      if (pc.includes('high metal content')) kt = 241607;
      else if (pc.includes('water world') || pc.includes('earthlike')) kt = 279088;
      else if (pc.includes('rocky body')) kt = 223971;
    }
    const world = (kk) => kk + (3 * kk * Math.pow(m, 0.199977) / 5.3);
    return { base: world(k) + (kt ? world(kt) : 0) };
  }
  return null;
}
function fssValue(base) { return Math.max(Math.round(base), 500); }
function mappedValue(base, firstDiscovered, odyssey) {
  let v = base * (firstDiscovered ? 3.699622554 : 3.3333333333);
  if (odyssey) v *= 1.3;                            // Odyssey mapping bonus
  return Math.max(Math.round(v), 500);
}

// True for real, ownable ships — excludes Apex taxis, SRVs and on-foot suits,
// all of which also emit Loadout events.
function isRealVessel(type) {
  if (!type) return false;
  return !/taxi|testbuggy|_srv|srv_|suit/i.test(String(type));
}

// Copy only numeric top-level fields from an event (used for Rank/Progress/Reputation).
function numericFields(e) {
  const out = {};
  for (const [k, v] of Object.entries(e)) {
    if (k === 'timestamp' || k === 'event') continue;
    if (typeof v === 'number') out[k] = v;
  }
  return out;
}
