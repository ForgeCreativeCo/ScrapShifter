# Sound sources

Recorded effects, renamed from the downloaded files. After adding or replacing one, run `node tools/pack-sfx.js` to rebuild `js/sfxdata.js`.

| File | Original download | Used for |
|---|---|---|
| explosion-a.mp3 | freesound_community-explosion-42132 | mid explosions (cars, crawlers, foundry); pitched up and cut short for small shells |
| explosion-b.mp3 | soundreality-explosion-fx-343683 | mid explosions (alternates with A); slowed down for building collapses |
| explosion-big.mp3 | dragon-studio-loud-explosion-425457 | heavy artillery shell impacts |
| gun-shot.mp3 | u_f09vejvoga-gun-shot-350315 | buggy cannon; clipped and pitched up for mech rapid fire (4 shots sliced, `SFX_CUT.gun`) |
| tank-shot.mp3 | freesound_community-053893_tank-shots-86181 | artillery firing (3 shots sliced, `SFX_CUT.tank`); pitched up for crawler guns |
| tank-moving.mp3 | dennish18-tank-moving-143104 | crawler tread loop (by distance and speed) |
| turret-rotate.mp3 | freesound_community-tank-turret-rotate-14879 | artillery turret loop while traversing or elevating |
| transform-a.mp3 | freesound_community-transformation-3-100340 | transforming into or out of mech |
| transform-b.mp3 | freesound_community-robotic-transform-1-103289 | buggy ↔ artillery |
| mech-step.mp3 | freesound_community-mech_step_001-87175 | mech footfalls |
| drone.mp3 | 11325622-drone-fx-240233 | spotter drone hover loop (4–7.1 s), placed at the drone |
| minigun.mp3 | u_w4utmqapnm-mini-gun-154177 | artillery defence turrets: steady fire looped (0.45–2.6 s), wind-down tail (from 2.62 s) when they stop |
| bomb-drop.mp3 | freesound_community-bomb-dropping-101151 | gyro bomb whistle: the last fall-time seconds before its peak at 4.8 s, so it peaks on impact |
| siren.mp3 | freesound_community-siren-alert-96052 | overheat alarm for mech and gyro, looped (0.8–6.35 s) until the heat drops to 35 |

## Music and ambience (sfx/music, packed into js/musicdata.js, loaded after start by maps with `audio`)

| File | Original download | Used for |
|---|---|---|
| city-ambience.mp3 | km007-city-ambience-9265 | town background ambience, looped |
| music-total-war.mp3 | audioatlant-total-war-epic-action-cinematic-trailer-short-1-513667 | town music, alternates with revolution, 25–45 s gap between tracks |
| music-revolution.mp3 | audioatlant-revolution-epic-action-cinematic-trailer-short-1-494839 | town music |
