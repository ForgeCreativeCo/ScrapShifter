// Town buildings: multi-floor shells made of wall panels (one piece per 4 m module, per floor, per side) plus a
// floor/roof slab per level. Same deterministic swap-state rules as other pieces: panel intact -> damaged -> gone.
// Collapse: when half of a floor's wall panels are gone, that floor and everything above pancakes into a rubble
// heap (terrain mound). Ground floors are tall workshop bays so the mech fits inside once it breaks in.
// Intact panels and slabs draw as InstancedMeshes (a handful of draw calls for the whole town); damaged/destroyed
// visuals are separate meshes created only when a panel changes state.
// Classic script sharing one global scope with the other js/ files; load order is set in index.html.

// Toughness: HP per panel (ground floor, upper floors) and slab. Damage taken is scaled by TUNE.bldDmg and a floor
// collapses once TUNE.collapse of its panels are gone (both live in the Tune panel).
const MOD=4,FH0=5.6,FH=3.4,PT=.4,SLAB=.35,PANEL_HP=[70,50],SLAB_HP=100;

// ---------- Facade textures: style (brick / concrete / corrugated) x variant (window / shopfront / plain)
function brickDraw(g,w,h){g.fillStyle='#7a4434';g.fillRect(0,0,w,h);const bh=10,bw=28;
  for(let y=0,row=0;y<h;y+=bh,row++)for(let x=(row%2)*-bw/2;x<w;x+=bw){g.fillStyle=`rgb(${110+Math.random()*30|0},${55+Math.random()*20|0},${42+Math.random()*15|0})`;g.fillRect(x+1,y+1,bw-2,bh-2)}
  grime(g,w,h);for(let i=0;i<8;i++){g.fillStyle=`rgba(30,26,22,${Math.random()*.3})`;g.fillRect(Math.random()*w,0,4+Math.random()*12,h*Math.random())}} // soot streaks
function concDraw(g,w,h){g.fillStyle='#8a867c';g.fillRect(0,0,w,h);grime(g,w,h);g.fillStyle='rgba(40,36,30,.35)';for(let y=48;y<h;y+=64)g.fillRect(0,y,w,2);
  for(let i=0;i<14;i++){g.fillStyle=`rgba(60,50,40,${Math.random()*.25})`;g.fillRect(Math.random()*w,Math.random()*h*.3,3+Math.random()*10,40+Math.random()*120)}}
