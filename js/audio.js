// Sound: recorded samples (sfx/*.mp3, embedded by js/sfxdata.js) with synthesized Web Audio fallbacks.
// Classic script sharing one global scope with the other js/ files; load order is set in index.html.

// ---------- Sound (synthesized with Web Audio) ----------
let AC=null,master,noiseBuf,soundOn=true;
function audio(){if(!soundOn)return null;if(!AC){const A=window.AudioContext||window.webkitAudioContext;if(!A)return null;AC=new A();const comp=AC.createDynamicsCompressor();master=AC.createGain();master.gain.value=.75;master.connect(comp);comp.connect(AC.destination);noiseBuf=AC.createBuffer(1,AC.sampleRate*3,AC.sampleRate);const d=noiseBuf.getChannelData(0);let b=0;for(let i=0;i<d.length;i++){const w=Math.random()*2-1;b=(b+.02*w)/1.02;d[i]=w*.6+b*3}sfxLoad()}if(AC.state==='suspended')AC.resume();return AC}
function nz(t,dur,f0,f1,vol,type){const s=AC.createBufferSource();s.buffer=noiseBuf;const f=AC.createBiquadFilter();f.type=type||'lowpass';f.frequency.setValueAtTime(f0,t);f.frequency.exponentialRampToValueAtTime(f1,t+dur);const g=AC.createGain();g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(Math.min(1,vol),t+.008);g.gain.exponentialRampToValueAtTime(.0001,t+dur);s.connect(f);f.connect(g);g.connect(master);s.start(t,Math.random()*1.5);s.stop(t+dur+.05)}
function th(t,f0,f1,dur,vol){const o=AC.createOscillator();o.frequency.setValueAtTime(f0,t);o.frequency.exponentialRampToValueAtTime(f1,t+dur);const g=AC.createGain();g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(Math.min(1,vol),t+.01);g.gain.exponentialRampToValueAtTime(.0001,t+dur);o.connect(g);g.connect(master);o.start(t);o.stop(t+dur+.05)}

// ---------- Recorded samples ----------
// sfx/*.mp3 are packed into js/sfxdata.js (node tools/pack-sfx.js) so they load from file:// too. They decode when the
// AudioContext first starts; until a sample is ready (or if decoding fails) the synthesized version plays instead.
const SFX={},SFX_CUT={ // slices of the multi-shot recordings: [offset, duration] in seconds
  gun:[[.13,.85],[1.39,.8],[2.23,.85],[3.49,.8]],tank:[[.04,3.4],[3.52,4.9],[8.62,2.35]]};
let sfxLoading=false,sfxVoices=0;
function sfxLoad(){if(sfxLoading||typeof SFX_DATA==='undefined')return;sfxLoading=true;
  Object.entries(SFX_DATA).forEach(([n,b64])=>{const bin=atob(b64),u=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);
    AC.decodeAudioData(u.buffer,b=>{SFX[n]=b},()=>console.warn('sfx: could not decode '+n))})}
// Play a sample. o: t start time, vol, rate, off/dur (slice, in buffer seconds), fade (tail seconds), pan, lp (lowpass Hz).
// Returns false when the sample isn't ready (callers then play their synth fallback).
function sfx(n,o={}){const b=SFX[n];if(!b||!AC)return false;if(sfxVoices>40)return true; // voice cap: drop, don't fall back
  const t=o.t??AC.currentTime,rate=o.rate||1,off=o.off||0,dur=Math.min(o.dur||b.duration,b.duration-off),len=dur/rate,vol=o.vol??1;
  const s=AC.createBufferSource();s.buffer=b;s.playbackRate.value=rate;let node=s;
  if(o.lp&&o.lp<18000){const f=AC.createBiquadFilter();f.type='lowpass';f.frequency.value=o.lp;node.connect(f);node=f}
  if(o.pan&&AC.createStereoPanner){const p=AC.createStereoPanner();p.pan.value=o.pan;node.connect(p);node=p}
  const g=AC.createGain();g.gain.setValueAtTime(vol,t);if(o.fade){g.gain.setValueAtTime(vol,t+Math.max(0,len-o.fade));g.gain.linearRampToValueAtTime(0,t+len)}
  node.connect(g);g.connect(master);s.start(t,off,dur);sfxVoices++;s.onended=()=>sfxVoices--;return true}
