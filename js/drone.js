// Spotter drone (artillery): launches off the rig's deck when the legs plant, flies within DRONE.range of the rig,
// and paints targets with a laser that the turret follows. Switching to buggy or mech recalls it to the deck.
// Crawlers shoot it with flak; a downed drone rebuilds in DRONE.rebuild seconds (artillery then aims from the rig).
// Classic script sharing one global scope with the other js/ files; load order is set in index.html.

const DRONE={range:130,alt:[16,50],alt0:28,spd:18,hp:60,rebuild:15,flakR:42,flakDmg:10,scale:1.7};
const DR={state:'dock',p:new THREE.Vector3(),v:new THREE.Vector3(),h:0,alt:DRONE.alt0,hp:DRONE.hp,t:0,k:0,rebuildT:0,
  tgt:null,laser:new THREE.Vector3(),aim:new THREE.Vector3(),has:false,ok:false,info:'',stat:0,spin:0,focus:new THREE.Vector3()};
// states: dock (on the deck) -> launch (climbing) -> fly -> return (homing to the deck) -> dock; fly/launch -> fall -> down (rebuilding) -> dock

// ---------- Model: a scrap quadcopter with a laser pod ----------
const drone=new THREE.Group();drone.rotation.order='YXZ';
const rotorM=new THREE.MeshBasicMaterial({color:0x2a2622,transparent:true,opacity:.45,depthWrite:false});
const lensM=new THREE.MeshBasicMaterial({color:0xff2a1a}),lampM=new THREE.MeshBasicMaterial({color:0xff3a2a});
mk(B(.5,.15,.38),rusty,0,0,0,drone);mk(B(.34,.07,.26),olive,-.02,.1,0,drone);mk(B(.12,.05,.4),hazard,.12,.09,0,drone);
const rotors=[];[[.34,.3],[.34,-.3],[-.34,.3],[-.34,-.3]].forEach(([x,z])=>{const a=mk(B(.46,.04,.05),steel,x/2,.02,z/2,drone);a.rotation.y=-Math.atan2(z,x);
  mk(C(.035,.08,6),steel,x,.06,z,drone);const r=mk(C(.19,.012,14),rotorM,x,.11,z,drone);r.castShadow=false;rotors.push(r)});
mk(new THREE.SphereGeometry(.085,10,8),steel,.16,-.12,0,drone);
const lens=mk(C(.035,.04,8),lensM,.25,-.12,0,drone);lens.rotation.z=-PI/2;
const lamp=mk(new THREE.SphereGeometry(.035,6,6),lampM,-.26,.06,0,drone);
const DOCK_POS=new THREE.Vector3(-.2,.5,0);
deck.add(drone);drone.position.copy(DOCK_POS);

// laser beam (thin additive cylinder from the lens) and dot
const beam=new THREE.Mesh(new THREE.CylinderGeometry(.035,.035,1,6,1,true).translate(0,.5,0),new THREE.MeshBasicMaterial({color:0xff3322,transparent:true,opacity:.55,blending:THREE.AdditiveBlending,depthWrite:false,fog:false}));
beam.frustumCulled=false;beam.visible=false;sc.add(beam);
const dot=S(glowT,0xff3a22,true,.95,1.6);dot.material.fog=false;dot.visible=false;sc.add(dot);
const _up=new THREE.Vector3(0,1,0),_lp=new THREE.Vector3(),_ld=new THREE.Vector3(),_dp=new THREE.Vector3();

// HUD pieces (index.html): drone view overlay with static, laser tag next to the dot, rig tag
const dvEl=document.getElementById('dview'),dvInfo=document.getElementById('dvInfo'),dvWarn=document.getElementById('dvWarn'),dvStatic=document.getElementById('dvStatic');
const ltag=document.getElementById('ltag'),rigTag=document.getElementById('rigTag');
const staticURLs=[0,1,2,3].map(()=>{const c=document.createElement('canvas');c.width=c.height=96;const g=c.getContext('2d'),im=g.createImageData(96,96);
  for(let i=0;i<im.data.length;i+=4){const v=Math.random()*255;im.data[i]=im.data[i+1]=im.data[i+2]=v;im.data[i+3]=255}g.putImageData(im,0,0);return 'url('+c.toDataURL()+')'});

