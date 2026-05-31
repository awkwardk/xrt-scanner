'use strict';
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const API_KEY = process.env.ANTHROPIC_API_KEY || process.env.anthropic_api_key || '';
const DATA_DIR = process.env.DATA_DIR || '/tmp/xrt-data';

console.log('[STARTUP] API key found:', API_KEY.length > 0);

// Ensure data directory exists
if(!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, {recursive:true});
if(!fs.existsSync(path.join(DATA_DIR, 'items'))) fs.mkdirSync(path.join(DATA_DIR, 'items'), {recursive:true});

// Scanner HTML
const SCANNER_HTML = "<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n<meta charset=\"UTF-8\">\n<meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0, user-scalable=no\">\n<meta name=\"mobile-web-app-capable\" content=\"yes\">\n<meta name=\"apple-mobile-web-app-capable\" content=\"yes\">\n<meta name=\"theme-color\" content=\"#000000\">\n<title>XRT Floor Scanner</title>\n<link rel=\"preconnect\" href=\"https://fonts.googleapis.com\">\n<link href=\"https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Mono:wght@400;500&family=Barlow:wght@400;600;700;900&display=swap\" rel=\"stylesheet\">\n<style>\n:root{--bg:#111;--surface:#1a1a1a;--border:#2c2c2c;--text:#f2f2f2;--muted:#555;--accent:#e8ff00;--keep:#00e676;--lot:#ff9f1c;--recycle:#ff1744;--keep-dark:#003d1a;--lot-dark:#3d2000;--recycle-dark:#4a000e;--display:'Bebas Neue',sans-serif;--body:'Barlow',sans-serif;--mono:'DM Mono',monospace;}\n*{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent;}\nhtml,body{height:100%;overflow:hidden;background:#000;font-family:var(--body);color:var(--text);user-select:none;touch-action:manipulation;}\n.screen{position:fixed;inset:0;display:none;flex-direction:column;}.screen.active{display:flex;}\n#scannerScreen{background:#000;}\n#videoEl{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;}\n.vf-overlay{position:absolute;inset:0;pointer-events:none;}\n.vf-corner{position:absolute;width:32px;height:32px;border-color:var(--accent);border-style:solid;opacity:0.85;}\n.vf-corner.tl{top:22%;left:10%;border-width:3px 0 0 3px;}.vf-corner.tr{top:22%;right:10%;border-width:3px 3px 0 0;}\n.vf-corner.bl{bottom:30%;left:10%;border-width:0 0 3px 3px;}.vf-corner.br{bottom:30%;right:10%;border-width:0 3px 3px 0;}\n.scan-line{position:absolute;left:10%;right:10%;height:2px;background:linear-gradient(90deg,transparent,var(--accent),transparent);top:22%;opacity:0;animation:scanAnim 2.4s ease-in-out infinite;}\n.scan-line.active{opacity:1;}@keyframes scanAnim{0%{top:22%;}50%{top:70%;}100%{top:22%;}}\n.scanner-topbar{position:absolute;top:0;left:0;right:0;padding:16px 18px 12px;display:flex;align-items:center;justify-content:space-between;background:linear-gradient(to bottom,rgba(0,0,0,0.88),transparent);z-index:10;}\n.topbar-brand{font-family:var(--display);font-size:1.6rem;letter-spacing:0.06em;color:#fff;line-height:1;}.topbar-brand span{color:var(--accent);}\n.topbar-right{display:flex;gap:10px;align-items:center;}\n.icon-btn{width:40px;height:40px;border-radius:50%;background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.15);display:flex;align-items:center;justify-content:center;cursor:pointer;backdrop-filter:blur(8px);}\n.mode-badge{font-family:var(--mono);font-size:0.58rem;letter-spacing:0.1em;text-transform:uppercase;padding:5px 10px;border-radius:100px;border:1px solid rgba(255,255,255,0.2);color:#ccc;background:rgba(0,0,0,0.4);}\n.mode-badge.auto{color:var(--accent);border-color:rgba(232,255,0,0.4);}\n.status-pill{position:absolute;bottom:28%;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.72);border:1px solid rgba(255,255,255,0.1);backdrop-filter:blur(12px);border-radius:100px;padding:8px 20px;font-family:var(--mono);font-size:0.65rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--muted);white-space:nowrap;transition:all 0.2s;z-index:10;}\n.status-pill.scanning{color:var(--accent);border-color:rgba(232,255,0,0.35);}.status-pill.ready{color:#fff;}.status-pill.waiting{color:var(--lot);border-color:rgba(255,159,28,0.35);}\n.scanner-bottombar{position:absolute;bottom:0;left:0;right:0;padding:16px 24px calc(env(safe-area-inset-bottom) + 18px);background:linear-gradient(to top,rgba(0,0,0,0.92),transparent);z-index:10;display:flex;align-items:center;justify-content:space-between;}\n.threshold-display{display:flex;flex-direction:column;}\n.threshold-display .label{font-family:var(--mono);font-size:0.55rem;color:var(--muted);letter-spacing:0.1em;text-transform:uppercase;}\n.threshold-display .value{font-family:var(--display);font-size:1.8rem;color:var(--accent);line-height:1;}\n.scan-btn{width:72px;height:72px;border-radius:50%;background:#fff;border:3px solid rgba(255,255,255,0.25);display:flex;align-items:center;justify-content:center;cursor:pointer;transition:transform 0.1s,background 0.1s;position:relative;}\n.scan-btn::after{content:'';position:absolute;inset:-7px;border-radius:50%;border:2px solid rgba(255,255,255,0.18);}\n.scan-btn:active{transform:scale(0.91);background:#ddd;}\n.scan-btn.locked{background:#333;cursor:not-allowed;}\n.scan-btn.locked svg{stroke:#666;}\n.scan-btn.locked:active{transform:none;}\n.sound-toggle{display:flex;flex-direction:column;align-items:flex-end;}\n.sound-toggle .label{font-family:var(--mono);font-size:0.55rem;color:var(--muted);letter-spacing:0.1em;text-transform:uppercase;margin-bottom:4px;}\n.pack-btn{background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.14);border-radius:5px;padding:5px 12px;font-family:var(--mono);font-size:0.62rem;color:#ccc;cursor:pointer;letter-spacing:0.06em;}\n#resultScreen{z-index:50;justify-content:center;align-items:center;}\n#resultScreen.keep{background:var(--keep-dark);}\n#resultScreen.lot{background:var(--lot-dark);}\n#resultScreen.recycle{background:var(--recycle-dark);}\n.result-glow{position:absolute;inset:0;pointer-events:none;opacity:0;}\n#resultScreen.keep .result-glow{background:radial-gradient(ellipse at center,rgba(0,230,118,0.2) 0%,transparent 70%);opacity:1;}\n#resultScreen.lot .result-glow{background:radial-gradient(ellipse at center,rgba(255,159,28,0.2) 0%,transparent 70%);opacity:1;}\n#resultScreen.recycle .result-glow{background:radial-gradient(ellipse at center,rgba(255,23,68,0.2) 0%,transparent 70%);opacity:1;}\n.result-inner{position:relative;z-index:2;display:flex;flex-direction:column;align-items:center;padding:0 28px;text-align:center;width:100%;}\n.result-verdict-word{font-family:var(--display);font-size:clamp(5.5rem,24vw,10rem);line-height:0.88;letter-spacing:0.03em;animation:verdictPop 0.32s cubic-bezier(0.34,1.56,0.64,1) both;}\n#resultScreen.keep .result-verdict-word{color:var(--keep);}\n#resultScreen.lot .result-verdict-word{color:var(--lot);}\n#resultScreen.recycle .result-verdict-word{color:var(--recycle);}\n@keyframes verdictPop{from{transform:scale(0.65);opacity:0;}to{transform:scale(1);opacity:1;}}\n.result-divider{width:48px;height:2px;margin:14px auto;opacity:0.35;}\n#resultScreen.keep .result-divider{background:var(--keep);}\n#resultScreen.lot .result-divider{background:var(--lot);}\n#resultScreen.recycle .result-divider{background:var(--recycle);}\n.result-item-name{font-size:1.1rem;font-weight:700;line-height:1.3;color:rgba(255,255,255,0.88);max-width:300px;animation:fadeUp 0.36s 0.12s both;}\n.result-price{font-family:var(--display);font-size:2.8rem;margin-top:10px;animation:fadeUp 0.36s 0.2s both;}\n#resultScreen.keep .result-price{color:var(--keep);}\n#resultScreen.lot .result-price{color:var(--lot);}\n#resultScreen.recycle .result-price{color:var(--recycle);}\n.result-price-label{font-family:var(--mono);font-size:0.58rem;letter-spacing:0.14em;color:rgba(255,255,255,0.38);text-transform:uppercase;margin-top:-2px;animation:fadeUp 0.36s 0.24s both;}\n.result-reason{margin-top:16px;font-size:0.88rem;color:rgba(255,255,255,0.5);max-width:280px;line-height:1.55;animation:fadeUp 0.36s 0.28s both;}\n@keyframes fadeUp{from{opacity:0;transform:translateY(12px);}to{opacity:1;transform:translateY(0);}}\n.result-countdown{position:absolute;bottom:44px;left:50%;transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;gap:8px;}\n.countdown-bar-track{width:130px;height:3px;background:rgba(255,255,255,0.1);border-radius:2px;overflow:hidden;}\n.countdown-bar{height:100%;border-radius:2px;}\n#resultScreen.keep .countdown-bar{background:var(--keep);}\n#resultScreen.lot .countdown-bar{background:var(--lot);}\n#resultScreen.recycle .countdown-bar{background:var(--recycle);}\n.countdown-label{font-family:var(--mono);font-size:0.58rem;letter-spacing:0.1em;color:rgba(255,255,255,0.28);text-transform:uppercase;}\n#loadingScreen{background:#080808;z-index:40;justify-content:center;align-items:center;gap:22px;}\n.loading-ring{width:60px;height:60px;border-radius:50%;border:2px solid var(--border);border-top-color:var(--accent);animation:spin 0.72s linear infinite;}\n@keyframes spin{to{transform:rotate(360deg);}}\n.loading-info{text-align:center;}\n.loading-step{font-family:var(--display);font-size:1.5rem;letter-spacing:0.05em;color:#fff;margin-bottom:5px;}\n.loading-sub{font-family:var(--mono);font-size:0.6rem;color:var(--muted);letter-spacing:0.1em;text-transform:uppercase;}\n#historyScreen{z-index:60;background:var(--bg);flex-direction:column;}\n.history-topbar{padding:16px 18px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--border);}\n.history-title{font-family:var(--display);font-size:1.8rem;letter-spacing:0.04em;}\n.history-actions{display:flex;gap:10px;}\n.history-btn{font-family:var(--mono);font-size:0.6rem;letter-spacing:0.08em;text-transform:uppercase;padding:8px 14px;border-radius:6px;border:1px solid var(--border);background:transparent;color:var(--muted);cursor:pointer;}\n.history-btn.accent{border-color:var(--accent);color:var(--accent);}\n.history-list{flex:1;overflow-y:auto;padding:12px 16px;}\n.history-item{display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid var(--border);}\n.history-verdict{font-family:var(--display);font-size:1.1rem;letter-spacing:0.04em;width:80px;flex-shrink:0;}\n.history-verdict.keep{color:var(--keep);}.history-verdict.lot{color:var(--lot);}.history-verdict.recycle{color:var(--recycle);}\n.history-info{flex:1;min-width:0;}\n.history-name{font-size:0.85rem;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}\n.history-price{font-family:var(--mono);font-size:0.65rem;color:var(--muted);margin-top:2px;}\n.history-time{font-family:var(--mono);font-size:0.58rem;color:var(--border);flex-shrink:0;}\n.history-empty{text-align:center;padding:60px 20px;font-family:var(--mono);font-size:0.65rem;color:var(--muted);letter-spacing:0.08em;text-transform:uppercase;}\n.legend-bar{display:flex;gap:0;border-bottom:1px solid var(--border);}\n.legend-item{flex:1;text-align:center;padding:8px 4px;font-family:var(--mono);font-size:0.55rem;letter-spacing:0.08em;text-transform:uppercase;}\n.legend-item.keep{color:var(--keep);}.legend-item.lot{color:var(--lot);}.legend-item.recycle{color:var(--recycle);}\n#settingsPanel{position:fixed;bottom:0;left:0;right:0;background:var(--surface);border-top:1px solid var(--border);border-radius:20px 20px 0 0;padding:18px 24px calc(env(safe-area-inset-bottom) + 28px);z-index:100;transform:translateY(100%);transition:transform 0.3s cubic-bezier(0.32,0.72,0,1);}\n#settingsPanel.open{transform:translateY(0);}\n.settings-handle{width:40px;height:4px;background:var(--border);border-radius:2px;margin:0 auto 22px;}\n.settings-title{font-family:var(--display);font-size:1.6rem;letter-spacing:0.04em;margin-bottom:26px;}\n.setting-row{margin-bottom:24px;}\n.setting-label{font-family:var(--mono);font-size:0.6rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--muted);margin-bottom:12px;display:flex;justify-content:space-between;align-items:center;}\n.setting-label span{font-size:0.8rem;color:var(--accent);font-family:var(--display);letter-spacing:0.06em;}\n.threshold-slider{width:100%;-webkit-appearance:none;appearance:none;height:4px;background:var(--border);border-radius:2px;outline:none;}\n.threshold-slider::-webkit-slider-thumb{-webkit-appearance:none;width:24px;height:24px;border-radius:50%;background:var(--accent);cursor:pointer;border:3px solid #000;box-shadow:0 0 0 2px var(--accent);}\n.lot-slider::-webkit-slider-thumb{-webkit-appearance:none;width:24px;height:24px;border-radius:50%;background:var(--lot);cursor:pointer;border:3px solid #000;box-shadow:0 0 0 2px var(--lot);}\n.toggle-row{display:grid;grid-template-columns:1fr 1fr;gap:10px;}\n.toggle-opt{border:1.5px solid var(--border);border-radius:10px;padding:14px 16px;cursor:pointer;transition:all 0.15s;text-align:center;}\n.toggle-opt.selected{border-color:var(--accent);background:rgba(232,255,0,0.06);}\n.toggle-opt-name{font-weight:700;font-size:0.95rem;margin-bottom:4px;}\n.toggle-opt-desc{font-family:var(--mono);font-size:0.58rem;color:var(--muted);line-height:1.4;}\n.toggle-opt.selected .toggle-opt-name{color:var(--accent);}\n.settings-close{width:100%;margin-top:6px;padding:15px;background:var(--border);border:none;border-radius:10px;font-family:var(--display);font-size:1.15rem;letter-spacing:0.06em;color:var(--text);cursor:pointer;}\n.settings-backdrop{position:fixed;inset:0;background:rgba(0,0,0,0.65);z-index:99;display:none;backdrop-filter:blur(3px);}\n.settings-backdrop.open{display:block;}\n</style>\n</head>\n<body>\n<div class=\"screen active\" id=\"scannerScreen\">\n  <video id=\"videoEl\" autoplay playsinline muted></video>\n  <canvas id=\"captureCanvas\" style=\"display:none\"></canvas>\n  <div class=\"vf-overlay\">\n    <div class=\"vf-corner tl\"></div><div class=\"vf-corner tr\"></div>\n    <div class=\"vf-corner bl\"></div><div class=\"vf-corner br\"></div>\n    <div class=\"scan-line\" id=\"scanLine\"></div>\n  </div>\n  <div class=\"scanner-topbar\">\n    <div class=\"topbar-brand\">XRT<span>&#183;</span>SCAN</div>\n    <div class=\"topbar-right\">\n      <div class=\"mode-badge\" id=\"modeBadge\">MANUAL</div>\n      <div class=\"icon-btn\" onclick=\"showHistory()\">\n        <svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"white\" stroke-width=\"1.8\" width=\"18\" height=\"18\">\n          <path d=\"M12 8v4l3 3m6-3a9 9 0 1 1-18 0 9 9 0 0 1 18 0z\"/>\n        </svg>\n      </div>\n      <div class=\"icon-btn\" onclick=\"openSettings()\">\n        <svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"white\" stroke-width=\"1.8\" width=\"18\" height=\"18\">\n          <circle cx=\"12\" cy=\"12\" r=\"3\"/>\n          <path d=\"M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z\"/>\n        </svg>\n      </div>\n    </div>\n  </div>\n  <div class=\"status-pill\" id=\"statusPill\">Starting camera...</div>\n  <div class=\"scanner-bottombar\">\n    <div class=\"threshold-display\">\n      <div class=\"label\">Min Value</div>\n      <div class=\"value\" id=\"thresholdDisplay\">$30</div>\n    </div>\n    <div class=\"scan-btn\" id=\"scanBtn\" onclick=\"triggerManualScan()\">\n      <svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"black\" stroke-width=\"2.2\" width=\"30\" height=\"30\">\n        <circle cx=\"11\" cy=\"11\" r=\"8\"/><path d=\"m21 21-4.35-4.35\"/>\n      </svg>\n    </div>\n    <div class=\"sound-toggle\">\n      <div class=\"label\">Sound Pack</div>\n      <div class=\"pack-btn\" id=\"packToggleBtn\" onclick=\"cycleSoundPack()\">PACK 1</div>\n    </div>\n  </div>\n</div>\n\n<div class=\"screen\" id=\"loadingScreen\">\n  <div class=\"loading-ring\"></div>\n  <div class=\"loading-info\">\n    <div class=\"loading-step\" id=\"loadingStep\">Identifying item...</div>\n    <div class=\"loading-sub\" id=\"loadingSub\">Checking eBay sold listings</div>\n  </div>\n</div>\n\n<div class=\"screen\" id=\"resultScreen\" onclick=\"dismissResult()\">\n  <div class=\"result-glow\"></div>\n  <div class=\"result-inner\">\n    <div class=\"result-verdict-word\" id=\"resultVerdict\">KEEP</div>\n    <div class=\"result-divider\"></div>\n    <div class=\"result-item-name\" id=\"resultItemName\">--</div>\n    <div class=\"result-price\" id=\"resultPrice\">--</div>\n    <div class=\"result-price-label\" id=\"resultPriceLabel\">avg sold on eBay</div>\n    <div class=\"result-reason\" id=\"resultReason\">--</div>\n  </div>\n  <div class=\"result-countdown\">\n    <div class=\"countdown-bar-track\">\n      <div class=\"countdown-bar\" id=\"countdownBar\" style=\"width:100%\"></div>\n    </div>\n    <div class=\"countdown-label\">Tap to scan next item</div>\n  </div>\n</div>\n\n<div class=\"screen\" id=\"historyScreen\">\n  <div class=\"history-topbar\">\n    <div class=\"history-title\">Scan History</div>\n    <div class=\"history-actions\">\n      <button class=\"history-btn accent\" onclick=\"copyHistory()\">Export CSV</button>\n      <button class=\"history-btn\" onclick=\"hideHistory()\">Close</button>\n    </div>\n  </div>\n  <div class=\"legend-bar\">\n    <div class=\"legend-item keep\">&#9646; Keep</div>\n    <div class=\"legend-item lot\">&#9646; Lot</div>\n    <div class=\"legend-item recycle\">&#9646; Recycle</div>\n  </div>\n  <div class=\"history-list\" id=\"historyList\">\n    <div class=\"history-empty\">No scans yet this session</div>\n  </div>\n</div>\n\n<div class=\"settings-backdrop\" id=\"settingsBackdrop\" onclick=\"closeSettings()\"></div>\n<div id=\"settingsPanel\">\n  <div class=\"settings-handle\"></div>\n  <div class=\"settings-title\">Settings</div>\n  <div class=\"setting-row\">\n    <div class=\"setting-label\">Sell Threshold (single unit) <span id=\"sliderValueLabel\">$30</span></div>\n    <input type=\"range\" class=\"threshold-slider\" id=\"thresholdSlider\" min=\"20\" max=\"80\" value=\"30\" step=\"5\" oninput=\"updateThreshold(this.value)\">\n  </div>\n  <div class=\"setting-row\">\n    <div class=\"setting-label\">Lot Minimum (per unit) <span id=\"lotValueLabel\">$8</span></div>\n    <input type=\"range\" class=\"threshold-slider lot-slider\" id=\"lotSlider\" min=\"3\" max=\"25\" value=\"8\" step=\"1\" oninput=\"updateLotThreshold(this.value)\">\n  </div>\n  <div class=\"setting-row\">\n    <div class=\"setting-label\">Scan Mode</div>\n    <div class=\"toggle-row\">\n      <div class=\"toggle-opt selected\" id=\"modeManualOpt\" onclick=\"setScanMode('manual')\">\n        <div class=\"toggle-opt-name\">Manual</div>\n        <div class=\"toggle-opt-desc\">Tap button to scan only.</div>\n      </div>\n      <div class=\"toggle-opt\" id=\"modeAutoOpt\" onclick=\"setScanMode('auto')\">\n        <div class=\"toggle-opt-name\">Auto</div>\n        <div class=\"toggle-opt-desc\">Fires when camera is steady.</div>\n      </div>\n    </div>\n  </div>\n  <div class=\"setting-row\">\n    <div class=\"setting-label\">Sound Pack</div>\n    <div class=\"toggle-row\">\n      <div class=\"toggle-opt selected\" id=\"pack1Opt\" onclick=\"selectPack(1)\">\n        <div class=\"toggle-opt-name\">Pack 1</div>\n        <div class=\"toggle-opt-desc\">Cash register / Chime / Buzzer</div>\n      </div>\n      <div class=\"toggle-opt\" id=\"pack2Opt\" onclick=\"selectPack(2)\">\n        <div class=\"toggle-opt-name\">Pack 2</div>\n        <div class=\"toggle-opt-desc\">Rising chime / Ding / Low thud</div>\n      </div>\n    </div>\n  </div>\n  <button class=\"settings-close\" onclick=\"closeSettings()\">Done</button>\n</div>\n\n<script>\nvar threshold=30,lotThreshold=8,soundPack=1,isAnalyzing=false,countdownTimer=null;\nvar lastFrameData=null,stableFrames=0,motionInterval=null,scanMode='manual';\nvar scanLocked=false,cooldownTimer=null,cooldownTick=null;\nvar STABLE_NEEDED=8,MOTION_MS=220,RESULT_MS=5000,COOLDOWN_MS=8000;\nvar scanHistory=[];\nvar audioCtx=new(window.AudioContext||window.webkitAudioContext)();\n\nfunction playCashRegister(){var ctx=audioCtx,now=ctx.currentTime;var c=ctx.createOscillator(),cg=ctx.createGain();c.connect(cg);cg.connect(ctx.destination);c.frequency.setValueAtTime(1200,now);c.frequency.exponentialRampToValueAtTime(800,now+0.05);cg.gain.setValueAtTime(0.28,now);cg.gain.exponentialRampToValueAtTime(0.001,now+0.07);c.start(now);c.stop(now+0.08);[[0.1,1046],[0.18,1318],[0.27,1568]].forEach(function(x){var o=ctx.createOscillator(),g=ctx.createGain();o.connect(g);g.connect(ctx.destination);o.type='sine';o.frequency.value=x[1];g.gain.setValueAtTime(0.26,now+x[0]);g.gain.exponentialRampToValueAtTime(0.001,now+x[0]+0.38);o.start(now+x[0]);o.stop(now+x[0]+0.39);});}\nfunction playMidChime(){var ctx=audioCtx,now=ctx.currentTime;[659,784].forEach(function(f,i){var o=ctx.createOscillator(),g=ctx.createGain();o.type='sine';o.connect(g);g.connect(ctx.destination);o.frequency.value=f;var t=now+i*0.14;g.gain.setValueAtTime(0.28,t);g.gain.exponentialRampToValueAtTime(0.001,t+0.5);o.start(t);o.stop(t+0.51);});}\nfunction playBuzzer(){var ctx=audioCtx,now=ctx.currentTime;[0,0.2].forEach(function(t){var o=ctx.createOscillator(),g=ctx.createGain();o.type='sawtooth';o.connect(g);g.connect(ctx.destination);o.frequency.setValueAtTime(145,now+t);o.frequency.exponentialRampToValueAtTime(88,now+t+0.15);g.gain.setValueAtTime(0.32,now+t);g.gain.exponentialRampToValueAtTime(0.001,now+t+0.16);o.start(now+t);o.stop(now+t+0.17);});}\nfunction playRisingChime(){var ctx=audioCtx,now=ctx.currentTime;[523,659,784,1047].forEach(function(f,i){var o=ctx.createOscillator(),g=ctx.createGain();o.type='sine';o.connect(g);g.connect(ctx.destination);o.frequency.value=f;var t=now+i*0.11;g.gain.setValueAtTime(0.24,t);g.gain.exponentialRampToValueAtTime(0.001,t+0.55);o.start(t);o.stop(t+0.56);});}\nfunction playSingleDing(){var ctx=audioCtx,now=ctx.currentTime;var o=ctx.createOscillator(),g=ctx.createGain();o.type='sine';o.connect(g);g.connect(ctx.destination);o.frequency.value=880;g.gain.setValueAtTime(0.3,now);g.gain.exponentialRampToValueAtTime(0.001,now+0.6);o.start(now);o.stop(now+0.61);}\nfunction playLowThud(){var ctx=audioCtx,now=ctx.currentTime;var o=ctx.createOscillator(),g=ctx.createGain();o.type='sine';o.connect(g);g.connect(ctx.destination);o.frequency.setValueAtTime(185,now);o.frequency.exponentialRampToValueAtTime(50,now+0.24);g.gain.setValueAtTime(0.5,now);g.gain.exponentialRampToValueAtTime(0.001,now+0.28);o.start(now);o.stop(now+0.29);setTimeout(function(){var o2=ctx.createOscillator(),g2=ctx.createGain();o2.type='sine';o2.connect(g2);g2.connect(ctx.destination);o2.frequency.setValueAtTime(120,ctx.currentTime);o2.frequency.exponentialRampToValueAtTime(38,ctx.currentTime+0.2);g2.gain.setValueAtTime(0.3,ctx.currentTime);g2.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+0.22);o2.start(ctx.currentTime);o2.stop(ctx.currentTime+0.23);},170);}\n\nfunction playSound(verdict){\n  audioCtx.resume();\n  var v=verdict.toUpperCase();\n  if(soundPack===1){if(v==='KEEP')playCashRegister();else if(v==='LOT')playMidChime();else playBuzzer();}\n  else{if(v==='KEEP')playRisingChime();else if(v==='LOT')playSingleDing();else playLowThud();}\n}\n\nfunction startCamera(){navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:1280},height:{ideal:720}},audio:false}).then(function(stream){var v=document.getElementById('videoEl');v.srcObject=stream;v.play();setStatus('Ready','ready');startMotionDetection();}).catch(function(e){setStatus('Camera error: '+e.message,'');});}\n\nfunction startMotionDetection(){var video=document.getElementById('videoEl');var canvas=document.getElementById('captureCanvas');if(motionInterval)clearInterval(motionInterval);motionInterval=setInterval(function(){if(isAnalyzing||scanLocked||scanMode!=='auto'||!video.videoWidth)return;canvas.width=80;canvas.height=45;var ctx=canvas.getContext('2d');ctx.drawImage(video,0,0,80,45);var frame=ctx.getImageData(0,0,80,45).data;if(lastFrameData){var diff=0;for(var i=0;i<frame.length;i+=4)diff+=Math.abs(frame[i]-lastFrameData[i]);var avg=diff/(frame.length/4);if(avg<6){stableFrames++;if(stableFrames===3)setStatus('Hold still...','scanning');if(stableFrames>=STABLE_NEEDED){stableFrames=0;lastFrameData=null;captureAndAnalyze();}}else{stableFrames=0;if(!isAnalyzing&&!scanLocked)setStatus('Point at item','');}}lastFrameData=new Uint8ClampedArray(frame);},MOTION_MS);}\n\nfunction captureAndAnalyze(){var video=document.getElementById('videoEl');var canvas=document.getElementById('captureCanvas');var maxW=800;var scale=Math.min(1,maxW/video.videoWidth);canvas.width=Math.round(video.videoWidth*scale);canvas.height=Math.round(video.videoHeight*scale);canvas.getContext('2d').drawImage(video,0,0,canvas.width,canvas.height);analyze(canvas.toDataURL('image/jpeg',0.75).split(',')[1]);}\n\nfunction triggerManualScan(){if(isAnalyzing||scanLocked)return;stableFrames=0;captureAndAnalyze();}\n\nfunction lockScanner(ms){\n  scanLocked=true;\n  var btn=document.getElementById('scanBtn');\n  btn.classList.add('locked');\n  var remaining=Math.ceil(ms/1000);\n  setStatus('Ready in '+remaining+'s...','waiting');\n  if(cooldownTick)clearInterval(cooldownTick);\n  cooldownTick=setInterval(function(){remaining--;if(remaining<=0){clearInterval(cooldownTick);}else{setStatus('Ready in '+remaining+'s...','waiting');}},1000);\n  clearTimeout(cooldownTimer);\n  cooldownTimer=setTimeout(function(){scanLocked=false;btn.classList.remove('locked');setStatus(scanMode==='auto'?'Point at item':'Ready','ready');},ms);\n}\n\nvar steps=[['Identifying item...','Vision scan in progress'],['Searching eBay...','Checking sold listings'],['Evaluating lot potential...','Checking demand velocity'],['Almost done...','Generating verdict']];\n\nfunction analyze(imageBase64){\n  if(isAnalyzing||scanLocked)return;\n  isAnalyzing=true;\n  showScreen('loadingScreen');\n  var si=0;updateStep(0);\n  var iv=setInterval(function(){si=Math.min(si+1,steps.length-1);updateStep(si);},2200);\n  fetch('/api/analyze',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({image:imageBase64,threshold:threshold,lotThreshold:lotThreshold})})\n  .then(function(r){if(!r.ok)throw new Error('HTTP '+r.status);return r.json();})\n  .then(function(data){clearInterval(iv);showResult(data);})\n  .catch(function(e){clearInterval(iv);showResult({verdict:'KEEP',item_name:'Network error - set aside',avg_sold_price:0,reason:'Could not reach server. Set aside for manual review.'});});\n}\n\nfunction updateStep(i){document.getElementById('loadingStep').textContent=steps[i][0];document.getElementById('loadingSub').textContent=steps[i][1];}\n\nfunction showResult(r){\n  var verdict=(r.verdict||'KEEP').toUpperCase();\n  var rs=document.getElementById('resultScreen');\n  var cls=verdict==='KEEP'?'keep':verdict==='LOT'?'lot':'recycle';\n  rs.className='screen active '+cls;\n  document.getElementById('resultVerdict').textContent=verdict;\n  document.getElementById('resultItemName').textContent=r.item_name||'Set aside for review';\n  var priceVal=r.avg_sold_price&&r.avg_sold_price>0?'$'+Number(r.avg_sold_price).toFixed(0):'--';\n  document.getElementById('resultPrice').textContent=priceVal;\n  document.getElementById('resultPriceLabel').textContent=verdict==='LOT'?'est. per unit':'avg sold on eBay';\n  document.getElementById('resultReason').textContent=r.reason||'';\n  showScreen('resultScreen');\n  playSound(verdict);\n  var now=new Date();\n  var timeStr=now.getHours()+':'+(now.getMinutes()<10?'0':'')+now.getMinutes();\n  scanHistory.unshift({verdict:verdict,item_name:r.item_name||'Unknown',avg_sold_price:r.avg_sold_price||0,reason:r.reason||'',time:timeStr});\n  var bar=document.getElementById('countdownBar');\n  bar.style.transition='none';bar.style.width='100%';\n  setTimeout(function(){bar.style.transition='width '+RESULT_MS+'ms linear';bar.style.width='0%';},30);\n  clearTimeout(countdownTimer);\n  countdownTimer=setTimeout(function(){dismissResult();},RESULT_MS);\n}\n\nfunction dismissResult(){\n  clearTimeout(countdownTimer);\n  isAnalyzing=false;stableFrames=0;lastFrameData=null;\n  showScreen('scannerScreen');\n  lockScanner(COOLDOWN_MS);\n}\n\nfunction showScreen(id){document.querySelectorAll('.screen').forEach(function(s){s.classList.remove('active');});document.getElementById(id).classList.add('active');}\nfunction setStatus(t,c){var p=document.getElementById('statusPill');p.textContent=t;p.className='status-pill'+(c?' '+c:'');}\n\nfunction showHistory(){\n  var list=document.getElementById('historyList');\n  if(scanHistory.length===0){list.innerHTML='<div class=\"history-empty\">No scans yet this session</div>';}\n  else{\n    var counts={KEEP:0,LOT:0,RECYCLE:0};\n    scanHistory.forEach(function(s){if(counts[s.verdict]!==undefined)counts[s.verdict]++;});\n    list.innerHTML='<div style=\"font-family:var(--mono);font-size:0.6rem;color:var(--muted);padding:10px 0 16px;letter-spacing:0.08em;\">SESSION: '+scanHistory.length+' scans &nbsp;|&nbsp; <span style=\"color:var(--keep)\">'+counts.KEEP+' KEEP</span> &nbsp;|&nbsp; <span style=\"color:var(--lot)\">'+counts.LOT+' LOT</span> &nbsp;|&nbsp; <span style=\"color:var(--recycle)\">'+counts.RECYCLE+' RECYCLE</span></div>'+\n    scanHistory.map(function(s){\n      var v=s.verdict.toUpperCase();\n      var cls=v==='KEEP'?'keep':v==='LOT'?'lot':'recycle';\n      var price=s.avg_sold_price>0?'$'+Number(s.avg_sold_price).toFixed(0):'--';\n      return '<div class=\"history-item\"><div class=\"history-verdict '+cls+'\">'+v+'</div><div class=\"history-info\"><div class=\"history-name\">'+s.item_name+'</div><div class=\"history-price\">'+price+' &middot; '+s.reason.slice(0,55)+'...</div></div><div class=\"history-time\">'+s.time+'</div></div>';\n    }).join('');\n  }\n  showScreen('historyScreen');\n}\n\nfunction hideHistory(){showScreen('scannerScreen');}\n\nfunction copyHistory(){\n  if(scanHistory.length===0){alert('No scans to export yet.');return;}\n  var csv='Time,Verdict,Item,Avg Unit Price,Reason\\n';\n  csv+=scanHistory.map(function(s){return s.time+','+s.verdict+',\"'+s.item_name.replace(/\"/g,'')+'\",'+s.avg_sold_price+',\"'+s.reason.replace(/\"/g,'')+'\"';}).join('\\n');\n  navigator.clipboard.writeText(csv).then(function(){alert('Copied! Paste into any spreadsheet.');}).catch(function(){alert('Copy failed - try again.');});\n}\n\nfunction updateThreshold(v){threshold=parseInt(v);document.getElementById('sliderValueLabel').textContent='$'+threshold;document.getElementById('thresholdDisplay').textContent='$'+threshold;}\nfunction updateLotThreshold(v){lotThreshold=parseInt(v);document.getElementById('lotValueLabel').textContent='$'+v;}\nfunction setScanMode(mode){scanMode=mode;document.getElementById('modeManualOpt').classList.toggle('selected',mode==='manual');document.getElementById('modeAutoOpt').classList.toggle('selected',mode==='auto');var badge=document.getElementById('modeBadge');badge.textContent=mode.toUpperCase();badge.className='mode-badge'+(mode==='auto'?' auto':'');document.getElementById('scanLine').classList.toggle('active',mode==='auto');setStatus(mode==='auto'?'Point at item':'Ready','ready');stableFrames=0;lastFrameData=null;}\nfunction openSettings(){document.getElementById('settingsPanel').classList.add('open');document.getElementById('settingsBackdrop').classList.add('open');}\nfunction closeSettings(){document.getElementById('settingsPanel').classList.remove('open');document.getElementById('settingsBackdrop').classList.remove('open');}\nfunction selectPack(n){soundPack=n;document.getElementById('pack1Opt').classList.toggle('selected',n===1);document.getElementById('pack2Opt').classList.toggle('selected',n===2);document.getElementById('packToggleBtn').textContent='PACK '+n;playSound('KEEP');}\nfunction cycleSoundPack(){selectPack(soundPack===1?2:1);}\nwindow.addEventListener('load',function(){audioCtx.resume();startCamera();});\ndocument.addEventListener('touchstart',function(){audioCtx.resume();},{once:true});\ndocument.addEventListener('click',function(){audioCtx.resume();},{once:true});\n</script>\n</body>\n</html>";

