// Aiming: ballistic solver, artillery turret and click-to-target, buggy/mech mouse aim, impact marker.
// Classic script sharing one global scope with the other js/ files; load order is set in index.html.

// ---------- Aiming: artillery turret + predicted impact marker ----------
// FIRE per mode: [muzzle speed, blast power]. Blast radius on targets is 2.3*power (see explode).
const FIRE=[[30,.7],[24,1.6],[32,1.05]],RELOAD=[.3,2.2,.6];let reloadT=0;
const AIM={yaw:0,elev:.25,k:0},ELEV_MIN=.03,ELEV_MAX=1.45,YAW_MAX=PI*.75;
const pivArtPose=parts.find(pt=>pt.o===piv).po[1];
const impactP=new THREE.Vector3();
// owner: 'player' or the enemy that fired; a shell never hits its own shooter
function shotHits(sp,owner='player'){if(sp.y<gh(sp.x,sp.z)+.05||Math.abs(sp.x)>58||Math.abs(sp.z)>58)return true;
  for(const o of targets){const h=o.userData.h;if(Math.abs(o.position.x-sp.x)<h.x+.15&&Math.abs(o.position.y-sp.y)<h.y+.15&&Math.abs(o.position.z-sp.z)<h.z+.15)return true}
  for(const pc of pieces)if(pieceHitShot(pc,sp))return true;
  for(const e of enemies)if(!e.dead&&e!==owner&&Math.hypot(sp.x-e.x,sp.z-e.z)<e.r&&sp.y>e.y-.2&&sp.y<e.y+e.hh)return true;
  if(owner!=='player'&&!pl.dead&&Math.hypot(sp.x-car.x,sp.z-car.z)<(mode===1?1.6:1.3)&&sp.y>car.y-.2&&sp.y<car.y+PL_H[mode])return true;
  return false}
const ARC_N=240,arcGeo=new THREE.BufferGeometry();arcGeo.setAttribute('position',new THREE.BufferAttribute(new Float32Array(ARC_N*3),3));
const arc=new THREE.Line(arcGeo,new THREE.LineBasicMaterial({color:0xFFB347,transparent:true,opacity:.6,depthWrite:false}));arc.frustumCulled=false;sc.add(arc);
const ringM=new THREE.MeshBasicMaterial({color:0xFFB347,transparent:true,opacity:.8,depthWrite:false,side:THREE.DoubleSide});
const marker=new THREE.Group();sc.add(marker);
const blastRing=new THREE.Mesh(new THREE.RingGeometry(.93,1,56).rotateX(-PI/2),ringM);marker.add(blastRing); // scaled to blast radius
marker.add(new THREE.Mesh(new THREE.RingGeometry(.12,.26,24).rotateX(-PI/2),ringM));
[0,1,2,3].forEach(i=>{const tick=new THREE.Mesh(new THREE.PlaneGeometry(.06,.5).rotateX(-PI/2),ringM);tick.rotation.y=i*PI/2;tick.position.set(Math.cos(i*PI/2)*.55,0,-Math.sin(i*PI/2)*.55);marker.add(tick)});
const _q=new THREE.Quaternion(),_v=new THREE.Vector3();
// Step a virtual shell with the same gravity/integration as real shots until it hits; fills the arc line.
function predict(){const p=new THREE.Vector3();muz.getWorldPosition(p);gun.getWorldQuaternion(_q);_v.set(1,0,0).applyQuaternion(_q).multiplyScalar(FIRE[mode][0]);
  const a=arcGeo.attributes.position.array,h=1/60;let n=0;const put=()=>{if(n<ARC_N){a[n*3]=p.x;a[n*3+1]=p.y;a[n*3+2]=p.z;n++}};put();
  for(let i=0;i<720;i++){_v.y-=9.8*h;p.addScaledVector(_v,h);if(i%3===2)put();
    if(shotHits(p)){put();arcGeo.setDrawRange(0,n);arcGeo.attributes.position.needsUpdate=true;impactP.copy(p);impactP.y=Math.max(gh(p.x,p.z),p.y-.05)+.08;return true}}
  return false}
