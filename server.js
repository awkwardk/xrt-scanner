const http = require('http');
const https = require('https');

const PORT = process.env.PORT || 3000;
const API_KEY = process.env.ANTHROPIC_API_KEY || '';

const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="theme-color" content="#000000">
<title>XRT Floor Scanner</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Mono:wght@400;500&family=Barlow:wght@400;600;700;900&display=swap" rel="stylesheet">
<style>
:root {
  --bg: #111;
  --surface: #1a1a1a;
  --border: #2c2c2c;
  --text: #f2f2f2;
  --muted: #555;
  --accent: #e8ff00;
  --keep: #00e676;
  --recycle: #ff1744;
  --keep-dark: #003d1a;
  --recycle-dark: #4a000e;
  --display: 'Bebas Neue', sans-serif;
  --body: 'Barlow', sans-serif;
  --mono: 'DM Mono', monospace;
}
* { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }
html, body { height: 100%; overflow: hidden; background: #000; font-family: var(--body); color: var(--text); user-select: none; touch-action: manipulation; }

.screen { position: fixed; inset: 0; display: none; flex-direction: column; }
.screen.active { display: flex; }

#scannerScreen { background: #000; }

#videoEl {
  position: absolute; inset: 0;
  width: 100%; height: 100%;
  object-fit: cover;
}

.vf-overlay { position: absolute; inset: 0; pointer-events: none; }
.vf-corner {
  position: absolute; width: 32px; height: 32px;
  border-color: var(--accent); border-style: solid; opacity: 0.85;
}
.vf-corner.tl { top: 22%; left: 10%; border-width: 3px 0 0 3px; }
.vf-corner.tr { top: 22%; right: 10%; border-width: 3px 3px 0 0; }
.vf-corner.bl { bottom: 30%; left: 10%; border-width: 0 0 3px 3px; }
.vf-corner.br { bottom: 30%; right: 10%; border-width: 0 3px 3px 0; }

.scan-line {
  position: absolute; left: 10%; right: 10%; height: 2px;
  background: linear-gradient(90deg, transparent, var(--accent), transparent);
  top: 22%; opacity: 0;
  animation: scanAnim 2.4s ease-in-out infinite;
}
.scan-line.active { opacity: 1; }
@keyframes scanAnim { 0% { top: 22%; } 50% { top: 70%; } 100% { top: 22%; } }

.scanner-topbar {
  position: absolute; top: 0; left: 0; right: 0;
  padding: 16px 18px 12px;
  display: flex; align-items: center; justify-content: space-between;
  background: linear-gradient(to bottom, rgba(0,0,0,0.88), transparent);
  z-index: 10;
}
.topbar-brand { font-family: var(--display); font-size: 1.6rem; letter-spacing: 0.06em; color: #fff; line-height: 1; }
.topbar-brand span { color: var(--accent); }
.topbar-right { display: flex; gap: 10px; align-items: center; }
.icon-btn {
  width: 40px; height: 40px; border-radius: 50%;
  background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.15);
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; backdrop-filter: blur(8px); transition: background 0.15s;
}
.icon-btn:active { background: rgba(255,255,255,0.28); }

