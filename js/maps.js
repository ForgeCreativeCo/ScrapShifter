// Map definitions. Pick one with ?map=<id> (default 'test') or the Map dropdown. Everything that used to assume the
// 120 m test field reads MAP instead: size/bounds, terrain height, fog, start, scenery, structure layout, spawns.
// Classic script sharing one global scope with the other js/ files; load order is set in index.html.

const TOWN=townPlan(11); // modern town (js/townplan.js)

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
  town:{name:'Town',size:HALF_T*2,seed:11,fog:[70,240],start:{x:-150,z:TP.HWY_Z,h:0},
    // clear day: blue sky dome, bright sun high overhead, light haze toward the horizon
    sky:{top:0x1f5bb8,horizon:0x7fb0e0,fog:0x93bbe0,sun:[0xfff1dc,2.3],sunDir:[18,40,12],hemi:[0xd2e6ff,0x5c6a4e,.9]},
    height:townHeight,ground:'town',groundNoise:.025,perimeter:'trees',
    scenery:{n:0,rMin:0,rMax:0,keepClear:()=>true}, // no junk scenery; street furniture and trees come from props (js/props.js)
    targets:false,buildings:TOWN.buildings,layout:TOWN.layout,props:TOWN.props,
    spawn:{ring:150,minDist:60}}};

const MAP_ID=MAPS[new URLSearchParams(location.search).get('map')]?new URLSearchParams(location.search).get('map'):'test',MAP=MAPS[MAP_ID];
const HALF=MAP.size/2,PLAY=HALF-3; // map half-extent; vehicles stay inside ±PLAY, shells stop at ±(HALF-2)
sc.fog.near=MAP.fog[0];sc.fog.far=MAP.fog[1];

// Sky: optional per-map colours, light, and a gradient dome that follows the camera
let skyDome=null;
if(MAP.sky){const S=MAP.sky;sc.background=new THREE.Color(S.horizon);sc.fog.color.setHex(S.fog);sun.color.setHex(S.sun[0]);sun.intensity=S.sun[1];
  hemi.color.setHex(S.hemi[0]);hemi.groundColor.setHex(S.hemi[1]);hemi.intensity=S.hemi[2];
  cam.far=Math.max(250,MAP.fog[1]+120);cam.updateProjectionMatrix();
  const rad=cam.far*.85,geo=new THREE.SphereGeometry(rad,32,16),pos=geo.attributes.position,col=new Float32Array(pos.count*3),top=new THREE.Color(S.top),hor=new THREE.Color(S.horizon),c=new THREE.Color();
  for(let i=0;i<pos.count;i++){const y=pos.getY(i)/rad;c.copy(hor).lerp(top,y>0?Math.pow(y,.5):0);col[i*3]=c.r;col[i*3+1]=c.g;col[i*3+2]=c.b}
  geo.setAttribute('color',new THREE.BufferAttribute(col,3));
  skyDome=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.BackSide,fog:false,depthWrite:false}));skyDome.renderOrder=-1;sc.add(skyDome)}
const SUN_DIR=(MAP.sky&&MAP.sky.sunDir)||[10,12,8];