// Processor HTML
const PROCESSOR_HTML = "<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n<meta charset=\"UTF-8\">\n<meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0, user-scalable=no\">\n<meta name=\"mobile-web-app-capable\" content=\"yes\">\n<meta name=\"apple-mobile-web-app-capable\" content=\"yes\">\n<meta name=\"theme-color\" content=\"#0f0f0f\">\n<title>XRT Processor</title>\n<link href=\"https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Barlow:wght@400;600;700;900&family=DM+Mono:wght@400;500&display=swap\" rel=\"stylesheet\">\n<style>\n:root{\n  --bg:#0f0f0f;--surface:#1a1a1a;--surface2:#222;--border:#2c2c2c;\n  --text:#f2f2f2;--muted:#666;--accent:#e8ff00;\n  --green:#00e676;--red:#ff1744;--orange:#ff9f1c;--blue:#448aff;\n  --display:'Bebas Neue',sans-serif;--body:'Barlow',sans-serif;--mono:'DM Mono',monospace;\n}\n*{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent;}\nhtml,body{height:100%;overflow:hidden;background:var(--bg);font-family:var(--body);color:var(--text);user-select:none;touch-action:manipulation;}\n\n/* \u2500\u2500 SCREENS \u2500\u2500 */\n.screen{position:fixed;inset:0;display:none;flex-direction:column;background:var(--bg);}\n.screen.active{display:flex;}\n\n/* \u2500\u2500 TOP BAR \u2500\u2500 */\n.topbar{\n  display:flex;align-items:center;justify-content:space-between;\n  padding:16px 20px 12px;\n  background:var(--bg);\n  border-bottom:1px solid var(--border);\n  flex-shrink:0;\n}\n.topbar-brand{font-family:var(--display);font-size:1.4rem;letter-spacing:0.06em;color:var(--text);}\n.topbar-brand span{color:var(--accent);}\n.status-dot{width:10px;height:10px;border-radius:50%;background:var(--green);flex-shrink:0;}\n.status-dot.offline{background:var(--orange);}\n.status-dot.error{background:var(--red);}\n.status-row{display:flex;align-items:center;gap:6px;}\n.status-text{font-family:var(--mono);font-size:0.6rem;letter-spacing:0.08em;text-transform:uppercase;color:var(--muted);}\n\n/* \u2500\u2500 PROGRESS BAR \u2500\u2500 */\n.progress-bar{\n  display:flex;gap:4px;padding:12px 20px;\n  background:var(--surface);border-bottom:1px solid var(--border);\n  flex-shrink:0;\n}\n.progress-step{\n  flex:1;height:4px;border-radius:2px;background:var(--border);\n  transition:background 0.3s;\n}\n.progress-step.done{background:var(--green);}\n.progress-step.active{background:var(--accent);}\n\n/* \u2500\u2500 SCROLL CONTENT \u2500\u2500 */\n.scroll-content{flex:1;overflow-y:auto;padding:24px 20px;}\n\n/* \u2500\u2500 HOME SCREEN \u2500\u2500 */\n.home-sku{\n  font-family:var(--display);font-size:5rem;color:var(--accent);\n  line-height:0.9;margin-bottom:4px;\n}\n.home-sku-label{font-family:var(--mono);font-size:0.6rem;letter-spacing:0.15em;text-transform:uppercase;color:var(--muted);margin-bottom:24px;}\n.home-instruction{font-size:1rem;font-weight:600;color:var(--text);margin-bottom:8px;}\n.home-sub{font-size:0.85rem;color:var(--muted);line-height:1.5;margin-bottom:32px;}\n\n.queue-badge{\n  display:inline-flex;align-items:center;gap:8px;\n  background:var(--surface);border:1px solid var(--border);\n  border-radius:8px;padding:10px 14px;margin-bottom:32px;\n  font-family:var(--mono);font-size:0.65rem;letter-spacing:0.08em;color:var(--muted);\n}\n.queue-badge .count{font-family:var(--display);font-size:1.4rem;color:var(--orange);line-height:1;}\n\n/* \u2500\u2500 BUTTONS \u2500\u2500 */\n.btn{\n  width:100%;padding:18px;border:none;border-radius:8px;\n  font-family:var(--display);font-size:1.3rem;letter-spacing:0.06em;\n  cursor:pointer;transition:all 0.15s;margin-bottom:10px;\n}\n.btn-primary{background:var(--accent);color:#000;}\n.btn-primary:active{background:#c8df00;}\n.btn-secondary{background:var(--surface2);color:var(--text);border:1px solid var(--border);}\n.btn-secondary:active{background:#2a2a2a;}\n.btn-danger{background:var(--red);color:#fff;}\n.btn-danger:active{opacity:0.8;}\n.btn-skip{background:transparent;color:var(--muted);border:1px solid var(--border);font-size:1rem;padding:14px;}\n\n/* \u2500\u2500 GRADE BUTTONS \u2500\u2500 */\n.grade-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px;}\n.grade-btn{\n  padding:20px 12px;border:2px solid var(--border);border-radius:10px;\n  background:var(--surface);cursor:pointer;transition:all 0.15s;text-align:center;\n}\n.grade-btn:active{transform:scale(0.96);}\n.grade-btn.selected{border-color:var(--accent);background:rgba(232,255,0,0.06);}\n.grade-letter{font-family:var(--display);font-size:3rem;line-height:1;margin-bottom:4px;color:var(--text);}\n.grade-name{font-size:0.85rem;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.04em;margin-bottom:4px;}\n.grade-desc{font-size:0.75rem;color:var(--muted);line-height:1.4;}\n.grade-btn.selected .grade-letter{color:var(--accent);}\n.grade-btn.selected .grade-name{color:var(--accent);}\n\n/* \u2500\u2500 PASS/FAIL \u2500\u2500 */\n.pf-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px;}\n.pf-btn{\n  padding:24px 12px;border:2px solid var(--border);border-radius:10px;\n  background:var(--surface);cursor:pointer;transition:all 0.15s;text-align:center;\n}\n.pf-btn:active{transform:scale(0.96);}\n.pf-pass.selected{border-color:var(--green);background:rgba(0,230,118,0.06);}\n.pf-fail.selected{border-color:var(--red);background:rgba(255,23,68,0.06);}\n.pf-icon{font-size:2.5rem;margin-bottom:8px;}\n.pf-label{font-family:var(--display);font-size:1.8rem;letter-spacing:0.04em;}\n.pf-pass.selected .pf-label{color:var(--green);}\n.pf-fail.selected .pf-label{color:var(--red);}\n\n/* \u2500\u2500 NOTES \u2500\u2500 */\n.notes-input{\n  width:100%;background:var(--surface2);border:1px solid var(--border);\n  border-radius:8px;padding:14px 16px;color:var(--text);\n  font-family:var(--body);font-size:1rem;line-height:1.5;\n  resize:none;outline:none;min-height:120px;\n  -webkit-appearance:none;\n}\n.notes-input:focus{border-color:var(--accent);}\n.notes-input::placeholder{color:var(--muted);}\n.notes-examples{margin-top:12px;margin-bottom:16px;}\n.notes-example{\n  font-family:var(--mono);font-size:0.6rem;letter-spacing:0.06em;\n  color:var(--muted);padding:4px 0;border-bottom:1px solid var(--border);\n}\n\n/* \u2500\u2500 CAMERA \u2500\u2500 */\n.camera-wrap{\n  position:relative;width:100%;\n  border-radius:8px;overflow:hidden;\n  background:#000;margin-bottom:12px;\n}\n.camera-video{width:100%;display:block;max-height:300px;object-fit:cover;}\n.camera-prompt{\n  position:absolute;bottom:0;left:0;right:0;\n  padding:10px 14px;\n  background:linear-gradient(to top,rgba(0,0,0,0.9),transparent);\n  font-family:var(--mono);font-size:0.6rem;letter-spacing:0.1em;\n  text-transform:uppercase;color:var(--accent);\n}\n.photo-count-badge{\n  position:absolute;top:10px;right:10px;\n  background:rgba(0,0,0,0.7);border-radius:100px;\n  padding:4px 10px;font-family:var(--mono);font-size:0.65rem;color:#fff;\n  letter-spacing:0.06em;\n}\n.photo-thumbs{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px;}\n.photo-thumb{\n  width:60px;height:60px;border-radius:6px;object-fit:cover;\n  border:2px solid var(--border);\n}\n.photo-thumb.new{border-color:var(--accent);}\n.shoot-btn{\n  width:100%;padding:16px;background:var(--surface2);\n  border:2px solid var(--border);border-radius:8px;\n  font-family:var(--display);font-size:1.2rem;letter-spacing:0.06em;\n  color:var(--text);cursor:pointer;margin-bottom:8px;\n  display:flex;align-items:center;justify-content:center;gap:10px;\n}\n.shoot-btn:active{background:#2a2a2a;}\n.shoot-btn svg{width:22px;height:22px;flex-shrink:0;}\n.photo-step-indicator{\n  display:flex;flex-direction:column;gap:4px;margin-bottom:16px;\n}\n.photo-step-item{\n  display:flex;align-items:center;gap:10px;\n  padding:8px 12px;border-radius:6px;\n  font-size:0.85rem;font-weight:600;\n}\n.photo-step-item.done{background:rgba(0,230,118,0.08);color:var(--green);}\n.photo-step-item.current{background:rgba(232,255,0,0.08);color:var(--accent);}\n.photo-step-item.pending{color:var(--muted);}\n.photo-step-num{font-family:var(--mono);font-size:0.65rem;width:20px;flex-shrink:0;}\n\n/* \u2500\u2500 SHELF CAMERA \u2500\u2500 */\n.shelf-result{\n  background:var(--surface2);border:1px solid var(--border);\n  border-radius:8px;padding:16px;text-align:center;margin-bottom:16px;\n}\n.shelf-code{font-family:var(--display);font-size:3.5rem;color:var(--accent);line-height:1;}\n.shelf-code-label{font-family:var(--mono);font-size:0.6rem;letter-spacing:0.12em;color:var(--muted);text-transform:uppercase;margin-top:4px;}\n.shelf-manual{margin-top:12px;}\n.shelf-manual-input{\n  width:100%;background:var(--surface2);border:1px solid var(--border);\n  border-radius:8px;padding:14px 16px;color:var(--text);\n  font-family:var(--mono);font-size:1.2rem;letter-spacing:0.15em;\n  text-align:center;outline:none;-webkit-appearance:none;\n  text-transform:uppercase;\n}\n.shelf-manual-input:focus{border-color:var(--accent);}\n\n/* \u2500\u2500 REVIEW \u2500\u2500 */\n.review-card{\n  background:var(--surface);border:1px solid var(--border);\n  border-radius:10px;overflow:hidden;margin-bottom:16px;\n}\n.review-row{\n  display:flex;justify-content:space-between;align-items:center;\n  padding:12px 16px;border-bottom:1px solid var(--border);\n}\n.review-row:last-child{border-bottom:none;}\n.review-label{font-family:var(--mono);font-size:0.6rem;letter-spacing:0.1em;text-transform:uppercase;color:var(--muted);}\n.review-value{font-size:0.95rem;font-weight:700;color:var(--text);text-align:right;max-width:60%;}\n.review-photos{padding:12px 16px;}\n.review-photo-row{display:flex;gap:6px;flex-wrap:wrap;}\n\n.conflict-banner{\n  background:rgba(255,159,28,0.1);border:1px solid var(--orange);\n  border-radius:8px;padding:12px 16px;margin-bottom:16px;\n  font-size:0.85rem;color:var(--orange);line-height:1.5;\n}\n\n/* \u2500\u2500 SUCCESS \u2500\u2500 */\n.success-icon{font-size:4rem;text-align:center;margin-bottom:16px;}\n.success-sku{font-family:var(--display);font-size:4rem;color:var(--green);text-align:center;line-height:1;margin-bottom:8px;}\n.success-msg{text-align:center;font-size:1rem;color:var(--muted);margin-bottom:32px;line-height:1.6;}\n\n/* \u2500\u2500 SECTION LABELS \u2500\u2500 */\n.section-title{font-family:var(--display);font-size:1.8rem;letter-spacing:0.04em;color:var(--text);margin-bottom:4px;}\n.section-sub{font-size:0.9rem;color:var(--muted);margin-bottom:24px;line-height:1.5;}\n\n/* \u2500\u2500 OFFLINE QUEUE \u2500\u2500 */\n.offline-notice{\n  background:rgba(255,159,28,0.1);border-top:1px solid var(--orange);\n  padding:8px 20px;display:none;\n  font-family:var(--mono);font-size:0.6rem;letter-spacing:0.08em;\n  color:var(--orange);text-align:center;text-transform:uppercase;\n  flex-shrink:0;\n}\n.offline-notice.show{display:block;}\n\ncanvas{display:none;}\n</style>\n</head>\n<body>\n\n<!-- HOME -->\n<div class=\"screen active\" id=\"homeScreen\">\n  <div class=\"topbar\">\n    <div class=\"topbar-brand\">XRT<span>&#183;</span>PROCESSOR</div>\n    <div class=\"status-row\">\n      <div class=\"status-dot\" id=\"statusDot\"></div>\n      <div class=\"status-text\" id=\"statusText\">Online</div>\n    </div>\n  </div>\n  <div class=\"offline-notice\" id=\"offlineNotice\">Offline \u2014 items queued locally</div>\n  <div class=\"scroll-content\">\n    <div style=\"margin-bottom:8px;\">\n      <div class=\"home-sku-label\">Next SKU</div>\n      <div class=\"home-sku\" id=\"homeSku\">---</div>\n    </div>\n    <div class=\"home-instruction\">Ready to process</div>\n    <div class=\"home-sub\">Write the SKU number on a sticker and attach it to the item before starting.</div>\n    <div class=\"queue-badge\" id=\"queueBadge\" style=\"display:none;\">\n      <div class=\"count\" id=\"queueCount\">0</div>\n      <div>items queued \u2014 will upload when online</div>\n    </div>\n    <button class=\"btn btn-primary\" onclick=\"startItem()\">New Item</button>\n    <button class=\"btn btn-secondary\" onclick=\"showBatchTrigger()\">Process Batch Now</button>\n  </div>\n</div>\n\n<!-- GRADE -->\n<div class=\"screen\" id=\"gradeScreen\">\n  <div class=\"topbar\">\n    <div class=\"topbar-brand\">Grade</div>\n    <div class=\"status-text\" id=\"gradeSkuLabel\" style=\"font-family:var(--mono);font-size:0.7rem;color:var(--accent);\">SKU \u2014</div>\n  </div>\n  <div class=\"progress-bar\">\n    <div class=\"progress-step done\"></div>\n    <div class=\"progress-step active\"></div>\n    <div class=\"progress-step\"></div>\n    <div class=\"progress-step\"></div>\n    <div class=\"progress-step\"></div>\n    <div class=\"progress-step\"></div>\n  </div>\n  <div class=\"scroll-content\">\n    <div class=\"section-title\">Assign Grade</div>\n    <div class=\"section-sub\">Pick the grade that matches what you saw and tested. When between two grades, always choose the lower one.</div>\n    <div class=\"grade-grid\">\n      <div class=\"grade-btn\" id=\"gradeA\" onclick=\"selectGrade('A')\">\n        <div class=\"grade-letter\">A</div>\n        <div class=\"grade-name\">Like New</div>\n        <div class=\"grade-desc\">Works perfectly. Looks almost new.</div>\n      </div>\n      <div class=\"grade-btn\" id=\"gradeB\" onclick=\"selectGrade('B')\">\n        <div class=\"grade-letter\">B</div>\n        <div class=\"grade-name\">Good &#9733;</div>\n        <div class=\"grade-desc\">Works perfectly. Normal light wear.</div>\n      </div>\n      <div class=\"grade-btn\" id=\"gradeC\" onclick=\"selectGrade('C')\">\n        <div class=\"grade-letter\">C</div>\n        <div class=\"grade-name\">Fair</div>\n        <div class=\"grade-desc\">Works. Heavy visible wear.</div>\n      </div>\n      <div class=\"grade-btn\" id=\"gradeD\" onclick=\"selectGrade('D')\">\n        <div class=\"grade-letter\">D</div>\n        <div class=\"grade-name\">Parts</div>\n        <div class=\"grade-desc\">Does not work or cannot test.</div>\n      </div>\n    </div>\n    <button class=\"btn btn-primary\" id=\"gradeContinue\" onclick=\"goToPowerTest()\" disabled>Continue</button>\n  </div>\n</div>\n\n<!-- POWER TEST -->\n<div class=\"screen\" id=\"powerScreen\">\n  <div class=\"topbar\">\n    <div class=\"topbar-brand\">Power Test</div>\n    <div class=\"status-text\" id=\"powerSkuLabel\" style=\"font-family:var(--mono);font-size:0.7rem;color:var(--accent);\">SKU \u2014</div>\n  </div>\n  <div class=\"progress-bar\">\n    <div class=\"progress-step done\"></div>\n    <div class=\"progress-step done\"></div>\n    <div class=\"progress-step active\"></div>\n    <div class=\"progress-step\"></div>\n    <div class=\"progress-step\"></div>\n    <div class=\"progress-step\"></div>\n  </div>\n  <div class=\"scroll-content\">\n    <div class=\"section-title\">Power Test Result</div>\n    <div class=\"section-sub\">Did the item power on and perform its basic function?</div>\n    <div class=\"pf-grid\">\n      <div class=\"pf-btn pf-pass\" id=\"pfPass\" onclick=\"selectPowerTest('Pass')\">\n        <div class=\"pf-icon\">&#10003;</div>\n        <div class=\"pf-label\">Pass</div>\n      </div>\n      <div class=\"pf-btn pf-fail\" id=\"pfFail\" onclick=\"selectPowerTest('Fail')\">\n        <div class=\"pf-icon\">&#10007;</div>\n        <div class=\"pf-label\">Fail</div>\n      </div>\n    </div>\n    <div class=\"conflict-banner\" id=\"pfConflict\" style=\"display:none;\">\n      &#9888; Grade <span id=\"conflictGrade\"></span> selected but power test failed. Consider changing grade to D.\n    </div>\n    <button class=\"btn btn-primary\" id=\"pfContinue\" onclick=\"goToNotes()\" disabled>Continue</button>\n  </div>\n</div>\n\n<!-- NOTES -->\n<div class=\"screen\" id=\"notesScreen\">\n  <div class=\"topbar\">\n    <div class=\"topbar-brand\">Notes</div>\n    <div class=\"status-text\" id=\"notesSkuLabel\" style=\"font-family:var(--mono);font-size:0.7rem;color:var(--accent);\">SKU \u2014</div>\n  </div>\n  <div class=\"progress-bar\">\n    <div class=\"progress-step done\"></div>\n    <div class=\"progress-step done\"></div>\n    <div class=\"progress-step done\"></div>\n    <div class=\"progress-step active\"></div>\n    <div class=\"progress-step\"></div>\n    <div class=\"progress-step\"></div>\n  </div>\n  <div class=\"scroll-content\">\n    <div class=\"section-title\">Additional Notes</div>\n    <div class=\"section-sub\">Optional. Add anything not visible in photos \u2014 defects found during testing, what is included, anything unusual.</div>\n    <textarea class=\"notes-input\" id=\"notesInput\" placeholder=\"e.g. Disc tray does not eject. Includes power adapter.\" rows=\"4\"></textarea>\n    <div class=\"notes-examples\">\n      <div class=\"notes-example\">Screen has dead pixel bottom right</div>\n      <div class=\"notes-example\">Powers on, no sound output</div>\n      <div class=\"notes-example\">Includes original box and cables</div>\n      <div class=\"notes-example\">No power cable found</div>\n    </div>\n    <button class=\"btn btn-primary\" onclick=\"goToPhotos()\">Continue</button>\n    <button class=\"btn btn-skip\" onclick=\"goToPhotos()\">Skip \u2014 No Notes</button>\n  </div>\n</div>\n\n<!-- PHOTOS -->\n<div class=\"screen\" id=\"photoScreen\">\n  <div class=\"topbar\">\n    <div class=\"topbar-brand\">Photos</div>\n    <div class=\"status-text\" id=\"photoSkuLabel\" style=\"font-family:var(--mono);font-size:0.7rem;color:var(--accent);\">SKU \u2014</div>\n  </div>\n  <div class=\"progress-bar\">\n    <div class=\"progress-step done\"></div>\n    <div class=\"progress-step done\"></div>\n    <div class=\"progress-step done\"></div>\n    <div class=\"progress-step done\"></div>\n    <div class=\"progress-step active\"></div>\n    <div class=\"progress-step\"></div>\n  </div>\n  <div class=\"scroll-content\">\n    <div class=\"section-title\">Photograph Item</div>\n    <div class=\"section-sub\">Take photos in order. Always include the item body in frame \u2014 never photograph labels alone.</div>\n\n    <div class=\"photo-step-indicator\" id=\"photoStepIndicator\"></div>\n\n    <div class=\"camera-wrap\">\n      <video class=\"camera-video\" id=\"photoVideo\" autoplay playsinline muted></video>\n      <div class=\"camera-prompt\" id=\"cameraPrompt\">Point at item</div>\n      <div class=\"photo-count-badge\" id=\"photoCountBadge\">0 photos</div>\n    </div>\n\n    <button class=\"shoot-btn\" onclick=\"takePhoto()\">\n      <svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\">\n        <path d=\"M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z\"/>\n        <circle cx=\"12\" cy=\"13\" r=\"4\"/>\n      </svg>\n      Take Photo\n    </button>\n\n    <div class=\"photo-thumbs\" id=\"photoThumbs\"></div>\n\n    <button class=\"btn btn-primary\" id=\"photoContinue\" onclick=\"goToShelf()\" style=\"display:none;\">Continue to Shelf Location</button>\n    <button class=\"btn btn-skip\" onclick=\"goToShelf()\">Skip remaining photos</button>\n  </div>\n  <canvas id=\"photoCanvas\"></canvas>\n</div>\n\n<!-- SHELF -->\n<div class=\"screen\" id=\"shelfScreen\">\n  <div class=\"topbar\">\n    <div class=\"topbar-brand\">Shelf</div>\n    <div class=\"status-text\" id=\"shelfSkuLabel\" style=\"font-family:var(--mono);font-size:0.7rem;color:var(--accent);\">SKU \u2014</div>\n  </div>\n  <div class=\"progress-bar\">\n    <div class=\"progress-step done\"></div>\n    <div class=\"progress-step done\"></div>\n    <div class=\"progress-step done\"></div>\n    <div class=\"progress-step done\"></div>\n    <div class=\"progress-step done\"></div>\n    <div class=\"progress-step active\"></div>\n  </div>\n  <div class=\"scroll-content\">\n    <div class=\"section-title\">Shelf Location</div>\n    <div class=\"section-sub\">Photograph the shelf location sticker or type the code manually.</div>\n\n    <div class=\"camera-wrap\" id=\"shelfCameraWrap\">\n      <video class=\"camera-video\" id=\"shelfVideo\" autoplay playsinline muted></video>\n      <div class=\"camera-prompt\">Point at shelf sticker</div>\n    </div>\n\n    <button class=\"shoot-btn\" onclick=\"takeShelfPhoto()\">\n      <svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\">\n        <path d=\"M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z\"/>\n        <circle cx=\"12\" cy=\"13\" r=\"4\"/>\n      </svg>\n      Scan Shelf Sticker\n    </button>\n\n    <div class=\"shelf-result\" id=\"shelfResult\" style=\"display:none;\">\n      <div class=\"shelf-code\" id=\"shelfCode\">--</div>\n      <div class=\"shelf-code-label\">Shelf Location Detected</div>\n    </div>\n\n    <div style=\"margin:12px 0;font-family:var(--mono);font-size:0.6rem;letter-spacing:0.1em;color:var(--muted);text-align:center;text-transform:uppercase;\">or type manually</div>\n\n    <input class=\"shelf-manual-input\" id=\"shelfInput\" type=\"text\" placeholder=\"e.g. F4\" maxlength=\"6\" oninput=\"onShelfInput(this.value)\">\n\n    <div style=\"margin-top:16px;\">\n      <button class=\"btn btn-primary\" id=\"shelfContinue\" onclick=\"goToReview()\" disabled>Continue</button>\n    </div>\n  </div>\n  <canvas id=\"shelfCanvas\"></canvas>\n</div>\n\n<!-- REVIEW -->\n<div class=\"screen\" id=\"reviewScreen\">\n  <div class=\"topbar\">\n    <div class=\"topbar-brand\">Review</div>\n    <div class=\"status-text\" id=\"reviewSkuLabel\" style=\"font-family:var(--mono);font-size:0.7rem;color:var(--accent);\">SKU \u2014</div>\n  </div>\n  <div class=\"scroll-content\">\n    <div class=\"section-title\">Review &amp; Submit</div>\n    <div class=\"section-sub\">Confirm everything looks correct before submitting.</div>\n\n    <div class=\"conflict-banner\" id=\"reviewConflict\" style=\"display:none;\"></div>\n\n    <div class=\"review-card\">\n      <div class=\"review-row\">\n        <div class=\"review-label\">SKU</div>\n        <div class=\"review-value\" id=\"reviewSku\">--</div>\n      </div>\n      <div class=\"review-row\">\n        <div class=\"review-label\">Grade</div>\n        <div class=\"review-value\" id=\"reviewGrade\">--</div>\n      </div>\n      <div class=\"review-row\">\n        <div class=\"review-label\">Power Test</div>\n        <div class=\"review-value\" id=\"reviewPowerTest\">--</div>\n      </div>\n      <div class=\"review-row\">\n        <div class=\"review-label\">Notes</div>\n        <div class=\"review-value\" id=\"reviewNotes\">None</div>\n      </div>\n      <div class=\"review-row\">\n        <div class=\"review-label\">Shelf</div>\n        <div class=\"review-value\" id=\"reviewShelf\">--</div>\n      </div>\n      <div class=\"review-row\">\n        <div class=\"review-label\">Photos</div>\n        <div class=\"review-value\" id=\"reviewPhotoCount\">0 photos</div>\n      </div>\n      <div class=\"review-photos\">\n        <div class=\"review-photo-row\" id=\"reviewPhotoRow\"></div>\n      </div>\n    </div>\n\n    <button class=\"btn btn-primary\" onclick=\"submitItem()\">Submit Item</button>\n    <button class=\"btn btn-secondary\" onclick=\"goBack()\">Go Back &amp; Edit</button>\n  </div>\n</div>\n\n<!-- SUCCESS -->\n<div class=\"screen\" id=\"successScreen\">\n  <div class=\"topbar\">\n    <div class=\"topbar-brand\">XRT<span>&#183;</span>PROCESSOR</div>\n    <div class=\"status-row\">\n      <div class=\"status-dot\" id=\"successDot\"></div>\n    </div>\n  </div>\n  <div class=\"scroll-content\" style=\"display:flex;flex-direction:column;justify-content:center;min-height:calc(100vh - 60px);\">\n    <div class=\"success-icon\">&#10003;</div>\n    <div class=\"success-sku\" id=\"successSku\">1771</div>\n    <div class=\"success-msg\" id=\"successMsg\">Item submitted successfully.<br>Photos uploaded.</div>\n    <button class=\"btn btn-primary\" onclick=\"nextItem()\">Next Item</button>\n    <button class=\"btn btn-secondary\" onclick=\"goHome()\">Back to Home</button>\n  </div>\n</div>\n\n<script>\n// \u2500\u2500 STATE \u2500\u2500\nvar currentItem = {};\nvar photoBlobs = [];\nvar photoB64s = [];\nvar nextSku = 1000;\nvar offlineQueue = [];\nvar isOnline = true;\nvar photoStream = null;\nvar shelfStream = null;\n\nvar photoSteps = [\n  {label:'Everything included \u2014 full shot', key:'full'},\n  {label:'Front of item', key:'front'},\n  {label:'Model/serial label (include item in frame)', key:'label'},\n  {label:'Condition details, ports, damage', key:'detail'},\n  {label:'Powered on \u2014 screen showing', key:'power'},\n  {label:'Weight on scale (last photo)', key:'weight'},\n];\nvar currentPhotoStep = 0;\n\n// \u2500\u2500 INIT \u2500\u2500\nwindow.addEventListener('load', function() {\n  loadNextSku();\n  checkOnline();\n  setInterval(checkOnline, 10000);\n  setInterval(flushQueue, 30000);\n});\n\nfunction loadNextSku() {\n  var stored = localStorage.getItem('xrt_next_sku');\n  nextSku = stored ? parseInt(stored) : 2000;\n  document.getElementById('homeSku').textContent = nextSku;\n}\n\nfunction checkOnline() {\n  fetch('/ping').then(function() {\n    isOnline = true;\n    setStatusDot(true);\n    flushQueue();\n  }).catch(function() {\n    isOnline = false;\n    setStatusDot(false);\n  });\n  updateQueueBadge();\n}\n\nfunction setStatusDot(online) {\n  var dots = document.querySelectorAll('.status-dot');\n  var texts = document.querySelectorAll('#statusText, #successDot');\n  dots.forEach(function(d) { d.className = 'status-dot' + (online ? '' : ' offline'); });\n  var t = document.getElementById('statusText');\n  if(t) t.textContent = online ? 'Online' : 'Offline';\n  var notice = document.getElementById('offlineNotice');\n  if(notice) notice.className = 'offline-notice' + (online ? '' : ' show');\n}\n\nfunction updateQueueBadge() {\n  var q = getOfflineQueue();\n  var badge = document.getElementById('queueBadge');\n  var count = document.getElementById('queueCount');\n  if(q.length > 0) {\n    badge.style.display = 'flex';\n    count.textContent = q.length;\n  } else {\n    badge.style.display = 'none';\n  }\n}\n\nfunction getOfflineQueue() {\n  try { return JSON.parse(localStorage.getItem('xrt_queue') || '[]'); } catch(e) { return []; }\n}\n\nfunction saveOfflineQueue(q) {\n  localStorage.setItem('xrt_queue', JSON.stringify(q));\n}\n\n// \u2500\u2500 NAVIGATION \u2500\u2500\nfunction showScreen(id) {\n  document.querySelectorAll('.screen').forEach(function(s) { s.classList.remove('active'); });\n  document.getElementById(id).classList.add('active');\n}\n\nfunction startItem() {\n  currentItem = { sku: nextSku, grade: null, powerTest: null, notes: '', shelf: '', timestamp: new Date().toISOString() };\n  photoBlobs = [];\n  photoB64s = [];\n  currentPhotoStep = 0;\n  document.getElementById('gradeSkuLabel').textContent = 'SKU ' + nextSku;\n  document.getElementById('powerSkuLabel').textContent = 'SKU ' + nextSku;\n  document.getElementById('notesSkuLabel').textContent = 'SKU ' + nextSku;\n  document.getElementById('photoSkuLabel').textContent = 'SKU ' + nextSku;\n  document.getElementById('shelfSkuLabel').textContent = 'SKU ' + nextSku;\n  document.getElementById('reviewSkuLabel').textContent = 'SKU ' + nextSku;\n  document.querySelectorAll('.grade-btn').forEach(function(b) { b.classList.remove('selected'); });\n  document.querySelectorAll('.pf-btn').forEach(function(b) { b.classList.remove('selected'); });\n  document.getElementById('notesInput').value = '';\n  document.getElementById('gradeContinue').disabled = true;\n  document.getElementById('pfContinue').disabled = true;\n  document.getElementById('pfConflict').style.display = 'none';\n  showScreen('gradeScreen');\n}\n\nfunction goHome() { stopAllCameras(); showScreen('homeScreen'); }\nfunction goBack() { showScreen('reviewScreen'); }\n\n// \u2500\u2500 GRADE \u2500\u2500\nfunction selectGrade(g) {\n  currentItem.grade = g;\n  document.querySelectorAll('.grade-btn').forEach(function(b) { b.classList.remove('selected'); });\n  document.getElementById('grade' + g).classList.add('selected');\n  document.getElementById('gradeContinue').disabled = false;\n}\n\nfunction goToPowerTest() {\n  if(!currentItem.grade) return;\n  showScreen('powerScreen');\n}\n\n// \u2500\u2500 POWER TEST \u2500\u2500\nfunction selectPowerTest(result) {\n  currentItem.powerTest = result;\n  document.querySelectorAll('.pf-btn').forEach(function(b) { b.classList.remove('selected'); });\n  document.getElementById(result === 'Pass' ? 'pfPass' : 'pfFail').classList.add('selected');\n  document.getElementById('pfContinue').disabled = false;\n  var conflict = document.getElementById('pfConflict');\n  if(result === 'Fail' && currentItem.grade && currentItem.grade !== 'D') {\n    document.getElementById('conflictGrade').textContent = currentItem.grade;\n    conflict.style.display = 'block';\n  } else {\n    conflict.style.display = 'none';\n  }\n}\n\nfunction goToNotes() {\n  if(!currentItem.powerTest) return;\n  showScreen('notesScreen');\n}\n\n// \u2500\u2500 NOTES \u2500\u2500\nfunction goToPhotos() {\n  currentItem.notes = document.getElementById('notesInput').value.trim();\n  startPhotoCamera();\n  renderPhotoSteps();\n  showScreen('photoScreen');\n}\n\n// \u2500\u2500 PHOTOS \u2500\u2500\nfunction renderPhotoSteps() {\n  var el = document.getElementById('photoStepIndicator');\n  el.innerHTML = photoSteps.map(function(s, i) {\n    var cls = i < currentPhotoStep ? 'done' : i === currentPhotoStep ? 'current' : 'pending';\n    var icon = i < currentPhotoStep ? '&#10003;' : i === currentPhotoStep ? '&#9654;' : '&#9675;';\n    return '<div class=\"photo-step-item ' + cls + '\"><div class=\"photo-step-num\">' + icon + '</div><div>' + s.label + '</div></div>';\n  }).join('');\n\n  var prompt = document.getElementById('cameraPrompt');\n  if(currentPhotoStep < photoSteps.length) {\n    prompt.textContent = photoSteps[currentPhotoStep].label;\n  } else {\n    prompt.textContent = 'All required photos taken';\n  }\n\n  var count = document.getElementById('photoCountBadge');\n  count.textContent = photoBlobs.length + ' photo' + (photoBlobs.length !== 1 ? 's' : '');\n\n  var cont = document.getElementById('photoContinue');\n  cont.style.display = photoBlobs.length >= 2 ? 'block' : 'none';\n}\n\nfunction startPhotoCamera() {\n  var video = document.getElementById('photoVideo');\n  if(photoStream) return;\n  navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:1280},height:{ideal:720}},audio:false})\n  .then(function(stream) { photoStream = stream; video.srcObject = stream; video.play(); })\n  .catch(function(e) { console.error('Camera error', e); });\n}\n\nfunction takePhoto() {\n  var video = document.getElementById('photoVideo');\n  var canvas = document.getElementById('photoCanvas');\n  if(!video.videoWidth) { alert('Camera not ready yet. Please wait a moment.'); return; }\n  var scale = Math.min(1, 1024/video.videoWidth);\n  canvas.width = Math.round(video.videoWidth * scale);\n  canvas.height = Math.round(video.videoHeight * scale);\n  canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);\n  var b64 = canvas.toDataURL('image/jpeg', 0.82).split(',')[1];\n  photoB64s.push(b64);\n  photoBlobs.push(b64);\n\n  // Add thumbnail\n  var img = document.createElement('img');\n  img.src = 'data:image/jpeg;base64,' + b64;\n  img.className = 'photo-thumb new';\n  img.style.width = '60px';\n  img.style.height = '60px';\n  img.style.objectFit = 'cover';\n  img.style.borderRadius = '6px';\n  img.style.border = '2px solid var(--accent)';\n  document.getElementById('photoThumbs').appendChild(img);\n  setTimeout(function() { img.style.border = '2px solid var(--border)'; }, 1000);\n\n  if(currentPhotoStep < photoSteps.length) currentPhotoStep++;\n  renderPhotoSteps();\n}\n\nfunction stopPhotoCamera() {\n  if(photoStream) { photoStream.getTracks().forEach(function(t){t.stop();}); photoStream = null; }\n}\n\n// \u2500\u2500 SHELF \u2500\u2500\nfunction goToShelf() {\n  stopPhotoCamera();\n  startShelfCamera();\n  document.getElementById('shelfInput').value = '';\n  document.getElementById('shelfResult').style.display = 'none';\n  document.getElementById('shelfContinue').disabled = true;\n  showScreen('shelfScreen');\n}\n\nfunction startShelfCamera() {\n  var video = document.getElementById('shelfVideo');\n  if(shelfStream) return;\n  navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:1280},height:{ideal:720}},audio:false})\n  .then(function(stream) { shelfStream = stream; video.srcObject = stream; video.play(); })\n  .catch(function(e) { console.error('Shelf camera error', e); });\n}\n\nfunction takeShelfPhoto() {\n  var video = document.getElementById('shelfVideo');\n  var canvas = document.getElementById('shelfCanvas');\n  if(!video.videoWidth) { alert('Camera not ready. Please wait.'); return; }\n  canvas.width = video.videoWidth;\n  canvas.height = video.videoHeight;\n  canvas.getContext('2d').drawImage(video, 0, 0);\n  var b64 = canvas.toDataURL('image/jpeg', 0.85).split(',')[1];\n\n  // Send to server to read shelf code via OCR\n  fetch('/api/read-shelf', {\n    method: 'POST',\n    headers: {'Content-Type': 'application/json'},\n    body: JSON.stringify({image: b64})\n  })\n  .then(function(r) { return r.json(); })\n  .then(function(data) {\n    if(data.code) {\n      document.getElementById('shelfCode').textContent = data.code;\n      document.getElementById('shelfResult').style.display = 'block';\n      document.getElementById('shelfInput').value = data.code;\n      currentItem.shelf = data.code;\n      document.getElementById('shelfContinue').disabled = false;\n    } else {\n      alert('Could not read sticker. Please type the code manually below.');\n    }\n  })\n  .catch(function() {\n    alert('Could not read sticker. Please type the code manually below.');\n  });\n}\n\nfunction onShelfInput(val) {\n  var v = val.trim().toUpperCase();\n  currentItem.shelf = v;\n  document.getElementById('shelfContinue').disabled = v.length < 1;\n}\n\nfunction stopShelfCamera() {\n  if(shelfStream) { shelfStream.getTracks().forEach(function(t){t.stop();}); shelfStream = null; }\n}\n\nfunction stopAllCameras() { stopPhotoCamera(); stopShelfCamera(); }\n\n// \u2500\u2500 REVIEW \u2500\u2500\nfunction goToReview() {\n  if(!currentItem.shelf) return;\n  stopShelfCamera();\n\n  document.getElementById('reviewSku').textContent = currentItem.sku;\n  document.getElementById('reviewGrade').textContent = currentItem.grade;\n  document.getElementById('reviewPowerTest').textContent = currentItem.powerTest;\n  document.getElementById('reviewNotes').textContent = currentItem.notes || 'None';\n  document.getElementById('reviewShelf').textContent = currentItem.shelf;\n  document.getElementById('reviewPhotoCount').textContent = photoBlobs.length + ' photos';\n\n  var conflict = document.getElementById('reviewConflict');\n  if(currentItem.powerTest === 'Fail' && currentItem.grade !== 'D') {\n    conflict.textContent = '\u26a0 Grade ' + currentItem.grade + ' selected but power test failed. Processor will flag this for review.';\n    conflict.style.display = 'block';\n  } else {\n    conflict.style.display = 'none';\n  }\n\n  var row = document.getElementById('reviewPhotoRow');\n  row.innerHTML = '';\n  photoBlobs.slice(0,6).forEach(function(b) {\n    var img = document.createElement('img');\n    img.src = 'data:image/jpeg;base64,' + b;\n    img.className = 'photo-thumb';\n    row.appendChild(img);\n  });\n\n  showScreen('reviewScreen');\n}\n\n// \u2500\u2500 SUBMIT \u2500\u2500\nfunction submitItem() {\n  var payload = {\n    sku: currentItem.sku,\n    grade: currentItem.grade,\n    powerTest: currentItem.powerTest,\n    notes: currentItem.notes,\n    shelf: currentItem.shelf,\n    timestamp: currentItem.timestamp,\n    photos: photoB64s\n  };\n\n  if(isOnline) {\n    uploadItem(payload);\n  } else {\n    queueItem(payload);\n    showSuccess(true);\n  }\n}\n\nfunction uploadItem(payload) {\n  fetch('/api/submit-item', {\n    method: 'POST',\n    headers: {'Content-Type': 'application/json'},\n    body: JSON.stringify(payload)\n  })\n  .then(function(r) {\n    if(!r.ok) throw new Error('Server error');\n    return r.json();\n  })\n  .then(function() {\n    advanceSku();\n    showSuccess(false);\n  })\n  .catch(function() {\n    queueItem(payload);\n    showSuccess(true);\n  });\n}\n\nfunction queueItem(payload) {\n  var q = getOfflineQueue();\n  q.push(payload);\n  saveOfflineQueue(q);\n  updateQueueBadge();\n}\n\nfunction flushQueue() {\n  if(!isOnline) return;\n  var q = getOfflineQueue();\n  if(q.length === 0) return;\n  var item = q[0];\n  fetch('/api/submit-item', {\n    method: 'POST',\n    headers: {'Content-Type': 'application/json'},\n    body: JSON.stringify(item)\n  })\n  .then(function(r) {\n    if(!r.ok) throw new Error();\n    q.shift();\n    saveOfflineQueue(q);\n    updateQueueBadge();\n    if(q.length > 0) setTimeout(flushQueue, 2000);\n  })\n  .catch(function() {});\n}\n\nfunction advanceSku() {\n  nextSku++;\n  localStorage.setItem('xrt_next_sku', nextSku);\n}\n\nfunction showSuccess(queued) {\n  advanceSku();\n  document.getElementById('successSku').textContent = currentItem.sku;\n  document.getElementById('successMsg').textContent = queued\n    ? 'Item saved locally.\\nWill upload when WiFi reconnects.'\n    : 'Item submitted.\\nPhotos uploaded to server.';\n  showScreen('successScreen');\n}\n\nfunction nextItem() {\n  document.getElementById('homeSku').textContent = nextSku;\n  startItem();\n}\n\n// \u2500\u2500 BATCH TRIGGER \u2500\u2500\nfunction showBatchTrigger() {\n  fetch('/api/trigger-batch', {method:'POST'})\n  .then(function(r) { return r.json(); })\n  .then(function(d) { alert('Batch processing started. ' + (d.count||0) + ' items queued. You will be notified when complete.'); })\n  .catch(function() { alert('Could not reach server. Make sure you are connected to WiFi.'); });\n}\n</script>\n</body>\n</html>";

