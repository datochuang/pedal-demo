// Web Audio 引擎：音源、11 個效果模組、分析器
import { AMPS } from './data.js';

const RANGE = 8; // WaveShaper 曲線的「真實值」範圍：曲線定義在 [-8, 8]，輸入先乘以 g/RANGE
const lerp = (a, b, t) => a + (b - a) * t;
const expMap = (a, b, t) => a * Math.pow(b / a, t);

// ---- 削波函式（同時用於音訊與轉換曲線繪圖）----
export const fns = {
  lin: (x) => x,
  od: (x) => Math.tanh(x),
  dist: (x) => x / Math.pow(1 + Math.pow(Math.abs(x), 5), 1 / 5),
  fuzz: (x) => (x >= 0 ? Math.tanh(3 * x) : -0.7 * Math.tanh(-6 * x)),
  tube: (x) => Math.tanh(x + 0.12) - Math.tanh(0.12),
  tubeHard: (x) => Math.tanh(1.4 * x + 0.15) - Math.tanh(0.15),
  power: (x) => Math.tanh(0.8 * x) / 0.8,
};

function mkCurve(fn) {
  const N = 4097, c = new Float32Array(N);
  for (let i = 0; i < N; i++) c[i] = fn(RANGE * (2 * i / (N - 1) - 1));
  return c;
}
function shaper(ctx, fn) {
  const s = ctx.createWaveShaper();
  s.curve = mkCurve(fn);
  s.oversample = '4x';
  return s;
}
const biq = (ctx, type, f, q = 0.707, g = 0) => {
  const b = ctx.createBiquadFilter();
  b.type = type; b.frequency.value = f; b.Q.value = q; b.gain.value = g;
  return b;
};
const chain = (...n) => {
  for (let i = 0; i < n.length - 1; i++) n[i].connect(n[i + 1]);
  return { in: n[0], out: n[n.length - 1] };
};
const sm = (ctx, p, v, t = 0.02) => p.setTargetAtTime(v, ctx.currentTime, t);
function lfo(ctx, rate, depth, target, type = 'sine') {
  const o = ctx.createOscillator(); o.type = type; o.frequency.value = rate;
  const g = ctx.createGain(); g.gain.value = depth;
  o.connect(g); g.connect(target); o.start();
  return { osc: o, amp: g };
}

// ---- 各效果器 ----
function buildComp(ctx) {
  const c = ctx.createDynamicsCompressor();
  c.ratio.value = 12; c.knee.value = 6; c.attack.value = 0.006; c.release.value = 0.25;
  const mk = ctx.createGain();
  c.connect(mk);
  return {
    in: c, out: mk,
    set(k, v) {
      if (k === 'sustain') sm(ctx, c.threshold, -12 - v * 38);
      if (k === 'level') sm(ctx, mk.gain, 0.5 + v * 3.5);
    },
  };
}

function buildWah(ctx) {
  const f = biq(ctx, 'peaking', 800, 5, 16);
  const l = lfo(ctx, 1.5, 800, f.detune);
  return {
    in: f, out: f,
    set(k, v) {
      if (k === 'freq') sm(ctx, f.frequency, expMap(350, 1400, v));
      if (k === 'rate') l.osc.frequency.setTargetAtTime(0.3 + v * 5, ctx.currentTime, 0.02);
      if (k === 'depth') sm(ctx, l.amp.gain, v * 1500); // detune (cents)
    },
  };
}

function clipPedal(ctx, o) {
  const hp = biq(ctx, 'highpass', o.hp);
  const pre = ctx.createGain();
  const sh = shaper(ctx, o.fn);
  const oh = biq(ctx, 'highpass', 40);
  const tone = biq(ctx, 'lowpass', 3000);
  const lv = ctx.createGain();
  const c = chain(hp, pre, sh, oh, tone, lv);
  const v = { drive: 0.5, tone: 0.5, level: 0.5 };
  let g = 1;
  const apply = () => {
    g = expMap(o.g[0], o.g[1], v.drive);
    sm(ctx, pre.gain, g / RANGE);
    sm(ctx, tone.frequency, expMap(o.t[0], o.t[1], v.tone));
    sm(ctx, lv.gain, lerp(o.lv[0], o.lv[1], v.level));
  };
  apply();
  return { ...c, set(k, x) { v[k] = x; apply(); }, transfer: () => (x) => o.fn(g * x) };
}

