import { FX, AMPS, PRESETS } from './data.js';
import { Engine, ORDER } from './audio.js';
import { createScene } from './scene.js';

const $ = (s) => document.querySelector(s);
const engine = new Engine();
const byId = Object.fromEntries(FX.map((f) => [f.id, f]));

// ---- 狀態 ----
const state = {};
FX.forEach((f) => { state[f.id] = { on: false, p: Object.fromEntries(f.params.map((p) => [p.key, p.def])) }; });
state.amp.on = true; state.amp.model = 'marshall';
Object.assign(state.amp.p, AMPS.marshall.defaults);
let selected = 'od';
let started = false;

const scene = createScene($('#stage'), FX, AMPS, {
  getParam: (id, k) => state[id].p[k],
  onParam: (id, k, v) => setParam(id, k, v),
  onToggle: (id) => setOn(id, !state[id].on),
  onSelect: (id) => select(id),
});

// ---- 狀態變更 ----
function setOn(id, on) {
  state[id].on = on;
  if (started) engine.setOn(id, on);
  scene.setOn(id, on);
  renderChips(); renderOnBtn();
}
function setParam(id, k, v) {
  state[id].p[k] = v;
  if (started) engine.setParam(id, k, v);
  scene.setParam(id, k, v);
  if (id === selected) {
    const r = $(`#sl-${k}`);
    if (r) { r.value = v; $(`#sv-${k}`).textContent = byId[id].params.find((p) => p.key === k).fmt(v); }
    drawTransfer();
  }
}
function setAmp(model) { // model: key 或 null（直通）
  if (model) {
    state.amp.model = model;
    FX.find((f) => f.id === 'amp').params.forEach((p) => {
      state.amp.p[p.key] = AMPS[model].defaults[p.key];
      if (started) engine.setParam('amp', p.key, state.amp.p[p.key]);
      scene.setParam('amp', p.key, state.amp.p[p.key]);
    });
    if (started) engine.setAmpModel(model);
    scene.setAmpModel(model);
  } else scene.setAmpModel(null);
  setOn('amp', !!model);
  document.querySelectorAll('#ampBtns button').forEach((b) => b.classList.toggle('on', b.dataset.amp === (model || 'off')));
  renderInfo();
}
function select(id) { selected = id; scene.setSelected(id); renderChips(); renderInfo(); }

// ---- 效果鏈（上方 chip）----
function renderChips() {
  const el = $('#chain');
  el.innerHTML = '';
  ORDER.forEach((id, i) => {
    const f = byId[id], s = state[id];
    const c = document.createElement('div');
    c.className = 'chip' + (s.on ? ' on' : '') + (id === selected ? ' sel' : '') + (id === 'amp' ? ' amp' : '');
    const name = id === 'amp' ? (s.on ? AMPS[s.model].btn : 'DIRECT') : f.short;
    c.innerHTML = `<i class="dot"></i><span>${name}</span>`;
    c.querySelector('.dot').onclick = (e) => { e.stopPropagation(); setOn(id, !s.on); };
    c.onclick = () => select(id);
    el.appendChild(c);
    if (i < ORDER.length - 1) { const a = document.createElement('b'); a.className = 'arr'; a.textContent = '›'; el.appendChild(a); }
  });
}

