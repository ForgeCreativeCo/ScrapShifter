// Race map generator ('race' map, "Neon Run"): a point-to-point track that spirals in through a neon city to a
// walled, multi-level battle arena in the middle. Seeded, so every player gets the same track.
//   raceTrack()      centreline: waypoints (RACE_WP) with rounded corners, resampled every 2 m (x, z, heading)
//   racePlan(seed)   buildings lining the track, lamps, parked cars, jersey-barrier slaloms, ammo crate spots,
//                    the start grid, and the arena's cover
//   RARENA           arena decks (raised heightfield rectangles) and ramps; raceHeight() is the map's height function
//   buildArena()     the arena's indestructible walls: perimeter, deck edges, ramp sides (called from structures.js)
//   paintRaceGround  the painted ground texture (asphalt ribbon with neon edge lines, arena floor)
// Classic script sharing one global scope with the other js/ files; load order is set in index.html.

const RTW=7; // track half width (m)
// Spiral: three lanes at 190 / 144 / 98 m from the centre, kinks on some straights, in through the arena's west gate
const RACE_WP=[[-170,190],[-70,190],[-38,200],[28,200],[60,190],[190,190],
  [190,70],[179,38],[179,-28],[190,-60],[190,-190],
  [-190,-190],
  [-190,-70],[-200,-38],[-200,28],[-190,60],[-190,144],
  [-50,144],[-20,134],[40,134],[70,144],[144,144],
  [144,-144],
  [50,-144],[20,-154],[-40,-154],[-70,-144],[-144,-144],
  [-144,98],[98,98],[98,-98],[-98,-98],[-98,0],[-46,0]];
// Arena: square, walled, one gate in the west wall. Decks are raised rectangles of the heightfield (h above `base`);
// `gaps` are the openings in a deck's edge wall where a ramp meets it (n/s: x range, e/w: z range).
// Ramps: rectangles sloping along `ax` from h0 (low-coordinate end) to h1.
const RARENA={half:64,gate:9,wallH:5,
  plats:[{x0:-30,z0:-30,x1:30,z1:30,h:3,base:0,col:0,gaps:{n:[-5,5],s:[-5,5],e:[-5,5]}}, // main deck
    {x0:-10,z0:-10,x1:10,z1:10,h:6,base:3,col:1,gaps:{e:[-5,5],w:[-5,5]}}, // top deck, on the main deck
    {x0:38,z0:-58,x1:58,z1:-38,h:2.5,base:0,col:3,gaps:{s:[43,53]}},{x0:-58,z0:38,x1:-38,z1:58,h:2.5,base:0,col:3,gaps:{n:[-53,-43]}}], // corner bunkers
  ramps:[{x0:-5,z0:-42,x1:5,z1:-30,ax:'z',h0:0,h1:3},{x0:-5,z0:30,x1:5,z1:42,ax:'z',h0:3,h1:0},{x0:30,z0:-5,x1:42,z1:5,ax:'x',h0:3,h1:0},
    {x0:10,z0:-5,x1:20,z1:5,ax:'x',h0:6,h1:3},{x0:-20,z0:-5,x1:-10,z1:5,ax:'x',h0:3,h1:6},
    {x0:43,z0:-38,x1:53,z1:-26,ax:'z',h0:2.5,h1:0},{x0:-53,z0:26,x1:-43,z1:38,ax:'z',h0:0,h1:2.5}]};
const RACE_EDGE=212; // paved city square; a low grassy bank and the tree line beyond

function raceHeight(x,z){const A=RARENA;
  if(Math.abs(x)<=A.half&&Math.abs(z)<=A.half){
    for(const q of A.ramps)if(x>=q.x0&&x<=q.x1&&z>=q.z0&&z<=q.z1){const t=q.ax==='x'?(x-q.x0)/(q.x1-q.x0):(z-q.z0)/(q.z1-q.z0);return q.h0+(q.h1-q.h0)*t}
    let h=0;for(const p of A.plats)if(x>=p.x0&&x<=p.x1&&z>=p.z0&&z<=p.z1)h=Math.max(h,p.h);return h}
  const k=ss(cl((Math.max(Math.abs(x),Math.abs(z))-RACE_EDGE-1)/8));return k?k*(2.4+1.2*Math.sin(x*.05+1)*Math.cos(z*.043)+.6*Math.sin((x-z)*.09)):0}

