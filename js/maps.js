// Map definitions. Pick one with ?map=<id> (default 'test') or the Map dropdown. Everything that used to assume the
// 120 m test field reads MAP instead: size/bounds, terrain height, fog, start, scenery, structure layout, spawns.
// Classic script sharing one global scope with the other js/ files; load order is set in index.html.

// Placeholder town: a street grid of sheds and low walls around a central plaza. Stand-in until real
// multi-piece buildings exist; it's here to exercise the big map, chunked terrain and lots of structures.
function townStubLayout(seed){const r=rng(seed),L=[],SP=26;
  for(let bx=-2;bx<=2;bx++)for(let bz=-2;bz<=2;bz++){if(bx===0&&bz===0)continue;const cx=bx*SP,cz=bz*SP;
    [[-5,-5],[5,-5],[-5,5],[5,5]].forEach(([ox,oz])=>{if(r()<.75)L.push({k:'shed',x:cx+ox+(r()-.5)*2,z:cz+oz+(r()-.5)*2,rot:(r()<.5?0:PI/2)+(r()-.5)*.15})});
    if(r()<.5){const side=r()<.5?-1:1;L.push({k:'wall',x:cx,z:cz+side*10,rot:0,w:12+r()*4})}
    if(r()<.3){const side=r()<.5?-1:1;L.push({k:'wall',x:cx+side*10,z:cz,rot:PI/2,w:10+r()*4})}}
  return L}

const MAPS={
  test:{name:'Test field',size:120,seed:7,fog:[22,75],start:{x:0,z:0,h:0},
    height:()=>0,
    scenery:{n:34,rMin:8,rMax:34,keepClear:(x,z)=>x>0&&Math.abs(z)<6}, // keep the target lane clear
    targets:true,
    layout:[
      {k:'wall',x:26,z:0,rot:PI/2,w:10},{k:'wall',x:-14,z:14,rot:0,w:8},{k:'wall',x:10,z:-22,rot:.4,w:10},
      {k:'wall',x:-24,z:-12,rot:PI/2+.3,w:8},{k:'wall',x:34,z:26,rot:-.6,w:8},{k:'wall',x:-38,z:6,rot:PI/2,w:7.5},
      {k:'shed',x:-30,z:24,rot:.2},{k:'shed',x:20,z:30,rot:-.3},{k:'shed',x:36,z:-28,rot:.5},{k:'shed',x:-8,z:-34,rot:0}],
    spawn:{ring:46,minDist:32}},
  town:{name:'Town (WIP)',size:360,seed:11,fog:[30,120],start:{x:-140,z:0,h:0},
    // flat town core, rolling junkland hills outside ~80 m
    height:(x,z)=>{const k=ss(cl((Math.hypot(x,z)-80)/40));return k*(2.5*Math.sin(x*.031+1)*Math.cos(z*.027)+1.5*Math.sin((x-z)*.045)+.8*Math.sin(x*.11)*Math.sin(z*.09))},
    scenery:{n:260,rMin:72,rMax:170,keepClear:(x,z)=>Math.hypot(x+140,z)<12}, // keep the start clear
    targets:false,
    layout:townStubLayout(11),
    spawn:{ring:150,minDist:60}}};

const MAP_ID=MAPS[new URLSearchParams(location.search).get('map')]?new URLSearchParams(location.search).get('map'):'test',MAP=MAPS[MAP_ID];
const HALF=MAP.size/2,PLAY=HALF-3; // map half-extent; vehicles stay inside ±PLAY, shells stop at ±(HALF-2)
sc.fog.near=MAP.fog[0];sc.fog.far=MAP.fog[1];
