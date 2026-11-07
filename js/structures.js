// Destructible structures: scrap walls and sheds with three swap states (0 intact -> 1 damaged -> 2 rubble),
// plus an indestructible scrap perimeter. Deterministic (multiplayer-friendly): shapes come from a per-piece seed,
// state changes are HP thresholds, and rubble raises the terrain into a mound instead of spawning physics bodies.
// Flying debris on a state change is cosmetic only (effects.js chunk()).
// Classic script sharing one global scope with the other js/ files; load order is set in index.html.

const corrTex=(base,rust)=>tex(256,256,(g,w,h)=>{g.fillStyle=base;g.fillRect(0,0,w,h);
  for(let x=0;x<w;x+=16){const gr=g.createLinearGradient(x,0,x+16,0);gr.addColorStop(0,'rgba(0,0,0,.28)');gr.addColorStop(.5,'rgba(255,255,255,.12)');gr.addColorStop(1,'rgba(0,0,0,.28)');g.fillStyle=gr;g.fillRect(x,0,16,h)}
  grime(g,w,h);rustBlobs(g,w,h,rust*10);g.fillStyle='rgba(20,18,15,.5)';for(let y=40;y<h;y+=96)g.fillRect(0,y,w,3)});
const corrM=[SM(corrTex('#6b5a45',5)),SM(corrTex('#5a5f4a',3)),SM(corrTex('#7a4a2c',7))],darkM=SM(metalTex('#2a2622',2),.9,.2);
// HP per piece; a piece shows "damaged" at half HP. STRUCT_DMG scales blast damage (× power, linear falloff like applyBlast).
const STRUCT={wall:{h:2.6,d:.5,hp:120,dmgH:.55},shed:{h:3.3,hp:240,dmgH:.6}},STRUCT_DMG=60,BASH_STRUCT=130,RAM_STRUCT=130;
const pieces=[];

function addPiece(kind,x,z,rot,w,d,seed){const r=rng(seed),S=STRUCT[kind],h=S.h*(.9+r()*.2),c=Math.cos(rot),s=Math.sin(rot);
  const gy=Math.min(gh(x,z),gh(x+c*w/2,z-s*w/2),gh(x-c*w/2,z+s*w/2))-.08;
  const mat=corrM[Math.floor(r()*3)],G=[0,1,2].map(()=>{const g=new THREE.Group();g.position.set(x,gy,z);g.rotation.y=rot;sc.add(g);return g});
  const box=(g,m,bw,bh,bd,px,py,pz,rx=0,rz=0)=>{const o=mk(B(bw,bh,bd),m,px,py,pz,g);o.rotation.x=rx;o.rotation.z=rz;return o};
  if(kind==='wall'){
    box(G[0],mat,w,h,d,0,h/2,0);[-1,1].forEach(e=>box(G[0],steel,.16,h+.25,d+.12,e*(w/2-.08),(h+.25)/2,0));if(r()<.4)box(G[0],hazard,w*.9,.18,d+.04,0,h*.75,0);
    const n=3;for(let i=0;i<n;i++){const sh=h*(.25+r()*(S.dmgH+.15)),sw=w/n-.06;box(G[1],mat,sw,sh,d,(i-(n-1)/2)*(w/n),sh/2,0,(r()-.5)*.12,(r()-.5)*.15)}
    box(G[1],mat,w*.45,d,h*.45,(r()-.5)*w*.4,.3,d/2+h*.2,1.25,0);[-1,1].forEach(e=>box(G[1],steel,.16,h*.6,d+.12,e*(w/2-.08),h*.3,0,0,e*.12));
  }else{ // shed: four walls, door, roof
    const t=.2;[[0,d/2-t/2,w,t],[0,-d/2+t/2,w,t],[-w/2+t/2,0,t,d],[w/2-t/2,0,t,d]].forEach(([px,pz,bw,bd])=>box(G[0],mat,bw,h,bd,px,h/2,pz));
    box(G[0],darkM,.05,h*.62,1.3,w/2+.01,h*.31,0);box(G[0],corrM[(Math.floor(r()*3)+1)%3],w+.5,.14,d+.5,0,h+.05,0,0,.08);
    [[0,d/2-t/2,w,t],[-w/2+t/2,0,t,d],[w/2-t/2,-d*.2,t,d*.6]].forEach(([px,pz,bw,bd])=>{const sh=h*(.35+r()*.45);box(G[1],mat,bw,sh,bd,px,sh/2,pz,(r()-.5)*.1,(r()-.5)*.1)});
    box(G[1],corrM[(Math.floor(r()*3)+1)%3],w+.3,.14,d*.9,0,h*.42,0,.55,.1);
  }
  // rubble: a low heap on the mound that replaces the piece
  const nRub=kind==='wall'?7:13;for(let i=0;i<nRub;i++){const sz=.3+r()*.6;box(G[2],[mat,rusty,concrete,steel][Math.floor(r()*4)],sz*(1+r()),sz*.5,sz,(r()-.5)*w*.9,.35+r()*.25,(r()-.5)*Math.max(d,1.2),r()*.8,r()*.8)}
  if(kind==='shed')box(G[2],mat,w*.6,.1,d*.5,r()-.5,.6,r()-.5,.25,.15);
  const p={kind,x,z,rot,w,d,gy,y0:gy,c,s,hp:S.hp,max:S.hp,state:0,H:[h,h*S.dmgH+.15,.5],g:G,lastRam:-9,blocks:true,debrisM:mat};
  G[1].visible=G[2].visible=false;pieces.push(p);return p}

