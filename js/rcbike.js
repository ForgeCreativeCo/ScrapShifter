// Remote-controlled bike (key 5): launched from the buggy's deck and driven by remote while the rig sits parked.
// Bike form: fast, its only weapon is the drum charge it carries (click / Space = detonate, like a rusher).
// Mech form (key 3 while driving it, 1 = back to a bike): stands up on its wheels, slow, fires a minigun.
// 5 again hands control back to the rig and parks the bike; 5 once more (from the buggy) takes it over again.
// A detonated or destroyed bike rebuilds in RCB.rebuild seconds.
// Classic script sharing one global scope with the other js/ files; load order is set in index.html.

const RCB={hp:45,spd:16,rev:5,acc:18,turn:2.9,range:170,rebuild:12,pw:2.2,walk:5.5,back:3,mturn:2.6,form:.7,armor:[1,.7],
  mgRange:45,mgDps:20,mgPw:.045,mgTick:.12,mgSpin:.3}; // mgDps on an enemy it hits; mgPw: a small blast per damage tick on anything else
// state: dock (stowed) -> launch (thrown clear of the deck) -> out -> down (rebuilding) -> dock
const RC={state:'dock',ctl:false,x:0,y:0,z:0,h:0,v:0,vy:0,pitch:0,roll:0,hp:RCB.hp,form:0,fk:0,k:0,cyaw:PI,pull:1,rebuildT:0,gait:0,spin:0,
  spinK:0,spinA:0,mg:false,dmgT:0,trT:0,lineT:0,blinkT:0,self:false,dustT:0};
const rcCtl=()=>RC.ctl,rcOut=()=>RC.state==='out'||RC.state==='launch',rcMg=()=>RC.mg;

// ---------- Model: player-coloured scrap bike (olive, green lamp) so it never reads as a red rusher ----------
const rcG=new THREE.Group();rcG.rotation.order='YZX';rcG.visible=false;sc.add(rcG);
const rcLampM=new THREE.MeshStandardMaterial({color:0x06200c,emissive:0x40ff70,emissiveIntensity:1.5});
const rcParts=[]; // {o, a: bike pose, b: mech pose}
const rcP=(o,a,b)=>{rcParts.push({o,a,b});return o};
// body: lies along +x as a bike, stands on end (nose up, drum on its back) as a mech
const rcBody=rcP(new THREE.Group(),ps([0,.62,0]),ps([-.05,1.28,0],[0,0,PI/2*.93]));rcG.add(rcBody);
mk(B(1.5,.22,.3),olive,0,0,0,rcBody);mk(B(.55,.35,.42),rusty,.15,.23,0,rcBody);mk(B(.3,.1,.34),steel,-.1,.2,0,rcBody);
mk(C(.06,.75,6),steel,.62,.33,0,rcBody).rotation.z=-.5;mk(B(.08,.08,.75),steel,.8,.65,0,rcBody); // fork, handlebar
mk(B(.14,.14,.2),hazard,.86,.5,0,rcBody); // headlamp housing (the mech's "face")
mk(C(.27,.62,12),hazard,-.45,.38,0,rcBody).rotation.x=PI/2;mk(B(.04,.6,.66),steel,-.45,.38,0,rcBody); // the charge
mk(new THREE.SphereGeometry(.1,10,8),rcLampM,-.45,.75,0,rcBody);
mk(C(.015,.8,5),steel,-.7,.55,.12,rcBody);mk(new THREE.SphereGeometry(.04,6,6),rcLampM,-.7,.96,.12,rcBody); // aerial
// wheels: in line as a bike, side by side as the mech's feet
const rcWheels=[[.75,.34],[-.65,-.34]].map(([wx,fz])=>rcP(mk(C(.36,.16,12),tireM,0,0,0,rcG),ps([wx,.36,0],[PI/2,0,0]),ps([.05,.36,fz],[PI/2,0,0])));
// legs: hidden inside the frame as a bike
const rcLegs=[.34,-.34].map(z=>rcP(mk(B(.16,.8,.16),steel,0,0,0,rcG),ps([0,.6,0],[0,0,0],[.01,.01,.01]),ps([.03,.82,z])));
// left arm stub, and the minigun on the right arm (yaw -> pitch -> spinning barrels)
rcP(mk(B(.14,.5,.14),rusty,0,0,0,rcG),ps([0,.6,0],[0,0,0],[.01,.01,.01]),ps([.05,1.35,-.42],[0,0,.25]));
const rcGun=rcP(new THREE.Group(),ps([-.1,.55,.2],[0,0,0],[.35,.35,.35]),ps([.05,1.5,.46]));rcG.add(rcGun);
const rcYaw=new THREE.Group();rcGun.add(rcYaw);mk(B(.2,.3,.16),steel,-.05,-.12,0,rcYaw);
const rcPitch=new THREE.Group();rcYaw.add(rcPitch);mk(B(.36,.2,.22),olive,0,0,0,rcPitch);mk(B(.16,.15,.12),hazard,-.08,.02,.17,rcPitch);
const rcSpin=new THREE.Group();rcSpin.position.x=.2;rcPitch.add(rcSpin);
for(let i=0;i<6;i++){const a=i/6*PI*2;mk(C(.022,.5,6),steel,.25,Math.cos(a)*.05,Math.sin(a)*.05,rcSpin).rotation.z=-PI/2}
mk(C(.075,.04,10),steel,.46,0,0,rcSpin).rotation.z=-PI/2;mk(C(.075,.04,10),steel,.12,0,0,rcSpin).rotation.z=-PI/2;
const rcMuz=new THREE.Object3D();rcMuz.position.x=.55;rcSpin.add(rcMuz);
const rcFlash=S(puffT,0xFFD27A,true,0,.5);sc.add(rcFlash);
const rcLine=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3()]),mgTracerM);rcLine.frustumCulled=false;rcLine.visible=false;sc.add(rcLine);
const rcPose=k=>{rcParts.forEach(pt=>apply(pt,pt.a,pt.b,k))};rcPose(0);