// ---- 資訊面板 ----
function renderInfo() {
  const f = byId[selected], s = state[selected];
  const isAmp = selected === 'amp', m = isAmp && s.model ? AMPS[s.model] : null;
  const title = isAmp ? (s.on ? m.name : '直接輸出（無音箱）') : f.name;
  const sub = isAmp ? (s.on ? m.ref : '訊號不經過音箱與箱體，聲音直接輸出') : `${f.en} · ${f.model}`;
  const desc = isAmp && m ? m.desc : f.desc;
  let h = `<h2>${title}</h2><div class="sub">${sub}</div>
    <button id="onBtn" class="big"></button>
    <p>${desc}</p>
    <h3>怎麼運作</h3><p>${f.how}</p>
    <h3>在波形上看什麼</h3><p>${f.wave}</p>
    <h3>旋鈕（也可以在 3D 場景直接上下拖曳旋鈕）</h3>`;
  f.params.forEach((p) => {
    h += `<label class="knobrow"><span>${p.label}</span><input type="range" id="sl-${p.key}" min="0" max="1" step="0.005" value="${s.p[p.key]}"><em id="sv-${p.key}">${p.fmt(s.p[p.key])}</em></label>`;
  });
  if (['fuzz', 'od', 'dist', 'amp'].includes(selected)) h += `<h3>轉換曲線（輸入振幅 → 輸出振幅）</h3><canvas id="tf" width="300" height="180"></canvas>`;
  $('#info').innerHTML = h;
  f.params.forEach((p) => {
    $(`#sl-${p.key}`).oninput = (e) => setParam(selected, p.key, parseFloat(e.target.value));
  });
  $('#onBtn').onclick = () => setOn(selected, !state[selected].on);
  renderOnBtn(); drawTransfer();
}
function renderOnBtn() {
  const b = $('#onBtn'); if (!b) return;
  const on = state[selected].on;
  b.textContent = on ? '● 已開啟（點擊關閉）' : '○ 已關閉（點擊開啟）';
  b.classList.toggle('active', on);
}

function drawTransfer() {
  const cv = $('#tf'); if (!cv || !started) return;
  const fn = engine.transfer(selected); if (!fn) return;
  const g = cv.getContext('2d'), W = cv.width, H = cv.height;
  g.clearRect(0, 0, W, H);
  g.strokeStyle = '#2a3140'; g.lineWidth = 1;
  g.beginPath(); g.moveTo(0, H / 2); g.lineTo(W, H / 2); g.moveTo(W / 2, 0); g.lineTo(W / 2, H); g.stroke();
  g.strokeStyle = '#46506a'; g.setLineDash([4, 4]); g.beginPath(); g.moveTo(0, H); g.lineTo(W, 0); g.stroke(); g.setLineDash([]);
  g.strokeStyle = '#ffb347'; g.lineWidth = 2.5; g.beginPath();
  for (let i = 0; i <= W; i++) {
    const x = (i / W) * 2 - 1, y = Math.max(-1.3, Math.min(1.3, fn(x)));
    const py = H / 2 - (y / 1.3) * (H / 2);
    i ? g.lineTo(i, py) : g.moveTo(i, py);
  }
  g.stroke();
  g.fillStyle = '#8b97ad'; g.font = '11px system-ui'; g.fillText('虛線 = 不失真（輸出 = 輸入）', 6, 14);
}

// ---- 預設組合 ----
function applyPreset(p) {
  FX.forEach((f) => { if (f.id !== 'amp') setOn(f.id, false); });
  FX.forEach((f) => { if (f.id !== 'amp') f.params.forEach((q) => setParam(f.id, q.key, q.def)); });
  setAmp(p.amp);
  Object.entries(p.ampP || {}).forEach(([k, v]) => setParam('amp', k, v));
  Object.entries(p.on).forEach(([id, ps]) => { Object.entries(ps).forEach(([k, v]) => setParam(id, k, v)); setOn(id, true); });
  document.querySelectorAll('#presets button').forEach((b) => b.classList.toggle('on', b.dataset.n === p.name));
}