// Point -> piece-local coords (local x runs along the wall)
const pieceLocal=(p,x,z)=>{const dx=x-p.x,dz=z-p.z;return[dx*p.c-dz*p.s,dx*p.s+dz*p.c]};
// Push a circle (o.x,o.z, radius rad) out of a piece's footprint. Returns the world push normal, or null.
// Pieces have a footprint box (w along local x, d along local z) from height y0 up to y0+H[state].
// blocks=false pieces (upper floors, roof slabs) don't stop movement.
function obbPush(o,p,rad){if(p.blocks===false||p.state===2)return null;const[lx,lz]=pieceLocal(p,o.x,o.z),hw=p.w/2,hd=p.d/2,cx=Math.max(-hw,Math.min(hw,lx)),cz=Math.max(-hd,Math.min(hd,lz));
  let nx=lx-cx,nz=lz-cz,d=Math.hypot(nx,nz);if(d>=rad)return null;
  if(d<1e-4){const px=hw-Math.abs(lx),pz=hd-Math.abs(lz);if(px<pz){nx=Math.sign(lx)||1;nz=0;d=-px}else{nx=0;nz=Math.sign(lz)||1;d=-pz}}else{nx/=d;nz/=d}
  const wx=nx*p.c+nz*p.s,wz=-nx*p.s+nz*p.c,k=rad-d;o.x+=wx*k;o.z+=wz*k;return{x:wx,z:wz}}
// Distance from a 3D point to the piece's current box (for blast falloff)
function pieceDist(p,v){const[lx,lz]=pieceLocal(p,v.x,v.z),dx=Math.max(Math.abs(lx)-p.w/2,0),dz=Math.max(Math.abs(lz)-p.d/2,0),dy=Math.max(v.y-(p.y0+p.H[p.state]),p.y0-v.y,0);return Math.hypot(dx,dy,dz)}
function pieceHitShot(p,sp){if(p.state===2)return false;const[lx,lz]=pieceLocal(p,sp.x,sp.z);return Math.abs(lx)<p.w/2+.1&&Math.abs(lz)<p.d/2+.1&&sp.y<p.y0+p.H[p.state]&&sp.y>p.y0-.1}
const solidPieces=()=>pieces.filter(p=>p.state<2);

function damagePiece(p,dmg,from){if(p.state===2)return;p.hp-=dmg;const ns=p.hp<=0?2:p.hp<=p.max*.5?1:0;if(ns>p.state)setPieceState(p,ns,from)}
// Visual swap: walls/sheds toggle prebuilt groups; other kinds (building panels) provide onState. from=null: no effects.
function setPieceState(p,s,from){p.state=s;if(p.onState)p.onState(p,s);else p.g.forEach((g,i)=>g.visible=i===s);if(!from)return;
  const top=p.y0+p.H[Math.max(0,s-1)],o=new THREE.Vector3(p.x,p.y0+Math.min(1,p.H[0]/2),p.z);
  for(let i=0;i<(s===2?16:9);i++){const lx=(Math.random()-.5)*p.w,lz=(Math.random()-.5)*p.d,q=new THREE.Vector3(p.x+lx*p.c+lz*p.s,p.y0+rnd(.2,Math.max(.4,top-p.y0)),p.z-lx*p.s+lz*p.c);
    chunk(q,rnd(.18,.45),Math.random()<.6?p.debrisM:rusty,rnd(4,8),from,Math.random()<.3)}
  for(let i=0;i<(s===2?12:6);i++){const a=Math.random()*6.28,sp=rnd(1.5,4);smoke(o.clone().add(new THREE.Vector3(Math.cos(a)*p.w*.3,rnd(-.6,.4),Math.sin(a)*p.d*.3)),new THREE.Vector3(Math.cos(a)*sp,rnd(.3,1.2),Math.sin(a)*sp),0x8A7A60,.6,rnd(2.4,3.8),rnd(2,3.5),.55)}
  trauma=Math.min(1,trauma+(s===2?.25:.12)/(1+cam.position.distanceTo(o)*.05));
  if(audio()){const d=cam.position.distanceTo(o),t=AC.currentTime+d/343,a=1/(1+d*.04);nz(t,s===2?.9:.5,1400,70,.75*a);th(t,60,24,.6,.7*a);nz(t+.05,.35,3800,900,.3*a,'bandpass')}
  if(s===2&&!p.onState)mound(p)}