// HUD: status pill and top-bar button (index.html); the drone's rig tag doubles as "where is my rig" while driving the bike
const rcTxt=document.getElementById('rcTxt'),rcBtn=document.getElementById('rcBtn');
const RC_TXT=['RC bike · WASD drive · click or Space DETONATES it · 3 = mech form · 5 = back to the rig','RC mech · WASD walk · hold click or Space for the minigun · 1 = bike form · 5 = back to the rig'];
function rcStatus(){if(RC.ctl)st.textContent=RC_TXT[RC.form]}
function rcSnd(rate){if(!audio())return;if(!sfx('transform-b',{vol:.6,rate})){const t=AC.currentTime;nz(t,.25,3000,900,.25,'bandpass');th(t,420,160,.2,.15)}}

// ---------- Control ----------
function rcKey(){if(pl.dead||MS.overlay)return;
  if(RC.ctl){rcRelease('Bike parked · 5 takes control again');return}
  if(RC.state==='down'){toast('Bike rebuilding · '+Math.ceil(RC.rebuildT)+' s',1.5);return}
  if(mode!==0||run){toast('Switch to buggy to use the bike',1.8);return}
  if(RC.state==='dock'){ // thrown forward off the deck
    const p=deck.getWorldPosition(new THREE.Vector3());Object.assign(RC,{state:'launch',x:p.x,y:p.y+.4,z:p.z,h:car.h,v:10+Math.max(0,car.v),vy:4,pitch:0,roll:0,hp:RCB.hp,form:0,fk:0,spinK:0,gait:0});
    rcG.visible=true;rcG.scale.setScalar(.35);rcPose(0);rcSnd(1.6);
    for(let i=0;i<6;i++)smoke(p.clone(),new THREE.Vector3(rnd(-1,1),rnd(.5,1.5),rnd(-1,1)),0x8C857A,.3,1.4,rnd(.8,1.3),.5)}
  else if(Math.hypot(RC.x-car.x,RC.z-car.z)>RCB.range){toast('Bike is out of signal range',1.8);return}
  RC.ctl=true;RC.cyaw=baseYaw;RC.pull=1;firing=false;rcStatus()}
function rcRelease(msg){if(!RC.ctl)return;RC.ctl=false;RC.mg=false;firing=false;st.textContent=TXT[mode];if(msg)toast(msg,2)}
function rcSetForm(f){if(!RC.ctl||RC.state!=='out'||RC.form===f)return;RC.form=f;rcSnd(f?1.35:1.5);rcStatus()}
// Called from fire(): the bike's only weapon is itself. (The mech's minigun runs off the held trigger in rcTick.)
function rcFire(){if(RC.state==='out'&&RC.form===0&&RC.fk<.05)rcDetonate()}
function rcDown(){RC.state='down';RC.rebuildT=RCB.rebuild;rcG.visible=false;RC.mg=false;rcLine.visible=false;rcFlash.material.opacity=0;rcRelease()}
function rcDetonate(){const p=new THREE.Vector3(RC.x,RC.y+.7,RC.z);rcDown();firing=false;reloadT=Math.max(reloadT,.8); // so a held trigger doesn't fire the buggy's gun straight after
  explode(p,RCB.pw);toast('Bike detonated · rebuilding',2)}