const sfxPick=a=>a[Math.floor(Math.random()*a.length)];
// Where a world sound sits for the listener: arrival time (speed of sound), loudness falloff, stereo pan, distance muffling.
const _sndV=new THREE.Vector3(),_sndR=new THREE.Vector3(),_sndP=new THREE.Vector3();
function spot(p,fall){const d=cam.position.distanceTo(p);_sndV.subVectors(p,cam.position).normalize();_sndR.setFromMatrixColumn(cam.matrixWorld,0);
  return{d,t:AC.currentTime+d/343,a:1/(1+d*fall),pan:d<3?0:_sndV.dot(_sndR)*.7,lp:Math.max(900,20000/(1+d*.035))}}
// Looping samples (turret motor, crawler treads): one source each, faded by gain.
const sfxLoops={},LOOP_RANGE={'turret-rotate':[.05,1.12],'tank-moving':[.3,9.95],drone:[4,7.1],minigun:[.45,2.6]};
function loopSnd(n,vol,rate,pan){if(!AC||!SFX[n])return;let L=sfxLoops[n];
  if(!L){if(vol<.003)return;const s=AC.createBufferSource();s.buffer=SFX[n];s.loop=true;[s.loopStart,s.loopEnd]=LOOP_RANGE[n]||[0,SFX[n].duration];
    const g=AC.createGain();g.gain.value=0;let node=s;let p=null;if(AC.createStereoPanner){p=AC.createStereoPanner();s.connect(p);node=p}
    node.connect(g);g.connect(master);s.start(AC.currentTime,s.loopStart);L=sfxLoops[n]={s,g,p}}
  const t=AC.currentTime;L.g.gain.setTargetAtTime(soundOn?vol:0,t,.07);L.s.playbackRate.setTargetAtTime(rate,t,.12);if(L.p)L.p.pan.setTargetAtTime(pan||0,t,.1)}
// Per frame (main loop): artillery turret motor while the gun traverses or elevates, crawler tread rumble by distance and speed.
let sfxYaw=0,sfxElev=0;
function sfxTick(dt){if(!AC)return;
  let sp=0;if(dt>0&&mode===1&&!run&&!pl.dead)sp=(Math.abs(AIM.yaw-sfxYaw)+Math.abs(AIM.elev-sfxElev)*.8)/dt;sfxYaw=AIM.yaw;sfxElev=AIM.elev;
  loopSnd('turret-rotate',sp>.04?Math.min(.5,.22+sp*.3):0,.85+Math.min(.3,sp*.25));
  let v=0,pw=0;if(dt>0)enemies.forEach(e=>{if(e.dead||e.type!=='crawler')return;const s=spot(_sndP.set(e.x,e.y+.5,e.z),.07),k=Math.min(1,Math.abs(e.v)/4)*s.a;v+=k;pw+=k*s.pan});
  loopSnd('tank-moving',Math.min(.6,v*.9),.8+Math.min(.3,v*.4),v>0?pw/v:0)}

function boomSnd(pw,p,heavy){if(!audio())return;const s=spot(p,.03),a=s.a,t=s.t,o={t,pan:s.pan,lp:s.lp};
  if(heavy?sfx('explosion-big',{...o,vol:1.15*a,rate:rnd(.92,1.02)}):
    pw>=1.3?(Math.random()<.5?sfx('explosion-a',{...o,vol:.95*a,rate:rnd(.9,1.06)}):sfx('explosion-b',{...o,off:.1,vol:1.1*a,rate:rnd(.95,1.08)})):
    sfx('explosion-a',{...o,vol:(.3+.45*pw)*a,rate:rnd(1.15,1.3)+(1.3-pw)*.4,dur:1.8,fade:.8}))return; // small shells: shorter, higher
  nz(t,.15,7000,1200,.55*a);nz(t,1+pw*.8,2200,70,.95*a);th(t,95,26,.7+pw*.4,1*a);nz(t+.06,2.4+pw,500,35,.4*a)}
function fireSnd(m){if(!audio())return;const t=AC.currentTime;
  if(m===0){const [off,dur]=sfxPick(SFX_CUT.gun);if(sfx('gun-shot',{off,dur,vol:2.3,rate:rnd(.94,1.04)}))return}
  if(m===2){const [off]=sfxPick(SFX_CUT.gun);if(sfx('gun-shot',{off,dur:.5,fade:.25,vol:1.7,rate:rnd(1.12,1.24)}))return} // rapid fire: clipped and brighter
  if(m===1){const [off,dur]=sfxPick(SFX_CUT.tank);if(sfx('tank-shot',{off,dur,fade:.5,vol:1.05,rate:rnd(.95,1.02)}))return}
  nz(t,.22,9000,900,.55);th(t,150,40,.3,.6);if(m===1){nz(t,1.5,1400,50,.8);th(t,70,22,1,1)}if(m===2){nz(t,.5,3000,200,.5,'bandpass');th(t,220,60,.25,.4)}}
