// World sound: the hall engine plays the world's music under the board, and every effect comes from the same band, in the current chord.
// Mix tiers (research: player feedback sits above music): big moments ~6 dB over the music and duck it; feedback ~3 dB over; frequent UI under it.
import { loadBuffers, createHall } from "./engine.js";
import { arrange, PALETTE } from "./arrange.js";
import { expand } from "./expand.js";

const WORLD = { "egypt-2011": "egypt", "kepler-1ae": "mars", "usa-2022": "egypt" };
const TIER = { big: .7, feedback: .35, ui: .09 };
const MUSIC = .5; // -6 dB: the music bus sits near -22 LUFS so effects have room above it
const E = window.EGYPT, clamp = (x) => Math.max(0, Math.min(1, x));
// the board's Settings sliders (same origin), so every page plays at the level the player chose
const saved = (k) => { try { const v = localStorage.getItem(`vol-${k}`); return v == null ? 1 : +v; } catch { return 1; } };
let musicVol = saved("music") ** 2, sfxVol = saved("sfx") ** 2, ac, out, musicGain, dip, tiers, hall, score, brief, worldId, muted = false, start = null, fadeIn = false, sfxDb = 0, lastBeat = 0, lastBeatAt = 0, beat = 0, poll;

export function init(s, given, world) { // given: a world's own music brief (v28 build screen), played without the hand calibration; world: its start state, read as month 1
  if (ac) return;
  start = world ?? null;
  ac = new AudioContext({ latencyHint: "playback", sampleRate: 48000 });
  Tone.setContext(ac);
  const lim = ac.createDynamicsCompressor(); lim.threshold.value = -2; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = .002; lim.release.value = .1;
  out = ac.createGain(); out.connect(lim).connect(ac.destination);
  dip = ac.createBiquadFilter(); dip.type = "peaking"; dip.frequency.value = 2200; dip.Q.value = .7; dip.gain.value = 0;
  musicGain = ac.createGain(); musicGain.gain.value = 0;
  dip.connect(musicGain).connect(out);
  tiers = Object.fromEntries(Object.entries(TIER).map(([k, v]) => { const g = ac.createGain(); g.gain.value = v * sfxVol; g.connect(out); return [k, g]; }));
  Tone.getTransport().scheduleRepeat((time) => {
    if (!hall) return;
    if (fadeIn && !muted) musicGain.gain.setTargetAtTime(level(), time, 1.3); // from silence over about 4 s, from the first downbeat
    fadeIn = false;
    if (score.intro && beat <= 2 * ENTRY && beat % ENTRY === 0) hall.setLevers({ ...levers(), ...lift }, { now: true, when: time }); // a family enters on its downbeat
    hall.scheduleBeat(beat, time); lastBeat = beat++; lastBeatAt = time; }, "4n");
  window.__sound = { ac, out, sfx, ready: () => !!hall }; // for checks
  setSkin(s, given);
}

export async function setSkin(s, given) {
  const w = given ? s?.id ?? "world" : WORLD[s?.id] ?? "egypt";
  if (!ac || w === worldId) return;
  worldId = w;
  brief = given ?? await (await fetch(`hall/${w}.brief.json`)).json();
  const sc = arrange(brief), cal = given ? null : await fetch(`hall/${w}.cal.json`); if (cal?.ok) sc.cal = await cal.json();
  if (given) { sc.intro = true; for (const ly of sc.layers) { const g = ly.gain, f = family(ly); ly.gain = (L) => ((L.intro ?? 4) > f ? g(L) : 0); } }
  const used = new Set([...Object.values(expand(sc)).flat().map((e) => e.sound), ...(sc.fills ?? []).map((f) => f.sound)]);
  const assets = await loadBuffers(ac, "hall/", null, used);
  if (worldId !== w) return;
  musicGain.gain.setTargetAtTime(0, ac.currentTime, .3);
  await new Promise((r) => setTimeout(r, hall ? 900 : 0));
  score = sc; hall = createHall(ac, score, assets, { dest: dip }); beat = given ? -ENTRY : 0; // a given brief starts with its bed, a phrase before bar 1
  hall.setLevers(levers(), { now: true });
  const tr = Tone.getTransport(); tr.bpm.value = score.bpm;
  if (tr.state !== "started") tr.start("+0.1");
  if (given) fadeIn = true; else if (!muted) musicGain.gain.setTargetAtTime(level(), ac.currentTime + .2, 1.2);
  clearInterval(poll); poll = setInterval(() => hall.setLevers({ ...levers(), ...lift }), 500);
}

