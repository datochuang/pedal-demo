// 效果器 / 音箱的資料定義（名稱、說明、旋鈕參數、預設組合）
const pct = (v) => Math.round(v * 100) + '%';
const expMap = (a, b, t) => a * Math.pow(b / a, t);

export const FX = [
  {
    id: 'comp', group: 'pre', name: '壓縮器', en: 'Compressor', short: 'COMP',
    model: '原型：MXR Dyna Comp', color: '#b8322a',
    params: [
      { key: 'sustain', label: 'SUSTAIN', def: 0.5, fmt: (v) => `門檻 ${(-12 - v * 38).toFixed(0)} dB` },
      { key: 'level', label: 'LEVEL', def: 0.5, fmt: (v) => `補償 ${(0.5 + v * 3.5).toFixed(1)}×` },
    ],
    desc: '把大聲的部分壓小、小聲的部分相對推大，音量變得平均，延音（sustain）變長，常用於清音、鄉村與 Funk。',
    how: '訊號超過門檻（Threshold）後，依壓縮比（Ratio）降低增益；再用 Makeup 增益補回整體音量，結果是「小聲的尾巴被拉高」。',
    wave: '波形的尖峰被壓低，大振幅與小振幅的差距縮小；撥弦後的衰減尾巴比原本更「肥」、更久。',
  },
  {
    id: 'wah', group: 'pre', name: 'Wah 哇音', en: 'Auto-Wah', short: 'WAH',
    model: '原型：Dunlop Cry Baby（此處以 LFO 代替腳踩）', color: '#2c2f36',
    params: [
      { key: 'freq', label: 'CENTER', def: 0.5, fmt: (v) => `${expMap(350, 1400, v).toFixed(0)} Hz` },
      { key: 'rate', label: 'RATE', def: 0.4, fmt: (v) => `${(0.3 + v * 5).toFixed(1)} Hz` },
      { key: 'depth', label: 'DEPTH', def: 0.7, fmt: pct },
    ],
    desc: '像人說「哇～」的聲音。真實的 Wah 是腳踩踏板來移動濾波器；這裡用低頻振盪器（LFO）自動來回「踩」。',
    how: '一個尖銳的峰值濾波器（Peaking Filter）中心頻率在約 400 Hz～2 kHz 之間來回掃動，被掃到的頻段會被強調。',
    wave: '波形的「亮度」隨時間變化：濾波器掃高時高頻細節增多、波形變尖；掃低時變得圓潤。頻譜上可看到一個移動的尖峰。',
  },
  {
    id: 'fuzz', group: 'pre', name: '法茲', en: 'Fuzz', short: 'FUZZ',
    model: '原型：Dallas Arbiter Fuzz Face / Big Muff', color: '#7b4fa3',
    params: [
      { key: 'drive', label: 'FUZZ', def: 0.6, fmt: (v) => `增益 ${expMap(8, 100, v).toFixed(0)}×` },
      { key: 'tone', label: 'TONE', def: 0.5, fmt: (v) => `${expMap(700, 5000, v).toFixed(0)} Hz` },
      { key: 'level', label: 'LEVEL', def: 0.4, fmt: pct },
    ],
    desc: '最原始、最「毛茸茸」的破音，Hendrix 的招牌。聲音接近方波，延音極長，像嗡嗡作響的蜂群。',
    how: '極高增益加上「不對稱」削波：正負半週被削的程度不同，會產生偶次與奇次諧波，所以比一般破音更粗糙、更厚。',
    wave: '正弦波被推成接近方波，且上下不對稱（正半週較圓、負半週較平）。看轉換曲線（Transfer Curve）就能理解。',
  },
  {
    id: 'od', group: 'pre', name: '過載', en: 'Overdrive', short: 'OD',
    model: '原型：Ibanez Tube Screamer TS9', color: '#2f9e5b',
    params: [
      { key: 'drive', label: 'DRIVE', def: 0.4, fmt: (v) => `增益 ${expMap(2, 50, v).toFixed(0)}×` },
      { key: 'tone', label: 'TONE', def: 0.5, fmt: (v) => `${expMap(800, 6400, v).toFixed(0)} Hz` },
      { key: 'level', label: 'LEVEL', def: 0.45, fmt: pct },
    ],
    desc: '模擬真空管音箱被推到飽和的溫暖破音。常被疊在音箱前面當「推力」（boost），讓音箱更緊實、中頻更突出。',
    how: '先切掉低頻（避免糊掉），放大後用二極體做「軟削波」：訊號越大壓縮得越多，但轉折圓滑。',
    wave: '波形的頂端與底端被「圓滑地壓平」，像把山峰磨圓；弱訊號幾乎不變，所以彈得輕聲音仍乾淨。',
  },
  {
    id: 'dist', group: 'pre', name: '失真', en: 'Distortion', short: 'DIST',
    model: '原型：Boss DS-1 / ProCo RAT', color: '#e8822e',
    params: [
      { key: 'drive', label: 'DIST', def: 0.55, fmt: (v) => `增益 ${expMap(5, 100, v).toFixed(0)}×` },
      { key: 'tone', label: 'TONE', def: 0.5, fmt: (v) => `${expMap(1000, 7000, v).toFixed(0)} Hz` },
      { key: 'level', label: 'LEVEL', def: 0.35, fmt: pct },
    ],
    desc: '比 Overdrive 更兇、更壓縮、更鋸齒的聲音，硬式搖滾與龐克的基礎。',
    how: '「硬削波」：訊號一超過門檻就被直接削平，轉折尖銳，產生大量高次諧波。',
    wave: '波形變成近乎梯形／方波，頂端出現平台；增益越大，平台越寬，頻譜裡的高頻諧波越多。',
  },
  {
    id: 'amp', group: 'amp', name: '音箱', en: 'Amp + Cabinet', short: 'AMP',
    model: '', color: '#222',
    params: [
      { key: 'gain', label: 'GAIN', def: 0.5, fmt: pct },
      { key: 'bass', label: 'BASS', def: 0.5, fmt: (v) => `${((v - 0.5) * 24).toFixed(0)} dB` },
      { key: 'treble', label: 'TREBLE', def: 0.5, fmt: (v) => `${((v - 0.5) * 24).toFixed(0)} dB` },
      { key: 'volume', label: 'VOLUME', def: 0.6, fmt: pct },
    ],
    desc: '',
    how: '前級管子放大並飽和（1～3 級串接）→ 音色旋鈕（EQ）→ 功率放大 → 喇叭箱體。箱體與喇叭像一個濾波器，把 5 kHz 以上的刺耳高頻切掉，並在中高頻形成特有的共振。',
    wave: '音箱的「破音」多半是不對稱軟削波，偶次諧波多，聽起來比踏板溫暖；喇叭箱體則讓波形的尖銳稜角被磨圓。',
  },
  {
    id: 'chorus', group: 'post', name: '合唱', en: 'Chorus', short: 'CHO',
    model: '原型：Boss CE-2', color: '#2e7bc4',
    params: [
      { key: 'rate', label: 'RATE', def: 0.3, fmt: (v) => `${(0.2 + v * 4).toFixed(1)} Hz` },
      { key: 'depth', label: 'DEPTH', def: 0.5, fmt: pct },
      { key: 'mix', label: 'MIX', def: 0.5, fmt: pct },
    ],
    desc: '把一把吉他變成「好幾把」，聲音變寬、變厚、有水波感。80 年代清音的標準配備。',
    how: '複製訊號，經過一條延遲時間被 LFO 緩慢調變的延遲線（音高會微微上下飄），再與原音混合 → 兩個略微失諧的聲音。',
    wave: '兩個頻率略有差異的波形疊加，會出現「拍頻」：包絡緩慢地一胖一瘦。',
  },
  {
    id: 'phaser', group: 'post', name: '相位器', en: 'Phaser', short: 'PHASE',
    model: '原型：MXR Phase 90', color: '#e0a21c',
    params: [
      { key: 'rate', label: 'RATE', def: 0.3, fmt: (v) => `${(0.1 + v * 3).toFixed(1)} Hz` },
      { key: 'depth', label: 'DEPTH', def: 0.6, fmt: pct },
      { key: 'fb', label: 'RESO', def: 0.3, fmt: pct },
    ],
    desc: '像噴射機劃過、或是旋轉的「咻～咻～」，Van Halen 早期專輯的招牌聲。',
    how: '多級「全通濾波器」只改變相位、不改變音量；與原音混合後，相位相反的頻率互相抵消，在頻譜上形成會移動的凹陷（Notch）。',
    wave: '波形外觀變化細微，但頻譜上會看到好幾條凹谷在左右掃動 —— 這是看頻譜最能體會的效果。',
  },
  {
    id: 'trem', group: 'post', name: '顫音', en: 'Tremolo', short: 'TREM',
    model: '原型：Boss TR-2 / Fender 音箱內建 Tremolo', color: '#3a3f4b',
    params: [
      { key: 'rate', label: 'RATE', def: 0.4, fmt: (v) => `${(1 + v * 11).toFixed(1)} Hz` },
      { key: 'depth', label: 'DEPTH', def: 0.7, fmt: pct },
    ],
    desc: '音量週期性地忽大忽小，像「顫動」。衝浪搖滾與老派 R&B 的味道。',
    how: '用一個 LFO 去調變音量（振幅調變 AM）。',
    wave: '最直觀的效果：波形的整體包絡（外框）隨 LFO 規律地起伏，頻率就是 Rate。',
  },
  {
    id: 'delay', group: 'post', name: '延遲', en: 'Delay', short: 'DLY',
    model: '原型：Boss DD-3 / Maxon AD9', color: '#6a6f78',
    params: [
      { key: 'time', label: 'TIME', def: 0.4, fmt: (v) => `${(80 + v * 720).toFixed(0)} ms` },
      { key: 'fb', label: 'FEEDBACK', def: 0.4, fmt: pct },
      { key: 'mix', label: 'MIX', def: 0.35, fmt: pct },
    ],
    desc: '產生一串「回音」，讓單音變成空間感與節奏。The Edge 的招牌。',
    how: '訊號進入延遲線，延遲 Time 後輸出；部分回授（Feedback）再送回入口，形成越來越小的重複。回授路徑加了低通濾波，每次回音更暗，像類比延遲。',
    wave: '同一段波形在後面一次次重複出現，振幅逐次衰減，視覺上就像波形的「殘影」。',
  },
  {
    id: 'reverb', group: 'post', name: '殘響', en: 'Reverb', short: 'REV',
    model: '原型：Strymon BlueSky / Fender 彈簧殘響', color: '#2a9d9a',
    params: [
      { key: 'decay', label: 'DECAY', def: 0.5, fmt: (v) => `${(0.4 + v * 4).toFixed(1)} s` },
      { key: 'damp', label: 'DAMP', def: 0.5, fmt: pct },
      { key: 'mix', label: 'MIX', def: 0.3, fmt: pct },
    ],
    desc: '模擬房間、大廳、教堂的空間感。聲音彷彿被放進一個空間裡。',
    how: '用一段「脈衝響應（Impulse Response）」與訊號做卷積（Convolution）：每一個取樣都被複製成一串密集且衰減的反射。Damp 越高，高頻衰減越快，空間越「悶」。',
    wave: '密集的反射疊加，使波形的衰減尾巴被拖長、邊緣變模糊；頻譜的缺口被填平。',
  },
];

