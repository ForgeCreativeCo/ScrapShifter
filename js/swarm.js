// The swarm: foundries (nests) that infest town buildings, spawn crawlers and bikes, and grow on rubble.
// Rubble feeds them: any panel, slab, wall, shed or car destroyed within NEST.feedR m of a living foundry (not in
// its own building) adds feed. Growth (0..1 = feed/NEST.feedFull) speeds up spawns, raises how many of its units
// can be out at once, toughens new crawlers, spreads the infested ground stain and brightens the beacon. Burning
// pieces feed a quarter as much: fire denies the material.
// Foundries take blast damage (30% through walls), mech shield bashes, damage from fire in their building, and a
// building collapse crushes them (60% of max HP for a full collapse, 15% for the top floors).
// Markers: a beacon column, an exhaust plume from a stack through the roof, a red-brown ground stain, scrap plating
// and blinking red lamps on the building, plus HUD markers (js/mission.js).
// Placement is seeded from the map and the run number, so a run is reproducible.
// Classic script sharing one global scope with the other js/ files; load order is set in index.html.

const NEST={hp:320,feedR:90,feedFull:160,blast:60,bash:95,crush:[.6,.15],fireDps:.9,fireMax:14,coreR:1.9,
  stain:[7,24],spawn:[24,7],cap:[1,4],max:9}; // stain radius, spawn interval (s) and alive cap at growth 0 -> 1; max = all enemies
const FEED={panel:1,slab:2,wall:1.5,shed:3,car:2.5};
const nests=[];

// Beacon: a translucent light column, strongest at the base, with bands scrolling up; ignores fog so it reads from afar.
// Normal (not additive) blending: additive red on a bright blue sky washes out to pale pink.
const beaconGeo=new THREE.CylinderGeometry(1,1,1,20,1,true).translate(0,.5,0);
function makeBeacon(x,y,z,col,r,h){const m=new THREE.Mesh(beaconGeo,new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,fog:false,
    uniforms:{col:{value:new THREE.Color(col)},time:{value:0},k:{value:1}},
    vertexShader:`varying vec2 vUv;varying float vF;void main(){vUv=uv;vec3 n=normalize(normalMatrix*normal);vec4 mv=modelViewMatrix*vec4(position,1.);vF=abs(dot(n,normalize(-mv.xyz)));gl_Position=projectionMatrix*mv;}`,
    fragmentShader:`uniform vec3 col;uniform float time,k;varying vec2 vUv;varying float vF;
      void main(){float a=pow(1.-vUv.y,1.5)*(.62+.38*sin(vUv.y*70.-time*5.))*pow(vF,1.3)*k;gl_FragColor=vec4(col*(1.+.5*a),min(1.,a*.85));}`}));
  m.position.set(x,y,z);m.scale.set(r,h,r);m.frustumCulled=false;m.renderOrder=5;sc.add(m);return m}

const nestCoreM=new THREE.MeshStandardMaterial({color:0x300806,emissive:0xff3010,emissiveIntensity:2.2,roughness:.4});
const nestLampM=new THREE.MeshStandardMaterial({color:0x2a0805,emissive:0xff2a10,emissiveIntensity:1.5});
const _nz=new THREE.Matrix4().makeScale(0,0,0),_nm=new THREE.Matrix4(),_nq=new THREE.Quaternion(),_ne=new THREE.Euler(0,0,0,'YXZ');
const nestCore=n=>new THREE.Vector3(n.x,n.y+1.7,n.z);

// Pick foundry buildings: multi-storey, away from the start, spread out (spacing relaxes if the map is tight)
function pickNestBuildings(count,seed){const r=rng(seed),few=buildings.length<=count;
  const a=buildings.filter(b=>few||(b.floors>=2&&Math.hypot(b.x-MAP.start.x,b.z-MAP.start.z)>50));
  for(let i=a.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[a[i],a[j]]=[a[j],a[i]]}
  const out=[];for(const gap of[80,55,30,0])for(const b of a){if(out.length>=count)return out;if(!out.includes(b)&&out.every(o=>Math.hypot(o.x-b.x,o.z-b.z)>=gap))out.push(b)}
  return out}

