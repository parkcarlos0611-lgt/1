/* ===== Tuning.js : every balance / physics number in one JSON tree =====
   Override without editing code:
     localStorage.setItem('cl_tuning', JSON.stringify({ragdoll:{iterations:16}}))
     or  index.html?tune={"combat":{"bufferMs":220}}
   Values are deep-merged over the defaults below at load time. */
const TUNING_DEFAULT={
  ragdoll:{
    gravity:11,            // m/s² in world units (fighter ≈ 1.6–1.9 units tall)
    iterations:12,         // constraint solver passes per substep
    maxSubsteps:4,         // CCD sub-stepping cap per frame
    linearDamping:.985,    // per-step velocity retention (physical phase)
    koLinearDamping:.972,  // limp KO body loses energy faster
    angularDamping:.18,    // 0–1, share of relative bone spin removed per step
    friction:.62,          // tangential velocity removed on floor contact
    restitution:.08,       // bounce off floor / cage (low = no jitter)
    maxSpeed:9,            // velocity clamp per particle (units/s)
    sleepSpeed:.11,        // below this for sleepTime → frozen
    sleepTime:.35,
    blendKO:{w0:.55,tau:.11},       // kinematic drive at the moment of a KO (fades fast → limp)
    blendKD:{w0:.6,tau:.18},        // knockdown: stays "controlled" longer
    impulseKO:3.2, impulseKD:1.6,   // strike impulse (units/s) at the struck joint
    impulseFalloff:.55,             // share of impulse passed one bone further from the hit joint
    shapeStiffKO:.3,                // soft shape constraints are weakened on KO
    cageInset:.05,                  // wall plane = stage.R + this
    limitStiffness:.4,              // share of a joint-limit violation corrected per solver pass
    contactDamping:.12              // extra velocity loss per step for particles touching floor / cage
  },
  combat:{
    bufferMs:180,          // combo pre-input window (inputs this early are kept)
    bufferMax:3,
    cancelFrac:.55,        // startup cancel allowed while t < t0 × cancelFrac
    cancelStaRefund:.5,    // share of stamina refunded on a cancelled strike
    hitDrag:.45, hitDragT:.06,      // attacker slows briefly on contact (weight of impact)
    blockRecoil:1.25,               // attacker recovers faster after a blocked strike (pushed off)
    whiffRecovery:.78,              // over-extension: slower recovery after a miss
    startupSpeed:1.08, recoverySpeed:.95,
    weaveT:.40, swayT:.38, headMoveSta:1.4,
    parryWindow:.14,       // block pressed this many seconds before impact = parry
    parryStun:.38,         // attacker flinch on parry
    parryGuardCost:0
  },
  debug:{on:false}
};
function _tmerge(a,b){for(const k in b){if(b[k]&&typeof b[k]==='object'&&!Array.isArray(b[k])&&a[k]&&typeof a[k]==='object')_tmerge(a[k],b[k]);else a[k]=b[k]}return a}
const TUNING=(()=>{const t=JSON.parse(JSON.stringify(TUNING_DEFAULT));
  try{const s=localStorage.getItem('cl_tuning');if(s)_tmerge(t,JSON.parse(s))}catch(e){}
  try{const q=new URLSearchParams(location.search).get('tune');if(q)_tmerge(t,JSON.parse(q))}catch(e){}
  try{if(/[?&]debug=1/.test(location.search))t.debug.on=true}catch(e){}
  return t})();
/* register a module's defaults (later phases add their own sections) */
function tuneSection(name,defs){TUNING_DEFAULT[name]=defs;const cur=TUNING[name]||{};TUNING[name]=_tmerge(JSON.parse(JSON.stringify(defs)),cur);return TUNING[name]}