function raceTrack(){const P=RACE_WP,pts=[],R=26,D=(a,b)=>Math.hypot(b[0]-a[0],b[1]-a[1]);
  P.forEach((b,i)=>{if(i===0||i===P.length-1){pts.push(b);return}
    const a=P[i-1],c=P[i+1],la=D(a,b),lc=D(b,c),r=Math.min(R,la*.45,lc*.45),p0=[b[0]+(a[0]-b[0])/la*r,b[1]+(a[1]-b[1])/la*r],p1=[b[0]+(c[0]-b[0])/lc*r,b[1]+(c[1]-b[1])/lc*r];
    for(let k=0;k<=10;k++){const t=k/10,u=1-t;pts.push([u*u*p0[0]+2*u*t*b[0]+t*t*p1[0],u*u*p0[1]+2*u*t*b[1]+t*t*p1[1]])}}); // corner: quadratic curve through the cut points
  const x=[pts[0][0]],z=[pts[0][1]],step=2;let acc=0;
  for(let i=1;i<pts.length;i++){let a=pts[i-1];const b=pts[i];let l=D(a,b);
    while(acc+l>=step){const t=(step-acc)/l;a=[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];x.push(a[0]);z.push(a[1]);l=D(a,b);acc=0}acc+=l}
  const n=x.length,h=[];for(let i=0;i<n;i++){const a=Math.max(0,i-1),b=Math.min(n-1,i+1);h.push(Math.atan2(-(z[b]-z[a]),x[b]-x[a]))}
  return{x,z,h,n,step,len:(n-1)*step}}
// Point on the track at distance s along it, `lat` metres to the left of the centreline
function trkAt(T,s,lat=0){const f=Math.max(0,Math.min(T.n-1.001,s/T.step)),i=Math.floor(f),u=f-i,h=T.h[u<.5?i:i+1];
  return{x:T.x[i]+(T.x[i+1]-T.x[i])*u-Math.sin(h)*lat,z:T.z[i]+(T.z[i+1]-T.z[i])*u-Math.cos(h)*lat,h}}