function makeNest(bl,i){const r=rng(Math.floor(bl.x*13+bl.z*7)+i*101+RUN.n*977+5),
    n={B:bl,i,x:bl.x,z:bl.z,y:bl.gy,hp:NEST.hp,max:NEST.hp,dead:false,feed:0,g:0,stage:0,spawnT:5+i*4,stainR:0,smokeT:0,flash:0,deadT:0,lastHit:-9,objs:[],skin:[]};
  const g=new THREE.Group();g.position.set(bl.x,bl.gy,bl.z);g.rotation.y=bl.rot;sc.add(g);n.grp=g;n.objs.push(g);
  // foundry: a red plate base, scrap heaped round a caged glowing core, two working pistons, an exhaust stack up through the roof
  mk(C(2.4,.6,18),hostile,0,.3,0,g);
  for(let k=0;k<12;k++){const a=r()*6.28,d=1.6+r()*1.1,s=.4+r()*.6,o=mk(B(s*1.4,s*.6,s),r()<.5?rusty:steel,Math.cos(a)*d,.6+r()*.5,Math.sin(a)*d,g);o.rotation.set(r(),r()*3,r())}
  n.core=mk(new THREE.SphereGeometry(.85,20,14),nestCoreM,0,1.7,0,g);
  for(let k=0;k<8;k++){const a=k/8*6.28;mk(C(.06,2.2,6),steel,Math.cos(a)*1.1,1.7,Math.sin(a)*1.1,g)}
  [.6,2.8].forEach(y=>{const t=mk(new THREE.TorusGeometry(1.1,.07,6,24),steel,0,y,0,g);t.rotation.x=PI/2});
  n.arms=[1,-1].map(s=>{const p=new THREE.Group();p.position.set(1.7*s,1.2,0);g.add(p);mk(B(.3,1.7,.3),hostile,0,.8,0,p);mk(C(.12,.9,8),steel,0,1.9,0,p);return p});
  const top=FH0+(bl.floors-1)*FH+3;n.stackH=top;n.stack=mk(C(.38,1,10),rusty,0,0,0,g);n.stack.position.set(-.6,2.6+(top-2.6)/2,.4);n.stack.scale.y=top-2.6;
  // infestation skin: scrap plates on the lower floors, red lamps in windows on every floor (instanced, hidden as panels go)
  const plates=[],lamps=[];
  bl.levels.flat().forEach(p=>{const nx=Math.sin(p.rot),nz=Math.cos(p.rot),sg=Math.sign((p.x-bl.x)*nx+(p.z-bl.z)*nz)||1,ox=nx*sg,oz=nz*sg,h=p.H[0];
    if(p.level<=1&&r()<.5)plates.push({p,x:p.x+ox*(PT/2+.09),y:p.y0+h*(.25+r()*.4),z:p.z+oz*(PT/2+.09),rot:p.rot,tilt:(r()-.5)*.5,w:p.w*(.35+r()*.35),h:h*(.22+r()*.25)});
    if(r()<.4)lamps.push({p,x:p.x+ox*(PT/2+.12),y:p.y0+h*(.45+r()*.12),z:p.z+oz*(PT/2+.12),s:.13+r()*.06})});
  const skin=(geo,mat,list,mtx)=>{if(!list.length)return;const im=new THREE.InstancedMesh(geo,mat,list.length);list.forEach((it,k)=>{mtx(it);im.setMatrixAt(k,_nm);it.im=im;it.k=k;n.skin.push(it)});im.castShadow=true;sc.add(im);n.objs.push(im)};
  skin(B(1,1,.14),hostile,plates,it=>{_ne.set(0,it.rot,it.tilt);_nm.compose(new THREE.Vector3(it.x,it.y,it.z),_nq.setFromEuler(_ne),new THREE.Vector3(it.w,it.h,1))});
  skin(new THREE.SphereGeometry(1,10,8),nestLampM,lamps,it=>_nm.makeScale(it.s,it.s,it.s).setPosition(it.x,it.y,it.z));
  n.beacon=makeBeacon(bl.x,bl.gy,bl.z,0xff3a1a,2.2,150);n.objs.push(n.beacon);
  tuneEnv(g);stainTo(n,NEST.stain[0]);nests.push(n);return n}

// Infested ground: tint the vertex colours red-brown out to radius r1, with a ragged edge. Growth only paints the new ring.
const stainNoise=(x,z,n)=>1.6*Math.sin(x*.7+n.i*3)*Math.cos(z*.6-n.i)+1.1*Math.sin((x+z)*.33+n.i*5);
function stainTo(n,r1){if(r1<n.stainR+1)return;const r0=n.stainR;n.stainR=r1;
  editGround(n.x,n.z,r1+3,(i,x,z)=>{const d=Math.hypot(x-n.x,z-n.z)+stainNoise(x,z,n);if(d>=r0&&d<r1){gCol[i*3]*=.8;gCol[i*3+1]*=.56;gCol[i*3+2]*=.5}})}