// Buggy/mech mouse aim: raycast the cursor into the world, solve the low ballistic arc to that point,
// convert the wanted world direction into hull space (so slopes are handled) and slew the gun toward it.
const TURRET={0:{yaw:2.1,lo:-.25,hi:.8,rate:6},2:{yaw:.6,lo:-.35,hi:.6,rate:3}}; // yaw/elev limits (rad), slew rad/s
const GA={yaw:0,elev:0,k:0,fresh:true},ray=new THREE.Raycaster(),aimPt=new THREE.Vector3(),_pv=new THREE.Vector3(),_d=new THREE.Vector3();
const pivPoses=parts.find(pt=>pt.o===piv).po;
function cursorPoint(){if(!mouseIn)return false;ray.setFromCamera(mouse,cam);const o=ray.ray.origin,d=ray.ray.direction;
  let best=160;const hit=ray.intersectObjects(targets.concat(enemies.filter(e=>!e.dead).map(e=>e.g),solidPieces().map(p=>p.g[p.state])),true)[0];if(hit)best=hit.distance;
  for(let t=1;t<best;t+=.4){const x=o.x+d.x*t,z=o.z+d.z*t;if(o.y+d.y*t<gh(x,z)){best=t-.2;break}} // march the heightfield
  aimPt.copy(o).addScaledVector(d,best);if(best>=160)aimPt.y=gh(aimPt.x,aimPt.z); // aiming at sky: use the far ground point
  return true}
// Ballistic solve: the hull-space gun yaw/elevation that lands a shell of speed v on `target`.
// high=true picks the lobbing arc. Solves from the pivot, then re-solves from the estimated muzzle position
// (barrel length along the first answer) so long barrels don't throw the shot off. ok=false: out of range (aims 45°).
const _mz=new THREE.Vector3(),_o=new THREE.Vector3(),_hq=new THREE.Quaternion();
function solveHull(target,v,high){piv.getWorldPosition(_pv);const Lb=muz.getWorldPosition(_mz).distanceTo(_pv),g=9.8;_o.copy(_pv);let ok=true;
  for(let it=0;it<2;it++){const dx=target.x-_o.x,dz=target.z-_o.z,dy=target.y-_o.y,dh=Math.max(.5,Math.hypot(dx,dz)),disc=v**4-g*(g*dh*dh+2*dy*v*v);
    ok=disc>=0;const sq=ok?Math.sqrt(disc):0,th=ok?Math.atan2(v*v+(high?sq:-sq),g*dh):PI/4,yw=Math.atan2(-dz,dx);
    _d.set(Math.cos(th)*Math.cos(yw),Math.sin(th),-Math.cos(th)*Math.sin(yw));_o.copy(_pv).addScaledVector(_d,Lb)}
  _d.applyQuaternion(root.getWorldQuaternion(_hq).invert()); // world direction -> hull space (handles slopes)
  return{yaw:Math.atan2(-_d.z,_d.x),elev:Math.atan2(_d.y,Math.hypot(_d.x,_d.z)),ok}}
function gunAim(dt){
  const on=(mode===0||mode===2)&&!run;GA.k=on?Math.min(1,GA.k+dt*4):0;
  if(!on){GA.fresh=true;return}
  const pp=pivPoses[mode],T=TURRET[mode];if(GA.fresh){GA.yaw=pp.r[1];GA.elev=pp.r[2];GA.fresh=false}
  let ty=pp.r[1],te=pp.r[2];
  if(cursorPoint()){const s=solveHull(aimPt,FIRE[mode][0],false);ty=Math.max(-T.yaw,Math.min(T.yaw,s.yaw));te=Math.max(T.lo,Math.min(T.hi,s.elev))}
  const s=T.rate*dt;let dyaw=ty-GA.yaw;dyaw=Math.atan2(Math.sin(dyaw),Math.cos(dyaw));
  GA.yaw+=Math.max(-s,Math.min(s,dyaw));GA.elev+=Math.max(-s,Math.min(s,te-GA.elev));
  piv.rotation.y=L(pp.r[1],GA.yaw,GA.k);piv.rotation.z=L(pp.r[2],GA.elev,GA.k)}
