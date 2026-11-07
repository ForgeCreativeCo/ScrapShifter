// Destructible parked cars. Each car becomes a piece (kind 'car') so shells, blasts, the shield bash and rams all
// damage it through the shared piece system (damagePiece / pieceHitShot / pieceDist / piecesNear).
// States: intact -> damaged (darkened, dented, smoking) -> wrecked: it explodes a moment later (which can set off
// neighbours in a staggered chain), burns, then smoulders as a charred husk. Husks still block movement through the
// car's `solids` circles (props.js); the piece stops catching shells once wrecked. Visuals change the car's instances.
// Classic script sharing one global scope with the other js/ files; load order is set in index.html.

// CAR_DMG: cars take extra blast damage, so a wreck's fuel explosion (CAR_BOOM) wrecks the car parked behind it
const CAR_HP=70,CAR_DMG=1.6,CAR_BOOM=1.8,CAR_BURN=14,carPieces=[],carBoom=[],carDebrisM=new THREE.MeshStandardMaterial({color:0x6b6f73,roughness:.5,metalness:.5});
const _cm=new THREE.Matrix4(),_cq=new THREE.Quaternion(),_cv=new THREE.Vector3(),_csc=new THREE.Vector3(),_cZero=new THREE.Matrix4().makeScale(0,0,0),charCol=new THREE.Color(0x1c1a17);
if(carInst){carInst.list.forEach((c,i)=>{const gy=gh(c.x,c.z);
  const p={kind:'car',x:c.x,z:c.z,rot:c.rot,c:Math.cos(c.rot),s:Math.sin(c.rot),w:4.3,d:1.85,y0:gy,gy,H:[1.55,1.4,0],hp:CAR_HP,max:CAR_HP,state:0,
    blocks:false,dmgMul:CAR_DMG,lastRam:-9,debrisM:carDebrisM,onState:carState,car:c,idx:i,fxT:0,burnT:0};pieces.push(p);carPieces.push(p)});
  buildPieceGrid()} // re-index with the cars included

// sag a stored instance matrix: drop it by dy and squash its height by sy
const sagM=(m,dy,sy)=>{m.decompose(_cv,_cq,_csc);_cv.y+=dy;_csc.y*=sy;return _cm.compose(_cv,_cq,_csc)};
function carState(p,s){const c=p.car,I=carInst;
  I.body.setMatrixAt(p.idx,s===2?sagM(c.mBody,-.2,.78):s===1?sagM(c.mBody,-.03,.96):c.mBody);
  I.cabin.setMatrixAt(p.idx,s===2?sagM(c.mCab,-.38,.6):c.mCab);
  c.wi.forEach(([k,m])=>I.wheel.setMatrixAt(k,s===2?_cZero:m)); // tyres burn away on a wreck
  I.body.setColorAt(p.idx,s===2?charCol:s===1?_cCol.copy(c.col).multiplyScalar(.5):c.col);
  I.body.instanceMatrix.needsUpdate=I.cabin.instanceMatrix.needsUpdate=I.wheel.instanceMatrix.needsUpdate=true;I.body.instanceColor.needsUpdate=true;
  const q=carBoom.findIndex(b=>b.p===p);if(q>=0)carBoom.splice(q,1);
  if(s===0){p.burnT=0;return}
  if(s===2){carBoom.push({p,t:rnd(.12,.45)});p.burnT=CAR_BURN}} // the fuel tank goes a beat later
const _cCol=new THREE.Color();

// Pending explosions, fire and smoke for damaged/wrecked cars near the camera
function carsTick(dt){
  for(let i=carBoom.length-1;i>=0;i--){const b=carBoom[i];b.t-=dt;if(b.t<=0){carBoom.splice(i,1);explode(new THREE.Vector3(b.p.x,b.p.y0+.9,b.p.z),CAR_BOOM)}}
  for(const p of carPieces){if(p.state===0)continue;if(Math.abs(p.x-cam.position.x)>130||Math.abs(p.z-cam.position.z)>130)continue;
    p.fxT-=dt;if(p.fxT>0)continue;const hood=new THREE.Vector3(p.x+p.c*1.4,p.y0+1.0,p.z-p.s*1.4);
    if(p.state===2&&p.burnT>0){p.burnT-=.1;p.fxT=.1;const q=new THREE.Vector3(p.x+rnd(-1.2,1.2)*p.c,p.y0+.9,p.z-rnd(-1.2,1.2)*p.s);
      fireball(q,new THREE.Vector3(rnd(-.3,.3),rnd(1.2,2.2),rnd(-.3,.3)),.35,1.1*(.4+.6*p.burnT/CAR_BURN),rnd(.4,.7));
      if(Math.random()<.6)smoke(q.clone().setY(q.y+1),new THREE.Vector3(rnd(-.2,.2),rnd(1.5,2.5),rnd(-.2,.2)),0x1f1c19,.6,3,rnd(4,6),.55)}
    else if(p.state===2){p.fxT=.7;smoke(hood.setY(p.y0+.6),new THREE.Vector3(0,rnd(.6,1.1),0),0x3a3632,.3,1.8,rnd(3,4),.35)} // smouldering husk
    else{p.fxT=.35;smoke(hood,new THREE.Vector3(rnd(-.15,.15),rnd(.7,1.2),rnd(-.15,.15)),0x9a958c,.25,1.4,rnd(2,3),.4)}}} // damaged: steam from the engine
