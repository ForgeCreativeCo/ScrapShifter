// Particle effects and explosions.
// Classic script sharing one global scope with the other js/ files; load order is set in index.html.

// ---------- Effects ----------
const fx=[];
function addFx(o,d,u,w=0){if(o)sc.add(o);fx.push({o,k:0,d,u,w})}
function S(map,col,addv,op,sz){const m=new THREE.SpriteMaterial({map,color:col,transparent:true,depthWrite:false,opacity:op,blending:addv?THREE.AdditiveBlending:THREE.NormalBlending,rotation:Math.random()*6.28});const s=new THREE.Sprite(m);s.scale.setScalar(sz);return s}
const cF0=new THREE.Color(0xFFF1C4),cF1=new THREE.Color(0xFF7A1A),cF2=new THREE.Color(0x6A2206);
function fireCol(c,k){if(k<.22)c.copy(cF0).lerp(cF1,k/.22);else c.copy(cF1).lerp(cF2,(k-.22)/.78)}
const wind=new THREE.Vector3(.35,0,.5);
function smoke(p,v,col,s0,s1,life,a,w=0){const s=S(puffT,col,false,0,s0);s.position.copy(p);const rs=rnd(-.4,.4);addFx(s,life,(f,k,dt)=>{s.position.addScaledVector(v,dt);v.multiplyScalar(Math.exp(-dt*1.2));s.position.addScaledVector(wind,dt*k);s.scale.setScalar(s0+(s1-s0)*(1-(1-k)**2));s.material.opacity=a*(k<.12?k/.12:(1-k)**1.2);s.material.rotation+=rs*dt},w)}
function fireball(p,v,s0,s1,life){const s=S(puffT,0xffffff,true,1,s0);s.position.copy(p);const rs=rnd(-1,1);addFx(s,life,(f,k,dt)=>{s.position.addScaledVector(v,dt);v.multiplyScalar(Math.exp(-dt*4));v.y+=2*dt;s.scale.setScalar(s0+(s1-s0)*Math.sqrt(k));fireCol(s.material.color,k);s.material.opacity=(1-k)**1.4;s.material.rotation+=rs*dt})}
function ember(p,v,life){const s=S(glowT,0xFFA040,true,1,rnd(.08,.18));s.position.copy(p);addFx(s,life,(f,k,dt)=>{v.y-=7*dt;v.multiplyScalar(Math.exp(-dt*.8));s.position.addScaledVector(v,dt);const g=gh(s.position.x,s.position.z);if(s.position.y<g){s.position.y=g;v.y*=-.3;v.x*=.5;v.z*=.5}s.material.opacity=1-k;s.material.color.setHSL(.07-.05*k,1,.6-.3*k)})}
const chunkG=new THREE.BoxGeometry(1,1,1);
function chunk(p,s,m,spd,from,smk){const c=mk(chunkG,m,p.x,p.y,p.z);c.scale.set(s,s*rnd(.25,1),s*rnd(.5,1));
const dir=from?p.clone().sub(from).setY(0).normalize():new THREE.Vector3(Math.random()-.5,0,Math.random()-.5).normalize();
const v=dir.multiplyScalar(spd*rnd(.5,1.1));v.y=spd*rnd(.35,1);const rv=new THREE.Vector3(rnd(-10,10),rnd(-10,10),rnd(-10,10));let tt=0;
addFx(c,rnd(5,7),(f,k,dt)=>{v.y-=12*dt;c.position.addScaledVector(v,dt);const g=gh(c.position.x,c.position.z)+c.scale.y/2;if(c.position.y<g){c.position.y=g;v.y*=-.28;v.x*=.55;v.z*=.55;rv.multiplyScalar(.5)}c.rotation.x+=rv.x*dt;c.rotation.y+=rv.y*dt;c.rotation.z+=rv.z*dt;
if(smk&&k<.25){tt+=dt;if(tt>.04){tt=0;smoke(c.position.clone(),new THREE.Vector3(0,.3,0),0x2E2A25,.25,.9,1.2,.55)}}})}