function rcHurt(d){if(!rcOut())return;RC.hp-=d*RCB.armor[RC.form];sparks(new THREE.Vector3(RC.x,RC.y+.8,RC.z),6);if(RC.ctl)trauma=Math.min(1,trauma+d/50);
  if(RC.hp<=0){const p=new THREE.Vector3(RC.x,RC.y+.7,RC.z);rcDown();explode(p,RCB.pw*.7);toast('Bike destroyed · rebuilding',2.5)}} // its charge cooks off
function rcBlast(p,pw){if(!rcOut()||RC.self)return;const R=2.3*pw+1.2,d=Math.hypot(p.x-RC.x,p.y-(RC.y+.7),p.z-RC.z);if(d<R)rcHurt(PL_DMG*pw*(1-d/R)*foeK())} // from applyBlast
function rcShotHit(sp){return rcOut()&&Math.hypot(sp.x-RC.x,sp.z-RC.z)<.9&&sp.y>RC.y-.2&&sp.y<RC.y+(RC.form?2.1:1.4)} // enemy shells (shotHits)
function rcReset(){RC.ctl=false;RC.state='dock';RC.k=0;RC.mg=false;RC.hp=RCB.hp;RC.form=0;RC.fk=0;rcG.visible=false;rcLine.visible=false;rcFlash.material.opacity=0}

// First thing a bullet meets between a and b: ground, a standing building/wall piece, or an enemy
const _ra=new THREE.Vector3(),_rb=new THREE.Vector3(),_rd=new THREE.Vector3(),_rm=new THREE.Vector3(),_rcC=new THREE.Vector3(),_rcL=new THREE.Vector3();
let rcHitE=null; // the enemy the last trace ended on
function rcTrace(a,b){const len=a.distanceTo(b),p=_rb;_rd.subVectors(b,a).normalize();rcHitE=null;
  for(let t=.6;t<len;t+=.5){p.copy(a).addScaledVector(_rd,t);if(p.y<gh(p.x,p.z)+.02)return p;
    if(piecesNear(p.x,p.z,.3).some(pc=>pieceHitShot(pc,p)))return p;
    for(const e of enemies)if(!e.dead&&Math.hypot(p.x-e.x,p.z-e.z)<e.r&&p.y>e.y-.2&&p.y<e.y+e.hh){rcHitE=e;return p}}
  return p.copy(b)}

