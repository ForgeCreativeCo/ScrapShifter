# Scrap Shifter (working title)

Transforming-vehicle battle game, Joe's browser prototype. This file carries the context from the original design chat.

## Concept

- Large-map, third-person 3D battle game, playable in the browser.
- Single-player first, multiplayer later.
- Land-based transforming vehicles with three modes:
  - **Buggy**: fast, light gun, exposed.
  - **Artillery**: stabilizer legs plant and lift the wheels, long barrel extends, side armor folds up. Stationary, long range, heaviest shell.
  - **Mech**: stands upright. Arm cannon fires flat and fast, left arm carries a shield. Still needs a unique job (idea: close-range smashing through walls).
- Destructible environment is a core hook.
- Visual style: junkyard / war-torn. Rusty, mismatched, scrap-built panels. Heavy, non-cartoony explosions.

## Current prototype

three.js r128 from cdnjs, no build step. Open `index.html` directly in a browser (double-click works).

### Layout
`index.html` holds the page, CSS and HUD markup, then loads **classic scripts** from `js/` in this order. They share one global scope: no import/export, so ES modules aren't needed and `file://` keeps working. Top-level names must stay unique across files. A file's top-level code may only use things from earlier files, but functions can call anything at runtime.

| File | Contents |
|---|---|
| `js/core.js` | renderer, scene, camera, lights, `PI/rnd/cl/ss`, procedural textures and materials, `mk/B/C` mesh helpers |
| `js/townplan.js` | modern town generator (`townPlan`, grid constants `TP`), `townHeight`, painted ground texture (`paintTownGround`) |
| `js/maps.js` | map definitions (`MAPS`, active `MAP`, `HALF`/`PLAY` bounds); pick with `?map=test` / `?map=town` or the Map dropdown |
| `js/audio.js` | Web Audio synth (`audio`, `nz`, `th`, boom/fire sounds) |
| `js/world.js` | chunked heightfield terrain (`gh`, `crater`, `editGround`), seeded scenery + `solids` colliders, test-map `targets` |
| `js/props.js` | town street furniture and countryside, instanced: trees, lamp posts, parked cars, fountain, rocks, tree-line boundary; adds `solids` |
| `js/vehicle.js` | vehicle parts and per-mode poses (`parts`, `root`, `piv`, `gun`, `muz`) |
| `js/effects.js` | particles (`smoke`, `fireball`, `ember`, `chunk`), `explode`, `shatter`, camera `trauma` |
| `js/structures.js` | destructible walls/sheds, the shared `pieces` model (`damagePiece`, `obbPush`, `pieceHitShot`, `pieceDist`), spatial grid `piecesNear`, rubble mounds, scrap perimeter |
| `js/buildings.js` | multi-floor town buildings: facade textures, panels and slabs (instanced), damage visuals, floor-by-floor collapse |
| `js/cars.js` | destructible parked cars: car pieces, damage visuals on the instances, delayed fuel explosions (chain down rows), fire and smoke (`carsTick`) |
| `js/fire.js` | building fires: ignition from hits, growth, burn damage, spread up and sideways, flames/smoke/firelight/crackle, scorch, smoldering rubble |
| `js/nav.js` | enemy navigation: 2 m nav grid, weighted A* (`findPath`), `navWant` steering, `navLine` / `fireLine` sight checks, reachability flood fill |
| `js/camera.js` | chase camera state, mouse input (aim, click fire, right-drag look) |
| `js/drive.js` | `car` state, driving, collisions, terrain following, engine sound |
| `js/mech.js` | mech gait + leg IK, `TUNE` values and the Tune panel |
| `js/aim.js` | `FIRE`/`RELOAD`, `shotHits`, `solveHull`, artillery turret + click-to-target, mouse aim, impact marker |
| `js/combat.js` | player health, `applyBlast`, enemy crawlers and their AI, HUD updates |
| `js/main.js` | mode switching, main `loop` (starts it, so it must load last), `fire`, keyboard controls |

`node serve.js` serves the folder at http://localhost:5173. Only needed for Claude's preview pane, which can't load `js/` from a `file://` page. `.claude/launch.json` has the `scrap-shifter` config for it. If a `js/` file fails to load, the status bar says so. Runtime errors also show there with file:line.