// Raise the heightfield under rubble so vehicles climb over the heap (reset by initGround)
function mound(p){const ext=Math.hypot(p.w,p.d)/2+1;
  editGround(p.x,p.z,ext,(i,x,z)=>{const[lx,lz]=pieceLocal(p,x,z),e=Math.hypot(Math.max(Math.abs(lx)-p.w/2,0),Math.max(Math.abs(lz)-Math.max(p.d,1)/2,0));
    if(e<.9){gHt[i]=Math.max(gHt[i],p.gy+.08+.42*(1-(e/.9)**2));gCol[i*3]*=.93;gCol[i*3+1]*=.93;gCol[i*3+2]*=.92}})}
// Spatial grid (8 m cells) so collisions, shells and blasts only check nearby pieces. Pieces never move,
// so the grid is built once after all structures and buildings exist (buildPieceGrid, called from buildings.js).
const PGC=8,pGrid=new Map();let pStamp=0;const pKey=(i,j)=>i*4096+j;
function buildPieceGrid(){pGrid.clear();pieces.forEach(p=>{const br=Math.hypot(p.w,p.d)/2;
  for(let i=Math.floor((p.x-br)/PGC);i<=Math.floor((p.x+br)/PGC);i++)for(let j=Math.floor((p.z-br)/PGC);j<=Math.floor((p.z+br)/PGC);j++){const k=pKey(i,j);if(!pGrid.has(k))pGrid.set(k,[]);pGrid.get(k).push(p)}})}
function piecesNear(x,z,r){const out=[];pStamp++;
  for(let i=Math.floor((x-r)/PGC);i<=Math.floor((x+r)/PGC);i++)for(let j=Math.floor((z-r)/PGC);j<=Math.floor((z+r)/PGC);j++){const l=pGrid.get(pKey(i,j));if(l)for(const p of l)if(p._q!==pStamp){p._q=pStamp;if(p.state<2)out.push(p)}}
  return out}
function resetStructures(){pieces.forEach(p=>{p.hp=p.max;setPieceState(p,0,null)})}

// Build the layout (LAYOUT lives in world.js so scenery can avoid it). Walls are cut into ~2.5 m segments.
LAYOUT.forEach((it,i)=>{if(it.k==='shed')addPiece('shed',it.x,it.z,it.rot,4.2,4.2,i*97+1);
  else{const n=Math.max(1,Math.round(it.w/2.5)),sw=it.w/n,c=Math.cos(it.rot),s=Math.sin(it.rot);for(let j=0;j<n;j++){const o=(j-(n-1)/2)*sw;addPiece('wall',it.x+o*c,it.z-o*s,it.rot,sw-.05,STRUCT.wall.d,i*97+j*13+5)}}});

// Indestructible scrap perimeter just outside the play area (hides the map edge; shots already stop at ±58)
(()=>{const r=rng(4242),per=[],e=HALF-1.1;for(let a=-HALF;a<=HALF;a+=2.1)per.push([a,-e,0],[a,e,0],[-e,a,PI/2],[e,a,PI/2]);
  [0,1,2].forEach(mi=>{const list=per.filter((_,i)=>i%3===mi),im=new THREE.InstancedMesh(B(2.3,1,.45),corrM[mi],list.length),m=new THREE.Matrix4(),q=new THREE.Quaternion(),e=new THREE.Euler();
    list.forEach(([x,z,ry],i)=>{const h=2.6+r()*3.4;e.set((r()-.5)*.12,ry+(r()-.5)*.25,(r()-.5)*.1);q.setFromEuler(e);m.compose(new THREE.Vector3(x,gh(x,z)+h/2-.3,z),q,new THREE.Vector3(1,h,1));im.setMatrixAt(i,m)});
    im.castShadow=im.receiveShadow=true;sc.add(im)})})();