// ---- 左側控制 ----
function buildLeft() {
  $('#presets').innerHTML = PRESETS.map((p) => `<button data-n="${p.name}">${p.name}</button>`).join('');
  $('#presets').onclick = (e) => { const b = e.target.closest('button'); if (b) applyPreset(PRESETS.find((p) => p.name === b.dataset.n)); };
  $('#ampBtns').innerHTML = [['off', '直通']].concat(Object.values(AMPS).map((a) => [a.key, a.btn])).map(([k, n]) => `<button data-amp="${k}">${n}</button>`).join('');
  $('#ampBtns').onclick = (e) => { const b = e.target.closest('button'); if (!b) return; setAmp(b.dataset.amp === 'off' ? null : b.dataset.amp); select('amp'); };
  $('#srcBtns').onclick = async (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.src === 'file') { $('#fileIn').click(); return; }
    await useSource(b.dataset.src);
  };
  $('#fileIn').onchange = async (e) => { if (e.target.files[0]) await useSource('file', e.target.files[0]); };
  $('#inLevel').oninput = (e) => engine.setInput(parseFloat(e.target.value));
  $('#master').oninput = (e) => engine.setMaster(parseFloat(e.target.value));
}
async function useSource(type, file) {
  try {
    await engine.setSource(type, file);
    document.querySelectorAll('#srcBtns button').forEach((b) => b.classList.toggle('on', b.dataset.src === type));
    $('#srcNote').textContent = type === 'mic' ? '⚠ 麥克風／音訊介面輸入：請戴耳機，否則會嘯叫。' : '';
  } catch (err) {
    $('#srcNote').textContent = '無法使用此音源：' + err.message;
  }
}

// ---- 波形 / 頻譜 ----
const sc = $('#scope'), sp = $('#spec');
const tBuf = { pre: new Float32Array(4096), post: new Float32Array(4096) };
const fBuf = { pre: new Float32Array(2048), post: new Float32Array(2048) };
const dbs = (a) => 20 * Math.log10(Math.max(a, 1e-5));

function fitCanvas(c) {
  const r = c.getBoundingClientRect(), d = Math.min(devicePixelRatio, 2);
  if (c.width !== Math.round(r.width * d)) { c.width = Math.round(r.width * d); c.height = Math.round(r.height * d); }
  return d;
}
function drawScope() {
  const d = fitCanvas(sc), g = sc.getContext('2d'), W = sc.width, H = sc.height;
  g.clearRect(0, 0, W, H);
  const win = parseInt($('#zoom').value, 10), norm = $('#norm').checked;
  g.strokeStyle = '#222a38'; g.lineWidth = 1;
  for (let i = 1; i < 4; i++) { g.beginPath(); g.moveTo(0, (H * i) / 4); g.lineTo(W, (H * i) / 4); g.stroke(); }
  for (let i = 1; i < 8; i++) { g.beginPath(); g.moveTo((W * i) / 8, 0); g.lineTo((W * i) / 8, H); g.stroke(); }
  const peaks = {};
  const trace = (which, color, lw) => {
    const b = tBuf[which]; engine.time(which, b);
    let st = 0;
    for (let i = 1; i < b.length - win; i++) { if (b[i - 1] <= 0 && b[i] > 0) { st = i; break; } }
    let pk = 0; for (let i = st; i < st + win; i++) pk = Math.max(pk, Math.abs(b[i]));
    peaks[which] = pk;
    const sc2 = norm ? (pk > 0.002 ? 0.9 / pk : 1) : 1;
    g.strokeStyle = color; g.lineWidth = lw * d; g.lineJoin = 'round'; g.beginPath();
    for (let i = 0; i < win; i++) {
      const x = (i / (win - 1)) * W, y = H / 2 - clampN(b[st + i] * sc2) * (H / 2) * 0.92;
      i ? g.lineTo(x, y) : g.moveTo(x, y);
    }
    g.stroke();
  };
  trace('pre', 'rgba(150,165,190,.75)', 1.5);
  trace('post', '#ffb347', 2.2);
  $('#peak').textContent = `峰值 乾聲 ${dbs(peaks.pre).toFixed(1)} dB → 效果後 ${dbs(peaks.post).toFixed(1)} dB`;
  return peaks.post;
}
const clampN = (x) => Math.max(-1.05, Math.min(1.05, x));