function racePlan(seed){const r=rng(seed),pick=a=>a[Math.floor(r()*a.length)],T=raceTrack(),A=RARENA,B=[],L=[],rects=[],props={trees:[],lamps:[],cars:[],fountains:[],lawns:[]};
  // --- buildings: walk the track and put a building on each side wherever one fits (clear of the track, the arena and
  // each other), so the strips between the spiral's lanes fill up with one row facing both
  const rd=(q,px,pz)=>Math.hypot(Math.max(q[0]-px,0,px-q[2]),Math.max(q[1]-pz,0,pz-q[3]));
  const ok=q=>{if(Math.max(-q[0],q[2],-q[1],q[3])>RACE_EDGE-2)return false;const m=A.half+5;if(q[0]<m&&q[2]>-m&&q[1]<m&&q[3]>-m)return false;
    for(const o of rects)if(q[0]<o[2]+2.5&&q[2]>o[0]-2.5&&q[1]<o[3]+2.5&&q[3]>o[1]-2.5)return false;
    for(let i=0;i<T.n;i++)if(rd(q,T.x[i],T.z[i])<RTW+3.2)return false;return true};
  // --- gun towers (js/towers.js): one every ~300 m beside the track, alternating sides, clear of every lane and the
  // arena; reserved first so the buildings leave a gap round each one
  const towers=[];
  for(let s=260,i=0;s<T.len-150;s+=300,i++)for(let k=0;k<8;k++){const sd=(i+(k>>2))%2?1:-1,p=trkAt(T,s+(k&3)*14,sd*(RTW+3.4));
    if(Math.max(Math.abs(p.x),Math.abs(p.z))>RACE_EDGE-4||Math.max(Math.abs(p.x),Math.abs(p.z))<A.half+8)continue;
    let near=1e9;for(let j=0;j<T.n;j++)near=Math.min(near,Math.hypot(T.x[j]-p.x,T.z[j]-p.z));if(near<RTW+2.6)continue;
    towers.push({x:p.x,z:p.z,s:s+(k&3)*14});rects.push([p.x-2.2,p.z-2.2,p.x+2.2,p.z+2.2]);break}
  for(let s=4;s<T.len-26;s+=2)for(const sd of[1,-1]){const p=trkAt(T,s),nx=-Math.sin(p.h)*sd,nz=-Math.cos(p.h)*sd,alongX=Math.abs(Math.cos(p.h))>.707,ml=4+Math.floor(r()*3);
    for(const md of[5,4,3,2]){const mx=alongX?ml:md,mz=alongX?md:ml,W=mx*4,D=mz*4,off=RTW+3.7+W/2*Math.abs(nx)+D/2*Math.abs(nz),cx=p.x+nx*off,cz=p.z+nz*off,q=[cx-W/2,cz-D/2,cx+W/2,cz+D/2];
      if(!ok(q))continue;rects.push(q);const rr=Math.max(Math.abs(cx),Math.abs(cz));
      if(r()<(rr>190?.3:.07)){for(let k=0;k<2;k++)props.trees.push({x:cx+(r()-.5)*W*.5,z:cz+(r()-.5)*D*.5,s:.9+r()*.4});break} // an empty lot with a couple of trees
      const[fl,st]=rr>190?[1+Math.floor(r()*2),pick(['stucco','mbrick','mconc'])]:rr>144?[2+Math.floor(r()*2),pick(['stucco','mbrick','mconc','mglass'])]:
        rr>98?[2+Math.floor(r()*3),pick(['mconc','mglass','mbrick'])]:[3+Math.floor(r()*4),pick(['mglass','mglass','mconc'])]; // taller toward the arena
      B.push({x:cx,z:cz,rot:0,mx,mz,floors:fl,style:st,neon:Math.floor(r()*NEON.length)});break}}
  // --- lamps: alternate sides, the colour changes every stretch
  for(let s=8,i=0;s<T.len-22;s+=14,i++){const sd=i%2?1:-1,p=trkAt(T,s),nx=-Math.sin(p.h)*sd,nz=-Math.cos(p.h)*sd,ax=Math.abs(nx)>Math.abs(nz)?-Math.sign(nx):0,az=ax?0:-Math.sign(nz);
    if(towers.some(t=>Math.hypot(t.x-p.x-nx*(RTW+1),t.z-p.z-nz*(RTW+1))<3.5))continue; // a tower stands there
    props.lamps.push({x:p.x+nx*(RTW+1),z:p.z+nz*(RTW+1),ax,az,c:Math.floor(s/150)%4})}
  // --- obstacles on straights: jersey-barrier slaloms and rows of parked cars
  const hAt=s=>T.h[Math.max(0,Math.min(T.n-1,Math.round(s/T.step)))],straight=(s,l)=>{for(let u=s-10;u<=s+l;u+=6)if(Math.abs(Math.sin(hAt(u)-hAt(s)))>.02)return false;return true};
  const onStraight=(f,l)=>{let s=f*T.len;for(let k=0;k<40&&!straight(s,l);k++)s+=8;return s};
  [.17,.35,.5,.67,.84].forEach(f=>{const s0=onStraight(f,96);for(let k=0;k<4;k++){const p=trkAt(T,s0+k*28,(k%2?1:-1)*3.5);L.push({k:'wall',x:p.x,z:p.z,rot:p.h+PI/2,w:6.2,style:'jersey'})}});
  [.07,.26,.43,.59,.76,.92].forEach((f,i)=>{const s0=onStraight(f,30),n=2+Math.floor(r()*2);for(let k=0;k<n;k++){const p=trkAt(T,s0+k*5.2,(i%2?1:-1)*(RTW-1.5));props.cars.push({x:p.x,z:p.z,rot:p.h+(r()<.5?0:PI),c:Math.floor(r()*6)})}});
  // --- ammo crates: a row every ~46 m, in a repeating pattern of lines across the track
  const crates=[],rows=[[0],[-4,4],[-4.6,0,4.6],[4.4],[-4.4],[-2.5,2.5]];
  for(let s=50,i=0;s<T.len-24;s+=46,i++)rows[i%rows.length].forEach(lat=>{const p=trkAt(T,s,lat);
    if(L.some(o=>Math.hypot(o.x-p.x,o.z-p.z)<4.5)||props.cars.some(o=>Math.hypot(o.x-p.x,o.z-p.z)<4))return;crates.push({x:p.x,z:p.z,s,lat})});
  // --- arena cover: scrap walls, jersey barriers and sheds on the floor and the decks, parked cars (they explode)
  const W_=(x,z,rot,w,style)=>L.push({k:'wall',x,z,rot,w,style});
  W_(-50,-16,PI/2,6,'jersey');W_(-50,16,PI/2,6,'jersey');W_(50,-16,PI/2,6,'jersey'); // floor
  W_(-22,-52,0,8);W_(22,-50,0,8);W_(-18,50,0,8);W_(24,52,0,8);W_(50,14,PI/2,8);
  L.push({k:'shed',x:-50,z:-50,rot:0},{k:'shed',x:50,z:50,rot:0});
  W_(-20,-18,0,6,'jersey');W_(20,18,0,6,'jersey');W_(-18,20,PI/2,6,'jersey');W_(18,-20,PI/2,6,'jersey');W_(0,-21,0,6);W_(0,21,0,6); // main deck
  W_(0,-6,0,5,'jersey');W_(0,6,0,5,'jersey'); // top deck
  [[34,50,0],[39.2,50,0],[-30,-54,0],[-24.8,-54,0],[54,-8,PI/2],[54,-13.2,PI/2]].forEach(([x,z,rot],i)=>props.cars.push({x,z,rot,c:i%6}));
  // --- start grid: three rows of three, 4 m apart across the track; the player starts in the middle of the middle row
  const sp=trkAt(T,22,0);
  return{buildings:B,layout:L,props,start:{x:sp.x,z:sp.z,h:sp.h},race:{track:T,crates,startS:36,playerS:22,playerLat:0,grid:[{s:30,lat:-4},{s:30,lat:0},{s:30,lat:4},{s:22,lat:-4},{s:22,lat:4},{s:14,lat:-4},{s:14,lat:0},{s:14,lat:4}],towers}}}