.status-pill {
  position: absolute; bottom: 28%; left: 50%; transform: translateX(-50%);
  background: rgba(0,0,0,0.72); border: 1px solid rgba(255,255,255,0.1);
  backdrop-filter: blur(12px); border-radius: 100px;
  padding: 8px 20px;
  font-family: var(--mono); font-size: 0.65rem; letter-spacing: 0.12em;
  text-transform: uppercase; color: var(--muted); white-space: nowrap;
  transition: all 0.2s; z-index: 10;
}
.status-pill.scanning { color: var(--accent); border-color: rgba(232,255,0,0.35); }
.status-pill.analyzing { color: #fff; }

.scanner-bottombar {
  position: absolute; bottom: 0; left: 0; right: 0;
  padding: 16px 24px calc(env(safe-area-inset-bottom) + 18px);
  background: linear-gradient(to top, rgba(0,0,0,0.92), transparent);
  z-index: 10; display: flex; align-items: center; justify-content: space-between;
}
.threshold-display { display: flex; flex-direction: column; }
.threshold-display .label { font-family: var(--mono); font-size: 0.55rem; color: var(--muted); letter-spacing: 0.1em; text-transform: uppercase; }
.threshold-display .value { font-family: var(--display); font-size: 1.8rem; color: var(--accent); line-height: 1; }

.scan-btn {
  width: 72px; height: 72px; border-radius: 50%;
  background: #fff; border: 3px solid rgba(255,255,255,0.25);
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; transition: transform 0.1s, background 0.1s; position: relative;
}
.scan-btn::after {
  content: ''; position: absolute; inset: -7px;
  border-radius: 50%; border: 2px solid rgba(255,255,255,0.18);
}
.scan-btn:active { transform: scale(0.91); background: #e8e8e8; }
.scan-btn svg { width: 30px; height: 30px; }

.sound-toggle { display: flex; flex-direction: column; align-items: flex-end; }
.sound-toggle .label { font-family: var(--mono); font-size: 0.55rem; color: var(--muted); letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 4px; }
.pack-btn {
  background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.14);
  border-radius: 5px; padding: 5px 12px;
  font-family: var(--mono); font-size: 0.62rem; color: #ccc;
  cursor: pointer; letter-spacing: 0.06em; transition: all 0.15s;
}
.pack-btn:active { background: rgba(255,255,255,0.22); }

#resultScreen { z-index: 50; justify-content: center; align-items: center; }
#resultScreen.keep { background: var(--keep-dark); }
#resultScreen.recycle { background: var(--recycle-dark); }

.result-glow {
  position: absolute; inset: 0; pointer-events: none;
  opacity: 0; transition: opacity 0.2s;
}
#resultScreen.keep .result-glow { background: radial-gradient(ellipse at center, rgba(0,230,118,0.18) 0%, transparent 70%); opacity: 1; }
#resultScreen.recycle .result-glow { background: radial-gradient(ellipse at center, rgba(255,23,68,0.18) 0%, transparent 70%); opacity: 1; }

.result-inner {
  position: relative; z-index: 2;
  display: flex; flex-direction: column; align-items: center;
  padding: 0 28px; text-align: center; width: 100%;
}
.result-verdict-word {
  font-family: var(--display);
  font-size: clamp(5.5rem, 24vw, 10rem);
  line-height: 0.88; letter-spacing: 0.03em;
  animation: verdictPop 0.32s cubic-bezier(0.34,1.56,0.64,1) both;
}
#resultScreen.keep .result-verdict-word { color: var(--keep); }
#resultScreen.recycle .result-verdict-word { color: var(--recycle); }
@keyframes verdictPop { from { transform: scale(0.65); opacity: 0; } to { transform: scale(1); opacity: 1; } }

.result-divider { width: 48px; height: 2px; margin: 14px auto; opacity: 0.35; }
#resultScreen.keep .result-divider { background: var(--keep); }
#resultScreen.recycle .result-divider { background: var(--recycle); }

.result-item-name {
  font-size: 1.1rem; font-weight: 700; line-height: 1.3;
  color: rgba(255,255,255,0.88); max-width: 300px;
  animation: fadeUp 0.36s 0.12s both;
}
.result-price {
  font-family: var(--display); font-size: 2.8rem; margin-top: 10px;
  animation: fadeUp 0.36s 0.2s both;
}
#resultScreen.keep .result-price { color: var(--keep); }
#resultScreen.recycle .result-price { color: var(--recycle); }

.result-price-label {
  font-family: var(--mono); font-size: 0.58rem; letter-spacing: 0.14em;
  color: rgba(255,255,255,0.38); text-transform: uppercase; margin-top: -2px;
  animation: fadeUp 0.36s 0.24s both;
}
.result-reason {
  margin-top: 16px; font-size: 0.88rem; color: rgba(255,255,255,0.48);
  max-width: 280px; line-height: 1.55; animation: fadeUp 0.36s 0.28s both;
}
@keyframes fadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }

.result-countdown {
  position: absolute; bottom: 44px; left: 50%; transform: translateX(-50%);
  display: flex; flex-direction: column; align-items: center; gap: 8px;
}
.countdown-bar-track { width: 130px; height: 3px; background: rgba(255,255,255,0.1); border-radius: 2px; overflow: hidden; }
.countdown-bar { height: 100%; border-radius: 2px; }
#resultScreen.keep .countdown-bar { background: var(--keep); }
#resultScreen.recycle .countdown-bar { background: var(--recycle); }
.countdown-label { font-family: var(--mono); font-size: 0.58rem; letter-spacing: 0.1em; color: rgba(255,255,255,0.28); text-transform: uppercase; }

#loadingScreen { background: #080808; z-index: 40; justify-content: center; align-items: center; gap: 22px; }
.loading-ring { width: 60px; height: 60px; border-radius: 50%; border: 2px solid var(--border); border-top-color: var(--accent); animation: spin 0.72s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.loading-info { text-align: center; }
.loading-step { font-family: var(--display); font-size: 1.5rem; letter-spacing: 0.05em; color: #fff; margin-bottom: 5px; }
.loading-sub { font-family: var(--mono); font-size: 0.6rem; color: var(--muted); letter-spacing: 0.1em; text-transform: uppercase; }

#settingsPanel {
  position: fixed; bottom: 0; left: 0; right: 0;
  background: var(--surface); border-top: 1px solid var(--border);
  border-radius: 20px 20px 0 0;
  padding: 18px 24px calc(env(safe-area-inset-bottom) + 28px);
  z-index: 100; transform: translateY(100%);
  transition: transform 0.3s cubic-bezier(0.32,0.72,0,1);
}
#settingsPanel.open { transform: translateY(0); }
.settings-handle { width: 40px; height: 4px; background: var(--border); border-radius: 2px; margin: 0 auto 22px; }
.settings-title { font-family: var(--display); font-size: 1.6rem; letter-spacing: 0.04em; margin-bottom: 26px; }
.setting-row { margin-bottom: 28px; }
.setting-label {
  font-family: var(--mono); font-size: 0.6rem; letter-spacing: 0.12em;
  text-transform: uppercase; color: var(--muted); margin-bottom: 12px;
  display: flex; justify-content: space-between; align-items: center;
}
.setting-label span { font-size: 0.8rem; color: var(--accent); font-family: var(--display); letter-spacing: 0.06em; }
.threshold-slider { width: 100%; -webkit-appearance: none; appearance: none; height: 4px; background: var(--border); border-radius: 2px; outline: none; }
.threshold-slider::-webkit-slider-thumb { -webkit-appearance: none; width: 24px; height: 24px; border-radius: 50%; background: var(--accent); cursor: pointer; border: 3px solid #000; box-shadow: 0 0 0 2px var(--accent); }
.sound-pack-options { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.pack-option { border: 1.5px solid var(--border); border-radius: 10px; padding: 14px 16px; cursor: pointer; transition: all 0.15s; }
.pack-option.selected { border-color: var(--accent); background: rgba(232,255,0,0.06); }
.pack-option-name { font-weight: 700; font-size: 0.95rem; margin-bottom: 5px; }
.pack-option-desc { font-family: var(--mono); font-size: 0.58rem; color: var(--muted); line-height: 1.5; }
.pack-option.selected .pack-option-name { color: var(--accent); }
.settings-close {
  width: 100%; margin-top: 6px; padding: 15px;
  background: var(--border); border: none; border-radius: 10px;
  font-family: var(--display); font-size: 1.15rem; letter-spacing: 0.06em;
  color: var(--text); cursor: pointer; transition: background 0.15s;
}
.settings-close:active { background: #3c3c3c; }
.settings-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.65); z-index: 99; display: none; backdrop-filter: blur(3px); }
.settings-backdrop.open { display: block; }

.manual-hint {
  position: absolute; top: 74%; left: 50%; transform: translateX(-50%);
  font-family: var(--mono); font-size: 0.58rem; color: rgba(255,255,255,0.22);
  letter-spacing: 0.08em; text-transform: uppercase; white-space: nowrap; z-index: 10;
}
</style>
</head>
<body>

<div class="screen active" id="scannerScreen">
  <video id="videoEl" autoplay playsinline muted></video>
  <canvas id="captureCanvas" style="display:none"></canvas>

  <div class="vf-overlay">
    <div class="vf-corner tl"></div>
    <div class="vf-corner tr"></div>
    <div class="vf-corner bl"></div>
    <div class="vf-corner br"></div>
    <div class="scan-line" id="scanLine"></div>
  </div>

  <div class="scanner-topbar">
    <div class="topbar-brand">XRT<span>·</span>SCAN</div>
    <div class="topbar-right">
      <div class="icon-btn" onclick="openSettings()">
        <svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.8" width="18" height="18">
          <circle cx="12" cy="12" r="3"/>
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
        </svg>
      </div>
    </div>
  </div>

  <div class="status-pill" id="statusPill">Starting camera...</div>
  <div class="manual-hint">Or tap button to scan manually</div>

  <div class="scanner-bottombar">
    <div class="threshold-display">
      <div class="label">Min Value</div>
      <div class="value" id="thresholdDisplay">$30</div>
    </div>
    <div class="scan-btn" id="scanBtn" onclick="triggerManualScan()">
      <svg viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="2.2" width="30" height="30">
        <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
      </svg>
    </div>
    <div class="sound-toggle">
      <div class="label">Sound Pack</div>
      <div class="pack-btn" id="packToggleBtn" onclick="cycleSoundPack()">PACK 1</div>
    </div>
  </div>
</div>

<div class="screen" id="loadingScreen">
  <div class="loading-ring"></div>
  <div class="loading-info">
    <div class="loading-step" id="loadingStep">Identifying item...</div>
    <div class="loading-sub" id="loadingSub">Checking eBay sold listings</div>
  </div>
</div>

<div class="screen" id="resultScreen" onclick="dismissResult()">
  <div class="result-glow"></div>
  <div class="result-inner">
    <div class="result-verdict-word" id="resultVerdict">KEEP</div>
    <div class="result-divider"></div>
    <div class="result-item-name" id="resultItemName">—</div>
    <div class="result-price" id="resultPrice">—</div>
    <div class="result-price-label">avg sold on eBay</div>
    <div class="result-reason" id="resultReason">—</div>
  </div>
  <div class="result-countdown">
    <div class="countdown-bar-track">
      <div class="countdown-bar" id="countdownBar" style="width:100%"></div>
    </div>
    <div class="countdown-label">Tap to scan next item</div>
  </div>
</div>

<div class="settings-backdrop" id="settingsBackdrop" onclick="closeSettings()"></div>
<div id="settingsPanel">
  <div class="settings-handle"></div>
  <div class="settings-title">Settings</div>
  <div class="setting-row">
    <div class="setting-label">Minimum Sell Threshold <span id="sliderValueLabel">$30</span></div>
    <input type="range" class="threshold-slider" id="thresholdSlider" min="20" max="80" value="30" step="5" oninput="updateThreshold(this.value)">
  </div>
  <div class="setting-row">
    <div class="setting-label">Sound Pack</div>
    <div class="sound-pack-options">
      <div class="pack-option selected" id="pack1Opt" onclick="selectPack(1)">
        <div class="pack-option-name">Pack 1</div>
        <div class="pack-option-desc">💰 Cash register<br>🔔 Buzzer</div>
      </div>
      <div class="pack-option" id="pack2Opt" onclick="selectPack(2)">
        <div class="pack-option-name">Pack 2</div>
        <div class="pack-option-desc">✅ Rising chime<br>❌ Low thud</div>
      </div>
    </div>
  </div>
  <button class="settings-close" onclick="closeSettings()">Done</button>
</div>

<script>
let threshold = 30;
let soundPack = 1;
let isAnalyzing = false;
let countdownTimer = null;
let lastFrameData = null;
let stableFrames = 0;
const STABLE_NEEDED = 8;
const MOTION_CHECK_MS = 220;
const RESULT_MS = 4500;

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playCashRegister() {
  const ctx = audioCtx, now = ctx.currentTime;
  const click = ctx.createOscillator(), cg = ctx.createGain();
  click.connect(cg); cg.connect(ctx.destination);
  click.frequency.setValueAtTime(1200, now);
  click.frequency.exponentialRampToValueAtTime(800, now + 0.05);
  cg.gain.setValueAtTime(0.28, now);
  cg.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
  click.start(now); click.stop(now + 0.08);
  [[0.1,1046],[0.18,1318],[0.27,1568]].forEach(([t,f]) => {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination); o.type = 'sine'; o.frequency.value = f;
    g.gain.setValueAtTime(0.26, now+t); g.gain.exponentialRampToValueAtTime(0.001, now+t+0.38);
    o.start(now+t); o.stop(now+t+0.39);
  });
}

function playBuzzer() {
  const ctx = audioCtx, now = ctx.currentTime;
  [0, 0.2].forEach(t => {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sawtooth'; o.connect(g); g.connect(ctx.destination);
    o.frequency.setValueAtTime(145, now+t); o.frequency.exponentialRampToValueAtTime(88, now+t+0.15);
    g.gain.setValueAtTime(0.32, now+t); g.gain.exponentialRampToValueAtTime(0.001, now+t+0.16);
    o.start(now+t); o.stop(now+t+0.17);
  });
}

function playRisingChime() {
  const ctx = audioCtx, now = ctx.currentTime;
  [523,659,784,1047].forEach((f,i) => {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type='sine'; o.connect(g); g.connect(ctx.destination); o.frequency.value=f;
    const t=now+i*0.11;
    g.gain.setValueAtTime(0.24,t); g.gain.exponentialRampToValueAtTime(0.001,t+0.55);
    o.start(t); o.stop(t+0.56);
  });
}

function playLowThud() {
  const ctx = audioCtx, now = ctx.currentTime;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type='sine'; o.connect(g); g.connect(ctx.destination);
  o.frequency.setValueAtTime(185,now); o.frequency.exponentialRampToValueAtTime(50,now+0.24);
  g.gain.setValueAtTime(0.5,now); g.gain.exponentialRampToValueAtTime(0.001,now+0.28);
  o.start(now); o.stop(now+0.29);
  setTimeout(() => {
    const o2=ctx.createOscillator(), g2=ctx.createGain();
    o2.type='sine'; o2.connect(g2); g2.connect(ctx.destination);
    o2.frequency.setValueAtTime(120,ctx.currentTime); o2.frequency.exponentialRampToValueAtTime(38,ctx.currentTime+0.2);
    g2.gain.setValueAtTime(0.3,ctx.currentTime); g2.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+0.22);
    o2.start(ctx.currentTime); o2.stop(ctx.currentTime+0.23);
  }, 170);
}