const droneUp=()=>DR.state==='fly'||DR.state==='launch';
const droneView=()=>DR.k>.5&&droneUp();
const droneFwd=()=>_ld.set(Math.cos(DR.h),0,-Math.sin(DR.h));
// highest intact roof under (x,z), so the drone climbs over towers
function roofAt(x,z){let top=-1e9;for(const b of buildings){if(b.collapsedFrom<=0)continue;const dx=x-b.x,dz=z-b.z,lx=dx*b.c-dz*b.s,lz=dx*b.s+dz*b.c;
  if(Math.abs(lx)<b.W/2+3&&Math.abs(lz)<b.D/2+3)top=Math.max(top,b.gy+FH0+(b.collapsedFrom-1)*FH+2)}return top}

function dockNow(){deck.attach(drone);drone.position.copy(DOCK_POS);drone.rotation.set(0,0,0);drone.scale.setScalar(1);drone.visible=true;DR.state='dock';DR.v.set(0,0,0)}
function resetDrone(){dockNow();DR.hp=DRONE.hp;DR.k=0;DR.tgt=null;DR.has=false;beam.visible=dot.visible=false}
function launchDrone(){sc.attach(drone);drone.getWorldPosition(DR.p);DR.h=car.h+AIM.yaw;DR.v.set(0,0,0);DR.state='launch';DR.t=0;
  if(audio()){const t=AC.currentTime;nz(t,.5,600,3000,.25,'bandpass');th(t,220,520,.45,.08)}}
function downDrone(){DR.state='fall';DR.t=0;DR.v.y=Math.min(DR.v.y,2);toast('Drone down! Rebuilding…',2.5)}
function hurtDrone(d){if(!droneUp())return;DR.hp-=d;sparks(DR.p.clone(),6);trauma=Math.min(1,trauma+.15*DR.k);if(DR.hp<=0)downDrone()}

// Rotor sound: the recorded hover loop (sfx/drone.mp3), placed in the world; synth buzz until it has decoded
let droneSnd=null;
function droneSound(on,spd){if(!AC||mode===3)return; // gyro mode drives the same loop as its rotor sound (gyro.js)
  if(SFX.drone){const s=spot(DR.p,.04);loopSnd('drone',on?Math.min(1.1,1.3*s.a):0,.95+Math.min(.15,spd*.008),s.pan);if(droneSnd)droneSnd.g.gain.setTargetAtTime(0,AC.currentTime,.1);return}
  if(!droneSnd){if(!on)return;const o=AC.createOscillator(),o2=AC.createOscillator(),f=AC.createBiquadFilter(),g=AC.createGain();
  o.type=o2.type='sawtooth';f.type='bandpass';f.frequency.value=1100;f.Q.value=.8;g.gain.value=0;o.connect(f);o2.connect(f);f.connect(g);g.connect(master);o.start();o2.start();droneSnd={o,o2,g}}
  const t=AC.currentTime,hz=150+spd*4;droneSnd.o.frequency.setTargetAtTime(hz,t,.1);droneSnd.o2.frequency.setTargetAtTime(hz*1.013,t,.1);
  droneSnd.g.gain.setTargetAtTime(on&&soundOn?.022+.012*DR.k:0,t,.12)}

