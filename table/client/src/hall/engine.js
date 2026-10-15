// Hall engine: plays a score through real samples, one shared concert hall and a master bus. Levers move layer gains.
import { expand } from "./expand.js";

const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
export function leverState(raw) {
  const c = raw.crisis, t = raw.tension * (1 - c);
  return { ...raw, crisis: c, tension: t, calm: 1 - t - c, open: 1 - raw.grip, grow: (x) => smooth(x - .12, x + .08, raw.growth) };
}

// Every recording is levelled to the same loudest 50 ms, so a gain in the score means the same loudness on any instrument.
function level(b) {
  const x = b.getChannelData(0), w = Math.round(b.sampleRate * .05); let best = 1e-6;
  for (let i = 0; i + w <= Math.min(x.length, b.sampleRate * 2); i += w) { let s = 0; for (let j = i; j < i + w; j++) s += x[j] * x[j]; best = Math.max(best, Math.sqrt(s / w)); }
  return Math.min(8, Math.max(.125, .2 / best));
}

export async function loadBuffers(ctx, base, onProgress, only) {
  const all = await (await fetch(base + "samples-local.json")).json(), map = only ? Object.fromEntries(Object.entries(all).filter(([k]) => only.has(k))) : all;
  const files = [...new Set(Object.values(map).flat().map((z) => z[3])), "hall.wav"];
  const buf = {}, norm = {}; let done = 0;
  const get = async (f, tries = 3) => { try { const r = await fetch(base + f); if (!r.ok) throw new Error(`${r.status} ${f}`); return await r.arrayBuffer(); } catch (e) { if (tries > 1) return get(f, tries - 1); throw e; } };
  const queue = [...files];
  await Promise.all(Array.from({ length: 8 }, async () => {
    for (let f; (f = queue.shift()); ) { buf[f] = await ctx.decodeAudioData(await get(f)); norm[f] = level(buf[f]); onProgress?.(++done / files.length); }
  }));
  return { map, buf, norm };
}

// Master: high-pass, input trim, a small dip at 300 Hz, glue compressor 2:1, limiter, soft clip. Reverb: pre-delay, band-limited, convolved with a real hall.
function buildGraph(ctx, buf, score, master = .13, dest = ctx.destination) {
  const set = (n, o) => { for (const k in o) n[k].value = o[k]; return n; };
  const hp = set(Object.assign(ctx.createBiquadFilter(), { type: "highpass" }), { frequency: 30 });
  const dip = set(Object.assign(ctx.createBiquadFilter(), { type: "peaking" }), { frequency: 300, gain: -1.5, Q: .8 });
  const glue = set(ctx.createDynamicsCompressor(), { threshold: -24, knee: 8, ratio: 2, attack: .03, release: .25 });
  const make = set(ctx.createGain(), { gain: 1.4 });
  const lim = set(ctx.createDynamicsCompressor(), { threshold: -2, knee: 0, ratio: 20, attack: .001, release: .08 });
  const clip = ctx.createWaveShaper(); clip.curve = Float32Array.from({ length: 2049 }, (_, i) => Math.tanh((i / 1024 - 1) * 1.1) / Math.tanh(1.1)); clip.oversample = "4x";
  const out = set(ctx.createGain(), { gain: master }); // input trim: the dynamics see calibrated levels
  hp.connect(out).connect(dip).connect(glue).connect(make).connect(lim).connect(clip).connect(dest);
  const rin = ctx.createGain(), pre = set(ctx.createDelay(.1), { delayTime: .025 });
  const rhp = set(Object.assign(ctx.createBiquadFilter(), { type: "highpass" }), { frequency: 200 });
  const rlp = set(Object.assign(ctx.createBiquadFilter(), { type: "lowpass" }), { frequency: 9000 });
  const conv = ctx.createConvolver(); conv.buffer = buf["hall.wav"];
  const ret = set(ctx.createGain(), { gain: .9 });
  rin.connect(pre).connect(rhp).connect(rlp).connect(conv).connect(ret).connect(hp);
  const bus = {};
  for (const ly of score.layers) {
    const g = set(ctx.createGain(), { gain: 0 }), p = set(ctx.createStereoPanner(), { pan: ly.pan ?? 0 }), s = set(ctx.createGain(), { gain: ly.send ?? .4 });
    g.connect(p); p.connect(hp); p.connect(s).connect(rin);
    bus[ly.id] = { g, target: 0 };
  }
  return { bus, out, hp, rin };
}