function corrDraw(g,w,h){g.fillStyle='#6b5a45';g.fillRect(0,0,w,h);for(let x=0;x<w;x+=16){const gr=g.createLinearGradient(x,0,x+16,0);gr.addColorStop(0,'rgba(0,0,0,.28)');gr.addColorStop(.5,'rgba(255,255,255,.12)');gr.addColorStop(1,'rgba(0,0,0,.28)');g.fillStyle=gr;g.fillRect(x,0,16,h)}grime(g,w,h);rustBlobs(g,w,h,40)}
// Modern town styles: stucco, clean brick (mbrick), precast concrete (mconc), glass curtain wall (mglass)
const noise=(g,w,h,n,a)=>{for(let i=0;i<n;i++){const v=Math.random()>.5?255:0;g.fillStyle=`rgba(${v},${v},${v},${Math.random()*a})`;g.fillRect(Math.random()*w,Math.random()*h,1+Math.random()*3,1+Math.random()*3)}};
function stuccoDraw(g,w,h){g.fillStyle='#ddd2bd';g.fillRect(0,0,w,h);noise(g,w,h,900,.05);g.fillStyle='#c9bca2';g.fillRect(0,0,w,h*.05);g.fillStyle='rgba(0,0,0,.06)';g.fillRect(0,h*.05,w,h*.02)}
function mbrickDraw(g,w,h){g.fillStyle='#d4cdc2';g.fillRect(0,0,w,h);const bh=9,bw=26;for(let y=0,row=0;y<h;y+=bh,row++)for(let x=(row%2)*-bw/2;x<w;x+=bw){g.fillStyle=`rgb(${150+Math.random()*25|0},${66+Math.random()*16|0},${50+Math.random()*12|0})`;g.fillRect(x+1,y+1,bw-2,bh-2)}noise(g,w,h,300,.04)}
function mconcDraw(g,w,h){g.fillStyle='#c7c5bf';g.fillRect(0,0,w,h);noise(g,w,h,700,.05);g.fillStyle='rgba(70,68,62,.35)';g.fillRect(0,0,w,2);g.fillRect(0,0,2,h);g.fillRect(w/2,0,1,h)}
let EM=null; // lit-window mask context (set with FM): white where light shows at night, used as the emissive map
let FM=null;const GLOSS='rgb(0,26,165)',ROUGH='rgb(0,215,0)'; // gloss mask context (set while drawing a modern facade)
function mglassDraw(g,w,h){if(FM){FM.fillStyle=GLOSS;FM.fillRect(0,0,w,h)}const gr=g.createLinearGradient(0,0,w,h);gr.addColorStop(0,'#7fa9c9');gr.addColorStop(.45,'#3c6788');gr.addColorStop(1,'#1d3247');g.fillStyle=gr;g.fillRect(0,0,w,h);
  g.fillStyle='rgba(255,255,255,.12)';g.beginPath();g.moveTo(w*.1,0);g.lineTo(w*.35,0);g.lineTo(0,h*.6);g.lineTo(0,h*.3);g.fill();
  g.fillStyle='#596570';for(let x=0;x<=w;x+=w/3)g.fillRect(x-2,0,4,h);for(let y=0;y<=h;y+=h/2)g.fillRect(0,y-3,w,6);
  if(FM){FM.fillStyle='rgb(0,110,200)';for(let x=0;x<=w;x+=w/3)FM.fillRect(x-2,0,4,h);for(let y=0;y<=h;y+=h/2)FM.fillRect(0,y-3,w,6)} // brushed-metal mullions
  if(EM)for(let i=0;i<3;i++)for(let j=0;j<2;j++){if(Math.random()<.42)continue;const x=i*w/3+2,y=j*h/2+3,pw=w/3-4,ph=h/2-6,gr=EM.createLinearGradient(0,y,0,y+ph);
    const a=.3+Math.random()*.6;gr.addColorStop(0,'rgba(255,255,255,'+a+')');gr.addColorStop(1,'rgba(255,255,255,'+a*.45+')');EM.fillStyle=gr;EM.fillRect(x,y,pw,ph);
    EM.fillStyle='rgba(0,0,0,.5)';EM.fillRect(x+Math.random()*pw*.6,y+ph*.55,pw*.3,ph*.45)}} // some panes lit, a dark shape in each
const STYLE_DRAW={brick:brickDraw,concrete:concDraw,corr:corrDraw,stucco:stuccoDraw,mbrick:mbrickDraw,mconc:mconcDraw,mglass:mglassDraw},STYLES=Object.keys(STYLE_DRAW),MODERN={stucco:1,mbrick:1,mconc:1,mglass:1};
const AWNINGS=['#b03a2e','#2e6da4','#2a8a55'];
function modernWindow(g,w,h,wide){const x0=w*(wide?.08:.24),x1=w*(wide?.92:.76),y0=h*.24,y1=h*.7;g.fillStyle='#efede7';g.fillRect(x0-5,y0-5,x1-x0+10,y1-y0+10);
  const gr=g.createLinearGradient(0,y0,0,y1);gr.addColorStop(0,'#a9c8de');gr.addColorStop(1,'#26394a');g.fillStyle=gr;g.fillRect(x0,y0,x1-x0,y1-y0);if(FM){FM.fillStyle=GLOSS;FM.fillRect(x0,y0,x1-x0,y1-y0)}
  if(EM){const e=EM.createLinearGradient(0,y0,0,y1);e.addColorStop(0,'#fff');e.addColorStop(1,'#999');EM.fillStyle=e;EM.fillRect(x0,y0,x1-x0,y1-y0);
    EM.fillStyle='rgba(0,0,0,.4)';for(let y=y0+4;y<y0+(y1-y0)*(.2+Math.random()*.5);y+=7)EM.fillRect(x0,y,x1-x0,3); // blinds part-way down
    EM.fillStyle='#000';EM.fillRect((x0+x1)/2-2,y0,4,y1-y0);if(wide)[.33,.67].forEach(f=>EM.fillRect(x0+(x1-x0)*f-2,y0,4,y1-y0))}
  g.fillStyle='#efede7';g.fillRect((x0+x1)/2-2,y0,4,y1-y0);if(wide)[.33,.67].forEach(f=>g.fillRect(x0+(x1-x0)*f-2,y0,4,y1-y0));g.fillStyle='rgba(0,0,0,.18)';g.fillRect(x0-5,y1+5,x1-x0+10,4)}