// ---------- Per frame (main loop, before aimTick) ----------
function droneTick(dt){
  const deployed=mode===1&&!run&&!pl.dead&&AIM.k>=1;
  DR.spin+=dt*60;rotors.forEach((r,i)=>r.rotation.y=DR.spin*(i%2?1:-1));lamp.visible=Math.sin(clock*9)>0;
  if(DR.state==='dock'){DR.hp=DRONE.hp;if(deployed&&dt>0)launchDrone()}
  else if(DR.state==='down'){drone.visible=false;DR.rebuildT-=dt;if(DR.rebuildT<=0){dockNow();toast('Drone rebuilt',1.5)}}
  else if(DR.state==='fall'){DR.t+=dt;DR.v.y-=9.8*dt;DR.p.addScaledVector(DR.v,dt);drone.rotation.x+=dt*5;drone.rotation.y+=dt*7;
    if(Math.random()<dt*25)smoke(DR.p.clone(),new THREE.Vector3(rnd(-.3,.3),rnd(.5,1),rnd(-.3,.3)),0x2a2622,.4,1.6,rnd(1,1.8),.6);
    const floor=Math.max(gh(DR.p.x,DR.p.z),roofAt(DR.p.x,DR.p.z)-2);
    if(DR.p.y<=floor+.2||DR.t>6){DR.p.y=Math.max(DR.p.y,gh(DR.p.x,DR.p.z)+.3);explode(DR.p.clone(),.45);DR.state='down';DR.rebuildT=DRONE.rebuild;drone.visible=false}}
  else if(DR.state==='return'){const goal=_dp.copy(DOCK_POS).applyMatrix4(deck.matrixWorld),d=DR.p.distanceTo(goal);
    if(d<.5||pl.dead)dockNow();else{DR.p.addScaledVector(goal.sub(DR.p).normalize(),Math.min(d,(12+d*1.2)*dt));drone.scale.setScalar(L(1,DRONE.scale,Math.min(1,d/6)))}}
  else{ // launch / fly
    if(pl.dead){downDrone()}
    else if(mode!==1||run){DR.state='return'}
    else{DR.t+=dt;const fwd=droneFwd(),rx=Math.sin(DR.h),rz=Math.cos(DR.h);
      let f=0,s=0;if(DR.state==='fly'){f=(held('KeyW','ArrowUp')?1:0)-(held('KeyS','ArrowDown')?1:0);s=(held('KeyD','ArrowRight')?1:0)-(held('KeyA','ArrowLeft')?1:0);
        DR.h+=((held('KeyQ')?1:0)-(held('KeyE')?1:0))*1.6*dt}
      else{f=.45;if(DR.t>1.6)DR.state='fly'}
      const tvx=(fwd.x*f+rx*s)*DRONE.spd,tvz=(fwd.z*f+rz*s)*DRONE.spd,a=Math.min(1,dt*3);DR.v.x+=(tvx-DR.v.x)*a;DR.v.z+=(tvz-DR.v.z)*a;
      DR.p.x+=DR.v.x*dt;DR.p.z+=DR.v.z*dt;
      // tether: soft push back past 90% of the range, hard stop at the range
      const ox=DR.p.x-car.x,oz=DR.p.z-car.z,od=Math.hypot(ox,oz),R=DRONE.range;
      if(od>R*.9){const k=Math.min(1,(od-R*.9)/(R*.1));DR.p.x-=ox/od*k*14*dt;DR.p.z-=oz/od*k*14*dt;if(od>R){DR.p.x=car.x+ox/od*R;DR.p.z=car.z+oz/od*R}}
      DR.stat=ss(cl((od-R*.82)/(R*.18)));
      const lim=HALF-4;DR.p.x=Math.max(-lim,Math.min(lim,DR.p.x));DR.p.z=Math.max(-lim,Math.min(lim,DR.p.z));
      const ty=Math.max(gh(DR.p.x,DR.p.z)+DR.alt,roofAt(DR.p.x,DR.p.z)+5);DR.p.y+=(ty-DR.p.y)*Math.min(1,dt*(DR.state==='launch'?1.6:2.2));
      const vf=DR.v.x*fwd.x+DR.v.z*fwd.z,vs=DR.v.x*rx+DR.v.z*rz;drone.rotation.set(vs*.025,DR.h,-vf*.025); // bank and pitch into the motion
      drone.scale.setScalar(L(drone.scale.x,DRONE.scale,Math.min(1,dt*2)))}}
  if(DR.state!=='dock'&&DR.state!=='down')drone.position.copy(DR.p);
  DR.k=droneUp()&&mode===1&&!run?Math.min(1,DR.k+dt*1.4):Math.max(0,DR.k-Math.max(dt,1/60)*6);
  droneSound(DR.state==='fly'||DR.state==='launch'||DR.state==='return',DR.v.length());
  // shadow / sun focus: the drone's look point while spotting, else the rig
  const f=droneFwd();DR.focus.set(L(car.x,DR.p.x+f.x*22,DR.k),0,L(car.z,DR.p.z+f.z*22,DR.k))}