function playSound(type) {
  audioCtx.resume();
  if (soundPack===1) { type==='keep' ? playCashRegister() : playBuzzer(); }
  else { type==='keep' ? playRisingChime() : playLowThud(); }
}

async function startCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: {ideal:'environment'}, width:{ideal:1280}, height:{ideal:720} }, audio: false
    });
    const v = document.getElementById('videoEl');
    v.srcObject = stream;
    await v.play();
    document.getElementById('scanLine').classList.add('active');
    setStatus('Point at item', '');
    startMotionDetection();
  } catch(e) {
    setStatus('Camera unavailable — tap button', '');
  }
}

function startMotionDetection() {
  const video = document.getElementById('videoEl');
  const canvas = document.getElementById('captureCanvas');
  setInterval(() => {
    if (isAnalyzing || !video.videoWidth) return;
    canvas.width=80; canvas.height=45;
    const ctx=canvas.getContext('2d');
    ctx.drawImage(video,0,0,80,45);
    const frame=ctx.getImageData(0,0,80,45).data;
    if (lastFrameData) {
      let diff=0;
      for(let i=0;i<frame.length;i+=4) diff+=Math.abs(frame[i]-lastFrameData[i]);
      const avg=diff/(frame.length/4);
      if (avg<6) {
        stableFrames++;
        if(stableFrames===3) setStatus('Hold still...','scanning');
        if(stableFrames>=STABLE_NEEDED) { stableFrames=0; lastFrameData=null; captureAndAnalyze(); }
      } else { stableFrames=0; if(!isAnalyzing) setStatus('Point at item',''); }
    }
    lastFrameData=new Uint8ClampedArray(frame);
  }, MOTION_CHECK_MS);
}