function buildChorus(ctx) {
  const d = ctx.createDelay(0.1); d.delayTime.value = 0.022;
  const l = lfo(ctx, 1, 0.003, d.delayTime);
  const wet = ctx.createGain();
  d.connect(wet);
  return {
    in: d, out: wet,
    set(k, v) {
      if (k === 'rate') l.osc.frequency.setTargetAtTime(0.2 + v * 4, ctx.currentTime, 0.02);
      if (k === 'depth') sm(ctx, l.amp.gain, 0.0005 + v * 0.0065);
      if (k === 'mix') sm(ctx, wet.gain, v * 1.1);
    },
  };
}

function buildPhaser(ctx) {
  const aps = [0, 1, 2, 3].map(() => biq(ctx, 'allpass', 700, 0.8));
  const input = ctx.createGain(), out = ctx.createGain();
  out.gain.value = 0.85;
  input.connect(aps[0]);
  for (let i = 0; i < 3; i++) aps[i].connect(aps[i + 1]);
  aps[3].connect(out);
  const fb = ctx.createGain(); fb.gain.value = 0.3;
  aps[3].connect(fb); fb.connect(aps[0]);
  const l = lfo(ctx, 0.5, 1200, aps[0].detune);
  for (let i = 1; i < 4; i++) l.amp.connect(aps[i].detune);
  return {
    in: input, out,
    set(k, v) {
      if (k === 'rate') l.osc.frequency.setTargetAtTime(0.1 + v * 3, ctx.currentTime, 0.02);
      if (k === 'depth') sm(ctx, l.amp.gain, v * 2000);
      if (k === 'fb') sm(ctx, fb.gain, v * 0.8);
    },
  };
}

function buildTrem(ctx) {
  const g = ctx.createGain();
  const l = lfo(ctx, 5, 0.35, g.gain);
  let depth = 0.7;
  const setD = () => { g.gain.setTargetAtTime(1 - depth / 2, ctx.currentTime, 0.02); sm(ctx, l.amp.gain, depth / 2); };
  setD();
  return {
    in: g, out: g,
    set(k, v) {
      if (k === 'rate') l.osc.frequency.setTargetAtTime(1 + v * 11, ctx.currentTime, 0.02);
      if (k === 'depth') { depth = v; setD(); }
    },
  };
}

function buildDelay(ctx) {
  const d = ctx.createDelay(1.5); d.delayTime.value = 0.4;
  const fb = ctx.createGain(); fb.gain.value = 0.4;
  const lp = biq(ctx, 'lowpass', 3200);
  const wet = ctx.createGain();
  d.connect(lp); lp.connect(fb); fb.connect(d);
  lp.connect(wet);
  return {
    in: d, out: wet,
    set(k, v) {
      if (k === 'time') sm(ctx, d.delayTime, 0.08 + v * 0.72, 0.05);
      if (k === 'fb') sm(ctx, fb.gain, v * 0.85);
      if (k === 'mix') sm(ctx, wet.gain, v);
    },
  };
}

function buildReverb(ctx) {
  const conv = ctx.createConvolver();
  const wet = ctx.createGain();
  conv.connect(wet);
  let decay = 0.5, damp = 0.5, timer = null;
  const gen = () => {
    const sec = 0.4 + decay * 4, sr = ctx.sampleRate, len = Math.floor(sr * sec), pre = Math.floor(sr * 0.02);
    const buf = ctx.createBuffer(2, len, sr);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      let y = 0;
      for (let i = pre; i < len; i++) {
        const t = (i - pre) / (len - pre);
        const a = Math.max(0.04, 1 - damp * 0.95 * (0.25 + 0.75 * t)); // 愈後面低通愈強
        y += a * ((Math.random() * 2 - 1) - y);
        d[i] = y * Math.exp(-6.9 * t) * (1 - Math.exp(-t * 80));
      }
    }
    conv.buffer = buf;
  };
  gen();
  const regen = () => { clearTimeout(timer); timer = setTimeout(gen, 150); };
  return {
    in: conv, out: wet,
    set(k, v) {
      if (k === 'decay') { decay = v; regen(); }
      if (k === 'damp') { damp = v; regen(); }
      if (k === 'mix') sm(ctx, wet.gain, v * 2.2);
    },
  };
}