// ---------- Per frame (main loop, after droneTick) ----------
function rcTick(dt){
  RC.k=RC.ctl?Math.min(1,RC.k+dt*2.5):Math.max(0,RC.k-Math.max(dt,1/60)*4);
  if(RC.state==='down'){RC.rebuildT-=dt;if(RC.rebuildT<=0){RC.state='dock';RC.hp=RCB.hp;toast('Bike ready',1.2)}}
  RC.mg=false;if(!rcOut())return;
  if(RC.ctl&&(pl.dead||mode!==0||run))rcRelease();
  if(RC.ctl)car.v*=Math.exp(-dt*5); // the rig rolls to a stop while its driver is busy
  const fx=Math.cos(RC.h),fz=-Math.sin(RC.h);
  if(RC.state==='launch'){RC.x+=fx*RC.v*dt;RC.z+=fz*RC.v*dt;RC.vy-=22*dt;RC.y+=RC.vy*dt;rcG.scale.setScalar(Math.min(1,rcG.scale.x+dt*2.5));
    const g=gh(RC.x,RC.z);if(RC.y<=g&&RC.vy<0){RC.y=g;RC.state='out';rcG.scale.setScalar(1);
      for(let i=0;i<5;i++)smoke(new THREE.Vector3(RC.x,g+.2,RC.z),new THREE.Vector3(rnd(-2,2),rnd(.3,.8),rnd(-2,2)),0x8A7A60,.3,1.4,rnd(.8,1.3),.4)}}
  else{
    const f=RC.ctl?(held('KeyW','ArrowUp')?1:0)-(held('KeyS','ArrowDown')?1:0):0,t=RC.ctl?(held('KeyA','ArrowLeft')?1:0)-(held('KeyD','ArrowRight')?1:0):0;
    RC.fk=RC.form?Math.min(1,RC.fk+dt/RCB.form):Math.max(0,RC.fk-dt/RCB.form);
    if(RC.fk>0&&RC.fk<1)RC.v*=Math.exp(-dt*4); // transforming bleeds off speed
    else if(RC.form){const tv=f>0?RCB.walk:f<0?-RCB.back:0;RC.v+=(tv-RC.v)*Math.min(1,dt*6);RC.h+=t*RCB.mturn*dt} // mech: slow, turns on the spot
    else{if(f>0)RC.v+=(RC.v<0?30:RCB.acc)*dt;else if(f<0)RC.v-=(RC.v>0?30:10)*dt;else RC.v*=Math.exp(-dt*1.2);
      RC.v=Math.max(-RCB.rev,Math.min(RCB.spd*UPG.spd,RC.v));RC.h+=t*RCB.turn*Math.min(1,Math.abs(RC.v)/3)*Math.sign(RC.v)*dt}
    if(Math.abs(RC.v)<.03&&!f)RC.v=0;
    const moved=RC.v*dt;RC.x+=fx*moved;RC.z+=fz*moved;RC.gait+=Math.abs(moved)*2.4;RC.spin-=moved/.36;
    // collisions: scenery, structures, targets, enemies, the rig, map edge, signal range
    const rad=.75;let hit=false;
    for(const s of solids)if(pushOut(RC,s.x,s.z,rad+s.r))hit=true;
    for(const pc of piecesNear(RC.x,RC.z,rad+1))if(obbPush(RC,pc,rad))hit=true;
    for(const o of targets){const h=o.userData.h;if(pushOut(RC,Math.max(o.position.x-h.x,Math.min(RC.x,o.position.x+h.x)),Math.max(o.position.z-h.z,Math.min(RC.z,o.position.z+h.z)),rad))hit=true}
    for(const e of enemies)if(!e.dead)pushOut(RC,e.x,e.z,rad+e.r*.6);
    if(!gyroAir())pushOut(RC,car.x,car.z,CR+rad);
    if(hit)RC.v*=Math.abs(RC.v)>8?.5:.9;
    const lim=PLAY-1;RC.x=Math.max(-lim,Math.min(lim,RC.x));RC.z=Math.max(-lim,Math.min(lim,RC.z));
    const ox=RC.x-car.x,oz=RC.z-car.z,od=Math.hypot(ox,oz);if(od>RCB.range){RC.x=car.x+ox/od*RCB.range;RC.z=car.z+oz/od*RCB.range;RC.v*=.9}
    // follow the ground; the bike leans into its turns
    const hf=gh(RC.x+fx*.7,RC.z+fz*.7),hb=gh(RC.x-fx*.7,RC.z-fz*.7),k=Math.min(1,dt*10),bk=1-RC.fk;
    RC.pitch+=(Math.atan2(hf-hb,1.4)*bk-RC.pitch)*k;RC.roll+=(Math.max(-.5,Math.min(.5,-t*.45*Math.sign(RC.v||1)))*Math.min(1,Math.abs(RC.v)/7)*bk-RC.roll)*Math.min(1,dt*5);RC.y+=((hf+hb)/2-RC.y)*k;
    RC.dustT+=dt;if(Math.abs(RC.v)>7&&RC.dustT>.06){RC.dustT=0;smoke(new THREE.Vector3(RC.x-fx*.8,RC.y+.15,RC.z-fz*.8),new THREE.Vector3(-fx*2+rnd(-.4,.4),rnd(.3,.8),-fz*2+rnd(-.4,.4)),0x8A7A60,.25,rnd(1,1.6),rnd(.7,1.1),.35)}}
  // pose: blend bike -> mech, spin the wheels, walk the legs
  const fk=ss(RC.fk);rcPose(fk);rcWheels.forEach(w=>w.rotation.y=RC.spin);
  if(fk>0){const sw=Math.min(1,Math.abs(RC.v)/3)*fk;[0,1].forEach(i=>{const ph=RC.gait+i*PI,lift=Math.max(0,Math.sin(ph))*.16*sw,fwd=Math.cos(ph)*.2*sw;
      rcWheels[i].position.x+=fwd;rcWheels[i].position.y+=lift;rcLegs[i].position.x+=fwd*.5;rcLegs[i].position.y+=lift*.6;rcLegs[i].rotation.z=-fwd*.6});
    rcBody.position.y+=Math.abs(Math.sin(RC.gait))*.04*sw}
  rcG.position.set(RC.x,RC.y,RC.z);rcG.rotation.set(RC.roll,RC.h,RC.pitch);
  RC.blinkT+=dt;rcLampM.emissiveIntensity=RC.ctl?(RC.blinkT%.5<.25?2.6:.5):1; // blinks while under control
  rcMinigun(dt);
  // shadows and the work light follow the bike while it is being driven
  if(RC.k>0){const k=ss(RC.k);DR.focus.x=L(DR.focus.x,RC.x,k);DR.focus.z=L(DR.focus.z,RC.z,k);
    if(rigLamp)rigLamp.position.set(L(rigLamp.position.x,RC.x+fx*3.5,k),L(rigLamp.position.y,RC.y+2.6,k),L(rigLamp.position.z,RC.z+fz*3.5,k))}}