function captureAndAnalyze() {
  const video=document.getElementById('videoEl');
  const canvas=document.getElementById('captureCanvas');
  canvas.width=video.videoWidth; canvas.height=video.videoHeight;
  canvas.getContext('2d').drawImage(video,0,0);
  analyze(canvas.toDataURL('image/jpeg',0.85).split(',')[1]);
}

function triggerManualScan() {
  if(isAnalyzing) return;
  stableFrames=0; captureAndAnalyze();
}

const steps=[['Identifying item...','Vision scan in progress'],['Searching eBay...','Checking sold listings'],['Calculating value...','Averaging recent sales'],['Generating verdict...','Almost done']];

async function analyze(imageBase64) {
  if(isAnalyzing) return;
  isAnalyzing=true;
  showScreen('loadingScreen');
  let si=0; updateStep(0);
  const iv=setInterval(()=>{ si=Math.min(si+1,steps.length-1); updateStep(si); },2100);

  try {
    const res=await fetch('/api/analyze',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({image:imageBase64, threshold})
    });
    clearInterval(iv);
    const data=await res.json();
    showResult(data);
  } catch(e) {
    clearInterval(iv);
    showResult({verdict:'KEEP',item_name:'Connection error — set aside for review',avg_sold_price:0,reason:'Could not reach server. Setting aside for manual review.'});
  }
}

