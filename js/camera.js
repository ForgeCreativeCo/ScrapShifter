// Chase camera state and mouse input.
// Classic script sharing one global scope with the other js/ files; load order is set in index.html.

// ---------- Chase camera (drag to look around, eases back behind the vehicle) ----------
const CAM_R=[11,19,12,17],CAM_EL=[.3,.55,.28,.62]; // per mode: buggy, artillery (pulled back and up), mech
let drag=null,lookOff=0,lookEl=0,lookIdle=9,zoom=1,baseYaw=PI,camR=11,camEl=.3;
// Mouse: cursor aims (buggy/mech), left button fires (hold for repeat), right-drag looks around.
const mouse=new THREE.Vector2();let mouseIn=false,firing=false;
const setMouse=e=>{const r=cv.getBoundingClientRect();mouse.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);mouseIn=true};
cv.addEventListener('contextmenu',e=>e.preventDefault());
cv.addEventListener('pointerdown',e=>{setMouse(e);cv.setPointerCapture(e.pointerId);
  if(e.button===0){if(audio())engine();
    if(mode===1&&!run)AIM.pending=true; // artillery: queue a shot at the laser / cursor (fires once laid and loaded)
    else{firing=true;fire()}}
  else{drag={x:e.clientX,y:e.clientY};cv.style.cursor='grabbing'}});
cv.addEventListener('pointermove',e=>{setMouse(e);if(!drag)return;if(droneView()){DR.h-=(e.clientX-drag.x)*.006;drag={x:e.clientX,y:e.clientY};return} // drone: drag turns it
  lookOff-=(e.clientX-drag.x)*.008;lookEl=Math.max(-.25,Math.min(.9,lookEl+(e.clientY-drag.y)*.006));lookIdle=0;drag={x:e.clientX,y:e.clientY}});
cv.addEventListener('pointerup',e=>{if(e.button===0)firing=false;else{drag=null;cv.style.cursor='crosshair'}});
cv.addEventListener('pointerleave',()=>{if(!drag)mouseIn=false});
window.addEventListener('blur',()=>{firing=false;drag=null});
cv.addEventListener('wheel',e=>{e.preventDefault();if(mode===3&&!run){GY.alt=Math.max(GYRO.alt[0],Math.min(GYRO.alt[1],GY.alt+e.deltaY*.015));return}if(droneView()){DR.alt=Math.max(DRONE.alt[0],Math.min(DRONE.alt[1],DR.alt+e.deltaY*.02));return}zoom=Math.max(.5,Math.min(2.2,zoom+e.deltaY*.001))},{passive:false});
sc.add(sun.target);