// Minigun (mech form): the arm follows the cursor, the barrels spin up while the trigger is held, then it hoses the
// first thing in the line of fire. An enemy takes RCB.mgDps; anything else takes a tiny blast per tick through
// applyBlast, so walls, cars and foundries are chewed up too. The sound is the turrets' minigun loop and tail (turretTick asks rcMg()).
function rcMinigun(dt){const armed=RC.ctl&&RC.state==='out'&&RC.form===1&&RC.fk>=1&&dt>0;let trig=false;
  if(armed){rcMuz.getWorldPosition(_ra);let has=cursorPoint(RCB.mgRange+40);_rm.copy(aimPt);
    if(has){let best=null,bd=2.2;for(const e of enemies){if(e.dead)continue;const d=Math.hypot(aimPt.x-e.x,aimPt.z-e.z)-e.r;if(d<bd&&aimPt.y<e.y+e.hh+2){bd=d;best=e}} // snap to an enemy by the cursor
      if(best)_rm.set(best.x,best.y+Math.min(1,best.hh*.5),best.z);
      // slew the arm: yaw about the body, then pitch
      const dx=_rm.x-RC.x,dz=_rm.z-RC.z;let yw=Math.atan2(-dz,dx)-RC.h;yw=Math.max(-1.3,Math.min(1.3,Math.atan2(Math.sin(yw),Math.cos(yw))));
      const pt=Math.max(-.6,Math.min(.8,Math.atan2(_rm.y-_ra.y,Math.max(.5,Math.hypot(dx,dz)))));
      rcYaw.rotation.y+=Math.max(-7*dt,Math.min(7*dt,yw-rcYaw.rotation.y));rcPitch.rotation.z+=Math.max(-5*dt,Math.min(5*dt,pt-rcPitch.rotation.z))}
    trig=has&&(firing||keys.Space)}
  else{rcYaw.rotation.y*=Math.exp(-dt*6);rcPitch.rotation.z*=Math.exp(-dt*6)}
  RC.spinK=trig?Math.min(1,RC.spinK+dt/RCB.mgSpin):Math.max(0,RC.spinK-dt*1.5);RC.spinA+=RC.spinK*40*dt;rcSpin.rotation.x=RC.spinA;
  const shooting=trig&&RC.spinK>=1;RC.mg=shooting;
  if(shooting){ // bullets leave along the barrel, out to the gun's range
    rcMuz.getWorldPosition(_ra);_rd.set(1,0,0).applyQuaternion(rcSpin.getWorldQuaternion(_q));const far=_rm.copy(_ra).addScaledVector(_rd,RCB.mgRange),end=rcTrace(_ra,far).clone(),hitE=rcHitE,reach=end.distanceTo(far)>.3;
    RC.dmgT+=dt;if(RC.dmgT>=RCB.mgTick){RC.dmgT=0;
      if(hitE)damageEnemy(hitE,RCB.mgDps*RCB.mgTick);
      else if(reach){end.x+=rnd(-.25,.25);end.y+=rnd(-.2,.2);end.z+=rnd(-.25,.25);RC.self=true;applyBlast(end,RCB.mgPw);RC.self=false;
        if(Math.random()<.5)smoke(end.clone(),new THREE.Vector3(rnd(-.4,.4),rnd(.6,1.2),rnd(-.4,.4)),0x8A7A60,.12,.6,rnd(.4,.7),.5);if(Math.random()<.3)sparks(end,2)}}
    RC.trT-=dt;if(RC.trT<=0){RC.trT=.05;const a=rcLine.geometry.attributes.position.array;_rcC.lerpVectors(_ra,end,rnd(0,.35));a[0]=_rcC.x;a[1]=_rcC.y;a[2]=_rcC.z;_rcC.lerpVectors(_ra,end,rnd(.55,1));a[3]=_rcC.x;a[4]=_rcC.y;a[5]=_rcC.z;
      rcLine.geometry.attributes.position.needsUpdate=true;rcLine.visible=true;RC.lineT=.035}
    trauma=Math.min(1,trauma+dt*.35)}
  RC.lineT-=dt;if(RC.lineT<=0)rcLine.visible=false;
  rcMuz.getWorldPosition(rcFlash.position);rcFlash.material.opacity=shooting?rnd(.5,1):0;rcFlash.scale.setScalar(shooting?rnd(.3,.5):.01)}

