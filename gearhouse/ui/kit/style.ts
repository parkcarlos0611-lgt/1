// The design system's CSS (docs/systems/110 G2): the tokens (ui/kit/tokens.ts) and the shared parts, put on a page once
// by installKit(). Every class starts gk-. The parts: headline and figure type with a black edge, chunky buttons by
// role with a pressed state, panels with cut corners (a thick outline, a solid face, a darker lower band), stat bars,
// tilted badges, diagonal stripe bands, the top band with its chips, and the slide transitions (short, shorter on a
// phone, none with reduced motion or the calm setting).
import { tokenCss, ROLE, ROLE_KEY, TIER_COLOUR, type Role, type TierColourKey } from './tokens';

const roleCls = (Object.keys(ROLE) as Role[]).map(r => `.gk-${ROLE_KEY[r]}{--f0:var(--gk-${ROLE_KEY[r]}0);--f1:var(--gk-${ROLE_KEY[r]}1)}`).join('');
/** the class ladder's colour classes (.gk-tier-N ...): a class's face and band as --c0 and --c1 */
const tierCls = (Object.keys(TIER_COLOUR) as TierColourKey[]).map(k => `.gk-tier-${k}{--c0:var(--gk-cls-${k.toLowerCase()}0);--c1:var(--gk-cls-${k.toLowerCase()}1)}`).join('');
const cut = (c: string) => `polygon(${c} 0,100% 0,100% calc(100% - ${c}),calc(100% - ${c}) 100%,0 100%,0 ${c})`;