// the walkthrough's pledge: the whole hall grows in (growth lever) and the music bus rises over about 3 s; off returns both
let lift = null;
const level = () => MUSIC * musicVol * (lift ? 1.35 : 1);
export function swell(on) {
  lift = on ? { growth: 1 } : null;
  if (!ac) return;
  hall?.setLevers({ ...levers(), ...lift });
  if (!muted) musicGain.gain.setTargetAtTime(level(), ac.currentTime, on ? 1 : .5);
}

// Settings sliders: 0..1, squared so the slider feels even to the ear
export function setVolume(kind, v) {
  if (kind === "music") { musicVol = v * v; if (musicGain && !muted) musicGain.gain.setTargetAtTime(level(), ac.currentTime, .1); }
  else { sfxVol = v * v; applySfx(); }
}
function applySfx() { if (tiers) for (const [k, g] of Object.entries(tiers)) g.gain.setTargetAtTime(TIER[k] * 10 ** (sfxDb / 20) * sfxVol, ac.currentTime, .05); }
export function toggleMute() {
  muted = !muted;
  if (out) out.gain.setTargetAtTime(muted ? 0 : 1, ac.currentTime, .05);
  return muted;
}
// , and . move the effects against the music in 3 dB steps (for judging the tiers)
addEventListener("keydown", (e) => {
  if (!tiers || (e.key !== "," && e.key !== ".")) return;
  sfxDb = Math.max(-12, Math.min(12, sfxDb + (e.key === "." ? 3 : -3)));
  applySfx();
  console.log(`effects ${sfxDb >= 0 ? "+" : ""}${sfxDb} dB`);
});

// The intro of a given brief: the bed alone for two bars, then from bar 1 the theme, then harmony, then rhythm, two bars apart.
const ENTRY = 8; // beats: two bars
const family = (ly) => (ly.hit ? 3 : ly.deg != null ? 1 : (ly.atk ?? 0) >= .5 ? 0 : 2); // 0 bed and drones, 1 tunes, 2 harmony and pulses, 3 drums
const stage = () => (beat < 0 ? 1 : Math.min(4, 2 + Math.floor(beat / ENTRY)));

// The board drives the music: held cards -> ideology levers; the month, the record and support -> growth; low support -> tension and crisis.
function levers() {
  const st = window.__game, ids = score?.levers ?? [];
  const lv = { tension: 0, crisis: 0, grip: .5, growth: .4, ...Object.fromEntries(ids.map((k) => [k, .2])) };
  if (!st) return { ...(start ? { ...lv, ...Object.fromEntries(ids.map((k) => [k, 0])), ...mood(start.factions.map((f) => f.support), start.grip, 1, start.months, 0) } : lv), intro: stage() }; // nothing filed yet
  const total = Object.values(st.held).reduce((a, b) => a + b, 0);
  Object.assign(lv, mood(E.factions.map((f) => st.sup[f.id]), st.grip, st.month, E.world.months, total));
  ids.forEach((k, i) => (lv[k] = clamp((st.held[k] ?? st.held[E.ideologies[i]?.id] ?? 0) / 5)));
  return lv;
}
function mood(home, grip, month, months, total) {
  const low = Math.min(...home), avg = home.reduce((a, b) => a + b, 0) / home.length;
  return { grip: grip == null ? .5 : grip / 100, tension: clamp((45 - avg) / 15), crisis: clamp((18 - low) / 8),
    growth: clamp(.5 * (month - 1) / Math.max(1, months - 1) + .3 * Math.min(1, total / 12) + .2 * avg / 100) };
}

