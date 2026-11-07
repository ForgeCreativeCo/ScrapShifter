// Town buildings: multi-floor shells made of wall panels (one piece per 4 m module, per floor, per side) plus a
// floor/roof slab per level. Same deterministic swap-state rules as other pieces: panel intact -> damaged -> gone.
// Collapse: when half of a floor's wall panels are gone, that floor and everything above pancakes into a rubble
// heap (terrain mound). Ground floors are tall workshop bays so the mech fits inside once it breaks in.
// Intact panels and slabs draw as InstancedMeshes (a handful of draw calls for the whole town); damaged/destroyed
// visuals are separate meshes created only when a panel changes state.
// Classic script sharing one global scope with the other js/ files; load order is set in index.html.

const MOD=4,FH0=5.6,FH=3.4,PT=.4,SLAB=.35,PANEL_HP=[130,90],SLAB_HP=160,COLLAPSE_FRAC=.5;

// ---------- Facade textures: style (brick / concrete / corrugated) x variant (window / shopfront / plain)
function brickDraw(g,w,h){g.fillStyle='#7a4434';g.fillRect(0,0,w,h);const bh=10,bw=28;
  for(let y=0,row=0;y<h;y+=bh,row++)for(let x=(row%2)*-bw/2;x<w;x+=bw){g.fillStyle=`rgb(${110+Math.random()*30|0},${55+Math.random()*20|0},${42+Math.random()*15|0})`;g.fillRect(x+1,y+1,bw-2,bh-2)}
  grime(g,w,h);for(let i=0;i<8;i++){g.fillStyle=`rgba(30,26,22,${Math.random()*.3})`;g.fillRect(Math.random()*w,0,4+Math.random()*12,h*Math.random())}} // soot streaks
function concDraw(g,w,h){g.fillStyle='#8a867c';g.fillRect(0,0,w,h);grime(g,w,h);g.fillStyle='rgba(40,36,30,.35)';for(let y=48;y<h;y+=64)g.fillRect(0,y,w,2);
  for(let i=0;i<14;i++){g.fillStyle=`rgba(60,50,40,${Math.random()*.25})`;g.fillRect(Math.random()*w,Math.random()*h*.3,3+Math.random()*10,40+Math.random()*120)}}
function corrDraw(g,w,h){g.fillStyle='#6b5a45';g.fillRect(0,0,w,h);for(let x=0;x<w;x+=16){const gr=g.createLinearGradient(x,0,x+16,0);gr.addColorStop(0,'rgba(0,0,0,.28)');gr.addColorStop(.5,'rgba(255,255,255,.12)');gr.addColorStop(1,'rgba(0,0,0,.28)');g.fillStyle=gr;g.fillRect(x,0,16,h)}grime(g,w,h);rustBlobs(g,w,h,40)}
const STYLE_DRAW={brick:brickDraw,concrete:concDraw,corr:corrDraw},STYLES=Object.keys(STYLE_DRAW),VARIANTS=['win','shop','plain'];
function facadeTex(style,variant){return tex(256,256,(g,w,h)=>{STYLE_DRAW[style](g,w,h);
  if(variant==='win'){g.fillStyle='#3a3530';g.fillRect(w*.27,h*.22,w*.46,h*.44);g.fillStyle='#15181b';g.fillRect(w*.3,h*.25,w*.4,h*.38);
    g.fillStyle='rgba(180,190,190,.25)';g.beginPath();g.moveTo(w*.3,h*.25);g.lineTo(w*.45,h*.25);g.lineTo(w*.3,h*.45);g.fill();g.fillStyle='#3a3530';g.fillRect(w*.49,h*.25,w*.02,h*.38)} // cracked pane, mullion
  else if(variant==='shop'){g.fillStyle='#2a2622';g.fillRect(w*.12,h*.35,w*.76,h*.65);for(let y=h*.37;y<h*.7;y+=7){g.fillStyle='rgba(120,110,95,.5)';g.fillRect(w*.13,y,w*.74,3)} // half-raised roller door
    g.fillStyle='#0f1112';g.fillRect(w*.13,h*.72,w*.74,h*.28);g.fillStyle='#a8832e';g.fillRect(w*.12,h*.33,w*.76,h*.03)}})}