function storefront(g,w,h,aw){g.fillStyle='#2b2b2b';g.fillRect(0,h*.2,w,h*.1);g.fillStyle='rgba(255,255,255,.5)';for(let x=w*.15;x<w*.85;x+=14)g.fillRect(x,h*.235,7,h*.03); // sign band
  g.fillStyle=aw;g.fillRect(0,h*.3,w,h*.07);g.fillStyle='rgba(255,255,255,.35)';for(let x=0;x<w;x+=20)g.fillRect(x,h*.3,10,h*.07); // striped awning
  const gr=g.createLinearGradient(0,h*.4,0,h);gr.addColorStop(0,'#8fb4cc');gr.addColorStop(1,'#1f2c36');g.fillStyle='#3a3f44';g.fillRect(w*.04,h*.38,w*.92,h*.62);g.fillStyle=gr;g.fillRect(w*.07,h*.41,w*.86,h*.59);if(FM){FM.fillStyle=GLOSS;FM.fillRect(w*.07,h*.41,w*.86,h*.59)}
  if(EM){const e=EM.createLinearGradient(0,h*.41,0,h);e.addColorStop(0,'#eee');e.addColorStop(1,'#777');EM.fillStyle=e;EM.fillRect(w*.07,h*.41,w*.86,h*.59);EM.fillStyle='#000';EM.fillRect(w*.48,h*.41,w*.04,h*.59);
    EM.fillStyle='#fff';for(let x=w*.15;x<w*.85;x+=14)EM.fillRect(x,h*.235,7,h*.03)} // shop window and the sign lettering
  g.fillStyle='#3a3f44';g.fillRect(w*.48,h*.41,w*.04,h*.59)}
function facadeTex(style,variant){return tex(256,256,(g,w,h)=>{
  if(MODERN[style]){ // modern: framed windows, lobbies, storefronts with coloured awnings (variant 'shop0'..'shop2')
    if(style==='mglass'){mglassDraw(g,w,h);if(variant==='plain'){g.fillStyle='#2e3a44';g.fillRect(0,h*.62,w,h*.38);if(EM){EM.fillStyle='#000';EM.fillRect(0,h*.62,w,h*.38)}}
      else if(variant.startsWith('shop')){g.fillStyle='#596570';g.fillRect(w*.38,h*.45,w*.24,h*.55);g.fillStyle='#1b2730';g.fillRect(w*.41,h*.5,w*.18,h*.5);if(EM){EM.fillStyle='#000';EM.fillRect(w*.38,h*.45,w*.24,h*.55);EM.fillStyle='#ddd';EM.fillRect(w*.41,h*.5,w*.18,h*.5)}}return}
    STYLE_DRAW[style](g,w,h);if(variant==='win')modernWindow(g,w,h,style==='mconc');else if(variant.startsWith('shop'))storefront(g,w,h,AWNINGS[+variant.slice(4)||0]);return}
  STYLE_DRAW[style](g,w,h);
  if(variant==='win'){g.fillStyle='#3a3530';g.fillRect(w*.27,h*.22,w*.46,h*.44);g.fillStyle='#15181b';g.fillRect(w*.3,h*.25,w*.4,h*.38);
    g.fillStyle='rgba(180,190,190,.25)';g.beginPath();g.moveTo(w*.3,h*.25);g.lineTo(w*.45,h*.25);g.lineTo(w*.3,h*.45);g.fill();g.fillStyle='#3a3530';g.fillRect(w*.49,h*.25,w*.02,h*.38)} // cracked pane, mullion
  else if(variant==='shop'){g.fillStyle='#2a2622';g.fillRect(w*.12,h*.35,w*.76,h*.65);for(let y=h*.37;y<h*.7;y+=7){g.fillStyle='rgba(120,110,95,.5)';g.fillRect(w*.13,y,w*.74,3)} // half-raised roller door
    g.fillStyle='#0f1112';g.fillRect(w*.13,h*.72,w*.74,h*.28);g.fillStyle='#a8832e';g.fillRect(w*.12,h*.33,w*.76,h*.03)}})}
