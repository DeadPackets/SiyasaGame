// Arranger: a short world brief (what Opus writes) -> a full adaptive score for the hall engine.
// Every rule we learned by ear lives here, so one model call only has to write the tune, the scale, the chords and the instruments.
import { events } from "./mini.js";

// How each sound is played by default: playable range (MIDI), envelope, plucked (long notes are re-struck), and its short/tremolo/pizzicato variants.
const P = (range, o = {}) => ({ range, ...o });
export const PALETTE = {
  // orchestra (VSCO 2 CE)
  violins: P([55, 93], { atk: .09, rel: .5, short: "violins_spic", trem: "violins_trem", pizz: "violins_pizz" }), violas: P([48, 84], { atk: .09, rel: .5, short: "violas_spic" }),
  celli: P([36, 76], { atk: .12, rel: .6, short: "celli_spic", pizz: "celli_pizz", trem: "celli_trem" }), bass: P([28, 60], { atk: .5, rel: 1.2, short: "bass_pizz", pizz: "bass_pizz" }),
  violin_solo: P([55, 96], { atk: .06, rel: .4 }), flute: P([60, 96], { atk: .06, rel: .4 }), oboe: P([58, 89], { atk: .05, rel: .3 }),
  horn: P([34, 77], { atk: .07, rel: .4, short: "horn_stac" }), trumpet: P([52, 82], { atk: .05, rel: .4, short: "trumpet_stac" }), trombone: P([34, 72], { atk: .5, rel: 1 }),
  harp: P([24, 103], { rel: 1.5, pluck: true }),
  // stand-ins: a real recording played another way
  ney: P([60, 88], { sample: "flute", atk: .14, rel: .6, lpf: 2600 }),
  // world (oud from Freesound, the rest FluidR3 GM)
  oud: P([38, 62], { atk: .015, rel: .4, lpf: 1700, pluck: true }), koto: P([48, 84], { rel: .8, pluck: true }), shamisen: P([48, 79], { rel: .4, pluck: true }),
  shakuhachi: P([60, 88], { atk: .1, rel: .5 }), sitar: P([48, 79], { rel: .8, pluck: true }), banjo: P([48, 79], { rel: .4, pluck: true }), dulcimer: P([48, 84], { rel: .8, pluck: true }),
  bagpipe: P([55, 77], { atk: .05, rel: .3 }), pan_flute: P([60, 91], { atk: .06, rel: .4 }), shanai: P([60, 84], { atk: .04, rel: .3 }), fiddle: P([55, 91], { atk: .04, rel: .3 }),
  steel_drums: P([55, 84], { rel: .6, pluck: true }), accordion: P([53, 89], { atk: .04, rel: .3 }), harmonica: P([60, 84], { atk: .04, rel: .3 }), ocarina: P([60, 84], { atk: .05, rel: .3 }),
  recorder: P([60, 88], { atk: .05, rel: .3 }), taiko_drum: P([36, 55], { rel: .8 }), clarinet: P([50, 89], { atk: .05, rel: .3 }), bassoon: P([34, 72], { atk: .05, rel: .3 }),
  english_horn: P([52, 81], { atk: .05, rel: .3 }), tuba: P([28, 58], { atk: .05, rel: .4 }),
  // keys, guitars, voices
  piano: P([21, 108], { rel: .9 }), harpsichord: P([41, 89], { rel: .4, pluck: true }), church_organ: P([36, 96], { atk: .05, rel: .5 }), choir_aahs: P([48, 79], { atk: .35, rel: .9 }),
  acoustic_guitar_nylon: P([40, 79], { rel: .6, pluck: true }), acoustic_guitar_steel: P([40, 79], { rel: .6, pluck: true }), electric_guitar_clean: P([40, 79], { rel: .5, pluck: true }),
  distortion_guitar: P([40, 76], { atk: .01, rel: .3 }), electric_bass_finger: P([28, 55], { rel: .25 }), synth_strings_1: P([36, 96], { atk: .3, rel: .8, short: "syn_pluck" }),
  marimba: P([45, 96], { rel: .6, pluck: true }), vibraphone: P([53, 89], { rel: 1.2 }), kalimba: P([55, 84], { rel: .8, pluck: true }), tubular_bells: P([60, 77], { rel: 2 }), glockenspiel: P([79, 108], { rel: 1 }),
  // synths (no downloads): for modern and future worlds
  syn_pad: P([36, 84], { atk: .8, rel: 1.5, short: "syn_pluck", trem: "syn_glass" }), syn_glass: P([48, 96], { atk: .4, rel: 1.2, short: "syn_pluck" }), syn_pluck: P([48, 88], { pluck: true }),
  syn_bass: P([24, 52], { short: "syn_bass" }), syn_lead: P([55, 91], { atk: .03, rel: .3, short: "syn_pluck" }), syn_bell: P([55, 96]), syn_sub: P([24, 48]),
};
const VARIANTS = ["short", "trem", "pizz"];
const play = (s) => { const p = PALETTE[s] ?? {}, o = { sound: p.sample ?? s }; for (const k of ["range", "atk", "rel", "lpf"]) if (p[k] != null) o[k] = p[k]; return o; };
const V = (s, k) => (s && PALETTE[s]?.[k]) ?? s;
export const SOUNDS = Object.keys(PALETTE);