// ---- 音箱 + 箱體 ----
function buildAmp(ctx) {
  const inHP = biq(ctx, 'highpass', 60);
  const st = [0, 1, 2].map(() => ({ g: ctx.createGain(), s: shaper(ctx, fns.lin), fixed: 1, fn: 'lin' }));
  const bass = biq(ctx, 'lowshelf', 120);
  const mid = biq(ctx, 'peaking', 700, 0.8);
  const treb = biq(ctx, 'highshelf', 3200);
  const hp2 = biq(ctx, 'highpass', 60), hp3 = biq(ctx, 'highpass', 60);
  const pres = biq(ctx, 'highshelf', 4000, 0.7, 2);
  const pw = ctx.createGain(); pw.gain.value = 1;
  const pws = shaper(ctx, fns.power);
  const cHP = biq(ctx, 'highpass', 80), cPk = biq(ctx, 'peaking', 3000, 1, 2);
  const cLP = biq(ctx, 'lowpass', 5500, 0.7), cLP2 = biq(ctx, 'lowpass', 7000, 0.5);
  const vol = ctx.createGain();
  const nodes = [inHP, st[0].g, st[0].s, bass, mid, treb, st[1].g, st[1].s, hp2, st[2].g, st[2].s, hp3, pres, pw, pws, cHP, cPk, cLP, cLP2, vol];
  const c = chain(...nodes);
  const v = { gain: 0.5, bass: 0.5, treble: 0.5, volume: 0.6 };
  let m = AMPS.marshall, stage1 = 1;
  const apply = () => {
    stage1 = expMap(m.gain[0], m.gain[1], v.gain);
    st.forEach((s, i) => sm(ctx, s.g.gain, (i === 0 ? stage1 : s.fixed) / RANGE));
    sm(ctx, bass.gain, (v.bass - 0.5) * 24 + m.bassOff);
    sm(ctx, treb.gain, (v.treble - 0.5) * 24 + m.trebleOff);
    sm(ctx, vol.gain, v.volume * 1.6 * m.trim);
  };
  const setModel = (key) => {
    m = AMPS[key];
    st.forEach((s, i) => {
      const sd = m.stages[i];
      s.fn = sd ? sd.fn : 'lin';
      s.fixed = sd && sd.g ? sd.g : 1;
      s.s.curve = mkCurve(fns[s.fn]);
    });
    mid.frequency.value = m.midHz; mid.gain.value = m.midDb;
    treb.frequency.value = m.trebleHz;
    inHP.frequency.value = m.key === 'mesa' ? 150 : 60;
    cHP.frequency.value = m.cab.hp; cLP.frequency.value = m.cab.lp; cLP2.frequency.value = m.cab.lp * 1.3;
    cPk.frequency.value = m.cab.peakHz; cPk.gain.value = m.cab.peakDb; cPk.Q.value = m.cab.peakQ;
    apply();
  };
  setModel('marshall');
  return {
    ...c, set(k, x) { v[k] = x; apply(); }, setModel,
    transfer: () => (x) => {
      let y = x;
      st.forEach((s, i) => { y = fns[s.fn]((i === 0 ? stage1 : s.fixed) * y); });
      return y;
    },
  };
}