const group = (id) => id.split("_")[0];

// Range check with auto-fix: a part written outside its instrument's recorded range moves by octaves until it fits.
export function validate(score, map) {
  const evs = expand(score), report = [];
  for (const ly of score.layers) {
    const missing = [...new Set(evs[ly.id].map((e) => e.sound))].filter((x) => !map[x] && !x?.startsWith("syn_"));
    if (missing.length) { report.push(`error: ${ly.id} uses ${missing.join(", ")}, not in the sample set`); continue; }
    const zs = map[ly.sound], ms = evs[ly.id].map((e) => e.midi).filter((m) => m != null);
    if (!ms.length || (!ly.range && (!zs || zs[0][0] === 0))) continue;
    const [lo, hi] = ly.range ?? [Math.min(...zs.map((z) => z[0])) - 2, Math.max(...zs.map((z) => z[0])) + 3];
    let shift = 0, a = Math.min(...ms), b = Math.max(...ms);
    while (a + shift < lo && b + shift + 12 <= hi + 12) shift += 12;
    while (b + shift > hi && a + shift - 12 >= lo - 12) shift -= 12;
    if (shift) { if (ly.deg != null) ly.oct = (ly.oct ?? 0) + shift / 12; else ly.add = (ly.add ?? 0) + shift; report.push(`fixed: ${ly.id} (${ly.sound}) moved ${shift > 0 ? "up" : "down"} ${Math.abs(shift / 12)} octave`); }
  }
  return report;
}