// ---------- Feeding, damage
function swarmFeed(p){if(!nests.length||MS.phase!=='nests')return;let a=(FEED[p.kind]||1)*(p.level===0?1.5:1);if(p.fire>0||p.burnt>.3)a*=.25;
  nests.forEach(n=>{if(n.dead||p.bld===n.B)return;const d=Math.hypot(p.x-n.x,p.z-n.z);if(d<NEST.feedR)n.feed+=a*(1-.5*d/NEST.feedR)})}
function swarmCollapse(bl,f){nests.forEach(n=>{if(!n.dead&&n.B===bl)nestDamage(n,n.max*NEST.crush[f===0?0:1])})}
function nestDamage(n,d){if(n.dead||d<=0)return;n.hp-=d;n.flash=1;n.lastHit=clock;if(n.hp<=0)killNest(n)}
function nestBlast(p,pw){const R=2.3*pw+1.2;nests.forEach(n=>{if(n.dead)return;const c=nestCore(n),d=Math.max(0,p.distanceTo(c)-NEST.coreR*.6);if(d<R)nestDamage(n,NEST.blast*pw*(1-d/R)*(fireLine(p,c)?1:.3))})}
function nestShotHit(sp){for(const n of nests){if(n.dead)continue;const dx=sp.x-n.x,dz=sp.z-n.z,hd=Math.hypot(dx,dz);
  if((hd<1.4&&Math.abs(sp.y-(n.y+1.7))<1.4)||(hd<2.4&&sp.y<n.y+1))return true}return false}
function nestBash(c){let hits=0;nests.forEach(n=>{if(!n.dead&&Math.hypot(c.x-n.x,c.z-n.z)<NEST.coreR+SMASH_R+.4&&Math.abs(car.y-n.y)<3){nestDamage(n,NEST.bash);hits++}});return hits}
function killNest(n){n.hp=0;n.dead=true;n.deadT=0;const c=nestCore(n);explode(c.clone(),1.4);
  let k=0;addFx(null,2.2,(f,t)=>{if(t*6>k){k++;const q=c.clone().add(new THREE.Vector3(rnd(-1.5,1.5),rnd(-.5,2),rnd(-1.5,1.5)));for(let i=0;i<5;i++)fireball(q.clone(),new THREE.Vector3(rnd(-3,3),rnd(1,4),rnd(-3,3)),rnd(.8,1.3),rnd(2.5,4),rnd(.5,.9));
    boomSnd(1,q)}});
  n.core.material=charM;n.arms.forEach(a=>a.traverse(o=>{if(o.isMesh)o.material=charM}));
  n.skin.forEach(it=>{if(it.im.material===nestLampM){it.im.setMatrixAt(it.k,_nz);it.im.instanceMatrix.needsUpdate=true;it.hid=true}});
  nestDown(n)} // mission bookkeeping (js/mission.js)

// ---------- Spawning: units leave by a reachable "door" just outside the building, preferring sides away from the player
function nestDoor(n){const bl=n.B,c=[];for(let k=0;k<16;k++){const a=k/16*6.28+n.i,ex=bl.W/2+4,ez=bl.D/2+4,t=Math.max(Math.abs(Math.cos(a))/ex,Math.abs(Math.sin(a))/ez),lx=Math.cos(a)/t,lz=Math.sin(a)/t,
    x=bl.x+lx*bl.c+lz*bl.s,z=bl.z-lx*bl.s+lz*bl.c;if(Math.abs(x)<PLAY-2&&Math.abs(z)<PLAY-2&&navReachable(x,z)&&!navBlocked(nIdx(toCell(x),toCell(z))))c.push({x,z})}
  if(!c.length)return null;c.sort((p,q)=>Math.hypot(q.x-car.x,q.z-car.z)-Math.hypot(p.x-car.x,p.z-car.z));return c[Math.floor(Math.random()*Math.min(3,c.length))]}
function spawnFromNest(n){const p=nestDoor(n);if(!p)return;const bike=Math.random()<.22+.15*n.g,e=bike?makeBike(p.x,p.z):makeEnemy(p.x,p.z);e.nest=n;
  if(!bike){if(Math.random()<.5)e.guard=n;e.hp=e.maxHp=Math.round(EN_HP*(1+.35*n.g))}e.h=Math.atan2(-(p.z-n.z),p.x-n.x);
  for(let k=0;k<10;k++)smoke(new THREE.Vector3(p.x+rnd(-1,1),gh(p.x,p.z)+.4,p.z+rnd(-1,1)),new THREE.Vector3(rnd(-2,2),rnd(.5,1.5),rnd(-2,2)),0x3a2620,.6,rnd(2,3.5),rnd(1.5,2.5),.5)}