const facadeM={},plainM={};STYLES.forEach(st=>{VARIANTS.forEach(v=>facadeM[st+'_'+v]=SM(facadeTex(st,v),.9,.12));plainM[st]=facadeM[st+'_plain']});
const roofM=SM(tex(256,256,(g,w,h)=>{g.fillStyle='#4a4640';g.fillRect(0,0,w,h);grime(g,w,h);g.strokeStyle='rgba(20,18,15,.5)';for(let i=0;i<5;i++){g.beginPath();g.moveTo(Math.random()*w,0);g.lineTo(Math.random()*w,h);g.stroke()}}),.95,.05);

// ---------- Build
const buildings=[],bldMeshes=[],_bm=new THREE.Matrix4(),_bq=new THREE.Quaternion(),_bs=new THREE.Vector3(),_bp=new THREE.Vector3(),_zero=new THREE.Matrix4().makeScale(0,0,0);
const instSpecs={}; // material key -> [{piece, matrix}]
const panelMatrix=p=>{_bq.setFromAxisAngle(new THREE.Vector3(0,1,0),p.rot);_bp.set(p.x,p.y0+p.H[0]/2,p.z);_bs.set(p.w,p.H[0],p.d);return new THREE.Matrix4().compose(_bp.clone(),_bq.clone(),_bs.clone())};
function addBuilding(b,bi){const r=rng(MAP.seed*1000+bi*17+3),c=Math.cos(b.rot),s=Math.sin(b.rot),W=b.mx*MOD,D=b.mz*MOD;
  const toW=(lx,lz)=>[b.x+lx*c+lz*s,b.z-lx*s+lz*c];
  const gy=Math.min(gh(b.x,b.z),...[[1,1],[1,-1],[-1,1],[-1,-1]].map(([u,v])=>gh(...toW(u*W/2,v*D/2))))-.1;
  const B={...b,W,D,c,s,gy,levels:[],slabs:[],collapsedFrom:b.floors,rubble:null};buildings.push(B);
  const piece=(o)=>{const p={c:Math.cos(o.rot),s:Math.sin(o.rot),state:0,lastRam:-9,bld:B,seed:Math.floor(r()*1e9),onState:o.kind==='slab'?slabState:panelState,...o};p.max=p.hp;pieces.push(p);return p};
  for(let f=0;f<b.floors;f++){const y0=gy+(f?FH0+(f-1)*FH:0),h=f?FH:FH0,lvl=[];B.levels.push(lvl);
    const add=(lx,lz,rot,w)=>{const[x,z]=toW(lx,lz),v=f===0?(r()<.4?'shop':r()<.55?'win':'plain'):(r()<.72?'win':'plain'),key=b.style+'_'+v;
      const p=piece({kind:'panel',level:f,x,z,rot,w,d:PT,y0,gy:y0,H:[h,h*.6,0],hp:PANEL_HP[f?1:0],blocks:f===0,style:b.style,key,debrisM:plainM[b.style]});
      (instSpecs[key]=instSpecs[key]||[]).push(p);lvl.push(p)};
    [1,-1].forEach(side=>{for(let i=0;i<b.mx;i++)add((i-(b.mx-1)/2)*MOD,side*(D/2-PT/2),b.rot,MOD)});
    // end walls sit between the long walls (shortened at the corners so faces don't overlap)
    [1,-1].forEach(side=>{for(let j=0;j<b.mz;j++){const end=j===0||j===b.mz-1,w=MOD-(end?PT:0),off=end?(j===0?PT/2:-PT/2):0;add(side*(W/2-PT/2),(j-(b.mz-1)/2)*MOD+off,b.rot+PI/2,w)}});
    const sp=piece({kind:'slab',level:f,x:b.x,z:b.z,rot:b.rot,w:W,d:D,y0:y0+h-SLAB,gy:y0+h-SLAB,H:[SLAB,SLAB,0],hp:SLAB_HP,blocks:false,key:'roof',debrisM:roofM});
    (instSpecs.roof=instSpecs.roof||[]).push(sp);B.slabs.push(sp)}
  return B}