const BUILDERS = {
  comp: [buildComp, false],
  wah: [buildWah, false],
  fuzz: [(c) => clipPedal(c, { hp: 80, fn: fns.fuzz, g: [8, 100], t: [700, 5000], lv: [0.05, 0.6] }), false],
  od: [(c) => clipPedal(c, { hp: 250, fn: fns.od, g: [2, 50], t: [800, 6400], lv: [0.1, 1.0] }), false],
  dist: [(c) => clipPedal(c, { hp: 120, fn: fns.dist, g: [5, 100], t: [1000, 7000], lv: [0.05, 0.7] }), false],
  amp: [buildAmp, false],
  chorus: [buildChorus, true],
  phaser: [buildPhaser, true],
  trem: [buildTrem, false],
  delay: [buildDelay, true],
  reverb: [buildReverb, true],
};
export const ORDER = ['comp', 'wah', 'fuzz', 'od', 'dist', 'amp', 'chorus', 'phaser', 'trem', 'delay', 'reverb'];

// ---- Karplus-Strong 合成吉他 ----
function pluck(out, startSample, f, dur, sr, amp, pm) {
  const N = Math.max(2, Math.round(sr / f - 0.5));
  const L = Math.floor(dur * sr);
  const buf = new Float32Array(L + N + 2);
  let prev = 0;
  let p2 = 0;
  for (let i = 0; i < N; i++) { prev = prev * 0.6 + (Math.random() * 2 - 1) * 0.4; p2 = p2 * 0.5 + prev * 0.5; buf[i] = p2; }
  const pp = Math.round(N * 0.16);
  for (let i = N - 1; i >= pp; i--) buf[i] -= buf[i - pp] * 0.8; // 撥弦位置造成的梳狀
  const d = pm ? 0.962 : Math.min(0.9985, 0.9945 + f / 600000);
  for (let i = N; i < L; i++) buf[i] = d * 0.5 * (buf[i - N] + buf[i - N + 1]);
  const fade = Math.floor(0.04 * sr);
  for (let i = 0; i < L && startSample + i < out.length; i++) {
    const e = i > L - fade ? (L - i) / fade : 1;
    out[startSample + i] += buf[i] * amp * e;
  }
}
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

function makeRiff(ctx) {
  const sr = ctx.sampleRate, step = 0.3, steps = 32;
  const out = new Float32Array(Math.floor(sr * (steps * step + 0.5)));
  const A5 = [45, 52, 57], C5 = [48, 55, 60], D5 = [50, 57, 62], E5 = [40, 47, 52], G5 = [43, 50, 55];
  const ev = [
    [0, 1, A5, 1], [1, 1, A5, 1], [2, 1, A5, 1], [3, 1, A5, 1], [4, 2, C5], [6, 2, D5],
    [8, 1, A5, 1], [9, 1, A5, 1], [10, 1, A5, 1], [11, 1, A5, 1], [12, 2, G5], [14, 2, E5],
    [16, 3, [69]], [19, 1, [72]], [20, 2, [74]], [22, 2, [76]], [24, 2, [74]], [26, 1, [72]], [27, 1, [69]],
    [28, 4, [45, 52, 57, 64]],
  ];
  for (const [s, d, notes, pm] of ev) {
    notes.forEach((n, i) => {
      const dur = pm ? 0.2 : d * step + 0.5;
      pluck(out, Math.floor((s * step + i * 0.012) * sr), mtof(n), dur, sr, notes.length > 1 ? 0.5 : 0.8, pm);
    });
  }
  let pk = 0; for (const x of out) pk = Math.max(pk, Math.abs(x));
  for (let i = 0; i < out.length; i++) out[i] *= 0.6 / pk;
  const b = ctx.createBuffer(1, out.length, sr);
  b.copyToChannel(out, 0);
  return b;
}

function makeNote(ctx) {
  const sr = ctx.sampleRate, out = new Float32Array(Math.floor(sr * 3));
  pluck(out, 0, 220, 2.9, sr, 1, false);
  let pk = 0; for (const x of out) pk = Math.max(pk, Math.abs(x));
  for (let i = 0; i < out.length; i++) out[i] *= 0.6 / pk;
  const b = ctx.createBuffer(1, out.length, sr);
  b.copyToChannel(out, 0);
  return b;
}