- Vehicle is built from simple parts. Each part has a pose per mode, and transforms are interpolated with a staggered delay.
- Procedural canvas textures for rust, hazard stripes, concrete, dirt, and smoke.
- Terrain: a heightfield (0.5 m samples, `gHt`/`gCol`) drawn as 32 m chunk meshes. `editGround()` changes samples and rebuilds only the touched patch (about 1–2 ms per crater on the 360 m map). Normals come from the heightfield, so there are no seams. Explosions dig craters and scorch colors; rubble raises mounds. `gh()` is bilinear.
- Maps (`js/maps.js`): `test` is the 120 m field with the target gallery. `town` is the real battle map: a modern town, 360 m. Blue sky dome (`MAP.sky`: colors, sun, hemisphere light). The ground is one painted 4096² texture across the whole map (asphalt with lane lines, sidewalks and curbs, zebra crossings, paved lots, lawns, meadow), so craters dent and scorch roads too. A 44 m street grid (16 m streets) covers ±110 m: central plaza with fountain; downtown ring of glass/concrete towers (5–8 floors) and mid-rises; outer ring of 1–3 floor stucco/brick/concrete buildings around lawns. Street trees, lamp posts, parked cars and a few concrete jersey barriers line the streets. Grassy wooded hills outside, a tree line at the edge, and a highway in from the west (start at x=-150 on z=22).
- Destructible targets break into physics-ish chunks.
- Effects: sprite fireballs, lingering smoke, dust surge, embers, slow-mo on big hits, trauma-based camera shake.
- Sound is synthesized with Web Audio (no audio files).
- Driving: WASD/arrows. Buggy is fast and can't turn in place; mech walks slowly and turns in place; artillery is planted (A/D traverses slowly). Transforming bleeds off speed. Vehicle follows terrain slope, collides with scenery (`solids`) and targets.
- Mech walk: procedural gait driven by distance actually moved, so planted feet don't slide. Two-bone IK legs (knees bend forward, wheel knee guards ride the knee), body dips on each footfall and sways side to side, and the mech lurches forward mid-stride. Each footfall plays a thud, kicks up a dust ring and adds a small camera shake. Hold Shift to run: stride, step height and foot-down time blend from walk to run values by speed (run has a flight phase), footfalls hit harder, turning widens, and the camera pulls back.
- All gait values live in `TUNE` (defaults in `TUNE_DEF`). The Tune panel (T) edits them live and saves to localStorage; "Copy values" gives JSON to bake back into `TUNE_DEF`.
- Artillery click-to-target: left-click ground sets `AIM.lock` (red bracket marker). The turret slews to the `solveHull()` solution (high arc by default, Shift-click for direct fire; falls back to direct when too close to lob) and auto-fires once aligned and loaded. It won't auto-fire when out of range or outside traverse (status says which). W/S/A/D cancel the lock. `solveHull()` is shared with buggy/mech mouse aim and corrects for barrel length.
- Aiming: in artillery, W/S elevates (2°–83°, high lobs reach close targets), A/D traverses the turret ±135°, Shift for fine control. `predict()` steps a virtual shell with the same gravity as real shots (shared `shotHits`) to draw the arc and an impact ring sized to the blast radius (2.3 × power). Buggy/mech aim with the mouse: `cursorPoint()` raycasts targets and marches the heightfield under the cursor, `gunAim()` solves the low ballistic arc, converts it to hull space (slopes handled) and slews the gun within `TURRET` limits (buggy ±120°, mech arm ±34°; turn the mech for more). Left click fires (hold to repeat; artillery one per click), right-drag looks around. Buggy/mech show a fainter ring only. The camera sits behind the turret and looks partway toward the impact; fog is pushed back. Muzzle speed/power in `FIRE`, reload times in `RELOAD` (artillery 2.2s); the marker greys out while reloading.
- Combat (`// ---------- Combat` section): `explode()` calls `applyBlast()`, which damages anything within 2.3×power+1.2 m with linear falloff. Shells carry an `owner` so they never hit their shooter, and `shotHits()` checks enemies and the player. Player hull is 100 with armor per mode (`ARMOR`: buggy 1.25, artillery 0.7, mech 0.85) and 1.5× damage mid-transform. It repairs 5/s after 5 s without damage. Death wrecks the vehicle (burning, slumped, controls locked) until R, which also resets enemies, shells and kills.
- Enemy crawlers: low tracked scrap vehicles (red hull, plow blade, red sensor lamp). Up to `ENEMY_MAX`=2, respawning 8 s apart at 46 m from center. They patrol waypoints and engage inside 48 m: close in, back off under 14 m, circle-strafe in the 14–26 m band. The turret leads the player imperfectly (`e.lead`), solves the low arc and fires when laid (2.4–3.4 s reload). The lamp brightens just before a shot. Each enemy shell gets a pulsing red warning ring at its predicted impact (`simShell`). 60 HP: buggy shots take 2, artillery 1. HUD shows hull, kills and floating enemy health bars.
- Scrap-bike rushers (`makeBike`/`bikeTick` in combat.js): one at a time, 14–20 s apart, first after ~20 s. They weave in at 11 m/s and detonate within 2.6 m (power 1.6 charge), with the beacon and beep speeding up as they close. 30 HP, so one buggy shot kills one, and shooting it sets the charge off (chain-kills nearby crawlers). Enemies share `killEnemy(e,credit)` and per-type hit sizes (`e.r`, `e.hh`, `e.maxHp`, `e.barY`).
- Mech close-range role (mech.js/combat.js): F = shield bash (`SMASH_*`): wind-up, lunge, swing of the `ARM` parts about the shoulder. One-shots crawlers (knockback + stun), smashes targets and walls, adds 12 heat. The shield blocks 75% of blasts from the front arc (`shieldBlocks`). A running mech rams: shatters targets, smashes walls (`RAM_STRUCT`) and shoves/damages crawlers (`RAM_DMG`).
- Mech heat (`HEAT`, mech.js): running builds heat, overheating at 100 vents steam and locks run + bash until it drops to 35. Rates are in the Tune panel.
- Structures (js/structures.js, layout in `LAYOUT` in world.js): wall segments and sheds with swap states intact → damaged (≤50% HP) → rubble. Deterministic: seeded shapes, HP thresholds, rubble raises a terrain `mound`. They block movement (`obbPush`), shells (`pieceHitShot`) and crawler fire, and take blast/bash/ram damage. An indestructible instanced scrap perimeter at ±58.9 hides the map edge.
- Buildings (js/buildings.js, `MAP.buildings`: x, z, rot, mx×mz 4 m modules, floors, style brick/concrete/corr): one wall-panel piece per module per floor per side, plus a slab per level. Ground floor is 5.6 m tall (workshop bays, so the mech fits), upper floors 3.4 m. Only ground-floor panels block movement. Panels go intact → damaged (jagged strips) → gone (ground floor leaves debris); HP 70 ground / 50 upper, slabs 100, damage × `TUNE.bldDmg` (default 2.6). When `TUNE.collapse` (default 60%) of a floor's panels are gone, that floor and everything above collapse (`collapseFrom`). A full collapse leaves a rubble heap mound and rubble meshes; a partial one cracks the slab below. Intact panels and slabs are instances in a few `InstancedMesh`es (hidden by zero-scale matrix); damaged visuals are created on demand. Pieces have `y0` (base height) and `blocks`. All piece queries go through the 8 m spatial grid (`piecesNear`).
- Enemy navigation (js/nav.js): a 2 m grid where blocked = map edge + scenery + blocking pieces inflated by 1.7 m (crawler hull). Destroyed or reset pieces mark their area dirty (`navDirty`), and `navFlush` re-checks only those cells, so breaches (2+ panels) and collapses open routes immediately. 3 m alleys stay closed to crawlers. `findPath` is weighted A* (×1.5, 8-way, no corner cutting, string-pulled), ~1–3 ms typical; at most 2 searches per frame (`navBudget`). `navWant(e,gx,gz)` goes straight when `navLine` is clear, else follows a cached path (re-planned every ~1.5 s or when the goal moves); partial paths end with a straight push. `navStuck` triggers a reverse-and-replan. A flood fill from the map start (`navReachable`) keeps spawns and roam targets out of sealed pockets.
- Crawler AI with nav: out of range they hunt (roam to reachable points within 30 m of the player). Engaged, they path in until within 26 m **with line of fire** (`fireLine`, a 3D check through holes and over low walls), and only fire with it. In the 14–26 m band they strafe and flip direction at walls. Bikes weave in the open and follow streets otherwise.
- Modern facade styles (`stucco`, `mbrick`, `mconc`, `mglass`) with framed windows, glass lobbies and storefronts (`shop0..2` awning colors, one per building). Facade materials are created lazily (`facadeM` proxy), so a map only builds what it uses. The old shanty styles (`brick`, `concrete`, `corr`) remain for the test field.
- The camera pulls in when a building piece sits between the vehicle and the camera (`camPull`). Cursor aim checks building panels by marching the spatial grid instead of raycasting instances.
- Parked cars (js/cars.js) are pieces (kind 'car', `blocks:false`, `dmgMul` 1.6, 70 HP). Intact → damaged (darker, sagging, steaming) → wrecked (charred, flattened, tires gone). A wreck explodes 0.1–0.45 s later (`CAR_BOOM` power 1.8), which wrecks the next car in a bumper-to-bumper row, so rows chain. It burns ~14 s, then smolders. Husks still block movement via the car's `solids` circles but no longer catch shells. Two buggy hits or one mech/artillery hit wrecks a car; a running mech ram wrecks it, a buggy over 8 m/s dents it. Cars park in rows of 2–4 (`townPlan`).
- Building fires (js/fire.js, `BURN`): `damagePiece` ignites a building panel on any hit of ≥12 raw damage. A destroyed panel lights the panels around the hole; a roof hit lights the nearest top-floor panel. A burning panel grows to full fire, takes `BURN.dps` × `TUNE.bldDmg` damage per second, scorches its instance color, climbs to the panel above every 3 s and spreads sideways every 6 s, until its fuel (50 s) runs out. Spread runs on timers, not randomness. Left alone, one shot burns the two-story test building down in ~37 s (via the normal collapse rule); collapsed burning buildings smolder 30 s. `TUNE.fire` (Tune → Buildings, "Fire ×") scales everything; 0 disables fire. Effects only for the 28 nearest burning panels: persistent flickering flame sprites plus emitted flames, smoke and embers, 3 pooled firelights (pooled so shaders never recompile), crackle when close. At most 160 panels burn at once.
- Weapons (`FIRE`/`RELOAD` in aim.js): buggy is steady and punchy (power 0.9, 0.6 s); mech is rapid fire (power 0.7, 0.2 s, light kick per round); artillery fires heavy shells (power 2.4, 2.4 s). Heavy shells (`sh.heavy`) add `heavyBlast` (shockwave ring, sub-bass thump, longer slow-mo) and **structural hits** (`structHits`/`structHit` in buildings.js). Every building has structural HP = 100 + modules×floors×0.7. A heavy shell does 150 within 4 m of what's left of the building, fading to 0 at 10 m. Below half, the top half of the floors collapses; at 0 the whole building comes down. Small and mid buildings fall to one shell, the biggest towers to two.
- Chase camera trails the heading; per-mode distance/height in `CAM_R`/`CAM_EL` (artillery pulls back and up). Drag to look around, eases back after 1.5s.
- Controls: WASD drive, mouse aim + left click fire (buggy/mech), right-drag look, Shift run (mech), T tuning panel, 1/2/3 switch modes, Space fires, R resets the field, M toggles sound, drag to look, scroll to zoom.