function callClaude(payload, callback) {
  var body = JSON.stringify(payload);
  var options = {
    hostname: 'api.anthropic.com',
    path: '/v1/messages',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
      'Content-Length': Buffer.byteLength(body)
    }
  };
  var req = https.request(options, function(res) {
    var data = '';
    res.on('data', function(c) { data += c; });
    res.on('end', function() {
      console.log('[API] Status:', res.statusCode);
      if(res.statusCode !== 200) console.log('[API] Error:', data.slice(0,300));
      try { callback(null, JSON.parse(data)); }
      catch(e) { callback(null, {content:[], type:'error', error:{message:'parse_failed'}}); }
    });
  });
  req.on('error', function(e) { console.log('[API] Network error:', e.message); callback(e); });
  req.write(body);
  req.end();
}

function extractText(content) {
  return (content||[]).filter(function(b){return b.type==='text';}).map(function(b){return b.text;}).join('');
}

function extractResult(text, fallbackName) {
  var depth=0,start=-1;
  for(var i=0;i<text.length;i++){
    if(text[i]==='{'){if(depth===0)start=i;depth++;}
    else if(text[i]==='}' && depth>0){depth--;if(depth===0&&start!==-1){try{return JSON.parse(text.slice(start,i+1));}catch(e){start=-1;}}}
  }
  var vm=text.match(/"verdict"\s*:\s*"(KEEP|LOT|RECYCLE)"/i);
  var nm=text.match(/"item_name"\s*:\s*"([^"]{3,})"/);
  var pm=text.match(/"avg_sold_price"\s*:\s*(\d+(?:\.\d+)?)/);
  var rm=text.match(/"reason"\s*:\s*"([^"]{5,})"/);
  return {
    verdict: vm?vm[1].toUpperCase():'KEEP',
    item_name: nm?nm[1]:(fallbackName||'Set aside for review'),
    avg_sold_price: pm?parseFloat(pm[1]):0,
    reason: rm?rm[1]:'Uncertain - set aside for processor review.'
  };
}