// ---------- effects ----------
const ready = () => ac && hall && score;
const sound = (s) => PALETTE[s]?.sample ?? s, spec = (s) => ({ atk: PALETTE[s]?.atk, rel: PALETTE[s]?.rel ?? .5, lpf: PALETTE[s]?.lpf });
const sixteenth = () => hall.beatDur / 4;
const grid = (k = 0) => { const s = sixteenth(), now = ac.currentTime + .02; return lastBeatAt + Math.ceil((now - lastBeatAt) / s) * s + k * s; };
const rootAt = (t) => score.harmony.roots[(Math.floor((lastBeat + (t - lastBeatAt) / hall.beatDur) / 4) % score.bars + score.bars) % score.bars];
const note = (deg, oct) => score.harmony.mid(deg, oct);
function play(tier, s, midi, vel, t, dur, extra = {}) { if (ready()) hall.voice(tiers[tier], { ...spec(s), ...extra }, sound(s), midi, vel, Math.max(t, ac.currentTime), dur); }
function duck() { const g = musicGain.gain, t = ac.currentTime; if (muted) return; g.cancelScheduledValues(t); g.setTargetAtTime(level() * .7, t, .03); g.setTargetAtTime(level(), t + .8, .35); }
function carve() { const g = dip.gain, t = ac.currentTime; g.cancelScheduledValues(t); g.setTargetAtTime(-5, t, .02); g.setTargetAtTime(0, t + .3, .15); }
function hiss({ at = 0, dur = .4, f0 = 600, f1 = 3000, q = 1.2, gain = .5 } = {}) {
  if (!ac) return;
  const t = ac.currentTime + at, len = Math.ceil(ac.sampleRate * dur), buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const src = ac.createBufferSource(), bp = ac.createBiquadFilter(), g = ac.createGain(); src.buffer = buf; bp.type = "bandpass"; bp.Q.value = q;
  bp.frequency.setValueAtTime(f0, t); bp.frequency.exponentialRampToValueAtTime(f1, t + dur);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + dur * .3); g.gain.linearRampToValueAtTime(0, t + dur);
  src.connect(bp).connect(g).connect(tiers.ui); src.start(t);
}
const lead = () => brief.ensemble.lead, leadOct = () => lead().oct ?? 0;
const drum = () => brief.rhythm.crisis.hit.split(/[\s\[\]<>*!@\d]+/).find((x) => x && x !== "x" && x !== "~") ?? brief.rhythm.village.sound;
const voiceOf = (id) => { const i = brief.ideologies[id] ?? Object.values(brief.ideologies)[E.ideologies.findIndex((x) => x.id === id)] ?? {}; const t = i.tune?.[0]; return t ? [t.sound, t.oct ?? 1] : [i.colour?.[0]?.sound ?? lead().sound, leadOct() + 1]; };
let motifCache;
const motif = () => motifCache?.[0] === score ? motifCache[1] : (motifCache = [score, expand({ ...score, layers: [{ id: "m", deg: score.brief.theme, sound: "x" }] }).m.filter((e) => e.t < 1).slice(0, 3).map((e) => e.deg)])[1];
const fifth = (r) => score.harmony.fifthOf(r) ?? r + score.brief.scale.length;