// ---- 引擎 ----
export class Engine {
  async init(extCtx) { // extCtx：測試用 OfflineAudioContext
    const ctx = (this.ctx = extCtx || new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive' }));
    if (!extCtx) await ctx.resume();
    this.inGain = ctx.createGain();
    this.inGain.channelCount = 1; this.inGain.channelCountMode = 'explicit';
    this.pre = this._analyser(); this.post = this._analyser();
    this.inGain.connect(this.pre);

    this.fx = {};
    let prev = this.inGain;
    for (const id of ORDER) {
      const [build, parallel] = BUILDERS[id];
      const core = build(ctx);
      const input = ctx.createGain(), output = ctx.createGain();
      const dry = ctx.createGain(), wet = ctx.createGain();
      wet.gain.value = 0; dry.gain.value = 1;
      input.connect(dry); dry.connect(output);
      input.connect(core.in); core.out.connect(wet); wet.connect(output);
      prev.connect(input); prev = output;
      this.fx[id] = {
        core, parallel,
        enable(on) {
          sm(ctx, wet.gain, on ? 1 : 0, 0.01);
          if (!parallel) sm(ctx, dry.gain, on ? 0 : 1, 0.01);
        },
      };
    }
    this.master = ctx.createGain(); this.master.gain.value = 0.7;
    const lim = ctx.createDynamicsCompressor();
    lim.threshold.value = -2; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = 0.002; lim.release.value = 0.1;
    const g8 = ctx.createGain(); g8.gain.value = 1 / RANGE; // 最後一層 tanh 軟限幅，避免爆音
    prev.connect(this.master); this.master.connect(lim); lim.connect(g8);
    g8.connect(shaper(ctx, Math.tanh)).connect(this.post); this.post.connect(ctx.destination);

    this.buffers = { riff: makeRiff(ctx), note: makeNote(ctx) };
    this.srcNode = null;
  }
  _analyser() {
    const a = this.ctx.createAnalyser();
    a.fftSize = 4096; a.smoothingTimeConstant = 0.7; a.minDecibels = -100; a.maxDecibels = -10;
    return a;
  }
  setOn(id, on) { this.fx[id].enable(on); }
  setParam(id, k, v) { this.fx[id].core.set(k, v); }
  setAmpModel(m) { this.fx.amp.core.setModel(m); }
  transfer(id) { const c = this.fx[id] && this.fx[id].core; return c && c.transfer ? c.transfer() : null; }
  setInput(v) { sm(this.ctx, this.inGain.gain, v); }
  setMaster(v) { sm(this.ctx, this.master.gain, v); }

  _stopSrc() {
    if (!this.srcNode) return;
    try { this.srcNode.stop && this.srcNode.stop(); } catch (e) { /* noop */ }
    this.srcNode.disconnect();
    if (this.stream) { this.stream.getTracks().forEach((t) => t.stop()); this.stream = null; }
    this.srcNode = null;
  }
  async setSource(type, file) {
    const ctx = this.ctx;
    this._stopSrc();
    if (type === 'riff' || type === 'note' || type === 'file') {
      let buffer = this.buffers[type];
      if (type === 'file') buffer = await ctx.decodeAudioData(await file.arrayBuffer());
      const s = ctx.createBufferSource(); s.buffer = buffer; s.loop = true; s.connect(this.inGain); s.start();
      this.srcNode = s;
    } else if (type === 'sine') {
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = 220;
      const g = ctx.createGain(); g.gain.value = 0.5; o.connect(g); g.connect(this.inGain); o.start();
      this.srcNode = o; o.disconnect = ((orig) => () => { orig.call(o); g.disconnect(); })(o.disconnect);
    } else if (type === 'mic') {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
      const s = ctx.createMediaStreamSource(this.stream); s.connect(this.inGain);
      this.srcNode = s;
    }
  }
  time(which, arr) { (which === 'pre' ? this.pre : this.post).getFloatTimeDomainData(arr); }
  freq(which, arr) { (which === 'pre' ? this.pre : this.post).getFloatFrequencyData(arr); }
}