// ---------- Arena walls: indestructible pieces (they block movement, shells, sight lines and the nav grid like any
// wall) with one merged mesh for the concrete and one per neon trim colour
function buildArena(){const A=MAP.arena;if(!A)return;const body=[],trim=NEON.map(()=>[]),M=new THREE.Matrix4(),U=THREE.BufferGeometryUtils;
  const box=(list,w,h,d,x,y,z,rot)=>{const g=new THREE.BoxGeometry(w,h,d);g.applyMatrix4(M.makeRotationY(rot));g.applyMatrix4(M.makeTranslation(x,y,z));list.push(g)};
  // axis-aligned wall from (xa,za) to (xb,zb), standing on y0, h tall; cut into pieces of at most 10 m
  const wall=(xa,za,xb,zb,y0,h,col,th=.8)=>{const len=Math.hypot(xb-xa,zb-za);if(len<.05)return;const n=Math.ceil(len/10),w=len/n,rot=Math.abs(zb-za)>Math.abs(xb-xa)?PI/2:0;
    for(let k=0;k<n;k++){const t=(k+.5)/n,x=xa+(xb-xa)*t,z=za+(zb-za)*t;
      pieces.push({kind:'wall',x,z,rot,w,d:th,gy:y0,y0,c:Math.cos(rot),s:Math.sin(rot),hp:Infinity,max:Infinity,state:0,H:[h,h,h],lastRam:-9,blocks:true,debrisM:concrete,fixed:true,onState(){}});
      box(body,w,h,th,x,y0+h/2,z,rot);box(trim[col],w+.02,.14,th+.08,x,y0+h+.07,z,rot)}};
  // perimeter, with the gate in the west wall
  const E=A.half+.5,H=A.wallH;wall(-E,-E,E,-E,0,H,1,1);wall(-E,E,E,E,0,H,1,1);wall(E,-E,E,E,0,H,1,1);wall(-E,-E,-E,-A.gate,0,H,1,1);wall(-E,A.gate,-E,E,0,H,1,1);
  [-1,1].forEach(s=>{box(body,2.2,H+3,2.2,-E,(H+3)/2,s*(A.gate+1.1),0);box(trim[0],2.4,.3,2.4,-E,H+3.15,s*(A.gate+1.1),0)}); // gate pylons
  // deck edges: a wall just outside each edge, from the level below up to a parapet above the deck; open where a ramp lands
  const side=(a0,a1,gap,fn)=>{if(!gap){fn(a0-.8,a1+.8);return}fn(a0-.8,gap[0]-.8);fn(gap[1]+.8,a1+.8)};
  A.plats.forEach(p=>{const y=p.base,h=p.h-p.base+.6,g=p.gaps||{};
    side(p.x0,p.x1,g.n,(a,b)=>wall(a,p.z0-.4,b,p.z0-.4,y,h,p.col));side(p.x0,p.x1,g.s,(a,b)=>wall(a,p.z1+.4,b,p.z1+.4,y,h,p.col));
    side(p.z0,p.z1,g.w,(a,b)=>wall(p.x0-.4,a,p.x0-.4,b,y,h,p.col));side(p.z0,p.z1,g.e,(a,b)=>wall(p.x1+.4,a,p.x1+.4,b,y,h,p.col))});
  // ramp sides: three steps of wall following the slope
  A.ramps.forEach(q=>{const lo=Math.min(q.h0,q.h1),X=q.ax==='x',a0=X?q.x0:q.z0,a1=X?q.x1:q.z1;
    for(let k=0;k<3;k++){const u0=a0+(a1-a0)*k/3,u1=a0+(a1-a0)*(k+1)/3,hh=Math.max(q.h0+(q.h1-q.h0)*k/3,q.h0+(q.h1-q.h0)*(k+1)/3)-lo+.6;
      [X?q.z0-.4:q.x0-.4,X?q.z1+.4:q.x1+.4].forEach(v=>X?wall(u0,v,u1,v,lo,hh,3):wall(v,u0,v,u1,lo,hh,3))}});
  const bm=SM(tex(256,256,(g,w,h)=>{g.fillStyle='#3d3f48';g.fillRect(0,0,w,h);grime(g,w,h);g.fillStyle='rgba(15,15,20,.5)';for(let y=0;y<h;y+=64)g.fillRect(0,y,w,3);for(let x=0;x<w;x+=128)g.fillRect(x,0,3,h)}),.8,.2);
  const put=(list,m,shadow)=>{if(!list.length)return;if(U){const o=new THREE.Mesh(U.mergeBufferGeometries(list),m);o.castShadow=o.receiveShadow=shadow;sc.add(o)}else list.forEach(g=>{const o=new THREE.Mesh(g,m);o.castShadow=o.receiveShadow=shadow;sc.add(o)})};
  put(body,bm,true);trim.forEach((l,i)=>put(l,new THREE.MeshBasicMaterial({color:new THREE.Color(NEON[i]).multiplyScalar(.85)}),false))}