const FMIN = 30, FMAX = 12000;
function drawSpec() {
  const d = fitCanvas(sp), g = sp.getContext('2d'), W = sp.width, H = sp.height;
  g.clearRect(0, 0, W, H);
  const sr = engine.ctx.sampleRate, bin = sr / 4096;
  const X = (f) => (Math.log(f / FMIN) / Math.log(FMAX / FMIN)) * W;
  g.strokeStyle = '#222a38'; g.fillStyle = '#6b7690'; g.font = `${11 * d}px system-ui`; g.lineWidth = 1;
  [100, 1000, 10000].forEach((f) => { g.beginPath(); g.moveTo(X(f), 0); g.lineTo(X(f), H); g.stroke(); g.fillText(f >= 1000 ? f / 1000 + 'k' : f, X(f) + 3, H - 4); });
  const Y = (db) => H - ((clampN2(db) + 100) / 90) * H;
  const line = (which, color, fill) => {
    const a = fBuf[which]; engine.freq(which, a);
    g.beginPath();
    let first = true;
    for (let px = 0; px < W; px += 2) {
      const f = FMIN * Math.pow(FMAX / FMIN, px / W), b0 = f / bin, b1 = (f * Math.pow(FMAX / FMIN, 2 / W)) / bin;
      let m = -120; for (let k = Math.floor(b0); k <= Math.max(Math.floor(b0), Math.floor(b1)); k++) m = Math.max(m, a[k]);
      first ? g.moveTo(px, Y(m)) : g.lineTo(px, Y(m)); first = false;
    }
    if (fill) { g.lineTo(W, H); g.lineTo(0, H); g.closePath(); g.fillStyle = fill; g.fill(); }
    g.strokeStyle = color; g.lineWidth = (fill ? 2 : 1.4) * d; g.stroke();
  };
  line('pre', 'rgba(150,165,190,.8)', null);
  line('post', '#ffb347', 'rgba(255,179,71,.18)');
}
const clampN2 = (x) => Math.max(-100, Math.min(-10, x));

// 3D 頻譜：48 個對數頻帶
function bands() {
  const a = fBuf.post, sr = engine.ctx.sampleRate, bin = sr / 4096, out = [];
  for (let i = 0; i < 48; i++) {
    const f0 = 60 * Math.pow(9000 / 60, i / 48), f1 = 60 * Math.pow(9000 / 60, (i + 1) / 48);
    let m = -120; for (let k = Math.floor(f0 / bin); k <= Math.max(Math.floor(f0 / bin), Math.floor(f1 / bin)); k++) m = Math.max(m, a[k]);
    out.push(Math.max(0, Math.min(1, (m + 90) / 60)));
  }
  return out;
}

function loop() {
  requestAnimationFrame(loop);
  if (!started) return;
  const pk = drawScope(); drawSpec();
  scene.update({ rms: Math.min(1, pk), bands: bands() });
}

// ---- 啟動 ----
$('#startBtn').onclick = async () => {
  const b = $('#startBtn'); b.disabled = true; b.textContent = '準備音訊中…';
  try {
    await engine.init();
    ORDER.forEach((id) => {
      byId[id].params.forEach((p) => engine.setParam(id, p.key, state[id].p[p.key]));
      engine.setOn(id, state[id].on);
    });
    engine.setAmpModel(state.amp.model);
    ORDER.forEach((id) => byId[id].params.forEach((p) => engine.setParam(id, p.key, state[id].p[p.key])));
    started = true;
    await useSource('riff');
    $('#start').remove();
    drawTransfer();
  } catch (e) { b.disabled = false; b.textContent = '失敗：' + e.message; console.error(e); }
};

// ---- 初始化 UI ----
buildLeft();
FX.forEach((f) => f.params.forEach((p) => scene.setParam(f.id, p.key, state[f.id].p[p.key])));
scene.setOn('amp', true);
document.querySelector('#ampBtns').dataset.ready = 1;
applyPreset(PRESETS[2]);
select('od');
loop();