export const KIT_CSS = tokenCss() + `
.gk-head{font-family:var(--gk-head);font-weight:700;font-style:italic;letter-spacing:.02em;color:#fff;text-shadow:var(--gk-edge);line-height:1.1}
.gk-num{font-family:var(--gk-head);font-weight:700;font-style:italic;font-variant-numeric:tabular-nums;color:#fff;text-shadow:var(--gk-edge-s)}
.gk-logo{font-family:var(--gk-head);font-weight:700;font-style:italic;letter-spacing:.04em;line-height:1;color:transparent;background:linear-gradient(#ffe45c 0 30%,#ffb31a 62%,#ff7a12);-webkit-background-clip:text;background-clip:text;
  filter:drop-shadow(2.5px 0 0 var(--gk-ink)) drop-shadow(-2.5px 0 0 var(--gk-ink)) drop-shadow(0 2.5px 0 var(--gk-ink)) drop-shadow(0 -2.5px 0 var(--gk-ink)) drop-shadow(0 5px 0 rgba(0,0,0,.55))}
.gk-ic{width:28px;height:28px;flex:none;display:inline-block;vertical-align:middle;overflow:visible}
/* ---- buttons: a solid face, a darker lower band, a thick outline, a hard shadow that the press closes ---- */
.gk-btn{--f0:var(--gk-y0);--f1:var(--gk-y1);font-family:var(--gk-head);font-weight:700;font-style:italic;font-size:1.08rem;line-height:1.1;letter-spacing:.03em;color:#fff;text-shadow:var(--gk-edge-s);
  border:var(--gk-bw) solid var(--gk-ink);border-radius:4px;background:linear-gradient(var(--f0) 0 68%,var(--f1) 68%);box-shadow:0 4px 0 var(--gk-ink),inset 0 2px 0 rgba(255,255,255,.4);
  padding:8px 16px;min-height:46px;display:inline-flex;align-items:center;justify-content:center;gap:8px;cursor:pointer;position:relative;transition:transform 60ms,box-shadow 60ms,filter 80ms;
  user-select:none;-webkit-user-select:none;-webkit-tap-highlight-color:transparent;white-space:nowrap;margin-bottom:4px}
.gk-btn:hover:not(:disabled){filter:brightness(1.07)}
.gk-btn:active:not(:disabled),.gk-btn.gk-down{transform:translateY(3px);box-shadow:0 1px 0 var(--gk-ink),inset 0 2px 0 rgba(0,0,0,.15)}
.gk-btn:focus-visible{outline:3px solid #fff;outline-offset:3px}
.gk-btn:disabled,.gk-btn.gk-locked{--f0:var(--gk-grey0);--f1:var(--gk-grey1);cursor:default;color:#f2f3f4}
.gk-btn .gk-ic{width:1.6em;height:1.6em;margin-left:-4px}
.gk-btn.gk-big{font-size:1.4rem;min-height:58px;padding:8px 20px;justify-content:flex-start}
.gk-btn.gk-sq{width:52px;height:52px;min-height:0;padding:0}.gk-btn.gk-sq .gk-ic{margin:0;width:34px;height:34px}
.gk-btn.gk-tilt{transform:skewX(-8deg)}.gk-btn.gk-tilt:active:not(:disabled){transform:skewX(-8deg) translateY(3px)}
/* ---- panels: cut corners, a thick outline, a solid face over a darker lower band ---- */
.gk-panel{--cut:var(--gk-cut);--face:var(--gk-p0);--band:var(--gk-p1);--bandh:9px;position:relative;isolation:isolate;background:var(--gk-ink);--gk-text:var(--gk-ptext);--gk-soft:var(--gk-psoft);color:var(--gk-text);clip-path:${cut('var(--cut)')};padding:14px 16px 18px}
.gk-panel::before{content:'';position:absolute;inset:var(--gk-bwp);z-index:-1;--c2:calc(var(--cut) - var(--gk-bwp) * .42);clip-path:${cut('var(--c2)')};
  background:linear-gradient(rgba(255,255,255,.13) 0 3px,transparent 3px),linear-gradient(var(--face) 0 calc(100% - var(--bandh)),var(--band) 0)}
.gk-panel.gk-well{--face:var(--gk-well);--band:var(--gk-well)}
.gk-panel.gk-sel{--face:var(--gk-g1);--band:#17702f}
.gk-panel.gk-y{--face:var(--gk-y0);--band:var(--gk-y1);color:var(--gk-ink)}
.gk-panel.gk-b{--face:var(--gk-b0);--band:var(--gk-b1)}
/* ---- stat bars ---- */
.gk-stat{display:grid;grid-template-columns:auto 4.6em minmax(60px,1fr) 5.2em;align-items:center;gap:8px}
.gk-stat .gk-ic{width:30px;height:30px}
.gk-stat-l{font-family:var(--gk-head);font-weight:700;font-style:italic;font-size:.98rem;color:#fff;text-shadow:var(--gk-edge-s);white-space:nowrap}
.gk-track{position:relative;height:22px;border:var(--gk-bw) solid var(--gk-ink);border-radius:3px;background:var(--gk-well);overflow:hidden;transform:skewX(-12deg)}
.gk-track>i{position:absolute;left:0;top:0;bottom:0;display:block}
.gk-fill{width:calc(var(--k,0) * 100%);background:linear-gradient(var(--f0) 0 62%,var(--f1) 62%);border-right:var(--gk-bw) solid var(--gk-ink);transition:width .5s cubic-bezier(.3,1.45,.5,1)}
.gk-gain,.gk-lost{opacity:0;transition:opacity .5s .7s,width 0s}
.gk-gain{background:#fff}.gk-lost{background:var(--gk-r0)}
.gk-track.gk-ch .gk-gain,.gk-track.gk-ch .gk-lost{opacity:.85;transition:none}
.gk-track::after{content:'';position:absolute;inset:0;background:repeating-linear-gradient(90deg,transparent 0 calc(10% - 2px),rgba(0,0,0,.28) calc(10% - 2px) 10%);pointer-events:none}
.gk-stat-n{text-align:right;font-size:1.3rem;line-height:1}.gk-stat-n small{font-size:.62em;margin-left:2px;color:var(--gk-y0)}
/* ---- badges ---- */
.gk-badge{--f0:var(--gk-r0);--f1:var(--gk-r1);display:inline-flex;align-items:center;gap:3px;font-family:var(--gk-head);font-weight:700;font-style:italic;font-size:.82rem;line-height:1;letter-spacing:.06em;color:#fff;text-shadow:var(--gk-edge-s);
  padding:4px 9px 5px;background:linear-gradient(var(--f0) 0 64%,var(--f1) 64%);border:2.5px solid var(--gk-ink);box-shadow:0 3px 0 var(--gk-ink);transform:rotate(-7deg) skewX(-8deg);white-space:nowrap}
.gk-badge .gk-ic{width:1.3em;height:1.3em;margin:-2px 0}
.gk-badge.gk-new{--f0:var(--gk-r0);--f1:var(--gk-r1)}.gk-badge.gk-beta{--f0:var(--gk-g0);--f1:var(--gk-g1)}.gk-badge.gk-lockb{--f0:var(--gk-grey0);--f1:var(--gk-grey1)}.gk-badge.gk-hot{--f0:var(--gk-o0);--f1:var(--gk-o1)}
.gk-badge.gk-pin{position:absolute;right:-8px;top:-12px;z-index:2}
/* ---- the class (docs/systems/115 §3-7): the class colour on the border band and the glow only, the face dark, the text
   white; a locked rung darkened (with the lock icon beside it), never greyed. Its room meters: the rung's span a band
   of its colour along the track's foot, the cap the track's right end ---- */
.gk-tier{--c0:var(--gk-cls-n0);--c1:var(--gk-cls-n1);display:inline-flex;align-items:center;gap:5px;font-family:var(--gk-head);font-weight:700;font-style:italic;font-size:.9rem;line-height:1;letter-spacing:.04em;color:#fff;text-shadow:var(--gk-edge-s);
  padding:3px 9px 4px 15px;background:linear-gradient(90deg,var(--c0) 0 6px,var(--c1) 6px 9px,#1b1e22 9px);border:2.5px solid var(--gk-ink);border-radius:3px;box-shadow:0 0 0 2px var(--c0),0 0 10px 2px var(--c0);transform:skewX(-8deg);white-space:nowrap;vertical-align:middle}
.gk-tier>*{transform:skewX(8deg)}.gk-tier-cd{font-size:1.08em}.gk-tier-nm{font-family:var(--gk-body);font-style:normal;font-size:.86em;letter-spacing:0}.gk-tier-ch{font-size:.9em;opacity:.85;letter-spacing:-.08em}
.gk-tier.gk-locked{filter:brightness(.5) saturate(.6)}
.gk-room{display:grid;grid-template-columns:4.6em minmax(40px,1fr) auto;align-items:center;gap:6px;font-size:.78rem;font-weight:700}
.gk-room-l{color:var(--gk-psoft);white-space:nowrap}
.gk-room-t{font-family:var(--gk-head);font-style:italic;font-variant-numeric:tabular-nums;color:#fff;text-shadow:var(--gk-edge-s);white-space:nowrap;text-align:right}.gk-room-t small{font-family:var(--gk-body);font-style:normal;font-weight:400;color:var(--gk-psoft);text-shadow:none;margin-left:3px}
.gk-room-k{position:relative;height:13px;border:2px solid var(--gk-ink);border-right-width:4px;border-radius:2px;background:var(--gk-well);overflow:hidden;transform:skewX(-12deg)}
.gk-room-k>i{position:absolute;display:block}
.gk-room-f{left:0;top:0;bottom:0;width:calc(var(--k,0) * 100%);background:linear-gradient(var(--gk-metal0) 0 60%,var(--gk-metal1) 60%);border-right:2px solid var(--gk-ink);transition:width .4s ease-out}
.gk-room-b{right:0;bottom:0;height:4px;left:calc(var(--b,0) * 100%);background:var(--c0)}
.gk-room.gk-over .gk-room-f{background:linear-gradient(var(--gk-r0) 0 60%,var(--gk-r1) 60%)}.gk-room.gk-over .gk-room-t{color:var(--gk-r0)}
.gk-room.gk-open .gk-room-f,.gk-room.gk-open .gk-room-b{display:none}
/* ---- stripes ---- */
.gk-stripes{height:16px;background:repeating-linear-gradient(-45deg,var(--gk-sa) 0 11px,var(--gk-sb) 11px 22px);border-block:var(--gk-bw) solid var(--gk-ink)}
.gk-stripes.gk-thin{height:8px;border-top:0}
/* ---- the top band: back, the title, the chips (money, slots) ---- */
.gk-top{display:flex;align-items:center;gap:10px;padding:8px 12px 10px;background:linear-gradient(var(--gk-t0) 0 76%,var(--gk-t1) 76%);border-bottom:var(--gk-bw) solid var(--gk-ink);color:#fff}
.gk-top-t{flex:1;min-width:0;font-size:1.5rem;margin:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.gk-chip{display:inline-flex;align-items:center;gap:6px;padding:2px 12px 2px 3px;border:var(--gk-bw) solid var(--gk-ink);border-radius:6px;background:linear-gradient(var(--gk-well) 0 70%,rgba(0,0,0,.35) 70%);transform:skewX(-10deg);white-space:nowrap}
.gk-chip>*{transform:skewX(10deg)}.gk-chip .gk-ic{width:30px;height:30px}.gk-chip .gk-num{font-size:1.2rem}
@media (max-width:760px){.gk-top{gap:6px;padding:6px 8px 8px}.gk-top-t{font-size:1.15rem}.gk-top .gk-btn{min-height:40px;padding:4px 9px;font-size:.95rem}.gk-chip{padding:1px 8px 1px 2px}.gk-chip .gk-ic{width:22px;height:22px}.gk-chip .gk-num{font-size:.95rem}}
/* ---- transitions ---- */
@keyframes gk-in-r{from{transform:translateX(var(--gk-slide));opacity:0}}
@keyframes gk-in-l{from{transform:translateX(calc(var(--gk-slide) * -1));opacity:0}}
@keyframes gk-in-u{from{transform:translateY(calc(var(--gk-slide) * .6));opacity:0}}
@keyframes gk-in-d{from{transform:translateY(-100%)}}
@keyframes gk-pop{from{transform:scale(.86);opacity:0}}
@keyframes gk-out-r{to{transform:translateX(var(--gk-slide));opacity:0}}
@keyframes gk-out-l{to{transform:translateX(calc(var(--gk-slide) * -1));opacity:0}}
.gk-in-r{animation:gk-in-r var(--gk-t) cubic-bezier(.2,.9,.3,1.12) both}.gk-in-l{animation:gk-in-l var(--gk-t) cubic-bezier(.2,.9,.3,1.12) both}
.gk-in-u{animation:gk-in-u var(--gk-t) cubic-bezier(.2,.9,.3,1.1) both}.gk-in-d{animation:gk-in-d var(--gk-t) ease-out both}.gk-pop{animation:gk-pop var(--gk-t) cubic-bezier(.2,.9,.3,1.3) both}
.gk-out-r{animation:gk-out-r calc(var(--gk-t) * .8) ease-in both}.gk-out-l{animation:gk-out-l calc(var(--gk-t) * .8) ease-in both}
@media (prefers-reduced-motion:reduce){.gk-in-r,.gk-in-l,.gk-in-u,.gk-in-d,.gk-pop,.gk-out-r,.gk-out-l{animation:none}.gk-fill,.gk-room-f{transition:none}}
:root[data-calm] :is(.gk-in-r,.gk-in-l,.gk-in-u,.gk-in-d,.gk-pop,.gk-out-r,.gk-out-l){animation:none}
` + tierCls + roleCls;   // the roles last: they set a part's colours over its default
/** the kit's style put on the page once (later calls do nothing) */
export function installKit(doc: Document = document): void { if (doc.getElementById('gk-style')) return; const s = doc.createElement('style'); s.id = 'gk-style'; s.textContent = KIT_CSS; doc.head.prepend(s); }
/** the palette chosen (data-kit on the root) */
export function setPalette(id: string, doc: Document = document): void { doc.documentElement.dataset.kit = id; }
