// Map definitions. Pick one with ?map=<id> (default 'test') or the Map dropdown. Everything that used to assume the
// 120 m test field reads MAP instead: size/bounds, terrain height, fog, start, scenery, structure layout, spawns.
// Classic script sharing one global scope with the other js/ files; load order is set in index.html.

const TOWN=townPlan(11); // modern town (js/townplan.js)

const MAPS={
  test:{name:'Test field',size:120,seed:7,fog:[22,75],start:{x:0,z:0,h:0},
    // dusty overcast junkyard day
    sky:{top:0x6f747c,horizon:0xb5a993,ground:0x7d7262,fog:0x9C9384,sun:[0xFFD9A8,1.7],sunDir:[10,12,8],hemi:[0xD8C8A8,0x3A3428,.75],cloud:.62,grade:{sat:.94,con:1.1,tint:[1.04,1,.94],vig:.32}},
    height:()=>0,
    scenery:{n:34,rMin:8,rMax:34,keepClear:(x,z)=>x>0&&Math.abs(z)<6}, // keep the target lane clear
    targets:true,
    buildings:[{x:-14,z:-22,rot:0,mx:3,mz:2,floors:2,style:'brick'}], // one test building to shoot at
    layout:[
      {k:'wall',x:26,z:0,rot:PI/2,w:10},{k:'wall',x:-14,z:14,rot:0,w:8},{k:'wall',x:10,z:-22,rot:.4,w:10},
      {k:'wall',x:-24,z:-12,rot:PI/2+.3,w:8},{k:'wall',x:34,z:26,rot:-.6,w:8},{k:'wall',x:-38,z:6,rot:PI/2,w:7.5},
      {k:'shed',x:-30,z:24,rot:.2},{k:'shed',x:20,z:30,rot:-.3},{k:'shed',x:36,z:-28,rot:.5},{k:'shed',x:-8,z:-34,rot:0}],
    spawn:{ring:46,minDist:32},
    mission:{nests:1,extract:{x:0,z:0,r:6}}}, // one foundry in the test building, then extract at the start
  town:{name:'Town',size:HALF_T*2,seed:11,fog:[55,205],start:{x:-HALF_T+30,z:TP.HWY_Z,h:0},night:true,
    audio:{ambience:'city-ambience',ambVol:.7,music:['music-total-war','music-revolution'],musVol:.32}, // js/musicdata.js (audio.js musicTick)
    // neon night: near-black sky with stars, the city's magenta haze on the horizon and in the fog, a cold moon as
    // the shadow-casting light. night:true turns on lit windows, neon signs, coloured lamps and the ground glow.
    sky:{top:0x010104,horizon:0x170820,ground:0x07050f,fog:0x130922,sun:[0x8fa8ff,.45],sunDir:[-22,30,26],hemi:[0x5560c8,0x1c1230,.85],
      cloud:.3,cloudCol:0x1c1232,stars:1,exposure:1,bloom:[.9,.6,.7],grade:{sat:1.15,con:1.08,tint:[.98,.97,1.06],vig:.34}},
    height:townHeight,ground:'town',groundNoise:.025,perimeter:'trees',
    scenery:{n:0,rMin:0,rMax:0,keepClear:()=>true}, // no junk scenery; street furniture and trees come from props (js/props.js)
    targets:false,buildings:TOWN.buildings,layout:TOWN.layout,props:TOWN.props,
    spawn:{ring:HALF_T-30,minDist:60},
    // three foundries; then a convoy rolls west along the z=22 street and out the highway; extract by the highway exit
    mission:{nests:3,convoy:{route:[[114,TP.HWY_Z],[-HALF_T+4,TP.HWY_Z]],trucks:3},extract:{x:-HALF_T+22,z:TP.HWY_Z,r:9}}}};

const MAP_ID=MAPS[new URLSearchParams(location.search).get('map')]?new URLSearchParams(location.search).get('map'):'test',MAP=MAPS[MAP_ID];
const HALF=MAP.size/2,PLAY=HALF-3; // map half-extent; vehicles stay inside ±PLAY, shells stop at ±(HALF-2)
sc.fog.near=MAP.fog[0];sc.fog.far=MAP.fog[1];

// Sky colours and light (the sky dome, reflections and post-processing are built in js/render.js)
{const S=MAP.sky;sc.background=new THREE.Color(S.horizon);sc.fog.color.setHex(S.fog);sun.color.setHex(S.sun[0]);sun.intensity=S.sun[1];
  hemi.color.setHex(S.hemi[0]);hemi.groundColor.setHex(S.hemi[1]);hemi.intensity=S.hemi[2];
  cam.far=Math.max(250,MAP.fog[1]+120);cam.updateProjectionMatrix()}
if(MAP.night){rigLamp=new THREE.PointLight(0xcfe0ff,1.5,24,2);sc.add(rigLamp)}
const SUN_DIR=(MAP.sky&&MAP.sky.sunDir)||[10,12,8];