// 音箱型號。stages：前級增益級（fn: 削波函式名稱）；g 為固定增益，null 代表由 GAIN 旋鈕控制
export const AMPS = {
  fender: {
    key: 'fender', btn: 'Twin', name: 'BLACKFACE TWIN', ref: '原型：Fender Twin Reverb（1965）',
    desc: '最具代表性的「清音」音箱。大功率、很高的乾淨空間（headroom），聲音透亮、低頻紮實、高頻閃亮，爵士、鄉村、藍調與清音搖滾都愛用。',
    stages: [{ g: null, fn: 'tube' }], gain: [0.7, 4], midHz: 500, midDb: -5, trebleHz: 3200, bassOff: 0, trebleOff: 2,
    cab: { hp: 70, lp: 5800, peakHz: 3000, peakDb: 2, peakQ: 1.0 }, trim: 0.35,
    defaults: { gain: 0.25, bass: 0.5, treble: 0.55, volume: 0.6 },
    look: { tolex: '#101010', grille: '#8f9ba4', panel: '#c4c9ce', text: '#111', knob: '#1a1a1a', pattern: 'weave' },
  },
  vox: {
    key: 'vox', btn: 'AC30', name: 'TOP-BOOST 30', ref: '原型：Vox AC30（1960s）',
    desc: '英倫入侵（British Invasion）的聲音。Class A 功放使中高頻特別「叮噹」（chime），輕度推動時有迷人的帶狀失真，Beatles、Queen、U2 都是它。',
    stages: [{ g: null, fn: 'tube' }, { g: 1.8, fn: 'tube' }], gain: [1, 12], midHz: 1500, midDb: 4, trebleHz: 3500, bassOff: -2, trebleOff: 3,
    cab: { hp: 95, lp: 6500, peakHz: 3500, peakDb: 3, peakQ: 1.2 }, trim: 0.26,
    defaults: { gain: 0.5, bass: 0.45, treble: 0.6, volume: 0.6 },
    look: { tolex: '#262019', grille: '#b99a58', panel: '#151515', text: '#d6b45f', knob: '#cfcfcf', pattern: 'diamond' },
  },
  marshall: {
    key: 'marshall', btn: 'Plexi', name: 'BRITISH PLEXI', ref: '原型：Marshall Super Lead 1959「Plexi」（1960s）',
    desc: '搖滾樂的聲音。中頻厚實、高頻帶「咬勁」，推高增益時產生豐富的破音。Hendrix、Led Zeppelin、AC/DC 的牆就是它。',
    stages: [{ g: null, fn: 'tube' }, { g: 2.5, fn: 'tube' }], gain: [2, 30], midHz: 750, midDb: 3, trebleHz: 3200, bassOff: 0, trebleOff: 1,
    cab: { hp: 90, lp: 5200, peakHz: 2200, peakDb: 3, peakQ: 1.0 }, trim: 0.19,
    defaults: { gain: 0.6, bass: 0.5, treble: 0.6, volume: 0.6 },
    look: { tolex: '#0c0c0c', grille: '#171717', panel: '#c9a23c', text: '#111', knob: '#f0efe6', pattern: 'basket' },
  },
  mesa: {
    key: 'mesa', btn: 'Recto', name: 'DUAL RECTIFIER', ref: '原型：Mesa/Boogie Dual Rectifier（1990s）',
    desc: '現代重金屬的標準。多級高增益串接、低頻很緊、中頻凹陷（scooped）、高頻細膩而有顆粒。Metallica、Foo Fighters 這類厚重的牆。',
    stages: [{ g: null, fn: 'tubeHard' }, { g: 3, fn: 'tubeHard' }, { g: 3, fn: 'tubeHard' }], gain: [4, 60], midHz: 650, midDb: -6, trebleHz: 3600, bassOff: 5, trebleOff: 3,
    cab: { hp: 80, lp: 4800, peakHz: 3000, peakDb: 2, peakQ: 0.9 }, trim: 0.14,
    defaults: { gain: 0.7, bass: 0.55, treble: 0.55, volume: 0.55 },
    look: { tolex: '#131313', grille: '#262626', panel: '#222428', text: '#cfd3d8', knob: '#bfc4ca', pattern: 'mesh' },
  },
};