function updateStep(i) {
  document.getElementById('loadingStep').textContent=steps[i][0];
  document.getElementById('loadingSub').textContent=steps[i][1];
}

function showResult(r) {
  const isKeep=(r.verdict||'KEEP').toUpperCase()==='KEEP';
  const rs=document.getElementById('resultScreen');
  rs.className='screen active '+(isKeep?'keep':'recycle');
  document.getElementById('resultVerdict').textContent=isKeep?'KEEP':'RECYCLE';
  document.getElementById('resultItemName').textContent=r.item_name||'—';
  document.getElementById('resultPrice').textContent=r.avg_sold_price?'$'+Number(r.avg_sold_price).toFixed(0):'—';
  document.getElementById('resultReason').textContent=r.reason||'';
  showScreen('resultScreen');
  playSound(isKeep?'keep':'recycle');
  const bar=document.getElementById('countdownBar');
  bar.style.transition='none'; bar.style.width='100%';
  setTimeout(()=>{ bar.style.transition='width '+RESULT_MS+'ms linear'; bar.style.width='0%'; },30);
  clearTimeout(countdownTimer);
  countdownTimer=setTimeout(()=>dismissResult(),RESULT_MS);
}

function dismissResult() {
  clearTimeout(countdownTimer);
  isAnalyzing=false; stableFrames=0; lastFrameData=null;
  showScreen('scannerScreen'); setStatus('Point at item','');
}

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

function setStatus(t,c) {
  const p=document.getElementById('statusPill');
  p.textContent=t; p.className='status-pill'+(c?' '+c:'');
}