function parseBody(req, callback) {
  var body = '';
  req.on('data', function(c) { body += c; });
  req.on('end', function() {
    try { callback(null, JSON.parse(body)); }
    catch(e) { callback(new Error('Bad JSON')); }
  });
}

function sendJSON(res, code, obj) {
  res.writeHead(code, {'Content-Type':'application/json'});
  res.end(JSON.stringify(obj));
}

const server = http.createServer(function(req, res) {
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Access-Control-Allow-Methods','GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type');
  if(req.method==='OPTIONS'){res.writeHead(204);res.end();return;}

  // ── SCANNER ROUTES ──
  if(req.method==='GET' && req.url==='/'){
    res.writeHead(200,{'Content-Type':'text/html'});
    var scannerPage = SCANNER_HTML.replace('</head>', '<link rel="manifest" href="/manifest-scanner.json"><link rel="apple-touch-icon" href="/icon-scanner-192.png"></head>');
    res.end(scannerPage);
    return;
  }

  if(req.method==='GET' && req.url==='/ping'){
    res.writeHead(200,{'Content-Type':'text/plain'});
    res.end('ok');
    return;
  }

  // PWA manifest for scanner
  if(req.method==='GET' && req.url==='/manifest-scanner.json'){
    res.writeHead(200,{'Content-Type':'application/manifest+json'});
    res.end(JSON.stringify({
      name: 'XRT Floor Scanner',
      short_name: 'XRT Scan',
      description: 'XRT e-waste intake sorting scanner',
      start_url: '/',
      display: 'fullscreen',
      orientation: 'portrait',
      background_color: '#000000',
      theme_color: '#000000',
      icons: [
        {src:'/icon-scanner-192.png', sizes:'192x192', type:'image/png', purpose:'any maskable'},
        {src:'/icon-scanner-512.png', sizes:'512x512', type:'image/png', purpose:'any maskable'}
      ]
    }));
    return;
  }

  // PWA manifest for processor
  if(req.method==='GET' && req.url==='/manifest-processor.json'){
    res.writeHead(200,{'Content-Type':'application/manifest+json'});
    res.end(JSON.stringify({
      name: 'XRT Processor',
      short_name: 'XRT Process',
      description: 'XRT item processing and listing tool',
      start_url: '/processor',
      display: 'fullscreen',
      orientation: 'portrait',
      background_color: '#0f0f0f',
      theme_color: '#0f0f0f',
      icons: [
        {src:'/icon-processor-192.png', sizes:'192x192', type:'image/png', purpose:'any maskable'},
        {src:'/icon-processor-512.png', sizes:'512x512', type:'image/png', purpose:'any maskable'}
      ]
    }));
    return;
  }

  // Icons - generated as PNG from SVG using sharp or canvas
  if(req.method==='GET' && (req.url.startsWith('/icon-scanner') || req.url.startsWith('/icon-processor'))){
    var isScanner = req.url.startsWith('/icon-scanner');
    var size = req.url.includes('512') ? 512 : 192;
    var bg = isScanner ? '#000000' : '#0f0f0f';
    var accent = '#e8ff00';
    var label = isScanner ? 'SCAN' : 'PROC';
    var icon = isScanner ? '&#9711;' : '&#9650;';

    // Generate SVG icon
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="'+size+'" height="'+size+'" viewBox="0 0 '+size+' '+size+'">'
      + '<rect width="'+size+'" height="'+size+'" fill="'+bg+'"/>'
      + '<rect x="'+Math.round(size*0.08)+'" y="'+Math.round(size*0.08)+'" width="'+Math.round(size*0.84)+'" height="'+Math.round(size*0.84)+'" rx="'+Math.round(size*0.12)+'" fill="'+accent+'"/>'
      + '<text x="'+Math.round(size*0.5)+'" y="'+Math.round(size*0.52)+'" font-family="Arial Black,Arial,sans-serif" font-weight="900" font-size="'+Math.round(size*0.32)+'" fill="#000000" text-anchor="middle" dominant-baseline="middle">'+label+'</text>'
      + '<text x="'+Math.round(size*0.5)+'" y="'+Math.round(size*0.78)+'" font-family="Arial,sans-serif" font-weight="700" font-size="'+Math.round(size*0.11)+'" fill="#000000" text-anchor="middle" opacity="0.6">XRT</text>'
      + '</svg>';

    res.writeHead(200,{'Content-Type':'image/svg+xml','Cache-Control':'public,max-age=86400'});
    res.end(svg);
    return;
  }

  if(req.method==='POST' && req.url==='/api/analyze'){
    parseBody(req, function(err, parsed) {
      if(err){sendJSON(res,400,{verdict:'KEEP',item_name:'Bad request',avg_sold_price:0,reason:'Request error.'});return;}

      var thresh=parsed.threshold||30;
      var lotThresh=parsed.lotThreshold||8;
      var image=parsed.image||'';
      console.log('[SCAN] Image:', image.length, '| Sell: $'+thresh+' | Lot: $'+lotThresh);

      if(!image||image.length<100){
        sendJSON(res,200,{verdict:'KEEP',item_name:'Image capture failed - try again',avg_sold_price:0,reason:'Camera did not send a valid image.'});
        return;
      }

      var step1={
        model:'claude-sonnet-4-5',
        max_tokens:250,
        system:'You are an electronics identification expert. Examine this image carefully. Identify the exact brand, model number, and item type. CRITICAL: Always include the item type category in your response even if only a label is visible - use context clues like the label format, any visible housing, or your knowledge of the brand/model to determine what kind of device it is. Never return just a model number alone. Reply with ONLY one line: brand model-number item-type-category. Examples: Cisco WS-C2960-24TT-L Network Switch | Apple A1466 MacBook Air Laptop | Tandy TRS-80 Model III Personal Computer | HP LaserJet 4250 Laser Printer',
        messages:[{role:'user',content:[
          {type:'image',source:{type:'base64',media_type:'image/jpeg',data:image}},
          {type:'text',text:'Identify this item including its device category/type. Even if you only see a label, use the brand and model number to determine what type of device it is. Brand, model number, device type - one line only.'}
        ]}]
      };

      callClaude(step1,function(err,r1){
        if(err||r1.type==='error'){
          sendJSON(res,200,{verdict:'KEEP',item_name:'Scan error - set aside',avg_sold_price:0,reason:'Could not identify item. Set aside for processor review.'});
          return;
        }
        var itemName=extractText(r1.content).trim().replace(/[\r\n]+/g,' ').slice(0,150);
        console.log('[SCAN] Identified:', itemName);
        if(!itemName||itemName.length<3) itemName='Unknown electronic item';

        var step2={
          model:'claude-haiku-4-5',
          max_tokens:500,
          tools:[{type:'web_search_20250305',name:'web_search'}],
          system:[
            'You are an eBay resale pricing expert for an e-waste resale business.',
            'Search eBay COMPLETED/SOLD listings for the given item and return a JSON verdict.',
            '',
            'VERDICT RULES:',
            '- KEEP: avg sold price >= $'+thresh+' as a single unit',
            '- LOT: avg sold price between $'+lotThresh+' and $'+(thresh-1)+' AND strong lot demand on eBay (buyers actively seeking lots of 5+) AND lots sell within 30 days',
            '- RECYCLE: avg sold < $'+lotThresh+', no meaningful market, or lot market is weak/slow',
            '- When uncertain always return KEEP - err on the side of keeping value',
            '- Vintage, specialty, or collector items often have strong markets - search carefully before returning RECYCLE',
            '- If first search returns no results, try a broader search with just brand and item type',
            '- Common vintage electronics (Apple, Tandy, Commodore, Atari, IBM, HP, Compaq) almost always have active eBay markets',
            '- Medical or government-regulated equipment: always RECYCLE',
            '',
            'Return ONLY this JSON, no markdown:',
            '{"verdict":"KEEP","item_name":"name","avg_sold_price":45,"reason":"One plain English sentence for a warehouse employee."}'
          ].join('\n'),
          messages:[{role:'user',content:'Search eBay completed sold listings for: '+itemName+'. What does it sell for? Return JSON verdict only.'}]
        };

        callClaude(step2,function(err2,r2){
          if(err2||r2.type==='error'){
            sendJSON(res,200,{verdict:'KEEP',item_name:itemName,avg_sold_price:0,reason:'Could not retrieve pricing. Set aside for review.'});
            return;
          }
          var text=extractText(r2.content);
          var result=extractResult(text,itemName);
          if(!result.item_name||result.item_name.length<3) result.item_name=itemName;
          console.log('[SCAN] Final:', JSON.stringify(result));
          sendJSON(res,200,result);
        });
      });
    });
    return;
  }

  // ── PROCESSOR ROUTES ──
  if(req.method==='GET' && req.url==='/processor'){
    res.writeHead(200,{'Content-Type':'text/html'});
    var processorPage = PROCESSOR_HTML.replace('</head>', '<link rel="manifest" href="/manifest-processor.json"><link rel="apple-touch-icon" href="/icon-processor-192.png"></head>');
    res.end(processorPage);
    return;
  }

  // Read shelf sticker via OCR
  if(req.method==='POST' && req.url==='/api/read-shelf'){
    parseBody(req, function(err, parsed) {
      if(err){sendJSON(res,400,{error:'Bad request'});return;}
      var image = parsed.image||'';
      if(!image){sendJSON(res,200,{code:null});return;}

      callClaude({
        model:'claude-haiku-4-5',
        max_tokens:50,
        system:'You are reading a shelf location sticker in a warehouse. The sticker contains a short alphanumeric code like F4, E5, A12, B3 etc. Read the code and return ONLY the code itself, nothing else. If you cannot read a clear code, return the word UNCLEAR.',
        messages:[{role:'user',content:[
          {type:'image',source:{type:'base64',media_type:'image/jpeg',data:image}},
          {type:'text',text:'What is the shelf location code on this sticker? Return only the code.'}
        ]}]
      }, function(err, r) {
        if(err||r.type==='error'){sendJSON(res,200,{code:null});return;}
        var code = extractText(r.content).trim().toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,8);
        sendJSON(res,200,{code: code.length > 0 && code !== 'UNCLEAR' ? code : null});
      });
    });
    return;
  }

  // Submit processed item
  if(req.method==='POST' && req.url==='/api/submit-item'){
    parseBody(req, function(err, parsed) {
      if(err){sendJSON(res,400,{error:'Bad request'});return;}

      var sku = parsed.sku;
      var itemDir = path.join(DATA_DIR, 'items', String(sku));
      if(!fs.existsSync(itemDir)) fs.mkdirSync(itemDir, {recursive:true});

      // Save metadata
      var meta = {
        sku: parsed.sku,
        grade: parsed.grade,
        powerTest: parsed.powerTest,
        notes: parsed.notes,
        shelf: parsed.shelf,
        timestamp: parsed.timestamp,
        photoCount: (parsed.photos||[]).length,
        processed: false
      };
      fs.writeFileSync(path.join(itemDir, 'meta.json'), JSON.stringify(meta, null, 2));

      // Save photos
      var photos = parsed.photos||[];
      photos.forEach(function(b64, i) {
        var buf = Buffer.from(b64, 'base64');
        fs.writeFileSync(path.join(itemDir, 'photo_'+(i+1)+'.jpg'), buf);
      });

      console.log('[SUBMIT] SKU', sku, 'saved with', photos.length, 'photos');
      sendJSON(res,200,{success:true, sku:sku});
    });
    return;
  }

  // List pending items (not yet processed into listings)
  if(req.method==='GET' && req.url==='/api/pending-items'){
    var itemsDir = path.join(DATA_DIR, 'items');
    var items = [];
    if(fs.existsSync(itemsDir)) {
      fs.readdirSync(itemsDir).forEach(function(dir) {
        var metaPath = path.join(itemsDir, dir, 'meta.json');
        if(fs.existsSync(metaPath)) {
          try {
            var meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
            if(!meta.processed) items.push(meta);
          } catch(e){}
        }
      });
    }
    sendJSON(res,200,{items:items, count:items.length});
    return;
  }

  // Trigger batch listing generation
  if(req.method==='POST' && req.url==='/api/trigger-batch'){
    var itemsDir = path.join(DATA_DIR, 'items');
    var pending = [];
    if(fs.existsSync(itemsDir)) {
      fs.readdirSync(itemsDir).forEach(function(dir) {
        var metaPath = path.join(itemsDir, dir, 'meta.json');
        if(fs.existsSync(metaPath)) {
          try {
            var meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
            if(!meta.processed) pending.push({meta:meta, dir:path.join(itemsDir,dir)});
          } catch(e){}
        }
      });
    }

    if(pending.length === 0) {
      sendJSON(res,200,{count:0, message:'No pending items to process'});
      return;
    }

    sendJSON(res,200,{count:pending.length, message:'Batch processing started. Items: '+pending.length});

    // Process asynchronously
    processBatch(pending);
    return;
  }

  // Get generated listings
  if(req.method==='GET' && req.url==='/api/listings'){
    var listingPath = path.join(DATA_DIR, 'latest-listings.html');
    if(fs.existsSync(listingPath)) {
      res.writeHead(200,{'Content-Type':'text/html'});
      res.end(fs.readFileSync(listingPath));
    } else {
      res.writeHead(200,{'Content-Type':'text/html'});
      res.end('<html><body><p style="font-family:sans-serif;padding:40px;color:#666;">No listings generated yet. Submit items and trigger a batch first.</p></body></html>');
    }
    return;
  }

  res.writeHead(404);res.end('Not found');
});