// Panel/slab visuals for each state. Intact = an instance; damaged = jagged strips; destroyed = gone (ground floor leaves debris)
function setInst(p,on){p.inst.mesh.setMatrixAt(p.inst.i,on?p.inst.m:_zero);p.inst.mesh.instanceMatrix.needsUpdate=true}
function clearDmg(p){if(p.dmg){sc.remove(p.dmg);p.dmg=null}}
function panelState(p,s){setInst(p,s===0);clearDmg(p);if(s===0)return;const r=rng(p.seed+s),h=p.H[0],m=plainM[p.style];
  const g=new THREE.Group();g.position.set(p.x,p.y0,p.z);g.rotation.y=p.rot;sc.add(g);p.dmg=g;
  if(s===1){const n=3,sw=p.w/n;for(let i=0;i<n;i++){const sh=h*(.3+r()*.65),o=mk(B(sw-.05,sh,p.d),m,(i-(n-1)/2)*sw,sh/2,0,g);o.rotation.z=(r()-.5)*.08;o.rotation.x=(r()-.5)*.06}
    const lint=mk(B(p.w,.3,p.d+.05),m,0,h*(.75+r()*.2),0,g);lint.rotation.z=(r()-.5)*.25;lint.visible=r()<.6;} // sagging lintel
  else if(p.level===0){for(let i=0;i<5;i++){const sz=.4+r()*.7,o=mk(B(sz*1.4,sz*.5,sz),r()<.5?m:concrete,(r()-.5)*p.w,sz*.25,(r()-.5)*1.2,g);o.rotation.set(r()*.6,r()*3,r()*.6)}}
  if(s===2&&!B_collapsing)checkCollapse(p.bld)}
function slabState(p,s){setInst(p,s===0);clearDmg(p);if(s===1){const g=new THREE.Group();g.position.set(p.x,p.y0,p.z);g.rotation.y=p.rot;sc.add(g);p.dmg=g;
  const r=rng(p.seed);[[-.25,-.25],[.25,-.25],[-.25,.25],[.25,.25]].forEach(([u,v])=>{if(r()<.75){const o=mk(B(p.w*.5,SLAB,p.d*.5),roofM,u*p.w,SLAB/2-r()*.4,v*p.d,g);o.rotation.set((r()-.5)*.2,0,(r()-.5)*.2)}})}}

// ---------- Collapse
let B_collapsing=false;
function checkCollapse(B){for(let f=0;f<B.collapsedFrom;f++){const lv=B.levels[f],gone=lv.filter(p=>p.state===2).length;
  if(gone/lv.length>=COLLAPSE_FRAC){collapseFrom(B,f);return}}}