function openSettings() { document.getElementById('settingsPanel').classList.add('open'); document.getElementById('settingsBackdrop').classList.add('open'); }
function closeSettings() { document.getElementById('settingsPanel').classList.remove('open'); document.getElementById('settingsBackdrop').classList.remove('open'); }
function updateThreshold(v) { threshold=parseInt(v); document.getElementById('sliderValueLabel').textContent='$'+threshold; document.getElementById('thresholdDisplay').textContent='$'+threshold; }
function selectPack(n) { soundPack=n; document.getElementById('pack1Opt').classList.toggle('selected',n===1); document.getElementById('pack2Opt').classList.toggle('selected',n===2); document.getElementById('packToggleBtn').textContent='PACK '+n; playSound('keep'); }
function cycleSoundPack() { selectPack(soundPack===1?2:1); }

window.addEventListener('load',()=>{ audioCtx.resume(); startCamera(); });
document.addEventListener('touchstart',()=>audioCtx.resume(),{once:true});
document.addEventListener('click',()=>audioCtx.resume(),{once:true});
</script>
</body>
</html>`;

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  if (req.method === 'GET' && req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(HTML);
    return;
  }

  if (req.method === 'POST' && req.url === '/api/analyze') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const { image, threshold } = JSON.parse(body);

        const systemPrompt = \`You are an eBay resale triage assistant for an e-waste/electronics sorting warehouse. Analyze the item in the photo and return a JSON verdict.

RULES:
- Minimum sell threshold: $\${threshold || 30}
- Verdict must be exactly "KEEP" or "RECYCLE"
- KEEP if avg eBay sold price >= $\${threshold || 30}
- RECYCLE if item has no realistic eBay market OR avg sold is clearly below threshold
- When uncertain or borderline, ALWAYS return KEEP (err on the side of value)
- NEVER return RECYCLE unless confident the item has no meaningful resale value
- Medical or regulated equipment: always RECYCLE
- Base prices on realistic eBay completed/sold listings for the item in similar condition

Return ONLY valid JSON, no markdown, no extra text:
{
  "verdict": "KEEP" or "RECYCLE",
  "item_name": "Descriptive name with make/model if visible",
  "avg_sold_price": 0,
  "reason": "One short plain-English sentence for a non-expert employee."
}\`;

        const anthropicPayload = JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 600,
          tools: [{ type: 'web_search_20250305', name: 'web_search' }],
          system: systemPrompt,
          messages: [{
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: image } },
              { type: 'text', text: 'Identify this item and search eBay sold listings to determine its resale value. Return the JSON verdict only.' }
            ]
          }]
        });

        const options = {
          hostname: 'api.anthropic.com',
          path: '/v1/messages',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': API_KEY,
            'anthropic-version': '2023-06-01',
            'Content-Length': Buffer.byteLength(anthropicPayload)
          }
        };

        const apiReq = https.request(options, apiRes => {
          let data = '';
          apiRes.on('data', chunk => data += chunk);
          apiRes.on('end', () => {
            try {
              const parsed = JSON.parse(data);
              let rawText = '';
              for (const block of (parsed.content || [])) {
                if (block.type === 'text') rawText += block.text;
              }
              const match = rawText.match(/\{[\s\S]*?\}/);
              const result = JSON.parse(match ? match[0] : rawText);
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify(result));
            } catch(e) {
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ verdict: 'KEEP', item_name: 'Parse error — set aside', avg_sold_price: 0, reason: 'Could not parse AI response. Set aside for manual review.' }));
            }
          });
        });

        apiReq.on('error', () => {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ verdict: 'KEEP', item_name: 'API error — set aside', avg_sold_price: 0, reason: 'Server error. Set aside for manual review.' }));
        });

        apiReq.write(anthropicPayload);
        apiReq.end();

      } catch(e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ verdict: 'KEEP', item_name: 'Request error', avg_sold_price: 0, reason: 'Bad request. Set aside for manual review.' }));
      }
    });
    return;
  }

  res.writeHead(404); res.end('Not found');
});

server.listen(PORT, () => console.log('XRT Scanner running on port ' + PORT));