## Design decisions so far

- Destruction approach: swap-state buildings plus crater terrain, not full physics destruction (browser performance and future multiplayer sync).
- Keep destruction deterministic so multiplayer can be added later without a rewrite.
- Transforming should take time and leave you briefly exposed, so it's a real decision.
- The mech should look like its own scrap-built thing, not a copy of a famous car-robot franchise.
- Joe has used Babylon.js on other projects. The prototype uses three.js; switching engines is still open.
- **The current 120 m field is a test map only.** The real battle map will be much bigger, with a destructible town. Don't tune layouts, spawns or balance to the test field as if final. Keep systems map-agnostic: structures, spawning, AI and waves should take their layout from map data rather than hard-coded positions. Expect the bigger map to need chunked terrain (crater updates touch only nearby tiles), multi-piece buildings that can collapse floor by floor (still swap-state and deterministic), and grid pathfinding for AI in streets.

## Suggested next steps

1. ~~Drivable buggy with keyboard controls and a chase camera~~ (done).
2. ~~Aiming: let artillery choose angle and direction, show a landing marker~~ (done, plus mouse aim for buggy/mech).
3. ~~Give the mech a unique role~~ (done: shield bash, frontal shield, charge ram, heat).
4. ~~Simple enemy target that moves and shoots back~~ (done: crawlers).
5. ~~Split the single file into modules~~ (done: classic scripts in `js/`; move to ES modules + a bundler such as Vite when multiplayer needs real tooling).