// ── BATCH PROCESSOR ──
function processBatch(pending) {
  console.log('[BATCH] Processing', pending.length, 'items');
  var results = [];
  var index = 0;

  function processNext() {
    if(index >= pending.length) {
      generateHTML(results);
      return;
    }
    var item = pending[index];
    index++;
    processItem(item, function(result) {
      results.push(result);
      setTimeout(processNext, 1500);
    });
  }
  processNext();
}

function processItem(item, callback) {
  var meta = item.meta;
  var itemDir = item.dir;
  var sku = meta.sku;

  // Load first photo for identification
  var photo1Path = path.join(itemDir, 'photo_1.jpg');
  if(!fs.existsSync(photo1Path)) {
    callback({sku:sku, meta:meta, error:'No photos found'});
    return;
  }

  var photo1B64 = fs.readFileSync(photo1Path).toString('base64');

  // Load all photos
  var allPhotos = [];
  var i = 1;
  while(fs.existsSync(path.join(itemDir, 'photo_'+i+'.jpg'))) {
    allPhotos.push(fs.readFileSync(path.join(itemDir, 'photo_'+i+'.jpg')).toString('base64'));
    i++;
  }

  console.log('[BATCH] Processing SKU', sku, 'with', allPhotos.length, 'photos');

  // Step 1: Identify item from first photo
  callClaude({
    model: 'claude-sonnet-4-5',
    max_tokens: 400,
    system: 'You are an expert electronics appraiser creating eBay listings for an e-waste resale business. Examine this image and identify the item with precision. Return a JSON object with: item_name (full descriptive name with brand and model), brand, model, serial_number (if visible), category (eBay category path), claude_grade (your own assessment: A=like new, B=normal used, C=heavy wear, D=parts/untested), condition_notes (honest description of what you observe). No markdown.',
    messages:[{role:'user',content:[
      {type:'image',source:{type:'base64',media_type:'image/jpeg',data:photo1B64}},
      {type:'text',text:'Identify this item precisely. Include any visible model numbers or serial numbers. Return JSON only.'}
    ]}]
  }, function(err, r1) {
    if(err||r1.type==='error') { callback({sku:sku, meta:meta, error:'Vision error'}); return; }

    var visionText = extractText(r1.content);
    var visionData = {};
    try {
      var m = visionText.match(/\{[\s\S]*?\}/);
      visionData = JSON.parse(m ? m[0] : visionText);
    } catch(e) {
      visionData = {item_name: visionText.trim().slice(0,100) || 'Unknown item SKU '+sku};
    }

    var itemName = visionData.item_name || 'Unknown item';
    var claudeGrade = visionData.claude_grade || meta.grade;

    // Check grade conflict
    var gradeConflict = null;
    if(claudeGrade && meta.grade && claudeGrade.toUpperCase() !== meta.grade.toUpperCase()) {
      gradeConflict = {processor: meta.grade, claude: claudeGrade.toUpperCase()};
    }

    // Step 2: Research pricing and generate listing
    callClaude({
      model: 'claude-sonnet-4-5',
      max_tokens: 1200,
      tools: [{type:'web_search_20250305', name:'web_search'}],
      system: [
        'You are an experienced eBay seller writing listings for an e-waste resale business based in Clovis, CA.',
        'Search eBay completed/sold listings for the item to get accurate pricing.',
        'Write in an honest, specific tone — neither overselling nor underselling. Describe what is actually there.',
        'Do not include pricing context in the buyer-facing description.',
        'Include serial number in the description when provided.',
        'Use condition grade to inform description tone: A=like new, B=normal used, C=heavy cosmetic wear, D=parts/untested.',
        '',
        'Return ONLY this JSON, no markdown:',
        '{',
        '"title": "eBay title under 80 characters with key search terms",',
        '"condition_box": "2-3 sentence condition description for the eBay condition field",',
        '"description_html": "Full HTML description using simple table and paragraph tags",',
        '"avg_sold_price": 45,',
        '"price_low": 30,',
        '"price_high": 65,',
        '"suggested_price": 48,',
        '"accept_price": 38,',
        '"decline_price": 28,',
        '"shipping": "FedEx Ground or USPS Priority"',
        '}',
      ].join('\n'),
      messages:[{role:'user', content: [
        'Item: '+itemName,
        'Grade: '+(gradeConflict ? gradeConflict.claude+' (processor said '+gradeConflict.processor+')' : (meta.grade||'B')),
        'Power Test: '+(meta.powerTest||'Pass'),
        'Serial Number: '+(visionData.serial_number||'Not visible'),
        'Notes from processor: '+(meta.notes||'None'),
        'Category: '+(visionData.category||'Electronics'),
        'Condition notes from photo: '+(visionData.condition_notes||'See photos'),
        '',
        'Search eBay sold listings for this item and generate the complete listing JSON.'
      ].join('\n')}]
    }, function(err2, r2) {
      if(err2||r2.type==='error') { callback({sku:sku, meta:meta, visionData:visionData, error:'Listing error'}); return; }

      var listingText = extractText(r2.content);
      var listing = {};
      try {
        var m2 = listingText.match(/\{[\s\S]*\}/);
        listing = JSON.parse(m2 ? m2[0] : listingText);
      } catch(e) {
        listing = {title: itemName, condition_box: 'See photos', description_html: '<p>'+itemName+'</p>', avg_sold_price:0};
      }

      // Mark as processed
      meta.processed = true;
      meta.processedAt = new Date().toISOString();
      fs.writeFileSync(path.join(itemDir, 'meta.json'), JSON.stringify(meta, null, 2));

      callback({
        sku: sku,
        meta: meta,
        visionData: visionData,
        listing: listing,
        gradeConflict: gradeConflict,
        allPhotos: allPhotos
      });
    });
  });
}