// Materials are made on first use, so a map only builds the facade textures it actually needs
// Modern facades get a gloss mask (glass smooth and reflective, walls rough) and a bump map from the painted detail
// Night maps: the lit-window mask is the emissive map. litPatch tints it per panel from a hash of the instance's
// position (about a third dark, most warm, some cyan / magenta / violet), so one material and one draw call still give
// every window its own light, and fades it with the instance colour, so scorched panels go dark.
const WIN_GLOW=1.15;
function litPatch(sh){sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vLit;').replace('#include <begin_vertex>',['#include <begin_vertex>',
  'vLit=vec3(0.);',
  '#ifdef USE_INSTANCING',
  'float lh=fract(sin(dot(instanceMatrix[3].xyz,vec3(12.9898,78.233,37.719)))*43758.5453);',
  'vLit=lh<.3?vec3(.02):lh<.72?vec3(1.,.74,.42):lh<.85?vec3(.2,.85,1.):lh<.95?vec3(1.,.22,.8):vec3(.55,.35,1.);',
  '#ifdef USE_INSTANCING_COLOR',
  'vLit*=instanceColor*instanceColor;',
  '#endif',
  '#endif'].join('\n'));
  sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vLit;').replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\ntotalEmissiveRadiance*=vLit;')}
function modernMaterial(st,v){const mc=document.createElement('canvas');mc.width=mc.height=256;FM=mc.getContext('2d');FM.fillStyle=ROUGH;FM.fillRect(0,0,256,256);
  const ec=document.createElement('canvas');ec.width=ec.height=256;EM=ec.getContext('2d');EM.fillStyle='#000';EM.fillRect(0,0,256,256);
  const map=facadeTex(st,v);FM=EM=null;const mask=new THREE.CanvasTexture(mc);
  const m=new THREE.MeshStandardMaterial({map,roughnessMap:mask,metalnessMap:mask,roughness:1,metalness:1,normalMap:normalFromCanvas(map.image,st==='mbrick'?3:st==='mglass'?.8:1.8),normalScale:new THREE.Vector2(.6,.6),envMapIntensity:st==='mglass'?1.25:1});
  if(MAP.night){const et=new THREE.CanvasTexture(ec);et.wrapS=et.wrapT=THREE.RepeatWrapping;et.encoding=THREE.sRGBEncoding;et.anisotropy=4;m.emissiveMap=et;m.emissive.setHex(0xffffff);m.emissiveIntensity=WIN_GLOW;m.onBeforeCompile=litPatch}
  m.userData.envTuned=true;return m}
const facadeCache={},facadeM=new Proxy({},{get:(_,key)=>{if(!facadeCache[key]){const[st,v]=key.split('_');facadeCache[key]=MODERN[st]?modernMaterial(st,v):SM(facadeTex(st,v),.9,.12)}return facadeCache[key]}}),
  plainM=new Proxy({},{get:(_,st)=>facadeM[st+'_plain']});
const roofM=SM(tex(256,256,(g,w,h)=>{g.fillStyle='#4a4640';g.fillRect(0,0,w,h);grime(g,w,h);g.strokeStyle='rgba(20,18,15,.5)';for(let i=0;i<5;i++){g.beginPath();g.moveTo(Math.random()*w,0);g.lineTo(Math.random()*w,h);g.stroke()}}),.95,.05);