// HUD (after droneHud, which owns the rig tag while spotting): bike status pill, and the rig's position + hull while away
function rcHud(){const far=Math.round(Math.hypot(RC.x-car.x,RC.z-car.z)),hp=Math.max(0,Math.round(RC.hp/RCB.hp*100));
  const s=RC.state==='dock'?'Ready':RC.state==='down'?'Rebuilding '+Math.ceil(RC.rebuildT)+' s':(RC.ctl?(RC.form?'Mech ':'Bike '):'Parked ')+hp+'% · '+far+' m';
  if(rcTxt&&rcTxt.textContent!==s)rcTxt.textContent=s;if(rcBtn)rcBtn.classList.toggle('on',RC.ctl);
  if(RC.k<=.3)return;const r=cv.getBoundingClientRect(),hot=clock-pl.lastHit<1.5;let txt='RIG '+Math.round(pl.hp/PL_MAX*100)+'%'+(hot?' · UNDER FIRE':'');
  _rcC.set(car.x,car.y+3,car.z).project(cam);const off=_rcC.z>1||Math.abs(_rcC.x)>.92||Math.abs(_rcC.y)>.88;
  if(off){if(_rcC.z>1){_rcC.x=-_rcC.x;_rcC.y=-_rcC.y}const m=Math.max(Math.abs(_rcC.x)/.92,Math.abs(_rcC.y)/.88,1e-6);_rcC.x/=m;_rcC.y/=m;txt=(_rcC.x<-.5?'◀ ':_rcC.x>.5?'▶ ':_rcC.y<0?'▼ ':'▲ ')+txt}
  rigTag.style.display='block';rigTag.style.left=(r.left+(_rcC.x+1)/2*r.width)+'px';rigTag.style.top=(r.top+(1-_rcC.y)/2*r.height)+'px';if(rigTag.textContent!==txt)rigTag.textContent=txt;rigTag.classList.toggle('hot',hot)}

// Camera: a chase camera on the bike, blended in over the rig's by RC.k (same drag-look and zoom as the rig's)
function rcCamera(tx,ty,tz,ox,oy,rdt){if(RC.k<=0)return;const k=ss(RC.k),fx=Math.cos(RC.h),fz=-Math.sin(RC.h);
  let dy=(PI-RC.h)-RC.cyaw;dy=Math.atan2(Math.sin(dy),Math.cos(dy));RC.cyaw+=dy*Math.min(1,rdt*4);
  const yaw=RC.cyaw+lookOff,el=Math.max(.08,Math.min(1.35,.3+lookEl)),R=L(8.5,9.5,RC.fk)*zoom,ly=RC.y+L(.9,1.7,RC.fk),ax=RC.x+fx*2,az=RC.z+fz*2;
  const cx=ax+Math.cos(yaw)*Math.cos(el)*R,cz=az+Math.sin(yaw)*Math.cos(el)*R,cy=Math.max(gh(cx,cz)+.6,ly+Math.sin(el)*R);
  let want=1;for(let i=1;i<=14;i++){const f=i/14;_rcL.set(L(RC.x,cx,f),L(ly,cy,f),L(RC.z,cz,f));if(piecesNear(_rcL.x,_rcL.z,.4).some(pc=>pieceHitShot(pc,_rcL))){want=Math.max(.12,(i-1.6)/14);break}} // walls between bike and camera
  RC.pull+=(want-RC.pull)*Math.min(1,rdt*(want<RC.pull?18:2.5));
  const px=L(RC.x,cx,RC.pull),pz=L(RC.z,cz,RC.pull);_rcL.set(px+ox,Math.max(gh(px,pz)+.6,L(ly,cy,RC.pull))+oy,pz);
  cam.position.lerp(_rcL,k);cam.lookAt(L(tx,ax,k)+ox*.4,L(ty,ly,k)+oy*.4,L(tz,az,k))}