// Laser: the point under the cursor (sticks to an enemy, snaps onto walls and roofs). Sets DR.laser (the dot) and DR.aim
// (where the gun should land: the enemy's led position). Returns false when nothing is painted.
function droneLaser(){DR.tgt=null;if(!cursorPoint(260))return false;DR.laser.copy(aimPt);
  let best=null,bd=2.5;for(const e of enemies){if(e.dead)continue;const d=Math.hypot(aimPt.x-e.x,aimPt.z-e.z)-e.r;if(d<bd&&aimPt.y<e.y+e.hh+2){bd=d;best=e}}
  if(best){DR.tgt=best;DR.laser.set(best.x,best.y+best.hh*.55,best.z)}
  if(DR.laser.y<gh(DR.laser.x,DR.laser.z))DR.laser.y=gh(DR.laser.x,DR.laser.z)+.05;
  DR.aim.copy(DR.laser);return true}
// lead a moving enemy by the shell's flight time (two passes)
function leadAim(high){const e=DR.tgt;if(!e)return;const vx=Math.cos(e.h)*e.v,vz=-Math.sin(e.h)*e.v;
  for(let i=0;i<2;i++){const s=solveHull(DR.aim,FIRE[1][0],high);if(!s.ok)return;const dh=Math.hypot(DR.aim.x-car.x,DR.aim.z-car.z),tf=dh/Math.max(1,FIRE[1][0]*Math.cos(s.elev));
    DR.aim.set(e.x+vx*tf,e.y+.5,e.z+vz*tf)}}

// Beam, dot and HUD (after aimTick so DR.ok reflects the current solve)
function droneHud(){const show=DR.k>.05&&DR.has&&droneUp();beam.visible=dot.visible=show;
  if(show){lens.getWorldPosition(_lp);_ld.subVectors(DR.laser,_lp);const len=_ld.length();beam.position.copy(_lp);beam.quaternion.setFromUnitVectors(_up,_ld.normalize());beam.scale.set(1,len,1);
    beam.material.color.setHex(DR.ok?0xff3322:0x777777);dot.material.color.setHex(DR.ok?0xff3a22:0x999999);dot.position.copy(DR.laser);dot.scale.setScalar((1.2+.25*Math.sin(clock*14))*(1+len*.012))}
  dvEl.style.opacity=DR.k;dvEl.style.display=DR.k>.01?'block':'none';
  if(DR.k>.01){dvStatic.style.opacity=DR.stat*.55;if(DR.stat>.01)dvStatic.style.backgroundImage=staticURLs[Math.floor(Math.random()*4)];
    const od=Math.round(Math.hypot(DR.p.x-car.x,DR.p.z-car.z)),alt=Math.round(DR.p.y-gh(DR.p.x,DR.p.z));
    const info=`DRONE ${Math.round(DR.hp/DRONE.hp*100)}% · ${od}/${DRONE.range} m from rig · alt ${alt} m`;if(dvInfo.textContent!==info)dvInfo.textContent=info;
    const near=enemies.filter(e=>!e.dead&&Math.hypot(e.x-car.x,e.z-car.z)<32).length,hit=clock-pl.lastHit<1.5;
    const w=hit?'RIG UNDER FIRE · hull '+Math.round(pl.hp/PL_MAX*100)+'%':near?near+' hostile'+(near>1?'s':'')+' near the rig':DR.stat>.3?'SIGNAL WEAK · near max range':'';
    if(dvWarn.textContent!==w)dvWarn.textContent=w;dvWarn.classList.toggle('hot',hit)}
  // screen tags: laser readout next to the dot, rig position while spotting
  const r=cv.getBoundingClientRect();
  const tag=(el,p,txt,on,edge)=>{if(!on){el.style.display='none';return}_dp.copy(p).project(cam);const off=_dp.z>1||Math.abs(_dp.x)>.92||Math.abs(_dp.y)>.88;
    if(off&&!edge){el.style.display='none';return}if(off){if(_dp.z>1){_dp.x=-_dp.x;_dp.y=-_dp.y}const m=Math.max(Math.abs(_dp.x)/.92,Math.abs(_dp.y)/.88,1e-6);_dp.x/=m;_dp.y/=m;txt=(_dp.x<-.5?'◀ ':_dp.x>.5?'▶ ':_dp.y<0?'▼ ':'▲ ')+txt} // off screen: pin to the edge, pointing at the rig
    el.style.display='block';el.style.left=(r.left+(_dp.x+1)/2*r.width)+'px';el.style.top=(r.top+(1-_dp.y)/2*r.height)+'px';if(el.textContent!==txt)el.textContent=txt};
  tag(ltag,DR.laser,DR.info,DR.k>.3&&DR.has&&DR.info);ltag.classList.toggle('bad',!DR.ok);
  tag(rigTag,_lp.set(car.x,car.y+3,car.z),'RIG '+Math.round(pl.hp/PL_MAX*100)+'%',DR.k>.3,true);rigTag.classList.toggle('hot',clock-pl.lastHit<1.5)}