// ---------- Build
const buildings=[],bldMeshes=[],_bm=new THREE.Matrix4(),_bq=new THREE.Quaternion(),_bs=new THREE.Vector3(),_bp=new THREE.Vector3(),_zero=new THREE.Matrix4().makeScale(0,0,0);
const instSpecs={}; // material key -> [{piece, matrix}]
const panelMatrix=p=>{_bq.setFromAxisAngle(new THREE.Vector3(0,1,0),p.rot);_bp.set(p.x,p.y0+p.H[0]/2,p.z);_bs.set(p.w,p.H[0],p.d);return new THREE.Matrix4().compose(_bp.clone(),_bq.clone(),_bs.clone())};
function addBuilding(b,bi){const r=rng(MAP.seed*1000+bi*17+3),c=Math.cos(b.rot),s=Math.sin(b.rot),W=b.mx*MOD,D=b.mz*MOD;
  const toW=(lx,lz)=>[b.x+lx*c+lz*s,b.z-lx*s+lz*c];
  const gy=Math.min(gh(b.x,b.z),...[[1,1],[1,-1],[-1,1],[-1,-1]].map(([u,v])=>gh(...toW(u*W/2,v*D/2))))-.1;
  const shp=STRUCT_BASE+b.mx*b.mz*b.floors*STRUCT_PER; // structural HP: how many artillery shells it takes to level
  const B={...b,W,D,c,s,gy,levels:[],slabs:[],collapsedFrom:b.floors,rubble:null,shp,shpMax:shp};buildings.push(B);const shopC=Math.floor(r()*3); // one awning colour per building
  const piece=(o)=>{const p={c:Math.cos(o.rot),s:Math.sin(o.rot),state:0,lastRam:-9,bld:B,seed:Math.floor(r()*1e9),onState:o.kind==='slab'?slabState:panelState,...o};p.max=p.hp;pieces.push(p);return p};
  for(let f=0;f<b.floors;f++){const y0=gy+(f?FH0+(f-1)*FH:0),h=f?FH:FH0,lvl=[];B.levels.push(lvl);
    const modern=MODERN[b.style],add=(lx,lz,rot,w)=>{const[x,z]=toW(lx,lz);let v=f===0?(r()<(modern?.55:.4)?'shop':r()<.55?'win':'plain'):(r()<(modern?.85:.72)?'win':'plain');
      if(v==='shop'&&modern)v='shop'+shopC;const key=b.style+'_'+v;
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
function panelState(p,s){setInst(p,s===0);neonState(p,s);clearDmg(p);if(s===0)return;const r=rng(p.seed+s),h=p.H[0],m=plainM[p.style];
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
  if(gone/lv.length>=TUNE.collapse){collapseFrom(B,f);return}}}
function collapseFrom(B,f){if(typeof swarmCollapse==='function')swarmCollapse(B,f); // crushes a foundry inside
  if(B.roofMesh)B.roofMesh.visible=false;const wasBurning=B.levels.flat().some(p=>p.fire>0);B_collapsing=true;const was=B.collapsedFrom;B.collapsedFrom=f;if(wasBurning&&f===0)fireSmoulder(B);
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
  if(audio()){const s=spot(o,.025),t=s.t,a=s.a;if(sfx('explosion-b',{t,off:.1,vol:1.2*a,rate:rnd(.66,.76),pan:s.pan,lp:Math.min(s.lp,6000)})){th(t,45,18,2.2,.7*a);return} // slowed blast = rumbling collapse
    nz(t,2.6,900,40,.95*a);th(t,45,18,2.2,.9*a);nz(t+.1,1.2,3000,300,.35*a,'bandpass');nz(t+.5,1.8,600,40,.6*a)}}
const B_box=(w,h,d)=>new THREE.BoxGeometry(w,h,d);
// Artillery structural hits. Every heavy shell that lands on or near a building hits its frame: full ART_STRUCT
// within 4 m of what's left of the building, fading to nothing at 10 m. Structural HP = STRUCT_BASE + modules × floors × STRUCT_PER,
// so small buildings fall to one shell; big ones lose their top half to the first and come down with the second.
const ART_STRUCT=150,STRUCT_BASE=100,STRUCT_PER=.7; // biggest town building (5x5, 8 floors) = 240 HP = 2 shells
function structHits(p){const seen=new Set();piecesNear(p.x,p.z,10).forEach(pc=>{if(pc.bld&&pc.bld.collapsedFrom>0)seen.add(pc.bld)});
  seen.forEach(B=>{let d=1e9;B.levels.flat().forEach(q=>{if(q.state<2)d=Math.min(d,pieceDist(q,p))});B.slabs.forEach(q=>{if(q.state<2)d=Math.min(d,pieceDist(q,p))});
    const dmg=ART_STRUCT*cl(1-(d-4)/6);if(dmg>0)structHit(B,dmg)})}
function structHit(B,dmg){if(B.collapsedFrom===0)return;B.shp-=dmg;
  if(B.shp<=0)collapseFrom(B,0);
  else if(B.shp<=B.shpMax*.5&&B.floors>=2){const f=Math.max(1,Math.ceil(B.floors/2));if(f<B.collapsedFrom)collapseFrom(B,f)}}
function resetBuildings(){buildings.forEach(B=>{B.collapsedFrom=B.floors;B.shp=B.shpMax;if(B.roofMesh)B.roofMesh.visible=true;if(B.rubble){sc.remove(B.rubble);B.rubble=null}})}

// ---------- Create all buildings for this map, then the instanced meshes and the piece grid
(MAP.buildings||[]).forEach(addBuilding);
Object.entries(instSpecs).forEach(([key,list])=>{const im=new TiledInst(new THREE.BoxGeometry(1,1,1),key==='roof'?roofM:facadeM[key],list.length); // map tiles, culled per tile
  const white=new THREE.Color(1,1,1);list.forEach((p,i)=>{p.inst={mesh:im,i,m:panelMatrix(p)};im.setMatrixAt(i,p.inst.m);im.setColorAt(i,white)}); /* instance colour = fire scorch */im.build();bldMeshes.push(im)});
buildPieceGrid();
// Rooftop detail per building (parapet, AC units, sometimes a water tank or antenna), merged into one mesh and hidden
// once the top floor comes down
const roofDetailM=SM(tex(128,128,(g,w,h)=>{g.fillStyle='#9a978f';g.fillRect(0,0,w,h);grime(g,w,h)}),.85,.15);
if(THREE.BufferGeometryUtils&&MODERN[(MAP.buildings||[])[0]?.style])buildings.forEach((B,bi)=>{const r=rng(bi*31+7),parts=[],top=FH0+(B.floors-1)*FH,M=new THREE.Matrix4();
  const box=(w,h,d,x,y,z,ry=0)=>{const g=new THREE.BoxGeometry(w,h,d);g.applyMatrix4(M.makeRotationY(ry));g.applyMatrix4(M.makeTranslation(x,y,z));parts.push(g)};
  const cyl=(rt,rb,h,x,y,z)=>{const g=new THREE.CylinderGeometry(rt,rb,h,14);g.applyMatrix4(M.makeTranslation(x,y,z));parts.push(g)};
  [[0,B.D/2-.15,B.W,.3],[0,-B.D/2+.15,B.W,.3],[B.W/2-.15,0,.3,B.D-.6],[-B.W/2+.15,0,.3,B.D-.6]].forEach(([x,z,w,d])=>box(w,.8,d,x,.4,z)); // parapet
  for(let i=0;i<1+Math.floor(r()*3);i++)box(1.5,1,1.1,(r()-.5)*(B.W-4),.5,(r()-.5)*(B.D-4),r()<.5?0:PI/2); // AC units
  if(B.floors>=2&&B.floors<=5&&r()<.35){const x=(r()-.5)*(B.W-5),z=(r()-.5)*(B.D-5);cyl(1.1,1.1,1.8,x,2.3,z);cyl(1.15,.2,.5,x,3.45,z);[[.7,.7],[.7,-.7],[-.7,.7],[-.7,-.7]].forEach(([a,c])=>box(.12,1.4,.12,x+a,.7,z+c))} // water tank
  if(B.floors>=6){const x=(r()-.5)*(B.W-4),z=(r()-.5)*(B.D-4);cyl(.06,.09,5,x,2.5,z);box(1.4,.06,.06,x,4,z)} // antenna
  const mesh=new THREE.Mesh(THREE.BufferGeometryUtils.mergeBufferGeometries(parts),roofDetailM);mesh.position.set(B.x,B.gy+top,B.z);mesh.rotation.y=B.rot;mesh.castShadow=mesh.receiveShadow=true;sc.add(mesh);B.roofMesh=mesh});

// ---------- Neon (night maps): unlit, instance-coloured boxes bright enough to bloom. A strip along the roof edge of
// taller buildings (the building's colour), a sign bar over most shopfronts, and blade signs with lettering standing
// out from upper floors. Each belongs to a wall panel and goes when that panel does (neonState, from panelState).
function neonState(p,s){if(p.neon)p.neon.forEach(n=>n.mesh.setMatrixAt(n.i,s===2?_zero:n.m))}
if(MAP.night){const r=rng(MAP.seed*97+13),cols=NEON.map(c=>new THREE.Color(c).multiplyScalar(1.9)),bars=[],blades=[],up=new THREE.Vector3(0,1,0),rc=()=>cols[Math.floor(r()*cols.length)];
  const add=(list,p,off,y,sx,sy,sz,col)=>{let nx=Math.sin(p.rot),nz=Math.cos(p.rot);if((p.x-p.bld.x)*nx+(p.z-p.bld.z)*nz<0){nx=-nx;nz=-nz} // outward normal
    list.push({p,col,m:new THREE.Matrix4().compose(new THREE.Vector3(p.x+nx*off,y,p.z+nz*off),_bq.setFromAxisAngle(up,p.rot),new THREE.Vector3(sx,sy,sz))})};
  buildings.forEach(B=>{if(!MODERN[B.style])return;const c=cols[B.neon||0];
    if(B.floors>=2)B.levels[B.floors-1].forEach(p=>add(bars,p,PT/2+.02,p.y0+p.H[0]+.84,p.w+.1,.14,.14,c));
    B.levels[0].forEach(p=>{if(p.key.includes('shop')&&r()<.65)add(bars,p,PT/2+.1,p.y0+p.H[0]*.76,2.2+r()*1.2,.5,.14,rc())});
    if(B.floors>=2)for(let k=0,n=2+Math.floor(r()*Math.min(4,B.floors));k<n;k++){const lv=B.levels[1+Math.floor(r()*Math.min(B.floors-1,4))],p=lv[Math.floor(r()*lv.length)];
      add(blades,p,PT/2+.62,p.y0+p.H[0]/2,.16,p.H[0]*.92,1.05,rc())}});
  const mkNeon=(list,mat)=>{if(!list.length)return;const im=new TiledInst(new THREE.BoxGeometry(1,1,1),mat,list.length,false);
    list.forEach((it,i)=>{im.setMatrixAt(i,it.m);im.setColorAt(i,it.col);(it.p.neon=it.p.neon||[]).push({mesh:im,i,m:it.m})});im.build()};
  mkNeon(bars,new THREE.MeshBasicMaterial({color:0xffffff}));
  mkNeon(blades,new THREE.MeshBasicMaterial({color:0xffffff,map:tex(64,256,(g,w,h)=>{g.fillStyle='#16101c';g.fillRect(0,0,w,h);g.strokeStyle='#fff';g.lineWidth=4;g.strokeRect(4,4,w-8,h-8);g.fillStyle='#fff';
    for(let i=0;i<4;i++){const y=18+i*57;for(let k=0;k<6;k++){const hz=Math.random()<.5,a=12+Math.random()*30,b=y+4+Math.random()*36;hz?g.fillRect(12,b,40,5):g.fillRect(a,y+2,5,44)}}})}))} // made-up glyphs