// ---------- Painted ground (same idea as paintTownGround): paved city square, the asphalt ribbon with neon edge
// lines, start grid and finish line, the arena floor with its decks and ramps
function paintRaceGround(size){const W=4096,k=W/size,X=x=>(x+size/2)*k,c=document.createElement('canvas');c.width=c.height=W;const g=c.getContext('2d'),T=MAP.race.track,A=MAP.arena;
  const rect=(x0,z0,x1,z1,col)=>{g.fillStyle=col;g.fillRect(X(x0),X(z0),(x1-x0)*k,(z1-z0)*k)};
  g.fillStyle='#6b8a46';g.fillRect(0,0,W,W);
  for(let i=0;i<9000;i++){g.fillStyle=Math.random()<.5?'rgba(90,120,55,.35)':'rgba(130,140,80,.25)';const s=4+Math.random()*30;g.fillRect(Math.random()*W,Math.random()*W,s,s)}
  rect(-RACE_EDGE,-RACE_EDGE,RACE_EDGE,RACE_EDGE,'#9c9a96'); // paved lots
  g.fillStyle='rgba(70,68,64,.28)';for(let u=-RACE_EDGE;u<=RACE_EDGE;u+=4){g.fillRect(X(u),X(-RACE_EDGE),1,2*RACE_EDGE*k);g.fillRect(X(-RACE_EDGE),X(u),2*RACE_EDGE*k,1)}
  // arena floor: steel-grey plates, lighter decks, striped ramps, a painted ring
  rect(-A.half,-A.half,A.half,A.half,'#74767f');g.fillStyle='rgba(30,30,38,.35)';for(let u=-A.half;u<=A.half;u+=4){g.fillRect(X(u),X(-A.half),1.5,2*A.half*k);g.fillRect(X(-A.half),X(u),2*A.half*k,1.5)}
  g.strokeStyle=NEON_CSS[1];g.lineWidth=.45*k;g.beginPath();g.arc(X(0),X(0),51*k,0,7);g.stroke();
  A.plats.forEach(p=>{rect(p.x0,p.z0,p.x1,p.z1,p.base?'#8d909c':p.h>2.9?'#7d808a':'#857f76');g.strokeStyle=NEON_CSS[p.col];g.lineWidth=.3*k;g.strokeRect(X(p.x0+1.6),X(p.z0+1.6),(p.x1-p.x0-3.2)*k,(p.z1-p.z0-3.2)*k)});
  A.ramps.forEach(q=>{rect(q.x0,q.z0,q.x1,q.z1,'#8b8d96');g.fillStyle='#d9a62a';const Xa=q.ax==='x';for(let u=(Xa?q.x0:q.z0)+1;u<(Xa?q.x1:q.z1);u+=2)Xa?g.fillRect(X(u),X(q.z0+.6),.5*k,(q.z1-q.z0-1.2)*k):g.fillRect(X(q.x0+.6),X(u),(q.x1-q.x0-1.2)*k,.5*k)});
  // track ribbon
  const path=off=>{g.beginPath();for(let i=0;i<T.n;i++){const x=X(T.x[i]-Math.sin(T.h[i])*off),z=X(T.z[i]-Math.cos(T.h[i])*off);i?g.lineTo(x,z):g.moveTo(x,z)}};
  g.lineJoin=g.lineCap='round';path(0);
  g.strokeStyle='#bdbab2';g.lineWidth=(RTW+2.6)*2*k;g.stroke();g.strokeStyle='#d4d1c8';g.lineWidth=(RTW+.2)*2*k;g.stroke();g.strokeStyle='#34363a';g.lineWidth=RTW*2*k;g.stroke();
  g.lineCap='butt';g.setLineDash([3*k,5*k]);g.strokeStyle='#e9e6dc';g.lineWidth=.18*k;g.stroke();g.setLineDash([]);
  path(RTW-.7);g.strokeStyle=NEON_CSS[1];g.lineWidth=.34*k;g.stroke();path(-(RTW-.7));g.strokeStyle=NEON_CSS[0];g.stroke();
  // chequered start line and finish line (the arena gate), grid boxes
  const across=(s,fn)=>{const p=trkAt(T,s);g.save();g.translate(X(p.x),X(p.z));g.rotate(-p.h);fn();g.restore()};
  const cheq=s=>across(s,()=>{for(let i=0;i<2;i++)for(let j=0;j<17;j++){g.fillStyle=(i+j)%2?'#e9e6dc':'#15161a';g.fillRect((i-1)*.8*k,(-RTW+.2+j*.8)*k,.8*k,.8*k)}});
  cheq(MAP.race.startS);cheq(T.len-18);
  MAP.race.grid.concat({s:MAP.race.playerS,lat:MAP.race.playerLat}).forEach(q=>across(q.s,()=>{g.strokeStyle='#e9e6dc';g.lineWidth=.16*k;g.strokeRect(-2.4*k,(-q.lat-1.6)*k,5.2*k,3.2*k)}));
  return groundFinish(c,g,size,W,(q,QX,a)=>{ // extra neon thrown on the ground: the track's edge lines, the arena ring and deck outlines
    const edge=(off,col)=>{q.beginPath();for(let i=0;i<T.n;i++){const x=QX(T.x[i]-Math.sin(T.h[i])*off),z=QX(T.z[i]-Math.cos(T.h[i])*off);i?q.lineTo(x,z):q.moveTo(x,z)}q.strokeStyle=col;q.lineWidth=2.6*a;q.globalAlpha=.75;q.stroke()};
    q.save();q.filter='blur(2px)';edge(RTW-.7,NEON_CSS[1]);edge(-(RTW-.7),NEON_CSS[0]);
    q.strokeStyle=NEON_CSS[1];q.lineWidth=5*a;q.globalAlpha=.6;q.beginPath();q.arc(QX(0),QX(0),51*a,0,7);q.stroke();
    A.plats.forEach(p=>{q.strokeStyle=NEON_CSS[p.col];q.lineWidth=4*a;q.strokeRect(QX(p.x0+1.6),QX(p.z0+1.6),(p.x1-p.x0-3.2)*a,(p.z1-p.z0-3.2)*a)});
    q.globalAlpha=.18;q.fillStyle='#8a8fd0';q.fillRect(QX(-A.half),QX(-A.half),2*A.half*a,2*A.half*a);q.restore()})}