// ---------- Explosion ----------
let trauma=0,slowT=0;
function explode(p,pw,heavy){
crater(p,heavy?pw*.8:pw);applyBlast(p,pw,heavy);if(heavy)heavyBlast(p,pw);
flashL.position.set(p.x,p.y+1.5,p.z);flashL.intensity=14*pw;
const cd=cam.position.distanceTo(p);trauma=Math.min(1,trauma+.75*pw/(1+cd*.04));if(pw>1.2)slowT=heavy?.16:.09;
boomSnd(pw,cd);
const core=S(glowT,0xFFF6E0,true,1,1);core.position.copy(p);addFx(core,.14,(f,k)=>{core.scale.setScalar((1+k*5)*pw*1.4);core.material.opacity=1-k});
for(let i=0;i<Math.round(11*pw);i++){const v=new THREE.Vector3(rnd(-1,1),rnd(.2,1.2),rnd(-1,1)).normalize().multiplyScalar(rnd(2,6)*pw);fireball(p.clone().add(new THREE.Vector3(rnd(-.3,.3),rnd(0,.4),rnd(-.3,.3))),v,rnd(.6,1.1)*pw,rnd(2.2,3.4)*pw,rnd(.45,.85))}
for(let i=0;i<Math.round(16*pw);i++){const v=new THREE.Vector3(rnd(-1,1)*1.5,rnd(1.2,3)*pw,rnd(-1,1)*1.5);const c=new THREE.Color().setHSL(.08,.12,rnd(.1,.2));smoke(p.clone().add(new THREE.Vector3(rnd(-.6,.6)*pw,rnd(.3,1.2),rnd(-.6,.6)*pw)),v,c,rnd(1,1.6)*pw,rnd(4,6.5)*pw,rnd(3.5,6.5),rnd(.6,.85),rnd(.05,.3))}
for(let i=0;i<Math.round(12*pw);i++){const a=Math.random()*6.28,sp=rnd(4,8)*pw;smoke(new THREE.Vector3(p.x+Math.cos(a)*.5,gh(p.x,p.z)+.25,p.z+Math.sin(a)*.5),new THREE.Vector3(Math.cos(a)*sp,rnd(.2,.8),Math.sin(a)*sp),0x8A7A60,rnd(.6,1)*pw,rnd(2.4,3.5)*pw,rnd(1.6,2.8),.6)}
for(let i=0;i<Math.round(22*pw);i++){const v=new THREE.Vector3(rnd(-1,1),rnd(.3,1.4),rnd(-1,1)).normalize().multiplyScalar(rnd(6,15)*pw);ember(p.clone(),v,rnd(.6,1.6))}
for(let i=0;i<Math.round(14*pw);i++)chunk(p.clone().add(new THREE.Vector3(0,.2,0)),rnd(.08,.24),Math.random()<.7?rusty:steel,rnd(5,10)*pw,null,Math.random()<.35);
if(pw>1.1){let tt=0;const fp=p.clone();fp.y=gh(fp.x,fp.z)+.1;addFx(null,5,(f,k,dt)=>{tt+=dt;if(tt>.1){tt=0;fireball(fp.clone().add(new THREE.Vector3(rnd(-.5,.5),0,rnd(-.5,.5))),new THREE.Vector3(0,rnd(1,2.5),0),.4,1.1*(1-k*.6),rnd(.4,.7));smoke(fp.clone().add(new THREE.Vector3(0,1,0)),new THREE.Vector3(rnd(-.2,.2),rnd(1.5,2.5),rnd(-.2,.2)),0x24211D,.8,3.5,rnd(4,6),.6)}})}
const r=2.3*pw;targets.slice().forEach(o=>{const d=o.position.distanceTo(p);if(d<r+.5)shatter(o,p,6*pw*(1-Math.min(d,r)/r)+3)})}
// Break a destructible target into flying chunks, thrown away from `from` at speed spd
function shatter(o,from,spd){const hv=o.userData.h,m=o.userData.m;for(let i=0;i<10;i++){const q=o.position.clone().add(new THREE.Vector3(rnd(-1,1)*hv.x,rnd(-1,1)*hv.y,rnd(-1,1)*hv.z));chunk(q,hv.y*rnd(.35,.7),m,spd,from,Math.random()<.3)}
  sc.remove(o);const i=targets.indexOf(o);if(i>=0)targets.splice(i,1)}

// Artillery shell extras: a ground shockwave ring, a sub-bass thump and a long rumble
const shockGeo=new THREE.RingGeometry(.86,1,48).rotateX(-PI/2);
function heavyBlast(p,pw){const g=gh(p.x,p.z),ring=new THREE.Mesh(shockGeo,new THREE.MeshBasicMaterial({color:0xd9cdb8,transparent:true,opacity:.7,depthWrite:false,side:THREE.DoubleSide}));
  ring.position.set(p.x,g+.25,p.z);addFx(ring,.7,(f,k)=>{ring.scale.setScalar(1+k*7*pw);ring.material.opacity=.7*(1-k)**1.5});
  for(let i=0;i<24;i++){const a=i/24*6.28,s=rnd(9,14);smoke(new THREE.Vector3(p.x+Math.cos(a)*1.5,g+.3,p.z+Math.sin(a)*1.5),new THREE.Vector3(Math.cos(a)*s,rnd(.3,1),Math.sin(a)*s),0x9a8c72,.8,rnd(3,4.5),rnd(2.2,3.4),.55)}
  const core=S(glowT,0xFFF2D0,true,1,1);core.position.copy(p);addFx(core,.22,(f,k)=>{core.scale.setScalar((2+k*14)*pw*.6);core.material.opacity=1-k});
  if(audio()){const d=cam.position.distanceTo(p),t=AC.currentTime+d/343,a=1/(1+d*.02);th(t,60,16,2.2,1*a);nz(t+.05,3.2,700,30,.7*a);nz(t,.4,9000,1500,.5*a)}}
