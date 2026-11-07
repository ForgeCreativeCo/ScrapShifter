// Map definitions. Pick one with ?map=<id> (default 'test') or the Map dropdown. Everything that used to assume the
// 120 m test field reads MAP instead: size/bounds, terrain height, fog, start, scenery, structure layout, spawns.
// Classic script sharing one global scope with the other js/ files; load order is set in index.html.

// Town: a 5x5 grid of 30 m blocks around a central plaza, with ~14 m streets between blocks.
// Each block holds one big building or two smaller ones (1-3 floors, taller near the centre), plus scrap clutter:
// backyard sheds and barricade walls half-blocking streets. Seeded, so every player gets the same town.
function townLayout(seed){const r=rng(seed),bld=[],lay=[],SP=30,style=()=>STYLES_ALL[Math.floor(r()*3)];
  for(let bx=-2;bx<=2;bx++)for(let bz=-2;bz<=2;bz++){const cx=bx*SP,cz=bz*SP;
    if(bx===0&&bz===0){[[-9,0,PI/2],[9,0,PI/2],[0,-9,0]].forEach(([x,z,rot])=>{if(r()<.7)lay.push({k:'wall',x,z,rot,w:6+r()*3})});continue} // plaza barricades
    const ring=Math.max(Math.abs(bx),Math.abs(bz)),maxF=ring===1?3:2,rot=(r()-.5)*.05,fl=()=>1+Math.floor(r()*maxF);
    if(r()<.45)bld.push({x:cx,z:cz,rot,mx:3+Math.floor(r()*2),mz:2+Math.floor(r()*2),floors:fl(),style:style()});
    else{const st=style();[-5.5,5.5].forEach(o=>bld.push({x:cx+o,z:cz+(r()-.5)*3,rot,mx:2,mz:2+Math.floor(r()*2),floors:fl(),style:r()<.7?st:style()}))}
    if(r()<.35)lay.push({k:'shed',x:cx+(r()<.5?-1:1)*11,z:cz+(r()<.5?-1:1)*10.5,rot:(r()-.5)*.3});
    if(r()<.25)lay.push({k:'wall',x:cx+15,z:cz+(r()-.5)*6,rot:PI/2,w:5+r()*3}); // half-blocks the street to the east
  }
  return{buildings:bld,layout:lay}}
const STYLES_ALL=['brick','concrete','corr'],TOWN=townLayout(11);

const MAPS={
  test:{name:'Test field',size:120,seed:7,fog:[22,75],start:{x:0,z:0,h:0},
    height:()=>0,
    scenery:{n:34,rMin:8,rMax:34,keepClear:(x,z)=>x>0&&Math.abs(z)<6}, // keep the target lane clear
    targets:true,
    buildings:[{x:-14,z:-22,rot:0,mx:3,mz:2,floors:2,style:'brick'}], // one test building to shoot at
    layout:[
      {k:'wall',x:26,z:0,rot:PI/2,w:10},{k:'wall',x:-14,z:14,rot:0,w:8},{k:'wall',x:10,z:-22,rot:.4,w:10},
      {k:'wall',x:-24,z:-12,rot:PI/2+.3,w:8},{k:'wall',x:34,z:26,rot:-.6,w:8},{k:'wall',x:-38,z:6,rot:PI/2,w:7.5},
      {k:'shed',x:-30,z:24,rot:.2},{k:'shed',x:20,z:30,rot:-.3},{k:'shed',x:36,z:-28,rot:.5},{k:'shed',x:-8,z:-34,rot:0}],
    spawn:{ring:46,minDist:32}},
  town:{name:'Town',size:360,seed:11,fog:[30,120],start:{x:-140,z:0,h:0},
    // flat town core, rolling junkland hills outside ~80 m
    height:(x,z)=>{const k=ss(cl((Math.hypot(x,z)-80)/40));return k*(2.5*Math.sin(x*.031+1)*Math.cos(z*.027)+1.5*Math.sin((x-z)*.045)+.8*Math.sin(x*.11)*Math.sin(z*.09))},
    scenery:{n:260,rMin:72,rMax:170,keepClear:(x,z)=>Math.hypot(x+140,z)<12}, // keep the start clear
    targets:false,
    buildings:TOWN.buildings,
    layout:TOWN.layout,
    spawn:{ring:150,minDist:60}}};

const MAP_ID=MAPS[new URLSearchParams(location.search).get('map')]?new URLSearchParams(location.search).get('map'):'test',MAP=MAPS[MAP_ID];
const HALF=MAP.size/2,PLAY=HALF-3; // map half-extent; vehicles stay inside ±PLAY, shells stop at ±(HALF-2)
sc.fog.near=MAP.fog[0];sc.fog.far=MAP.fog[1];