// ---------- Per frame
function swarmTick(dt){const pulse=.5+.5*Math.sin(clock*3);nestCoreM.emissiveIntensity=1.5+1.3*pulse;nestLampM.emissiveIntensity=Math.sin(clock*4)>0?2.4:.35;
  const live=MS.phase==='nests',alive=live?enemies.filter(e=>!e.dead).length:0;
  nests.forEach(n=>{const bl=n.B,u=n.beacon.material.uniforms;u.time.value=clock;n.flash=Math.max(0,n.flash-dt*3);
    // keep the rig and enemies out of the foundry itself
    if(Math.abs(car.y-n.y)<4)pushOut(car,n.x,n.z,2.5+CR);enemies.forEach(e=>{if(!e.dead)pushOut(e,n.x,n.z,2.5+(e.r||1.5))});
    // skin: hide plates/lamps whose panel is gone or whose floor fell; shorten the stack once upper floors collapse
    n.skin.forEach(it=>{if(!it.hid&&(it.p.state===2||bl.collapsedFrom<=it.p.level)){it.hid=true;it.im.setMatrixAt(it.k,_nz);it.im.instanceMatrix.needsUpdate=true}});
    const top=bl.collapsedFrom===0?4:FH0+(bl.collapsedFrom-1)*FH+3;if(top<n.stackH){n.stackH=top;n.stack.scale.y=Math.max(.5,top-2.6);n.stack.position.y=2.6+(top-2.6)/2}
    const near=cam.position.distanceTo(n.grp.position)<230;
    if(n.dead){n.deadT+=dt;u.k.value=Math.max(0,1-n.deadT/2.5);n.beacon.visible=u.k.value>0;
      if(near&&n.deadT<25){n.smokeT-=dt;if(n.smokeT<=0){n.smokeT=.35;smoke(nestCore(n).add(new THREE.Vector3(rnd(-1,1),.5,rnd(-1,1))),new THREE.Vector3(rnd(-.3,.3),rnd(1,2),rnd(-.3,.3)),0x1e1b18,.8,3.5,rnd(4,6),.5)}}
      return}
    u.k.value=(.75+.55*n.g)*(.85+.15*Math.sin(clock*(2+3*n.g)))+n.flash*.8;
    n.arms.forEach((a,k)=>a.rotation.z=Math.sin(clock*(2+2*n.g)+k*PI)*.6);n.core.rotation.y+=dt*(1+2*n.g);
    // exhaust plume from the stack top, thicker as it grows
    if(near){n.smokeT-=dt;if(n.smokeT<=0){n.smokeT=.32/(1+n.g);const q=new THREE.Vector3(-.6,n.stackH,.4).applyMatrix4(n.grp.matrixWorld);
      smoke(q,new THREE.Vector3(rnd(-.3,.3),rnd(2.2,3.4),rnd(-.3,.3)),Math.random()<.3?0x4a2a1e:0x24201c,.7,rnd(3.5,5.5),rnd(4.5,6.5),.6);if(Math.random()<.25)ember(q.clone(),new THREE.Vector3(rnd(-1,1),rnd(3,6),rnd(-1,1)),rnd(.8,1.6))}}
    // fire in its building eats at it
    let burn=0;for(const p of burning)if(p.bld===bl)burn++;if(burn)nestDamage(n,Math.min(NEST.fireMax,NEST.fireDps*burn)*dt*TUNE.fire);
    if(n.dead||!live)return;
    // growth from rubble
    n.g=Math.min(1,n.feed/NEST.feedFull);const st=Math.floor(n.g*5);if(st>n.stage){n.stage=st;toast(`Foundry ${n.i+1} is feeding on rubble: growth ${st}/5`,3)}
    stainTo(n,L(NEST.stain[0],NEST.stain[1],n.g));
    const cap=Math.round(L(NEST.cap[0],NEST.cap[1],n.g)),mine=enemies.filter(e=>!e.dead&&e.nest===n).length;
    n.spawnT-=dt;if(n.spawnT<=0&&mine<cap&&alive<NEST.max){spawnFromNest(n);n.spawnT=L(NEST.spawn[0],NEST.spawn[1],n.g)*rnd(.85,1.15)}})}
function clearNests(){nests.forEach(n=>n.objs.forEach(o=>sc.remove(o)));nests.length=0}