export function createHall(ctx, score, { map, buf, norm }, opts = {}) {
  const evs = expand(score), bar = 240 / score.bpm, beatsPerBar = 4, cal = { ...(score.cal ?? {}), ...(opts.cal ?? {}) };
  const { bus, out, hp, rin } = buildGraph(ctx, buf, score, opts.master, opts.dest);
  const fillBus = ctx.createGain(), fillSend = ctx.createGain(); fillBus.gain.value = .55; fillSend.gain.value = .5; fillBus.connect(hp); fillBus.connect(fillSend).connect(rin);
  const byBeat = {}; // id -> beat index -> events
  for (const ly of score.layers) {
    const b = (byBeat[ly.id] = {});
    for (const e of evs[ly.id]) (b[Math.floor(e.t * beatsPerBar + 1e-6)] ??= []).push(e);
  }
  const rr = {}, drift = {};
  let rand = opts.seed ?? 1; const rnd = () => ((rand = (rand * 16807) % 2147483647) / 2147483647);
  function zone(sound, midi, vel) {
    const zs = map[sound]; if (!zs) return null;
    if (midi == null && zs[0][0] > 0) midi = zs[Math.floor(zs.length * .35)][0]; // a pitched drum used as a hit: play it from its lower middle
    let zm = zs[0][0];
    if (midi != null) for (const z of zs) if (Math.abs(z[0] - midi) < Math.abs(zm - midi)) zm = z[0];
    const at = zs.filter((z) => z[0] === zm), layers = [...new Set(at.map((z) => z[1]))].sort((a, b) => a - b);
    const layer = layers[Math.min(layers.length - 1, Math.floor(vel * layers.length * .999))];
    const takes = at.filter((z) => z[1] === layer), k = `${sound}|${zm}|${layer}`;
    rr[k] = ((rr[k] ?? -1) + 1) % takes.length;
    return takes[rr[k]];
  }
  let noise = null;
  const noiseBuf = () => noise ??= (() => { const n = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), d = n.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = rnd() * 2 - 1; return n; })();
  // Synth voices for modern and future worlds: oscillators and noise only, so they cost no downloads.
  function synth(dest, ly, sound, midi, vel, time, dur) {
    time = Math.max(time, ctx.currentTime);
    const hz = 440 * 2 ** (((midi ?? 60) - 69) / 12), end = time + Math.max(.01, dur), out = ctx.createGain(), nodes = [];
    const osc = (type, f, det = 0) => { const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; o.detune.value = det; nodes.push(o); return o; };
    const env = (g, atk, peak, rel, stopAt = end) => { g.gain.setValueAtTime(0, time); g.gain.linearRampToValueAtTime(peak, time + atk); g.gain.setValueAtTime(peak, Math.max(time + atk, stopAt)); g.gain.setTargetAtTime(0, Math.max(time + atk, stopAt), rel / 3); return Math.max(time + atk, stopAt) + rel * 2.5; };
    const lp = (f, q = .7) => { const x = ctx.createBiquadFilter(); x.type = "lowpass"; x.frequency.value = f; x.Q.value = q; return x; };
    const v = vel, atk = ly.atk, rel = ly.rel;
    let stop = end + 1;
    if (sound === "syn_pad" || sound === "syn_glass") {
      const glass = sound === "syn_glass", f = lp(glass ? 5000 : 700 + 1600 * v, .6), g = ctx.createGain();
      f.frequency.setTargetAtTime(glass ? 7000 : 1400 + 2600 * v, time, (atk ?? .8) * .8);
      for (const d of [-8, 0, 8]) osc(glass ? "triangle" : "sawtooth", hz, d).connect(f);
      const sub = osc("sine", glass ? hz * 2 : hz / 2), sg = ctx.createGain(); sg.gain.value = .5; sub.connect(sg).connect(f);
      f.connect(g).connect(out); stop = env(g, atk ?? .8, .16 * v, rel ?? 1.5);
    } else if (sound === "syn_pluck" || sound === "syn_bass") {
      const bass = sound === "syn_bass", f = lp(bass ? 300 + 900 * v : 900 + 4500 * v, bass ? 1.2 : 2), g = ctx.createGain();
      f.frequency.setTargetAtTime(bass ? 220 : 500, time + .005, bass ? .12 : .09);
      osc("sawtooth", hz).connect(f); osc(bass ? "sine" : "square", bass ? hz / 2 : hz, bass ? 0 : 7).connect(f);
      f.connect(g).connect(out); stop = env(g, atk ?? .004, (bass ? .32 : .2) * v, rel ?? (bass ? .15 : .35), bass ? end : time + Math.min(dur, .25));
    } else if (sound === "syn_lead") {
      const f = lp(2600 + 1400 * v, 1), g = ctx.createGain(), lfo = osc("sine", 5.4), ld = ctx.createGain();
      ld.gain.setValueAtTime(0, time); ld.gain.linearRampToValueAtTime(9, time + .35); lfo.connect(ld);
      for (const d of [-5, 5]) { const o = osc("sawtooth", hz, d); ld.connect(o.detune); o.connect(f); }
      f.connect(g).connect(out); stop = env(g, atk ?? .03, .17 * v, rel ?? .3);
    } else if (sound === "syn_bell") {
      const c = osc("sine", hz), m = osc("sine", hz * 3.5), mg = ctx.createGain(), g = ctx.createGain();
      mg.gain.setValueAtTime(hz * 2.5 * v, time); mg.gain.setTargetAtTime(0, time, .5); m.connect(mg).connect(c.frequency);
      c.connect(g).connect(out); g.gain.setValueAtTime(0, time); g.gain.linearRampToValueAtTime(.3 * v, time + .003); g.gain.setTargetAtTime(0, time + .003, .7); stop = time + 4;
    } else if (sound === "syn_sub") {
      const g = ctx.createGain(); osc("sine", hz).connect(g).connect(out); stop = env(g, atk ?? .01, .35 * v, rel ?? .2);
    } else if (sound === "syn_kick") {
      const o = osc("sine", 150), g = ctx.createGain(); o.frequency.setValueAtTime(150, time); o.frequency.exponentialRampToValueAtTime(42, time + .12);
      o.connect(g).connect(out); g.gain.setValueAtTime(.9 * v, time); g.gain.setTargetAtTime(0, time + .02, .12); stop = time + .8;
    } else {
      // noise voices: snare, hat, clap, riser
      const src = ctx.createBufferSource(); src.buffer = noiseBuf(); src.loop = true; nodes.push(src);
      const f = ctx.createBiquadFilter(), g = ctx.createGain(); src.connect(f).connect(g).connect(out);
      if (sound === "syn_hat") { f.type = "highpass"; f.frequency.value = 7500; g.gain.setValueAtTime(.35 * v, time); g.gain.setTargetAtTime(0, time, .025); stop = time + .3; }
      else if (sound === "syn_snare") { f.type = "bandpass"; f.frequency.value = 1900; f.Q.value = .8; g.gain.setValueAtTime(.7 * v, time); g.gain.setTargetAtTime(0, time, .07);
        const t = osc("triangle", 185), tg = ctx.createGain(); t.connect(tg).connect(out); tg.gain.setValueAtTime(.4 * v, time); tg.gain.setTargetAtTime(0, time, .05); stop = time + .5; }
      else if (sound === "syn_clap") { f.type = "bandpass"; f.frequency.value = 1300; f.Q.value = 1.5; for (const k of [0, .012, .024]) { g.gain.setValueAtTime(.8 * v, time + k); g.gain.setTargetAtTime(0, time + k + .001, k < .02 ? .004 : .09); } stop = time + .6; }
      else { f.type = "bandpass"; f.Q.value = 2; f.frequency.setValueAtTime(300, time); f.frequency.exponentialRampToValueAtTime(6000, end); g.gain.setValueAtTime(0, time); g.gain.linearRampToValueAtTime(.5 * v, end); g.gain.setTargetAtTime(0, end, .05); stop = end + .4; }
    }
    out.connect(dest);
    for (const n of nodes) { n.start(time); n.stop(stop); }
  }
  function voice(dest, ly, sound, midi, vel, time, dur) {
    if (sound?.startsWith("syn_")) return synth(dest, ly, sound, midi, vel, time, dur);
    const z = zone(sound, midi, vel); if (!z) return;
    time = Math.max(time, ctx.currentTime);
    const src = ctx.createBufferSource(); src.buffer = buf[z[3]];
    src.playbackRate.value = midi == null ? 1 + (rnd() - .5) * .02 : 2 ** ((midi - z[0]) / 12);
    const f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = (ly.lpf ?? 16000) * (.4 + .6 * vel); f.Q.value = .5;
    const g = ctx.createGain(), atk = ly.atk ?? .005, rel = ly.rel ?? .3, peak = vel ** 1.3 * (norm[z[3]] ?? 1);
    g.gain.setValueAtTime(0, time); g.gain.linearRampToValueAtTime(peak, time + atk);
    g.gain.setValueAtTime(peak, time + Math.max(atk, dur)); g.gain.setTargetAtTime(0, time + Math.max(atk, dur), rel / 3);
    src.connect(f).connect(g).connect(dest);
    src.start(time); src.stop(time + Math.max(atk, dur) + rel * 2.5);
  }
  const solo = opts.solo ? new Set([opts.solo].flat()) : null;
  const gainOf = (ly, L) => (solo && !solo.has(ly.id) && !solo.has(group(ly.id)) ? 0 : Math.max(0, Math.min(2, ly.gain(L) * (cal[group(ly.id)] ?? 1))));
  const danger = (r) => Math.max(r.crisis, r.tension);
  let L = null, applied = null, pending = null, fillAt = -1;
  // Lever changes wait for the next bar line, then fade: in over about a bar, out over about two.
  function applyLevers(raw, when, instant) {
    L = leverState(raw); applied = raw; pending = null; fillAt = -1;
    for (const ly of score.layers) {
      const b = bus[ly.id], v = gainOf(ly, L), tau = instant ? .01 : v > b.target ? bar * .3 : bar * .7;
      b.g.gain.cancelScheduledValues(when); b.g.gain.setTargetAtTime(v, when, tau);
      b.hold = Math.max(b.target, v); b.holdUntil = when + tau * 4; b.target = v;
    }
  }
  function setLevers(raw, { now = false, when = ctx.currentTime } = {}) {
    if (now || !applied) return applyLevers(raw, when, true);
    if (Object.keys(raw).every((k) => raw[k] === applied[k])) { pending = null; return; }
    pending = { ...raw };
  }
  const fill = (time) => { for (const f of score.fills ?? []) voice(fillBus, { atk: 2 * bar / beatsPerBar * .9, rel: .6 }, f.sound, null, f.vel ?? .9, time, 2 * bar / beatsPerBar); };
  // schedule one beat (quarter note) of every audible layer, starting at audio time `time`
  function scheduleBeat(beat, time) {
    const inBar = ((beat % beatsPerBar) + beatsPerBar) % beatsPerBar;
    if (pending) {
      const rising = danger(pending) - danger(applied) >= .25 && (score.fills ?? []).length;
      if (rising && fillAt < 0 && inBar === 2) { fill(time); fillAt = beat; }
      if (inBar === 0 && (!rising || fillAt >= 0)) applyLevers(pending, time, false);
    }
    const k = ((beat % (score.bars * beatsPerBar)) + score.bars * beatsPerBar) % (score.bars * beatsPerBar), loopT = Math.floor(beat / (score.bars * beatsPerBar)) * score.bars;
    for (const ly of score.layers) {
      const b = bus[ly.id];
      if (b.target < .003 && !(time < b.holdUntil && b.hold >= .003)) continue;
      const list = byBeat[ly.id][k]; if (!list) continue;
      const lenF = typeof ly.len === "function" ? ly.len(L) : ly.len ?? (ly.hit ? 4 : 1);
      const orn = ly.orn ? ly.orn(L) : 0, hz = (ly.humanize ?? 8) / 1000;
      for (const e of list) {
        drift[ly.id] = Math.max(-hz, Math.min(hz, (drift[ly.id] ?? 0) * .85 + (rnd() - .5) * hz));
        const t = time + (e.t * beatsPerBar - k) * (bar / beatsPerBar) + drift[ly.id];
        let v = e.vel; if (ly.shape) v *= .78 + .22 * Math.sin(Math.PI * (((e.t + loopT) % 4) / 4));
        const dur = e.d * bar * lenF;
        if (orn && e.up != null && e.d * bar > .3 && rnd() < orn) voice(b.g, ly, e.sound, e.up, v * .7, t - .07, .06);
        voice(b.g, ly, e.sound, e.midi, v, t, dur);
      }
    }
  }
  return { setLevers, scheduleBeat, voice, out, rin, beatDur: bar / beatsPerBar, beats: score.bars * beatsPerBar, get L() { return L; } };
}