export function arrange(b) {
  const n = b.bars, sc = b.scale, len = sc.length;
  const mid = (d, oct = 0) => b.tonic + 12 * oct + sc[((d % len) + len) % len] + 12 * Math.floor(d / len);
  const ch = events(b.chords, n), roots = Array.from({ length: n }, (_, i) => ch.find((e) => Math.floor(e.t) === i)?.v ?? 0);
  // the scale step nearest a pure fifth (7 semitones) above the root, or null when the scale has none: then we double the octave
  const fifthOf = (r) => { for (let k = 1; k < len; k++) { const iv = mid(r + k) - mid(r); if (Math.abs(iv - 7) <= .25) return r + k; } return null; };
  const thirdOf = (r) => { for (let k = 1; k < len; k++) { const iv = mid(r + k) - mid(r); if (iv >= 2.5 && iv <= 4.5) return r + k; } return null; };
  const place = (m, lo) => { while (m < lo) m += 12; while (m >= lo + 12) m -= 12; return m; };
  const perBar = (f) => "<" + roots.map((r) => f(r)).join(" ") + ">";
  const chord = (lo) => (r) => { const R = place(mid(r), lo), f = fifthOf(r); return `[${R},${f != null ? R + (mid(f) - mid(r) + 1200) % 12 : R + 12}]`; };
  const bars = (from, to) => "<" + Array.from({ length: n }, (_, i) => (i + 1 >= from && i + 1 <= to ? 1 : 0)).join(" ") + ">";
  const SOLO = bars(...b.form.solo), CLIMB = bars(...b.form.climb), TUNE = SOLO.replace(/\d/g, (x) => 1 - x);
  const step = (r, k) => mid(r + k) - mid(r);
  const ost = (r, lo) => { const R = place(mid(r), lo); return "[" + [0, 1, 0, 1, 0, 1, 2, 1].map((k) => R + step(r, k)).join(" ") + "]"; };
  const arp = (r) => { const R = place(mid(r), 43), f = fifthOf(r), t = thirdOf(r), F = f != null ? mid(f) - mid(r) : 12, T = t != null ? mid(t) - mid(r) : 12;
    return "[" + [R, R + F, R + 12, R + 12 + T, R + 12 + F, R + 12 + T, R + 12, R + F].join(" ") + "]"; };
  const E = b.ensemble, I = b.ideologies, Rh = b.rhythm;
  const ids = Object.keys(I);
  const lv = (L, id) => L[id] ?? 0;
  // the strongest ideology takes the tune from the strings; the tune itself never stops
  const lead = (L) => Math.max(0, ...ids.filter((id) => I[id].tune).map((id) => lv(L, id) * (I[id].share ?? 1)));
  const thin = (L, what) => ids.reduce((a, id) => a * (1 - (I[id].thins?.[what] ?? 0) * lv(L, id)), 1);
  const strict = (L) => 1 - .45 * L.grip, bed = (L) => L.calm + .8 * L.tension + .6 * L.crisis;
  const pad = perBar(chord(43)), rootLine = perBar((r) => place(mid(r), 43)), low = perBar((r) => place(mid(r), 31));
  const tuneL = (s, o, extra = {}) => ({ ...play(s), deg: b.theme, oct: o, mask: TUNE, len: strict, shape: true, ...(PALETTE[s]?.pluck ? { segment: 8, vel: "[1 .55]*4" } : {}), ...extra });
  const T = { tune: E.bed[0], ostinato: V(E.bed[0], "short"), tremolo: V(E.section, "trem"), cry: "violin_solo", heartbeat: "timpani", roll: "timpani_roll", ...b.moods?.tension };
  const C = { tune: [E.section, E.brass?.[0]].filter(Boolean), drive: E.bed.map((x) => V(x, "short")), stab: [V(E.brass?.[0], "short"), "trumpet_stac"].filter(Boolean), low: E.pulse, timp: "timpani", ...b.moods?.crisis };
  const layers = [];
  const add = (id, spec, gain) => layers.push({ id, ...spec, gain });

  // ---------- CALM ----------
  add("lead", { ...play(E.lead.sound), deg: b.theme, oct: E.lead.oct ?? 0, mask: TUNE, len: strict, pan: -.1, send: .3,
    ...(PALETTE[E.lead.sound]?.pluck ? { segment: 8, vel: "[1 .55]*4" } : { shape: true }), orn: (L) => .3 * L.open * thin(L, "ornaments") },
    (L) => (L.calm + .45 * L.tension) * .55 * thin(L, "lead"));
  add("section", tuneL(E.section, 1, { pan: -.25, send: .45 }), (L) => L.calm * L.grow(.45) * (1 - .55 * lead(L)) * .8);
  add("section8", { ...tuneL(E.section, 2, { pan: -.3, send: .5 }), mask: CLIMB }, (L) => L.calm * L.grow(.75) * (1 - .4 * lead(L)) * .55);
  add("bed1", { ...play(E.bed[0]), note: pad, atk: .9, rel: 1.4, pan: .2, send: .45 }, (L) => bed(L) * (.32 + .25 * L.grow(.3)));
  if (E.bed[1]) add("bed2", { ...play(E.bed[1]), note: pad, add: 12, atk: 1.1, rel: 1.4, pan: -.1, send: .5 }, (L) => bed(L) * L.grow(.3) * .3);
  add("bass", { ...play(E.bass), note: rootLine, atk: .5, rel: 1.2, pan: .25, send: .35 }, (L) => bed(L) * Math.max(L.grow(.25), 1 - L.calm) * .45);
  if (E.arp) add("arp", { ...play(E.arp), note: perBar(arp), vel: "[.9 .6 .7 .6 .8 .6 .7 .55]", len: 2, pan: .35, send: .55 },
    (L) => L.calm * L.grow(.55) * (.25 + .5 * L.open) * thin(L, "ornaments") * 1.1);
  if (E.brass?.[0]) add("brass1", { ...play(E.brass[0]), note: perBar(chord(43)), mask: CLIMB, atk: .8, rel: 1.2, pan: .1, send: .55 }, (L) => L.calm * L.grow(.7) * .35);
  if (E.brass?.[1]) add("brass2", { ...play(E.brass[1]), note: perBar(chord(38)), mask: CLIMB, atk: .5, rel: 1, pan: .2, send: .55 }, (L) => L.calm * L.grow(.9) * .25);
  add("village", { sound: Rh.village.sound, hit: Rh.village.hit, vel: Rh.village.vel, pan: -.2, send: .25 }, (L) => L.calm * (.5 - .3 * L.grow(.35)) * thin(L, "ornaments"));
  add("city", { sound: Rh.city.sound ?? null, hit: Rh.city.hit, pan: .1, send: .2 }, (L) => L.calm * L.grow(.25) * thin(L, "drums") * .6);
  add("pulse", { ...play(E.pulse), note: rootLine, rhythm: "x ~ ~ ~ x ~ ~ ~", pan: .2, send: .2 }, (L) => L.calm * L.grow(.25) * (1 - .4 * L.grip) * .5);
  if (E.cymbal) add("swell", { sound: E.cymbal, hit: bars(b.form.climb[0] - 1, b.form.climb[0] - 1).replace(/1/g, "x").replace(/0/g, "~"), len: 2.5, send: .6 }, (L) => L.calm * L.grow(.8) * .3);

  // ---------- IDEOLOGIES: their players take the tune, and their colour joins ----------
  for (const id of ids) {
    const ide = I[id];
    (ide.tune ?? []).forEach((t, k) => add(`${id}_tune${k}`, { ...tuneL(t.sound, t.oct ?? 1, { pan: [-.35, .3, .15][k] ?? 0, send: .55 }), ...(t.climb ? { mask: CLIMB } : {}),
      ...(t.ornament ? { orn: (L) => .25 * L.open } : {}) }, (L) => L.calm * lv(L, id) * (t.climb ? L.grow(.4) * .3 : [.8, .6][k] ?? .5)));
    (ide.colour ?? []).forEach((c, k) => {
      const g = { pulse: .5, drums: .7, drone: .45, calls: .7 }[c.type] ?? .5, key = `${id}_${c.type}${k}`;
      if (c.type === "pulse") add(key, { ...play(c.sound), note: perBar(chord(55)), rhythm: c.rhythm, pan: .3, send: .3 }, (L) => L.calm * lv(L, id) * g);
      if (c.type === "drums") add(key, { sound: c.sound ?? null, hit: c.hit, vel: c.vel, pan: -.15, send: .3 }, (L) => L.calm * lv(L, id) * g);
      if (c.type === "drone") add(key, { ...play(c.sound), note: `[${c.degrees.map((d) => mid(d, c.oct ?? -1)).join(",")}]`, atk: 1.6, rel: 2, lpf: 900, send: .5 }, (L) => L.calm * lv(L, id) * g);
      if (c.type === "calls") add(key, { ...play(c.sound), note: perBar(chord(60)), rhythm: "<[x ~ ~ ~ ~ ~ ~ ~] ~>", vel: ".9", pan: .3, send: .55 }, (L) => L.calm * lv(L, id) * g);
    });
  }

  // ---------- GRIP ----------
  add("open_solo", { ...play(E.soloist), deg: b.solo, oct: 1, atk: .25, rel: .9, shape: true, send: .65 }, (L) => L.calm * L.open * .55);
  add("open_figure", { ...play(E.lead.sound), deg: "<" + Array.from({ length: n }, (_, i) => (+SOLO.slice(1, -1).split(" ")[i] ? E.figure : "~")).join(" ") + ">", oct: E.lead.oct ?? 0, send: .3 }, (L) => L.calm * L.open * .5);
  add("open_fills", { sound: Rh.fills.sound, hit: Rh.fills.hit, vel: Rh.fills.vel, humanize: 14, pan: .25, send: .2 }, (L) => L.calm * L.open * thin(L, "drums") * .45);
  add("open_shaker", { sound: Rh.shaker.sound, hit: Rh.shaker.hit, vel: Rh.shaker.vel, pan: .4, send: .25 }, (L) => L.calm * (.4 + .6 * L.open) * thin(L, "ornaments") * L.grow(.5) * .3);
  add("iron_theme", { ...play(V(E.section, "short")), deg: b.theme, oct: 1, mask: SOLO, len: .5, pan: -.2, send: .3 }, (L) => L.calm * L.grip * .7);
  add("iron_pulse", { ...play(V(E.bed[0], "pizz")), note: rootLine, rhythm: "x x x x", pan: .2, send: .3 }, (L) => L.calm * L.grip * .6);
  add("iron_beat", { sound: Rh.strict.sound, hit: Rh.strict.hit, vel: ".8", send: .2 }, (L) => L.calm * L.grip * L.grip * .3);

  // ---------- TENSION: same key, same chords; the tune sinks to the low strings over a pulsing ostinato ----------
  add("t_tune", { ...play(T.tune), deg: b.theme, oct: 0, mask: TUNE, len: .95, shape: true, pan: .15, send: .5 }, (L) => L.tension * .75);
  add("t_ost", { ...play(T.ostinato), note: perBar((r) => ost(r, 43)), vel: "[1 .55 .75 .55 .9 .55 .75 .6]", pan: -.15, send: .35 }, (L) => L.tension * .95);
  add("t_trem", { ...play(T.tremolo), note: perBar(chord(60)), vel: "<.4 .55 .7 .9>", atk: .9, rel: 1, pan: -.3, send: .6 }, (L) => L.tension * .7);
  add("t_sigh", { ...play(T.cry), deg: b.sighs, oct: 2, atk: .4, rel: .8, pan: -.1, send: .65 }, (L) => L.tension * .5);
  add("t_heart", { sound: T.heartbeat, hit: "x ~ ~ ~ x ~ ~ ~", vel: "[1 .6]", send: .45 }, (L) => L.tension * .7);
  add("t_drums", { sound: Rh.tension.sound ?? null, hit: Rh.tension.hit, send: .25 }, (L) => L.tension * .8);
  add("t_roll", { sound: T.roll, hit: "<~!3 x>", len: 2.5, send: .5 }, (L) => L.tension * .75);

  // ---------- CRISIS: the whole orchestra plays the theme over driving sixteenths; brass on the accents ----------
  add("c_tune", { ...tuneL(C.tune[0], 1, { pan: -.3, send: .4 }), atk: .03, rel: .3, len: .8 }, (L) => L.crisis * .9);
  add("c_tune8", { ...tuneL(C.tune[0], 2, { pan: -.35, send: .45 }), atk: .03, rel: .3, len: .8 }, (L) => L.crisis * .55);
  if (C.tune[1]) add("c_brass_tune", { ...tuneL(C.tune[1], 0, { pan: .15, send: .45 }), atk: .03, rel: .3, len: .8 }, (L) => L.crisis * .9);
  add("c_lead", { ...play(E.lead.sound), deg: b.theme, oct: E.lead.oct ?? 0, mask: TUNE, segment: 16, vel: "[1 .6]*8", atk: .005, rel: .25, lpf: 2200, send: .3 }, (L) => L.crisis * .7);
  add("c_solo_bars", { ...play(V(C.tune[0], "short")), deg: b.theme, oct: 1, mask: SOLO, pan: -.2, send: .35 }, (L) => L.crisis * 1.1);
  add("c_ost", { ...play(C.drive[0]), note: perBar((r) => ost(r, 43) + "*2"), vel: "[1 .5 .7 .5]*4", pan: .25, send: .3 }, (L) => L.crisis * 1.2);
  if (C.drive[1]) add("c_ost2", { ...play(C.drive[1]), note: perBar((r) => ost(r, 43) + "*2"), add: 12, vel: "[1 .5 .7 .5]*4", pan: .05, send: .3 }, (L) => L.crisis * .8);
  if (C.stab[0]) add("c_stab", { ...play(C.stab[0]), note: perBar(chord(43)), rhythm: Rh.crisis.accents, vel: ".95", pan: .1, send: .45 }, (L) => L.crisis * 1.2);
  if (C.stab[1]) add("c_stab_hi", { ...play(C.stab[1]), note: perBar(chord(60)), rhythm: Rh.crisis.accents, vel: ".85", pan: .3, send: .45 }, (L) => L.crisis * .7);
  add("c_low", { ...play(C.low), note: low, rhythm: Rh.crisis.accents, vel: "1", send: .25 }, (L) => L.crisis * 1.3);
  add("c_drums", { sound: Rh.crisis.sound ?? null, hit: Rh.crisis.hit, send: .2 }, (L) => L.crisis * 1.3);
  add("c_drive", { sound: Rh.village.sound, hit: "x*8", vel: "[1 .55]*4", pan: -.25, send: .2 }, (L) => L.crisis * .8);
  add("c_timp", { sound: C.timp, hit: Rh.crisis.accents, vel: "[1 .7 .85]", send: .4 }, (L) => L.crisis * 1.1);
  if (E.cymbal) add("c_swell", { sound: E.cymbal, hit: "<~!3 x>", len: 2, send: .6 }, (L) => L.crisis * .6);

  for (const ly of layers) for (const k of Object.keys(ly)) if (ly[k] === undefined) delete ly[k];
  const fills = b.fills ?? [{ sound: "timpani_roll", vel: .9 }, ...(E.cymbal ? [{ sound: E.cymbal, vel: .8 }] : [])];
  return { title: b.title, bpm: b.bpm, bars: n, root: b.tonic, maqam: "main", scales: { main: sc }, layers, fills, levers: ids, harmony: { roots, mid, fifthOf }, brief: b };
}

