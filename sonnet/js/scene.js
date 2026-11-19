// Three.js 3D 場景：踏板板、音箱、3D 頻譜；旋鈕可拖曳、踩釘可點擊
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const FONT = '"PingFang TC","Noto Sans TC","Microsoft JhengHei",system-ui,sans-serif';
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const ang = (v) => THREE.MathUtils.degToRad(-135 + v * 270);

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}
function textSprite(text, scale = 1) {
  const t = canvasTex(512, 96, (g, w, h) => {
    g.font = `600 36px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = 'rgba(180,200,230,.85)'; g.fillText(text, w / 2, h / 2);
  });
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false }));
  s.scale.set(5.3 * scale, 1 * scale, 1);
  return s;
}

export function createScene(host, FX, AMPS, hooks) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0c11);
  scene.fog = new THREE.Fog(0x0a0c11, 18, 40);
  scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.55;

  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
  camera.position.set(0, 5.6, 9.6);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 0.9, -0.2);
  controls.enableDamping = true; controls.maxPolarAngle = 1.45; controls.minDistance = 4; controls.maxDistance = 20;

  scene.add(new THREE.HemisphereLight(0xaab8ff, 0x201810, 0.5));
  const sun = new THREE.DirectionalLight(0xfff1dd, 2.2);
  sun.position.set(4, 10, 7); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 30 });
  sun.shadow.bias = -0.0004;
  scene.add(sun);
  const rim = new THREE.PointLight(0x4d7cff, 40, 18); rim.position.set(-6, 4, -2); scene.add(rim);

  // 地板與板子
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.MeshStandardMaterial({ color: 0x141821, roughness: 0.9 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  const board = new THREE.Mesh(new THREE.BoxGeometry(7.6, 0.12, 4.3), new THREE.MeshStandardMaterial({ color: 0x1d222d, roughness: 0.8 }));
  board.position.set(0, 0.06, 1.5); board.receiveShadow = true; board.castShadow = true; scene.add(board);

  const pickables = [];
  const items = {}; // id -> { group, knobs:{key:Group}, led, outline }
  const mark = (obj, data) => { obj.traverse((o) => { o.userData = { ...o.userData, ...data }; }); };

  function addKnob(parent, id, key, x, y, z, axis, look) {
    const g = new THREE.Group(); g.position.set(x, y, z);
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.13, 0.15, 0.16, 28),
      new THREE.MeshStandardMaterial({ color: look || 0x1b1b1b, roughness: 0.35, metalness: 0.6 }));
    body.castShadow = true;
    const dot = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.01, 0.1), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    dot.position.set(0, 0.085, -0.045);
    const inner = new THREE.Group(); inner.add(body, dot);
    g.add(inner);
    if (axis === 'z') { g.rotation.x = Math.PI / 2; dot.position.set(0, 0.085, -0.045); }
    parent.add(g);
    mark(g, { type: 'knob', id, key });
    pickables.push(g);
    return inner;
  }

  function outlineFor(w, h, d, y) {
    const l = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(w, h, d)), new THREE.LineBasicMaterial({ color: 0x59d8ff }));
    l.position.y = y; l.visible = false;
    return l;
  }

  // ---- 踏板 ----
  function makePedal(def, x, z) {
    const g = new THREE.Group(); g.position.set(x, 0.12, z);
    const W = 1.05, H = 0.42, D = 1.75;
    const nk = def.params.length;
    const kx = nk === 1 ? [0] : nk === 2 ? [-0.24, 0.24] : [-0.3, 0, 0.3];
    const tex = canvasTex(512, 854, (c, w, h) => {
      const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, def.color); gr.addColorStop(1, '#0003');
      c.fillStyle = def.color; c.fillRect(0, 0, w, h);
      c.fillStyle = gr; c.fillRect(0, 0, w, h);
      c.fillStyle = 'rgba(255,255,255,.9)'; c.textAlign = 'center';
      c.font = `700 74px ${FONT}`; c.fillText(def.name, w / 2, h * 0.5);
      c.font = `600 40px ${FONT}`; c.fillText(def.en.toUpperCase(), w / 2, h * 0.5 + 56);
      c.font = `400 26px ${FONT}`; c.fillStyle = 'rgba(255,255,255,.7)';
      const m = def.model.replace('原型：', '').split('（')[0];
      c.fillText(m.length > 30 ? m.slice(0, 30) + '…' : m, w / 2, h * 0.5 + 100);
      c.font = `600 28px ${FONT}`; c.fillStyle = '#fff';
      def.params.forEach((p, i) => c.fillText(p.label, w / 2 + kx[i] * (w / W), ((-0.6 + 0.27 + D / 2) / D) * h));
    });
    const body = new THREE.Mesh(new THREE.BoxGeometry(W, H, D), new THREE.MeshStandardMaterial({ color: def.color, roughness: 0.5, metalness: 0.3 }));
    body.position.y = H / 2; body.castShadow = true; body.receiveShadow = true;
    const top = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.02, D - 0.02), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.45, metalness: 0.15 }));
    top.rotation.x = -Math.PI / 2; top.position.y = H + 0.002; top.receiveShadow = true;
    g.add(body, top);
    mark(body, { type: 'body', id: def.id }); mark(top, { type: 'body', id: def.id });
    pickables.push(body, top);

    const knobs = {};
    def.params.forEach((p, i) => { knobs[p.key] = addKnob(g, def.id, p.key, kx[i], H + 0.08, -0.6, 'y'); });

    const sw = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.2, 32), new THREE.MeshStandardMaterial({ color: 0xcfd3d8, roughness: 0.25, metalness: 0.95 }));
    sw.position.set(0, H + 0.1, 0.55); sw.castShadow = true;
    g.add(sw); mark(sw, { type: 'switch', id: def.id }); pickables.push(sw);

    const led = new THREE.Mesh(new THREE.SphereGeometry(0.055, 16, 12), new THREE.MeshStandardMaterial({ color: 0x300000, emissive: 0xff2a2a, emissiveIntensity: 0.05 }));
    led.position.set(0, H + 0.03, 0.2); g.add(led);

    const outline = outlineFor(W + 0.14, H + 0.14, D + 0.14, H / 2); g.add(outline);
    scene.add(g);
    items[def.id] = { group: g, knobs, led, outline, selW: 1 };
    return g;
  }

  const pre = FX.filter((f) => f.group === 'pre'), post = FX.filter((f) => f.group === 'post');
  const Z1 = 2.4, Z2 = 0.55, sx = (i) => -2.6 + 1.3 * i;
  pre.forEach((d, i) => makePedal(d, sx(i), Z1));
  post.forEach((d, i) => makePedal(d, sx(i), Z2));

  // 線材
  const cableMat = new THREE.MeshStandardMaterial({ color: 0x0c0c0e, roughness: 0.6 });
  function cable(pts) {
    const m = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)), false, 'catmullrom', 0.3), 64, 0.035, 8), cableMat);
    m.castShadow = true; scene.add(m);
  }
  for (let i = 0; i < 4; i++) {
    cable([[sx(i) + 0.55, 0.4, Z1], [sx(i) + 0.65, 0.3, Z1], [sx(i + 1) - 0.65, 0.3, Z1], [sx(i + 1) - 0.55, 0.4, Z1]]);
    cable([[sx(i) + 0.55, 0.4, Z2], [sx(i) + 0.65, 0.3, Z2], [sx(i + 1) - 0.65, 0.3, Z2], [sx(i + 1) - 0.55, 0.4, Z2]]);
  }
  cable([[sx(4) + 0.55, 0.4, Z1], [3.4, 0.18, Z1], [3.5, 0.16, 0.2], [3.4, 0.16, -2.0], [2.3, 0.3, -2.7]]);
  cable([[-2.3, 0.3, -2.7], [-3.4, 0.16, -2.0], [-3.5, 0.16, 0.2], [-3.4, 0.2, Z2], [sx(0) - 0.55, 0.4, Z2]]);
  cable([[-4.8, 0.05, 4.4], [-4.0, 0.1, 3.4], [-3.4, 0.18, Z1], [sx(0) - 0.55, 0.4, Z1]]);

  const s1 = textSprite('🎸 吉他輸入 → 前級踏板', 0.7); s1.position.set(-1.6, 0.05, 3.9); scene.add(s1);
  
  // ---- 音箱 ----
  const ampG = new THREE.Group(); ampG.position.set(0, 0, -3.5); scene.add(ampG);
  const cabMats = ['px', 'nx', 'py', 'ny', 'pz', 'nz'].map(() => new THREE.MeshStandardMaterial({ color: 0x101010, roughness: 0.85 }));
  const cab = new THREE.Mesh(new THREE.BoxGeometry(4.2, 2.0, 1.3), cabMats);
  cab.position.y = 1.0; cab.castShadow = true; cab.receiveShadow = true;
  const headMats = ['px', 'nx', 'py', 'ny', 'pz', 'nz'].map(() => new THREE.MeshStandardMaterial({ color: 0x101010, roughness: 0.85 }));
  const head = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.95, 1.1), headMats);
  head.position.set(0, 2.475, -0.1); head.castShadow = true;
  ampG.add(cab, head);
  mark(cab, { type: 'body', id: 'amp' }); mark(head, { type: 'body', id: 'amp' });
  pickables.push(cab, head);

  const panelMat = new THREE.MeshStandardMaterial({ roughness: 0.5, metalness: 0.2 });
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(4.0, 0.8), panelMat);
  panel.position.set(0, 2.475, 0.452); ampG.add(panel);
  mark(panel, { type: 'body', id: 'amp' }); pickables.push(panel);
  const grilleMat = cabMats[4]; // 前面

  const ampDef = FX.find((f) => f.id === 'amp');
  const ampKnobs = {};
  const kxA = [-1.35, -0.45, 0.45, 1.35];
  const knobMats = [];
  ampDef.params.forEach((p, i) => {
    const k = addKnob(ampG, 'amp', p.key, kxA[i], 2.55, 0.5, 'z', 0x1a1a1a);
    ampKnobs[p.key] = k; knobMats.push(k.children[0].material);
  });
  const pilot = new THREE.Mesh(new THREE.SphereGeometry(0.06, 16, 12), new THREE.MeshStandardMaterial({ color: 0x300000, emissive: 0xff3322, emissiveIntensity: 0.05 }));
  pilot.position.set(1.8, 2.7, 0.46); ampG.add(pilot);
  const ampOutline = outlineFor(4.5, 3.6, 1.7, 1.75); ampOutline.position.z = -0.05; ampG.add(ampOutline);
  items.amp = { group: ampG, knobs: ampKnobs, led: pilot, outline: ampOutline };

  function drawGrille(look) {
    return canvasTex(1024, 512, (c, w, h) => {
      c.fillStyle = look.grille; c.fillRect(0, 0, w, h);
      c.strokeStyle = 'rgba(0,0,0,.28)'; c.lineWidth = 2;
      if (look.pattern === 'weave') { for (let x = 0; x < w; x += 6) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke(); } for (let y = 0; y < h; y += 6) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); } }
      if (look.pattern === 'diamond') { c.strokeStyle = 'rgba(70,45,10,.55)'; c.lineWidth = 3; for (let i = -h; i < w; i += 28) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i + h, h); c.stroke(); c.beginPath(); c.moveTo(i + h, 0); c.lineTo(i, h); c.stroke(); } }
      if (look.pattern === 'basket') { c.strokeStyle = '#2d2d2d'; c.lineWidth = 3; for (let x = 0; x < w; x += 12) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke(); } for (let y = 0; y < h; y += 12) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); } c.strokeStyle = '#c9a23c'; c.lineWidth = 6; c.strokeRect(10, 10, w - 20, h - 20); }
      if (look.pattern === 'mesh') { c.strokeStyle = '#7d848c'; c.lineWidth = 2; for (let x = 0; x < w; x += 18) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke(); } for (let y = 0; y < h; y += 18) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); } c.strokeStyle = '#aab'; c.lineWidth = 10; c.strokeRect(5, 5, w - 10, h - 10); }
      if (look.pattern === 'none') { c.fillStyle = '#1a1a1a'; c.fillRect(0, 0, w, h); }
      // 喇叭輪廓暗示
      c.fillStyle = 'rgba(0,0,0,.12)';
      [w * 0.27, w * 0.73].forEach((cx) => { c.beginPath(); c.arc(cx, h / 2, h * 0.42, 0, 7); c.fill(); });
    });
  }
  function drawPanel(look, name, ref) {
    return canvasTex(1024, 205, (c, w, h) => {
      c.fillStyle = look.panel; c.fillRect(0, 0, w, h);
      c.fillStyle = 'rgba(0,0,0,.18)'; c.fillRect(0, h - 10, w, 10);
      c.fillStyle = look.text; c.textAlign = 'center';
      c.font = `800 34px ${FONT}`; c.fillText(name, w * 0.5, 44);
      c.font = `700 20px ${FONT}`;
      ampDef.params.forEach((p, i) => c.fillText(p.label, ((kxA[i] + 2.0) / 4.0) * w, h - 22));
    });
  }
  function setAmpModel(key) {
    const m = key ? AMPS[key] : null;
    const look = m ? m.look : { tolex: '#1c1c1c', grille: '#1f1f1f', panel: '#2b2b2b', text: '#777', knob: '#333', pattern: 'none' };
    const name = m ? m.name : '直接輸出 DIRECT';
    [...cabMats, ...headMats].forEach((mt) => mt.color.set(look.tolex));
    if (grilleMat.map) grilleMat.map.dispose();
    grilleMat.map = drawGrille(look); grilleMat.color.set(0xffffff); grilleMat.needsUpdate = true;
    if (panelMat.map) panelMat.map.dispose();
    panelMat.map = drawPanel(look, name); panelMat.needsUpdate = true;
    knobMats.forEach((k) => k.color.set(look.knob));
  }
  setAmpModel('marshall');

  // ---- 3D 頻譜長條 ----
  const NB = 48, bars = [];
  const barGeo = new THREE.BoxGeometry(0.1, 1, 0.12);
  for (let i = 0; i < NB; i++) {
    const m = new THREE.Mesh(barGeo, new THREE.MeshBasicMaterial({ color: 0x59d8ff, transparent: true, opacity: 0.85 }));
    m.position.set(-3.0 + (6.0 * i) / (NB - 1), 0.02, -1.55);
    m.scale.y = 0.04; scene.add(m); bars.push(m);
  }
  const s3 = textSprite('輸出頻譜（低 → 高頻）', 0.6); s3.position.set(0, 0.25, -1.0); scene.add(s3);

  // ---- 互動 ----
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  function pick(e) {
    const r = renderer.domElement.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hits = ray.intersectObjects(pickables, true);
    for (const h of hits) { let o = h.object; while (o) { if (o.userData && o.userData.type) return o.userData; o = o.parent; } }
    return null;
  }
  let drag = null, down = null;
  const el = renderer.domElement;
  el.addEventListener('pointerdown', (e) => {
    const h = pick(e);
    down = { x: e.clientX, y: e.clientY, h };
    if (h && h.type === 'knob') {
      drag = { id: h.id, key: h.key, y: e.clientY, v: hooks.getParam(h.id, h.key) };
      controls.enabled = false; el.setPointerCapture(e.pointerId);
      hooks.onSelect(h.id);
    }
  });
  el.addEventListener('pointermove', (e) => {
    if (drag) {
      hooks.onParam(drag.id, drag.key, clamp(drag.v + (drag.y - e.clientY) / 180, 0, 1), 'scene');
      return;
    }
    const h = pick(e);
    el.style.cursor = h ? (h.type === 'knob' ? 'ns-resize' : 'pointer') : 'grab';
  });
  const end = (e) => {
    if (drag) { drag = null; controls.enabled = true; }
    else if (down && down.h && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 5) {
      if (down.h.type === 'switch') { hooks.onToggle(down.h.id); hooks.onSelect(down.h.id); }
      else if (down.h.type === 'body') hooks.onSelect(down.h.id);
    }
    down = null;
  };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', () => { drag = null; controls.enabled = true; down = null; });

  function resize() {
    const w = host.clientWidth, h = host.clientHeight;
    renderer.setSize(w, h); camera.aspect = w / h;
    // 窄螢幕時把相機拉遠一點
    camera.fov = w / h < 1 ? 60 : 42;
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(host); resize();

  let rmsS = 0;
  renderer.setAnimationLoop(() => { controls.update(); renderer.render(scene, camera); });

  return {
    setOn(id, on) {
      const it = items[id]; if (!it) return;
      it.led.material.emissiveIntensity = on ? 2.2 : 0.05;
      it.led.material.color.set(on ? 0xff6655 : 0x300000);
    },
    setParam(id, key, v) { const k = items[id] && items[id].knobs[key]; if (k) k.rotation[id === 'amp' ? 'y' : 'y'] = -ang(v); },
    setSelected(id) { Object.entries(items).forEach(([k, it]) => { it.outline.visible = k === id; }); },
    setAmpModel,
    update({ rms, bands }) {
      for (let i = 0; i < NB; i++) {
        const v = bands[i];
        bars[i].scale.y = 0.04 + v * 1.7;
        bars[i].position.y = bars[i].scale.y / 2;
        bars[i].material.color.setHSL(0.58 - 0.58 * v, 0.9, 0.35 + 0.3 * v);
      }
      rmsS = rmsS * 0.8 + rms * 0.2;
      const s = 1 + rmsS * 0.06;
      cab.scale.set(s, 1 + rmsS * 0.01, s);
      ampG.position.y = Math.sin(performance.now() / 18) * rmsS * 0.01;
    },
  };
}