// Offline render: timeline(tSeconds) -> raw lever values, read once per beat. Returns an AudioBuffer.
export async function renderOffline(score, assets, seconds, timeline, opts = {}) {
  const ctx = new OfflineAudioContext(2, Math.ceil(48000 * seconds), 48000);
  const h = createHall(ctx, score, assets, opts);
  for (let b = 0, t = 0; t < seconds; b++, t = b * h.beatDur) { h.setLevers(timeline(t), { now: b === 0 || !!opts.instant, when: t + .05 }); h.scheduleBeat(b, t + .05); }
  return ctx.startRendering();
}

const rmsDb = (buf, from) => { let s = 0, n = 0; for (let c = 0; c < 2; c++) { const x = buf.getChannelData(c); for (let i = Math.floor(from * buf.sampleRate); i < x.length; i++) { s += x[i] * x[i]; n++; } } return 10 * Math.log10(s / n + 1e-12); };
export async function measure(score, assets, raw, opts = {}) {
  return rmsDb(await renderOffline(score, assets, opts.seconds ?? 10, () => raw, { ...opts, instant: true }), 2);
}

// Calibration targets, measured once on the hand-tuned Egypt score the owner approved. kind ratio: the group's own level against the whole mix; delta: the mix against calm.
export const TARGET_SETS = (ids) => ({
  ...Object.fromEntries(ids.map((id) => [id, { set: { [id]: 1 }, kind: "ratio" }])),
  open: { set: { grip: 0 }, kind: "ratio" }, iron: { set: { grip: 1 }, kind: "ratio" },
  t: { set: { tension: 1 }, kind: "delta" }, c: { set: { crisis: 1 }, kind: "delta" },
});
export async function readTargets(score, assets, base, ids, log = () => {}) {
  const calm = await measure(score, assets, base), out = {};
  for (const [g, t] of Object.entries(TARGET_SETS(ids))) {
    const mix = await measure(score, assets, { ...base, ...t.set });
    out[g] = +(t.kind === "ratio" ? (await measure(score, assets, { ...base, ...t.set }, { solo: g })) - mix : mix - calm).toFixed(2); log(g, out[g]);
  }
  return out;
}
export async function calibrate(score, assets, base, ids, targets, log = () => {}) {
  const cal = {}, calm = await measure(score, assets, base);
  for (const [g, t] of Object.entries(TARGET_SETS(ids))) {
    for (let i = 0; i < 3; i++) {
      const mix = await measure(score, assets, { ...base, ...t.set }, { cal });
      const got = t.kind === "ratio" ? (await measure(score, assets, { ...base, ...t.set }, { cal, solo: g })) - mix : mix - calm;
      const err = targets[g] - got; log(g, i, got.toFixed(2), "target", targets[g]);
      if (Math.abs(err) < .4) break;
      cal[g] = Math.max(.25, Math.min(4, (cal[g] ?? 1) * 10 ** ((err / 20) * (t.kind === "ratio" ? 1.3 : 1.6))));
    }
  }
  return cal;
}