// Drone camera: behind and above the drone, looking down past it. Blends with the chase camera by DR.k.
const _dc=new THREE.Vector3(),_dl=new THREE.Vector3();
function droneCamera(tx,ty,tz,ox,oy){if(DR.k<=0)return;const k=ss(DR.k),f=droneFwd();
  _dc.set(DR.p.x-f.x*8,DR.p.y+5,DR.p.z-f.z*8);_dl.set(DR.p.x+f.x*24,gh(DR.p.x+f.x*24,DR.p.z+f.z*24),DR.p.z+f.z*24);
  cam.position.lerp(_dc,k);cam.position.x+=ox*k;cam.position.y+=oy*k;_dl.set(L(tx,_dl.x,k),L(ty,_dl.y,k),L(tz,_dl.z,k));cam.lookAt(_dl)}

// Crawler flak: a three-round burst of tracers at a drone within DRONE.flakR with a clear line; accuracy drops with distance and drone speed
const tracerM=new THREE.LineBasicMaterial({color:0xffb050,transparent:true,opacity:.9,blending:THREE.AdditiveBlending,depthWrite:false});
function droneFlak(e,dt){if(!droneUp()||e.stun>0){e.flakT=Math.max(e.flakT||0,1);return}
  const o=_lp.set(e.x,e.y+1.6,e.z),d=o.distanceTo(DR.p);if(d>DRONE.flakR){e.flakT=Math.max(e.flakT||0,rnd(.8,1.6));return}
  e.flakT=(e.flakT??rnd(1,2))-dt;if(e.flakT>0)return;e.flakT=rnd(1.8,2.8);
  if(!fireLine(o.clone(),DR.p.clone()))return;
  const pHit=Math.max(.15,.75-d/DRONE.flakR*.35-Math.min(.3,DR.v.length()*.015));
  for(let i=0;i<3;i++){const hit=Math.random()<pHit,end=DR.p.clone();if(!hit)end.add(new THREE.Vector3(rnd(-1,1),rnd(-.5,1),rnd(-1,1)).normalize().multiplyScalar(rnd(2,4))).addScaledVector(_ld.subVectors(end,o).normalize(),6);
    const g=new THREE.BufferGeometry().setFromPoints([o.clone(),end]),ln=new THREE.Line(g,tracerM);ln.frustumCulled=false;
    addFx(ln,.09,(f,k)=>{if(k>.9)g.dispose()},i*.11);
    if(hit)addFx(null,.02,f=>{if(!f.hit){f.hit=1;hurtDrone(DRONE.flakDmg*FOE_DMG)}},i*.11+d/400)}
  if(audio()){const s=spot(o,.04);if(!sfx('gun-shot',{t:s.t,off:SFX_CUT.gun[0][0],dur:.4,fade:.2,vol:.45*s.a,rate:1.7,pan:s.pan,lp:s.lp}))nz(s.t,.15,6000,1500,.3*s.a,'bandpass')}}