// Melody lint for the theme: warnings a model can be told about, never silent rewrites.
export function lintBrief(b) {
  const w = [], len = b.scale.length, ev = events(b.theme, b.bars).filter((e) => typeof e.v === "number");
  const barsWithNotes = new Set(ev.map((e) => Math.floor(e.t)));
  if (barsWithNotes.size < b.bars * .6) w.push(`theme plays in only ${barsWithNotes.size} of ${b.bars} bars`);
  const lo = Math.min(...ev.map((e) => e.v)), hi = Math.max(...ev.map((e) => e.v));
  if (hi - lo > len * 1.5) w.push(`theme spans ${hi - lo} scale steps; keep it within about ${Math.round(len * 1.5)} so one instrument can sing it`);
  const last = ev.at(-1); if (last && ((last.v % len) + len) % len !== 0) w.push(`theme ends on step ${last.v}, not the tonic: the loop will not feel at home`);
  const leaps = ev.slice(1).filter((e, i) => Math.abs(e.v - ev[i].v) > 4).length; if (leaps > b.bars / 3) w.push(`${leaps} leaps of more than 4 steps; a singable tune moves mostly by step`);
  const shape = (i) => ev.filter((e) => Math.floor(e.t) === i).map((e) => e.v).join(" ");
  const seen = new Set(); let repeats = 0; for (let i = 0; i < b.bars; i++) { const s = shape(i); if (!s) continue; if (seen.has(s)) repeats++; seen.add(s); }
  if (repeats < 2) w.push("no bar of the theme ever comes back; repeat the opening phrase so the tune is memorable");
  return w;
}