// Red target marker for an artillery click: bracket corners around a centre dot
const tgtM=new THREE.MeshBasicMaterial({color:0xE5533D,transparent:true,opacity:.9,depthWrite:false,side:THREE.DoubleSide});
const tgtMark=new THREE.Group();tgtMark.visible=false;sc.add(tgtMark);
tgtMark.add(new THREE.Mesh(new THREE.CircleGeometry(.18,16).rotateX(-PI/2),tgtM));
[0,1,2,3].forEach(i=>{const a=i*PI/2+PI/4,c=new THREE.Group();c.rotation.y=a;tgtMark.add(c);
  const m1=new THREE.Mesh(new THREE.PlaneGeometry(.7,.09).rotateX(-PI/2),tgtM);m1.position.set(1.15,.02,-.3);c.add(m1);
  const m2=new THREE.Mesh(new THREE.PlaneGeometry(.09,.7).rotateX(-PI/2),tgtM);m2.position.set(1.46,.02,0);c.add(m2)});
let lastSt='';
function aimTick(dt){
  const active=mode===1&&!run;AIM.k=active?Math.min(1,AIM.k+dt*2.5):0;
  let lockInfo='';
  if(active){const fine=held('ShiftLeft','ShiftRight')?.25:1;
    const e=(held('KeyW','ArrowUp')?1:0)-(held('KeyS','ArrowDown')?1:0),t=(held('KeyA','ArrowLeft')?1:0)-(held('KeyD','ArrowRight')?1:0);
    if(e||t)AIM.lock=null; // manual adjustment cancels a click target
    if(AIM.lock){ // slew toward the clicked spot, then fire once aligned and loaded
      let s=solveHull(AIM.lock,FIRE[1][0],AIM.high),arcName=AIM.high?'high arc':'direct';
      if(AIM.high&&s.elev>ELEV_MAX){s=solveHull(AIM.lock,FIRE[1][0],false);arcName='direct (too close to lob)'}
      const ty=Math.max(-YAW_MAX,Math.min(YAW_MAX,s.yaw)),te=Math.max(ELEV_MIN,Math.min(ELEV_MAX,s.elev));
      const ys=1.3*dt,es=.8*dt;let dy=ty-AIM.yaw;dy=Math.atan2(Math.sin(dy),Math.cos(dy));
      AIM.yaw+=Math.max(-ys,Math.min(ys,dy));AIM.elev+=Math.max(-es,Math.min(es,te-AIM.elev));
      const aligned=Math.abs(ty-AIM.yaw)<.004&&Math.abs(te-AIM.elev)<.004&&AIM.k>=1,canHit=s.ok&&ty===s.yaw;
      if(AIM.pending&&aligned&&canHit&&reloadT<=0){AIM.pending=false;fire()}
      lockInfo=` · target ${Math.round(Math.hypot(AIM.lock.x-car.x,AIM.lock.z-car.z))} m, ${arcName}, `+(!s.ok?'out of range':ty!==s.yaw?'outside traverse':!aligned?'laying gun…':AIM.pending?'firing when loaded':'on target');
    }else{AIM.elev=Math.max(ELEV_MIN,Math.min(ELEV_MAX,AIM.elev+e*.45*fine*dt));AIM.yaw=Math.max(-YAW_MAX,Math.min(YAW_MAX,AIM.yaw+t*.9*fine*dt))}
    piv.rotation.y=L(pivArtPose.r[1],AIM.yaw,AIM.k);piv.rotation.z=L(pivArtPose.r[2],AIM.elev,AIM.k)}
  else AIM.lock=null;
  tgtMark.visible=!!AIM.lock;if(AIM.lock){tgtMark.position.copy(AIM.lock);tgtMark.rotation.y+=dt*.8}
  gunAim(dt);
  arc.visible=marker.visible=false;if(run||!predict())return;
  marker.visible=true;arc.visible=mode===1;marker.position.copy(impactP);blastRing.scale.setScalar(2.3*FIRE[mode][1]);
  const ready=reloadT<=0,pulse=.85+.15*Math.sin(clock*7);
  ringM.color.setHex(ready?0xFFB347:0x9A8F80);ringM.opacity=(mode===1?.85:.4)*(ready?pulse:.5);arc.material.opacity=ready?.6:.2;
  if(active){const s=`Artillery · range ${Math.round(Math.hypot(impactP.x-car.x,impactP.z-car.z))} m · elev ${Math.round(AIM.elev*180/PI)}° · traverse ${Math.round(AIM.yaw*180/PI)}°${ready?'':' · reloading'}${lockInfo||' · click ground to target (Shift-click: direct fire), W/S/A/D adjust'}`;
    if(s!==lastSt){st.textContent=lastSt=s}}else lastSt=''}