function collapseFrom(B,f){B_collapsing=true;const was=B.collapsedFrom;B.collapsedFrom=f;
  for(let l=f;l<was;l++){B.levels[l].forEach(p=>{if(p.state<2){p.hp=0;setPieceState(p,2,null)}});const sl=B.slabs[l];if(sl.state<2){sl.hp=0;setPieceState(sl,2,null)}}
  if(f>0){const sl=B.slabs[f-1];if(sl.state<1){sl.hp=Math.min(sl.hp,sl.max*.5);setPieceState(sl,1,null)}} // falling floors crack the slab they land on
  B_collapsing=false;
  // rubble heap over the footprint, taller for taller buildings; the top of a part-collapse lands on the floors below
  const floorsDown=was-f,heap=f===0?.5+.45*floorsDown:0;
  if(f===0)editGround(B.x,B.z,Math.hypot(B.W,B.D)/2+2.5,(i,x,z)=>{const dx=x-B.x,dz=z-B.z,lx=dx*B.c-dz*B.s,lz=dx*B.s+dz*B.c,e=Math.hypot(Math.max(Math.abs(lx)-B.W/2+1,0),Math.max(Math.abs(lz)-B.D/2+1,0));
    if(e<3){gHt[i]=Math.max(gHt[i],B.gy+.1+heap*(1-ss(e/3)));gCol[i*3]*=.9;gCol[i*3+1]*=.9;gCol[i*3+2]*=.89}});
  if(f===0){if(B.rubble)sc.remove(B.rubble);const g=new THREE.Group(),r=rng(B.seed||7);sc.add(g);B.rubble=g;
    for(let i=0;i<10+floorsDown*6;i++){const lx=(r()-.5)*B.W*.9,lz=(r()-.5)*B.D*.9,x=B.x+lx*B.c+lz*B.s,z=B.z-lx*B.s+lz*B.c,sz=.5+r()*1.1,o=mk(B_box(sz*1.5,sz*.45,sz),[plainM[B.style],concrete,roofM,steel][Math.floor(r()*4)],x,gh(x,z)+sz*.15,z,g);o.rotation.set(r()*.7,r()*3,r()*.7)}}
  // effects: a rolling dust cloud and a deep rumble, scaled by how much came down
  const top=B.gy+FH0+(was-1)*FH,cy=B.gy+(f?FH0+(f-1)*FH:0);
  for(let i=0;i<18+floorsDown*10;i++){const lx=(Math.random()-.5)*B.W,lz=(Math.random()-.5)*B.D,q=new THREE.Vector3(B.x+lx*B.c+lz*B.s,rnd(cy,top),B.z-lx*B.s+lz*B.c);
    chunk(q,rnd(.25,.6),Math.random()<.6?plainM[B.style]:roofM,rnd(3,7),new THREE.Vector3(B.x,top+2,B.z),Math.random()<.4)}
  for(let i=0;i<20+floorsDown*10;i++){const a=Math.random()*6.28,sp=rnd(3,7),q=new THREE.Vector3(B.x+Math.cos(a)*B.W*.4,cy+rnd(.5,3),B.z+Math.sin(a)*B.D*.4);
    smoke(q,new THREE.Vector3(Math.cos(a)*sp,rnd(.5,2),Math.sin(a)*sp),0x8A7A60,1,rnd(4.5,7),rnd(4,7),.6,rnd(0,.4))}
  const o=new THREE.Vector3(B.x,cy,B.z),d=cam.position.distanceTo(o);trauma=Math.min(1,trauma+.7/(1+d*.03));if(d<30)slowT=.12;
  if(audio()){const t=AC.currentTime+d/343,a=1/(1+d*.025);nz(t,2.6,900,40,.95*a);th(t,45,18,2.2,.9*a);nz(t+.1,1.2,3000,300,.35*a,'bandpass');nz(t+.5,1.8,600,40,.6*a)}}
const B_box=(w,h,d)=>new THREE.BoxGeometry(w,h,d);
function resetBuildings(){buildings.forEach(B=>{B.collapsedFrom=B.floors;if(B.rubble){sc.remove(B.rubble);B.rubble=null}})}

// ---------- Create all buildings for this map, then the instanced meshes and the piece grid
(MAP.buildings||[]).forEach(addBuilding);
Object.entries(instSpecs).forEach(([key,list])=>{const im=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),key==='roof'?roofM:facadeM[key],list.length);
  im.frustumCulled=false;im.castShadow=im.receiveShadow=true; // instances span the map; the base sphere would cull them wrongly
  list.forEach((p,i)=>{p.inst={mesh:im,i,m:panelMatrix(p)};im.setMatrixAt(i,p.inst.m)});im.instanceMatrix.needsUpdate=true;sc.add(im);bldMeshes.push(im)});
buildPieceGrid();