export const sfx = {
  hover: () => { if (ready()) play("ui", brief.rhythm.fills.sound ?? drum(), null, .35, ac.currentTime, .12); },
  care: (i) => { if (!ready()) return; const r = rootAt(ac.currentTime); play("ui", lead().sound, note(r + [0, 2, 4, 7][i % 4], leadOct() + 1), .35, ac.currentTime + i * .05, .25); },
  draw: () => { hiss({ dur: .5, f0: 300, f1: 2400, gain: .45 }); if (!ready()) return; const t = grid(2); play("feedback", lead().sound, note(rootAt(t), leadOct()), .8, t, hall.beatDur * 2); },
  flip: () => hiss({ dur: .32, f0: 2600, f1: 500, q: 2, gain: .55 }),
  // the answer is stamped: that ideology's own instrument sings the first three notes of the theme
  stamp: (id) => {
    if (!ready()) return; const [s, o] = voiceOf(id), t = grid(1), m = motif();
    m.forEach((d, k) => play("big", s, note(d, o), 1, t + k * 2 * sixteenth(), (k === m.length - 1 ? 6 : 2) * sixteenth()));
    play("big", drum(), null, .8, t, .5); duck();
  },
  // support moves: the lead steps up the scale (gain) or down it (loss); bigger changes take more steps
  faction: (delta, i = 0) => {
    if (!ready()) return; const n = Math.min(4, 1 + Math.floor(Math.abs(delta) / 4)), t = grid(i * 2), r = rootAt(t), up = delta > 0;
    for (let k = 0; k < n; k++) play("feedback", lead().sound, note(up ? r + k : fifth(r) - k, leadOct() + 1), up ? .95 : .9, t + k * sixteenth(), sixteenth() * (k === n - 1 ? 3 : 1), up ? {} : { lpf: 1400 });
    carve();
  },
  file: () => { hiss({ dur: .45, f0: 3000, f1: 400, gain: .5 }); if (ready()) play("feedback", drum(), null, .6, ac.currentTime + .42, .4); },
  unlock: (id) => {
    if (!ready()) return; const [s, o] = voiceOf(id), t = grid(1), m = motif(), r = rootAt(t);
    m.forEach((d, k) => play("big", s, note(d, o + 1), 1 - k * .1, t + k * 2 * sixteenth(), (k === m.length - 1 ? 8 : 2) * sixteenth()));
    for (const d of [r, fifth(r), r + score.brief.scale.length]) play("big", brief.ensemble.section, note(d, 1), .7, t, hall.beatDur * 4, { atk: .3, rel: 1.2 });
    if (brief.ensemble.cymbal) play("big", brief.ensemble.cymbal, null, .7, t, hall.beatDur * 3);
    duck();
  },
  passive: (id) => { if (!ready()) return; const [s, o] = voiceOf(id), t = grid(1), r = rootAt(t); play("feedback", s, note(r, o), .8, t, hall.beatDur * 2); play("feedback", s, note(fifth(r), o), .7, t + sixteenth(), hall.beatDur * 2); },
  play: () => {
    hiss({ dur: .3, f0: 800, f1: 3200, gain: .35 }); if (!ready()) return; const t = grid(0), r = rootAt(t), b = brief.ensemble.brass?.[0], stab = PALETTE[b]?.short ?? b ?? lead().sound;
    for (const d of [r, fifth(r)]) play("feedback", stab, note(d, 0), .9, t, sixteenth() * 2);
    carve();
  },
  // impacts land on the animation, not the grid
  hit: (k = 1) => { if (ready()) play("feedback", drum(), null, Math.min(1, .75 * k + .1), ac.currentTime, .5); },
  heartbeat: () => { if (!ready()) return; const h = brief.moods?.tension?.heartbeat ?? "timpani", t = ac.currentTime; [[0, .9], [.24, .7], [1, .8], [1.24, .6]].forEach(([a, v]) => play("feedback", h, null, v, t + a, .5)); },
  shimmer: () => { if (!ready()) return; const t = ac.currentTime + .1, r = rootAt(t), a = brief.ensemble.arp ?? lead().sound; [r, fifth(r), r + score.brief.scale.length, fifth(r) + score.brief.scale.length].forEach((d, k) => play("feedback", a, note(d, 1), .45, t + k * .07, .5)); },
  // the month closes on a cadence: the fifth chord, then home
  endMonth: () => {
    if (!ready()) return; const t = grid(0), len = score.brief.scale.length, five = fifth(0);
    for (const [d, at, dur] of [[five, 0, 1], [five + len, 0, 1], [0, 1, 3], [len, 1, 3], [fifth(0), 1, 3]]) play("big", d === five || d === five + len ? brief.ensemble.section : brief.ensemble.bed[0], note(d, 0), .5, t + at * hall.beatDur, dur * hall.beatDur, { atk: .05, rel: 1.2 });
    play("big", drum(), null, .8, t + hall.beatDur, .5); duck();
  },
};
