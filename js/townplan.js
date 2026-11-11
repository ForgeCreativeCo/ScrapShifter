// Modern town generator for the 'town' map: street grid, zoned buildings, street props, and the painted ground
// (asphalt, lane lines, sidewalks, crosswalks, lots, lawns). Seeded, so every player gets the same town.
// Classic script sharing one global scope with the other js/ files; load order is set in index.html.

// Grid: 44 m pitch. Streets are 16 m wide (10 m asphalt + 3 m sidewalks) on the lines ±22, ±66, ±110, ±154, so blocks
// are 28 m lots centred on multiples of 44: TP.N rings of blocks around the centre one (N=3 -> 7x7 = 49 blocks).
// Ring 0 = central plaza, ring 1 = downtown towers, ring 2 = a mix of downtown and residential, ring 3 = residential.
// A highway runs in from the west edge along z=22 (the map start).
const TP={P:44,ROAD:10,WALK:3,N:3,LINES:[],HWY_Z:22};for(let i=-TP.N-1;i<=TP.N;i++)TP.LINES.push(22+i*TP.P);
TP.ST=TP.ROAD+2*TP.WALK;TP.LOT=(TP.P-TP.ST)/2;TP.EDGE=TP.LINES[TP.LINES.length-1]+TP.ST/2;
// Neon palette (night town): lamp heads, signs, roof-edge strips and the painted glow on the ground share these
const NEON=[0xff2bd6,0x19e6ff,0x9d4dff,0xff7a1a,0x39ff88],NEON_CSS=NEON.map(c=>'#'+c.toString(16).padStart(6,'0'));
function townPlan(seed){const r=rng(seed),pick=a=>a[Math.floor(r()*a.length)],B=[],L=[],props={trees:[],lamps:[],cars:[],fountains:[],lawns:[]},lots=[];
  const addB=(x,z,mx,mz,floors,style)=>{B.push({x,z,rot:0,mx,mz,floors,style,neon:Math.floor(r()*NEON.length)});lots.push([x-mx*2-1,z-mz*2-1,x+mx*2+1,z+mz*2+1])};
  const free=(x,z,m=1.5)=>!lots.some(([a,b,c,d])=>x>a-m&&x<c+m&&z>b-m&&z<d+m);
  for(let bx=-TP.N;bx<=TP.N;bx++)for(let bz=-TP.N;bz<=TP.N;bz++){const cx=bx*TP.P,cz=bz*TP.P,ring=Math.max(Math.abs(bx),Math.abs(bz)),E=TP.LOT-.6;
    if(ring===0){props.fountains.push({x:cx,z:cz});for(let a=0;a<10;a++){const t=a/10*PI*2;props.trees.push({x:cx+Math.cos(t)*10,z:cz+Math.sin(t)*10,s:1+r()*.3})}continue}
    if(ring===1||(ring===2&&r()<.55)){ // downtown
      if(r()<.55){const mx=4+Math.floor(r()*2),mz=4+Math.floor(r()*2);addB(cx,cz,mx,mz,5+Math.floor(r()*4),pick(['mglass','mglass','mconc']))}
      else{const mz=2+Math.floor(r()*2),st=pick(['mconc','mbrick','mglass','stucco']);[-1,1].forEach(sd=>addB(cx,cz+sd*(E-mz*2),6,mz,3+Math.floor(r()*4),r()<.7?st:pick(['mconc','stucco'])))}}
    else{ // mid-rise / residential: up to four buildings around a lawn
      props.lawns.push({x:cx,z:cz});
      if(r()<.35){const mz=3;addB(cx,cz-(E-mz*2),6,mz,2+Math.floor(r()*3),pick(['stucco','mbrick','mconc']));}
      else[[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([sx,sz])=>{if(r()<.22)return;const mx=2+Math.floor(r()*2),mz=2+Math.floor(r()*2);addB(cx+sx*(E-mx*2),cz+sz*(E-mz*2),mx,mz,1+Math.floor(r()*3),pick(['stucco','stucco','mbrick','mconc']))});
      for(let k=0;k<6;k++){const x=cx+(r()-.5)*TP.LOT*1.6,z=cz+(r()-.5)*TP.LOT*1.6;if(free(x,z))props.trees.push({x,z,s:.8+r()*.5})}}}
  // street props along every street segment between intersections
  const segs=[];TP.LINES.forEach(v=>{for(let i=0;i<TP.LINES.length-1;i++){const a=TP.LINES[i]+TP.ST/2,b=TP.LINES[i+1]-TP.ST/2;segs.push({h:true,v,a,b});segs.push({h:false,v,a,b})}});
  segs.forEach(({h,v,a,b})=>{const at=(u,off)=>h?{x:u,z:v+off}:{x:v+off,z:u},rot=h?0:PI/2;
    const lc=Math.floor(r()*3);for(const sd of[-1,1]){for(let u=a+4;u<b-3;u+=11){const p=at(u,sd*(TP.ROAD/2+TP.WALK*.62));if(free(p.x,p.z,.3))props.trees.push({...p,s:.85+r()*.3})}
      for(let u=a+8;u<b-4;u+=22){const p=at(u,sd*(TP.ROAD/2+.45));props.lamps.push({...p,ax:h?0:-sd,az:h?-sd:0,c:lc})}
      for(let u=a+6;u<b-4;){if(r()<.32){const n=2+Math.floor(r()*3);for(let k=0;k<n&&u<b-4;k++,u+=5.2){const p=at(u,sd*(TP.ROAD/2-1.25));props.cars.push({...p,rot:rot+(r()<.5?0:PI),c:Math.floor(r()*6)})}u+=4}else u+=7}}}); // rows of 2-4 cars parked bumper to bumper
  // highway in from the west edge
  for(let x=-HALF_T+6;x<-TP.EDGE;x+=24)[-1,1].forEach(sd=>props.lamps.push({x,z:TP.HWY_Z+sd*(TP.ROAD/2+.6),ax:0,az:-sd,c:3}));
  // a few concrete jersey barriers narrowing streets (combat cover)
  for(let k=0;k<14;k++){const v=pick(TP.LINES.slice(1,-1)),u=pick(TP.LINES.slice(1,-1))+(r()-.5)*12,h=r()<.5;L.push({k:'wall',x:h?u:v+(r()-.5)*4,z:h?v+(r()-.5)*4:u,rot:h?0:PI/2,w:5+r()*3,style:'jersey'})}
  return{buildings:B,layout:L,props}}
const HALF_T=224; // town map half size (kept in sync with MAPS.town.size)

// Town ground height: flat inside the town and along the highway, rolling grassy hills elsewhere
function townHeight(x,z){const core=Math.max(Math.abs(x),Math.abs(z)),hwy=x<0?Math.abs(z-TP.HWY_Z):99;
  const k=ss(cl((core-TP.EDGE-7)/35))*ss(cl((hwy-12)/16));return k*(3*Math.sin(x*.029+1)*Math.cos(z*.024)+1.8*Math.sin((x-z)*.041)+.9*Math.sin(x*.1)*Math.sin(z*.083))}

// Paint the whole map's ground into one texture (≈11 px per metre), mapped across the map, so roads deform with craters
function paintTownGround(size){const W=4096,k=W/size,X=x=>(x+size/2)*k,c=document.createElement('canvas');c.width=c.height=W;const g=c.getContext('2d');
  const rect=(x0,z0,x1,z1,col)=>{g.fillStyle=col;g.fillRect(X(x0),X(z0),(x1-x0)*k,(z1-z0)*k)};
  g.fillStyle='#6b8a46';g.fillRect(0,0,W,W); // meadow
  for(let i=0;i<9000;i++){g.fillStyle=Math.random()<.5?'rgba(90,120,55,.35)':'rgba(130,140,80,.25)';const s=4+Math.random()*30;g.fillRect(Math.random()*W,Math.random()*W,s,s)}
  rect(-TP.EDGE,-TP.EDGE,TP.EDGE,TP.EDGE,'#a8a59d'); // town base: paved lots
  {const L=TP.LOT;(MAP.props?.lawns||[]).forEach(({x:cx,z:cz})=>{rect(cx-L,cz-L,cx+L,cz+L,'#5f8a3e');for(let i=0;i<120;i++){g.fillStyle='rgba(70,105,45,.4)';g.fillRect(X(cx-L+Math.random()*L*2),X(cz-L+Math.random()*L*2),6,6)}}); // lawns
    {const cx=0,cz=0;rect(cx-L,cz-L,cx+L,cz+L,'#c2b9a8');g.strokeStyle='rgba(120,110,95,.35)';g.lineWidth=2;for(let u=-L;u<=L;u+=2){g.beginPath();g.moveTo(X(cx+u),X(cz-L));g.lineTo(X(cx+u),X(cz+L));g.stroke();g.beginPath();g.moveTo(X(cx-L),X(cz+u));g.lineTo(X(cx+L),X(cz+u));g.stroke()}
      g.fillStyle='#8a8f86';g.beginPath();g.arc(X(cx),X(cz),5*k,0,7);g.fill()}}
  const sideW=TP.ST/2,half=TP.ROAD/2;
  const street=(h,v,a,b)=>{h?rect(a,v-sideW,b,v+sideW,'#bdbab2'):rect(v-sideW,a,v+sideW,b,'#bdbab2'); // sidewalk
    g.fillStyle='rgba(90,88,82,.5)';for(let u=a;u<b;u+=2){h?(g.fillRect(X(u),X(v-sideW),1,TP.WALK*k),g.fillRect(X(u),X(v+half),1,TP.WALK*k)):(g.fillRect(X(v-sideW),X(u),TP.WALK*k,1),g.fillRect(X(v+half),X(u),TP.WALK*k,1))} // paving joints
    h?rect(a,v-half-.15,b,v+half+.15,'#d4d1c8'):rect(v-half-.15,a,v+half+.15,b,'#d4d1c8'); // curb
    h?rect(a,v-half,b,v+half,'#3a3c3f'):rect(v-half,a,v+half,b,'#3a3c3f')}; // asphalt
  TP.LINES.forEach(v=>{street(true,v,-TP.EDGE,TP.EDGE);street(false,v,-TP.EDGE,TP.EDGE)});
  street(true,TP.HWY_Z,-size/2,-TP.EDGE+2);
  // re-lay asphalt through intersections, then markings
  TP.LINES.forEach(a=>TP.LINES.forEach(b=>rect(a-half,b-half,a+half,b+half,'#3a3c3f')));
  const dash=(h,v,a,b,col,len=3,gap=3,wd=.15)=>{g.fillStyle=col;for(let u=a;u<b;u+=len+gap)h?g.fillRect(X(u),X(v-wd/2),len*k,Math.max(1.5,wd*k)):g.fillRect(X(v-wd/2),X(u),Math.max(1.5,wd*k),len*k)};
  TP.LINES.forEach(v=>{for(let i=0;i<TP.LINES.length-1;i++){const a=TP.LINES[i]+half+3.5,b=TP.LINES[i+1]-half-3.5;
    [true,false].forEach(h=>{dash(h,v,a,b,'#e9e6dc');dash(h,v-half+.35,a,b,'#e9e6dc',b-a,1,.12);dash(h,v+half-.35,a,b,'#e9e6dc',b-a,1,.12)})}});
  dash(true,TP.HWY_Z,-size/2,-TP.EDGE-2,'#e9e6dc',4,4);
  // zebra crossings on every approach to an intersection
  g.fillStyle='#e9e6dc';TP.LINES.forEach(a=>TP.LINES.forEach(b=>{for(let s=-half+.5;s<half-.3;s+=1){
    [[a+s,b-half-3.2,.5,2.6],[a+s,b+half+.6,.5,2.6],[a-half-3.2,b+s,2.6,.5],[a+half+.6,b+s,2.6,.5]].forEach(([x,z,w,d])=>g.fillRect(X(x),X(z),w*k,d*k))}}));
  return groundFinish(c,g,size,W)}
// Shared last steps of a painted ground (town and race maps): contact shadows, wear, the night glow map, the texture
function groundFinish(c,g,size,W,glowExtra){
  // soft contact shadow (ambient occlusion) at building bases, under parked cars and under trees: drawn small, blurred up
  {const A=1024,a=A/size,ao=document.createElement('canvas');ao.width=ao.height=A;const q=ao.getContext('2d'),AX=x=>(x+size/2)*a;
    q.fillStyle='rgba(0,0,0,.55)';(MAP.buildings||[]).forEach(b=>{const w=b.mx*4+1.4,d=b.mz*4+1.4;q.fillRect(AX(b.x-w/2),AX(b.z-d/2),w*a,d*a)});
    q.fillStyle='rgba(0,0,0,.5)';(MAP.props?.cars||[]).forEach(c=>{const h=Math.abs(Math.sin(c.rot))<.5,w=h?4.6:2.1,d=h?2.1:4.6;q.fillRect(AX(c.x-w/2),AX(c.z-d/2),w*a,d*a)});
    q.fillStyle='rgba(0,0,0,.28)';(MAP.props?.trees||[]).forEach(tr=>{q.beginPath();q.arc(AX(tr.x),AX(tr.z),2.2*tr.s*a,0,7);q.fill()});
    g.save();g.filter='blur(10px)';g.drawImage(ao,0,0,W,W);g.restore()}
  // asphalt wear and patches
  for(let i=0;i<2500;i++){g.fillStyle=`rgba(${Math.random()<.5?20:80},${Math.random()<.5?20:80},${Math.random()<.5?22:80},.08)`;const s=3+Math.random()*25;g.fillRect(Math.random()*W,Math.random()*W,s,s*.6)}
  if(MAP.night)townGlow=paintTownGlow(size,c,glowExtra);
  const t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;t.anisotropy=R.capabilities.getMaxAnisotropy();t.generateMipmaps=true;return t}
// Night town: light that the neon throws on the ground, painted once into a small map-wide texture and used as the
// ground's emissive map (world.js), so it costs no real lights. Pools under the lamp heads (the lamp's colour), a wash
// around each building in its sign colour, a cyan plaza. Multiplied by the ground paint so asphalt stays darker than
// sidewalk and lane lines still read.
let townGlow=null;
function paintTownGlow(size,paint,extra){const A=1024,a=A/size,c=document.createElement('canvas');c.width=c.height=A;const g=c.getContext('2d'),X=x=>(x+size/2)*a;
  g.fillStyle='#1c1838';g.fillRect(0,0,A,A);g.globalCompositeOperation='lighter'; // faint base so unlit ground still reads
  const pool=(x,z,rad,col,al)=>{const gr=g.createRadialGradient(X(x),X(z),0,X(x),X(z),rad*a);gr.addColorStop(0,col);gr.addColorStop(1,'#000');g.globalAlpha=al;g.fillStyle=gr;g.beginPath();g.arc(X(x),X(z),rad*a,0,7);g.fill()};
  g.save();g.filter='blur(4px)';(MAP.buildings||[]).forEach(b=>{const w=b.mx*4+7,d=b.mz*4+7;g.globalAlpha=.3;g.fillStyle=NEON_CSS[b.neon||0];g.fillRect(X(b.x-w/2),X(b.z-d/2),w*a,d*a)});g.restore();
  (MAP.props?.lamps||[]).forEach(l=>pool(l.x+l.ax*1.55,l.z+l.az*1.55,10,['#ff5ad8','#3fe6ff','#b98cff','#ffb060'][l.c||0],.9));
  (MAP.props?.fountains||[]).forEach(f=>pool(f.x,f.z,16,'#3fe6ff',.8));
  if(extra){g.globalAlpha=1;extra(g,X,a)} // map-specific neon (race track edge lines, arena)
  g.globalAlpha=1;g.globalCompositeOperation='multiply';g.drawImage(paint,0,0,A,A);
  g.globalCompositeOperation='source-over';g.fillStyle='#000';(MAP.buildings||[]).forEach(b=>g.fillRect(X(b.x-b.mx*2),X(b.z-b.mz*2),b.mx*4*a,b.mz*4*a)); // nothing glows indoors
  const t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;return t}