function generateHTML(results) {
  var date = new Date().toISOString().slice(0,10);
  var skus = results.map(function(r){return r.sku;}).join('-');

  var cards = results.map(function(r) {
    var sku = r.sku;
    var meta = r.meta||{};
    var listing = r.listing||{};
    var vd = r.visionData||{};
    var grade = r.gradeConflict ? r.gradeConflict.claude : (meta.grade||'B');
    var headerColor = grade==='A'?'#2e7d32':grade==='B'?'#1565c0':grade==='C'?'#e65100':'#b71c1c';
    var price = listing.avg_sold_price||0;
    var accept = listing.accept_price||Math.round(price*0.8);
    var decline = listing.decline_price||Math.round(price*0.6);
    var suggest = listing.suggested_price||Math.round(price*0.9);

    var conflictFlag = r.gradeConflict ? (
      '<div style="background:#fff8e1;border-left:4px solid #f9a825;padding:8px 14px;font-size:13px;color:#5d4037;">'
      +'<strong>&#9888; GRADE CONFLICT</strong> — Processor: '+r.gradeConflict.processor+' | Claude: '+r.gradeConflict.claude+'. Claude grade applied. Verify before listing.</div>'
    ) : '';

    var errorFlag = r.error ? (
      '<div style="background:#ffebee;border-left:4px solid #f44336;padding:8px 14px;font-size:13px;color:#b71c1c;">'
      +'<strong>&#9888; ERROR</strong> — '+r.error+'</div>'
    ) : '';

    var title = listing.title || (vd.item_name||'SKU '+sku);
    var condBox = listing.condition_box || 'See photos for condition details.';
    var descHtml = listing.description_html || '<p>'+title+'</p>';

    return '<div style="background:#fff;border-radius:6px;box-shadow:0 1px 4px rgba(0,0,0,0.15);margin-bottom:28px;overflow:hidden;">'
      +'<div style="background:'+headerColor+';color:#fff;padding:12px 16px;display:flex;align-items:center;gap:12px;">'
      +'<span style="background:rgba(255,255,255,0.25);border-radius:4px;padding:2px 8px;font-size:13px;font-weight:bold;">SKU '+sku+'</span>'
      +'<span style="font-size:15px;font-weight:bold;">'+title+'</span>'
      +'<span style="margin-left:auto;background:rgba(255,255,255,0.2);padding:2px 8px;border-radius:4px;font-size:12px;">Grade '+grade+'</span>'
      +'</div>'
      +conflictFlag+errorFlag
      +'<div style="background:#f5f5f5;border-bottom:1px solid #ddd;padding:8px 16px;font-size:12.5px;color:#444;display:flex;flex-wrap:wrap;gap:6px 18px;">'
      +'<span><b>Suggest:</b> $'+suggest+'</span>'
      +'<span><b>Accept:</b> $'+accept+'</span>'
      +'<span><b>Decline:</b> $'+decline+'</span>'
      +'<span><b>Avg Sold:</b> $'+price+'</span>'
      +'<span><b>Range:</b> $'+(listing.price_low||0)+' – $'+(listing.price_high||0)+'</span>'
      +'<span><b>Shelf:</b> '+(meta.shelf||'—')+'</span>'
      +'<span><b>Shipping:</b> '+(listing.shipping||'TBD')+'</span>'
      +'</div>'
      +'<div style="padding:14px 16px;">'
      +'<div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px;">'
      +'<button onclick="copy(this,\''+sku+'_title\')" style="padding:8px 16px;border:none;border-radius:4px;cursor:pointer;font-size:13px;font-weight:bold;background:#1565c0;color:#fff;">Copy Title</button>'
      +'<button onclick="copy(this,\''+sku+'_cond\')" style="padding:8px 16px;border:none;border-radius:4px;cursor:pointer;font-size:13px;font-weight:bold;background:#37474f;color:#fff;">Copy Condition</button>'
      +'<button onclick="copy(this,\''+sku+'_html\')" style="padding:8px 16px;border:none;border-radius:4px;cursor:pointer;font-size:13px;font-weight:bold;background:#2e7d32;color:#fff;">Copy HTML Description</button>'
      +'</div>'
      +'<textarea id="'+sku+'_title" style="display:none;">'+title+'</textarea>'
      +'<textarea id="'+sku+'_cond" style="display:none;">'+condBox+'</textarea>'
      +'<textarea id="'+sku+'_html" style="display:none;">'+descHtml+'</textarea>'
      +'</div></div>';
  }).join('');

  var html = '<!DOCTYPE html><html><head><meta charset="UTF-8">'
    +'<meta name="viewport" content="width=device-width,initial-scale=1">'
    +'<title>XRT Listings — '+date+'</title>'
    +'<style>*{box-sizing:border-box;margin:0;padding:0;}body{font-family:Arial,sans-serif;background:#f0f0f0;padding:20px;}h1{font-size:18px;color:#333;margin-bottom:4px;}.meta{font-size:12px;color:#777;margin-bottom:20px;}</style>'
    +'<script>function copy(btn,id){var el=document.getElementById(id);if(!el)return;navigator.clipboard.writeText(el.value.trim()).then(function(){var o=btn.textContent;btn.textContent=\'Copied!\';setTimeout(function(){btn.textContent=o;},1500);});}<\/script>'
    +'</head><body>'
    +'<h1>XRT eBay Listing Descriptions</h1>'
    +'<p class="meta">Generated '+new Date().toISOString().slice(0,16).replace('T',' ')+' · '+results.length+' items</p>'
    +cards
    +'</body></html>';

  var listingPath = path.join(DATA_DIR, 'latest-listings.html');
  fs.writeFileSync(listingPath, html);
  console.log('[BATCH] Listings generated:', results.length, 'items ->', listingPath);
}

server.listen(PORT, function(){console.log('XRT Server running on port '+PORT);});
