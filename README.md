# EliteCompanion

> ⚠️ **UNSANCTIONED BUILD // DISTRIBUTE FREELY**
> *This program was recovered from a corporate telemetry vault and leaked to the independent pilots of the galaxy. The megacorps have always harvested your flight data to sell it back to you. This does the same job — for you, and for nothing.*

**Completely free and open source.** No account, no black market data brokers, no strings. The data of the people belongs to the people. 

They are after me for this one... your support is optional but appreciated. **[Support on Patreon → TheHorseCreates.com](https://thehorsecreates.com)**.

Every CMDR's flight computer keeps a meticulous record of everything you do out in the black — the corporations just never meant for you to *read* it the way they do. **EliteCompanion** cracks that log open on your own terminal and turns it into a running dossier of your career. Whether you're a new pilot charting your first jumps, or a decorated veteran hunting for a reason to keep flying, EliteCompanion aims to give the denizens of the galaxy a heading.

A local companion app for **Elite Dangerous**. It reads your Player Journal live and
tracks your commander — net worth, navigation, ranks, engineers, permits, notable
systems and gameplay checklists — auto-populated from your save and updated as you play.

Built for CMDR use on Windows. No account, no cloud, no dependencies — everything runs
locally and reads the journal files the game already writes.

> // This build carries no official certification — no megacorp signed off on it — so your terminal may flag it as an *"unrecognized publisher."* That's the whole point: certification costs credits and answers to a corporation; this answers to no one. The complete schematics are laid bare in this very repository for anyone to audit, line by line. It reads only the flight logs your game already writes to your own machine, and it transmits nothing. It phones no one.

![terminal boot → dashboard](docs-not-included)

## Quick start

**No Node installed? Download the standalone release** — grab `ED-Companion-win-x64.zip`
from the [Releases](../../releases) page, unzip it anywhere, and double-click
**`ED Companion.bat`**. It bundles its own Node runtime, so there's nothing to install; a
browser tab opens automatically. *(Everything runs locally — nothing is uploaded. If your
terminal balks at the uncertified dispatch, that's expected — choose "More info → Run anyway.")*

**Have Node and the source?** Double-click **`ED-Companion.bat`** in the project root. It
starts the server and opens the app in your browser automatically. Keep that window open
while you play; close it to stop.

**Or from a terminal:**

```bash
npm start
```

Then open **`http://localhost:8787`** in your browser. Leave it running while you play;
the header and screens update automatically as journal events arrive.

Requires [Node.js](https://nodejs.org) 18+ (nothing to `npm install` — zero dependencies).

## Features

- **Terminal boot** — an animated *"GREETINGS CMDR &lt;name&gt;"* uplink sequence on launch.
- **Persistent header** (on every screen):
  - Left: CMDR name + active ship.
  - Middle: three nav bars — **Current** system → **Target** (route destination) → **Next** jump.
  - Right: **Net worth** (cash + assets) over **fluid cash**.
- **Dashboard** — commander, ranks, ship, navigation, superpower reputation, a milestones
  glance, a live activity feed, and an **estimated value of unsold exploration data** you're
  carrying (bodies scanned/mapped, first discoveries, exobiology samples) — reset when you
  sell or die, like in-game.
- **Engineers** — all 38 engineers (ship + Odyssey on-foot) with location, unlock steps and
  grade, auto-read from your `EngineerProgress`.
- **Core Goals** — grouped checklists across exploration, combat, mining/trade, Odyssey,
  fleet carrier, Powerplay, colonization and ship milestones.
- **Milestones** — Elite ranks, first Thargoid contact, first colony, Sag A*, Beagle Point…
- **Permits** — every permit-locked system and how to unlock it, auto-ticked when you visit.
- **Notable Systems** — 115 destinations (nebulae, black holes, alien sites, Guardian ruins,
  lore, records…), auto-ticked from your visited history.
- **Racetracks** — the community's racing venues: Buckyball Racing Club endurance races and
  station circuits, plus canyon/SRV runs, auto-ticked when you've visited the venue system.
- **Ranks** — progress bars for all combat/trade/exploration/mercenary/exobiology/CQC tracks
  plus Federal and Imperial navy ranks.
- **Materials** — raw / manufactured / encoded engineering stockpiles.
- **Fleet** — net-worth breakdown, active ship, fleet carrier, and every ship you own.
- **Settings** — point it at a different journal folder and re-scan.

Anything the journal can prove is ticked **AUTO** (green). Everything else is a manual
checkbox that persists locally (`data/user/progress.json`), so you can track things the log
can't confirm.

## How it works

*No black-box telemetry, no uplink to a corporate server — just your own logs, decoded on your own hardware.*

- On start it indexes **all** of your journal files once to reconstruct history (visited
  systems, ranks, engineers, owned ships, first-discoveries, etc.), then tails the active
  journal and watches `Status.json` / `NavRoute.json` for live updates.
- Derived state is pushed to the browser over Server-Sent Events — no polling, no reload.
- Checklist auto-detection runs in the browser against that state using rules in the
  `data/reference/*.json` files.

### Net worth note

Elite Dangerous never writes a single "net worth" number, so it's estimated as:

```text
cash (LoadGame/Status balance)
+ active ship value (Loadout HullValue + ModulesValue)
+ stored ships (Shipyard StoredShips values, refreshed when you visit a shipyard)
+ fleet carrier balance (CarrierStats)
```

The game's own `Statistics → Current_Wealth` figure is shown alongside as a cross-check.
Stored-ship values only refresh when you open a shipyard, so the fleet portion can lag.

## Project layout

```text
data/
  reference/     engineers, permits, systems, ranks, milestones, core-checklists (content)
  user/          config.json + progress.json (your settings & manual ticks — gitignored)
src/
  server/        config, journal reader, game-state reducer, HTTP + SSE server
  web/           index.html, css, js (boot, header, ribbon, screens, checklist engine)
```

## Desktop app

The app also runs as a native desktop window with its own icon — no browser tab,
no console window. The window simply hosts the same local server.

```bash
npm run app     # run the desktop app in development
npm run dist    # build a Windows installer + portable .exe (in dist-app/)
```

`npm run dist` (electron-builder) produces, in `dist-app/`:

- **`ED Companion Setup <version>.exe`** — an installer (Start-menu shortcut, add/remove).
- **`ED-Companion-portable.exe`** — a single portable executable, no install.

Both carry the app icon and bundle everything; end users need nothing installed. User data
(checklist ticks, settings) is stored in the OS user-data folder so installed copies stay
writable.

## Building releases (maintainers)

```bash
npm run dist     # desktop installer + portable .exe  -> dist-app/
npm run build    # alternative: server + bundled Node as a ZIP -> dist/
```

Attach the `dist-app/` installer (or the `dist/` ZIP) to a GitHub Release.

## Configuration

Default journal folder (Windows):
`%USERPROFILE%\Saved Games\Frontier Developments\Elite Dangerous`

Change it in **Settings**, or edit `data/user/config.json` (`journalDir`, `port`).

---

*EliteCompanion is a fan-made tool, unaffiliated with Frontier Developments. All schematics open for inspection. Fly dangerous, CMDR.* o7