export const PRESETS = [
  { name: '乾淨 Clean', amp: 'fender', on: { comp: { sustain: 0.3, level: 0.5 }, reverb: { decay: 0.45, damp: 0.5, mix: 0.25 } } },
  { name: '藍調 Blues', amp: 'fender', on: { od: { drive: 0.35, tone: 0.5, level: 0.5 }, reverb: { decay: 0.4, damp: 0.5, mix: 0.25 } }, ampP: { gain: 0.4 } },
  { name: '搖滾 Rock', amp: 'marshall', on: { od: { drive: 0.2, tone: 0.55, level: 0.6 } }, ampP: { gain: 0.6 } },
  { name: '金屬 Metal', amp: 'mesa', on: { od: { drive: 0.25, tone: 0.55, level: 0.7 } }, ampP: { gain: 0.75, bass: 0.55 } },
  { name: '迷幻 Psychedelic', amp: 'vox', on: { fuzz: { drive: 0.55, tone: 0.5, level: 0.4 }, phaser: { rate: 0.25, depth: 0.7, fb: 0.5 }, delay: { time: 0.5, fb: 0.5, mix: 0.3 }, reverb: { decay: 0.6, damp: 0.5, mix: 0.3 } } },
  { name: '空靈 Ambient', amp: 'fender', on: { comp: { sustain: 0.5, level: 0.5 }, chorus: { rate: 0.2, depth: 0.6, mix: 0.5 }, delay: { time: 0.6, fb: 0.6, mix: 0.45 }, reverb: { decay: 0.85, damp: 0.6, mix: 0.5 } } },
  { name: '放克 Funk', amp: 'fender', on: { comp: { sustain: 0.6, level: 0.55 }, wah: { freq: 0.5, rate: 0.55, depth: 0.8 } }, ampP: { gain: 0.3 } },
];
