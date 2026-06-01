'use strict';
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const API_KEY = process.env.ANTHROPIC_API_KEY || process.env.anthropic_api_key || '';
const DATA_DIR = process.env.DATA_DIR || '/tmp/xrt-data';

console.log('[STARTUP] API key found:', API_KEY.length > 0);

if(!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, {recursive:true});
if(!fs.existsSync(path.join(DATA_DIR, 'items'))) fs.mkdirSync(path.join(DATA_DIR, 'items'), {recursive:true});

// Server-side SKU counter - shared across all phones
var SKU_FILE = path.join(DATA_DIR, 'sku_counter.json');
function getNextSku(){
  var current = 2000;
  try{ if(fs.existsSync(SKU_FILE)) current = JSON.parse(fs.readFileSync(SKU_FILE,'utf8')).next || 2000; }catch(e){}
  var next = current + 1;
  fs.writeFileSync(SKU_FILE, JSON.stringify({next:next}));
  return current;
}
function peekNextSku(){
  try{ if(fs.existsSync(SKU_FILE)) return JSON.parse(fs.readFileSync(SKU_FILE,'utf8')).next || 2000; }catch(e){}
  return 2000;
}

const SCANNER_HTML = "<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n<meta charset=\"UTF-8\">\n<meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0, user-scalable=no\">\n<meta name=\"mobile-web-app-capable\" content=\"yes\">\n<meta name=\"apple-mobile-web-app-capable\" content=\"yes\">\n<meta name=\"theme-color\" content=\"#000000\">\n<title>XRT Floor Scanner</title>\n<link rel=\"preconnect\" href=\"https://fonts.googleapis.com\">\n<link href=\"https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Mono:wght@400;500&family=Barlow:wght@400;600;700;900&display=swap\" rel=\"stylesheet\">\n<style>\n:root{--bg:#111;--surface:#1a1a1a;--border:#2c2c2c;--text:#f2f2f2;--muted:#555;--accent:#e8ff00;--keep:#00e676;--lot:#ff9f1c;--recycle:#ff1744;--keep-dark:#003d1a;--lot-dark:#3d2000;--recycle-dark:#4a000e;--display:'Bebas Neue',sans-serif;--body:'Barlow',sans-serif;--mono:'DM Mono',monospace;}\n*{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent;}\nhtml,body{height:100%;overflow:hidden;background:#000;font-family:var(--body);color:var(--text);user-select:none;touch-action:manipulation;}\n.screen{position:fixed;inset:0;display:none;flex-direction:column;}.screen.active{display:flex;}\n#scannerScreen{background:#000;}\n#videoEl{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;}\n.vf-overlay{position:absolute;inset:0;pointer-events:none;}\n.vf-corner{position:absolute;width:32px;height:32px;border-color:var(--accent);border-style:solid;opacity:0.85;}\n.vf-corner.tl{top:22%;left:10%;border-width:3px 0 0 3px;}.vf-corner.tr{top:22%;right:10%;border-width:3px 3px 0 0;}\n.vf-corner.bl{bottom:30%;left:10%;border-width:0 0 3px 3px;}.vf-corner.br{bottom:30%;right:10%;border-width:0 3px 3px 0;}\n.scan-line{position:absolute;left:10%;right:10%;height:2px;background:linear-gradient(90deg,transparent,var(--accent),transparent);top:22%;opacity:0;animation:scanAnim 2.4s ease-in-out infinite;}\n.scan-line.active{opacity:1;}@keyframes scanAnim{0%{top:22%;}50%{top:70%;}100%{top:22%;}}\n.scanner-topbar{position:absolute;top:0;left:0;right:0;padding:16px 18px 12px;display:flex;align-items:center;justify-content:space-between;background:linear-gradient(to bottom,rgba(0,0,0,0.88),transparent);z-index:10;}\n.topbar-brand{font-family:var(--display);font-size:1.6rem;letter-spacing:0.06em;color:#fff;line-height:1;}.topbar-brand span{color:var(--accent);}\n.topbar-right{display:flex;gap:10px;align-items:center;}\n.icon-btn{width:40px;height:40px;border-radius:50%;background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.15);display:flex;align-items:center;justify-content:center;cursor:pointer;backdrop-filter:blur(8px);}\n.mode-badge{font-family:var(--mono);font-size:0.58rem;letter-spacing:0.1em;text-transform:uppercase;padding:5px 10px;border-radius:100px;border:1px solid rgba(255,255,255,0.2);color:#ccc;background:rgba(0,0,0,0.4);}\n.mode-badge.auto{color:var(--accent);border-color:rgba(232,255,0,0.4);}\n.status-pill{position:absolute;bottom:28%;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.72);border:1px solid rgba(255,255,255,0.1);backdrop-filter:blur(12px);border-radius:100px;padding:8px 20px;font-family:var(--mono);font-size:0.65rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--muted);white-space:nowrap;transition:all 0.2s;z-index:10;}\n.status-pill.scanning{color:var(--accent);border-color:rgba(232,255,0,0.35);}.status-pill.ready{color:#fff;}.status-pill.waiting{color:var(--lot);border-color:rgba(255,159,28,0.35);}\n.scanner-bottombar{position:absolute;bottom:0;left:0;right:0;padding:16px 24px calc(env(safe-area-inset-bottom) + 18px);background:linear-gradient(to top,rgba(0,0,0,0.92),transparent);z-index:10;display:flex;align-items:center;justify-content:space-between;}\n.threshold-display{display:flex;flex-direction:column;}\n.threshold-display .label{font-family:var(--mono);font-size:0.55rem;color:var(--muted);letter-spacing:0.1em;text-transform:uppercase;}\n.threshold-display .value{font-family:var(--display);font-size:1.8rem;color:var(--accent);line-height:1;}\n.scan-btn{width:72px;height:72px;border-radius:50%;background:#fff;border:3px solid rgba(255,255,255,0.25);display:flex;align-items:center;justify-content:center;cursor:pointer;transition:transform 0.1s,background 0.1s;position:relative;}\n.scan-btn::after{content:'';position:absolute;inset:-7px;border-radius:50%;border:2px solid rgba(255,255,255,0.18);}\n.scan-btn:active{transform:scale(0.91);background:#ddd;}\n.scan-btn.locked{background:#333;cursor:not-allowed;}\n.scan-btn.locked svg{stroke:#666;}\n.scan-btn.locked:active{transform:none;}\n.sound-toggle{display:flex;flex-direction:column;align-items:flex-end;}\n.sound-toggle .label{font-family:var(--mono);font-size:0.55rem;color:var(--muted);letter-spacing:0.1em;text-transform:uppercase;margin-bottom:4px;}\n.pack-btn{background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.14);border-radius:5px;padding:5px 12px;font-family:var(--mono);font-size:0.62rem;color:#ccc;cursor:pointer;letter-spacing:0.06em;}\n#resultScreen{z-index:50;justify-content:center;align-items:center;}\n#resultScreen.keep{background:var(--keep-dark);}\n#resultScreen.lot{background:var(--lot-dark);}\n#resultScreen.recycle{background:var(--recycle-dark);}\n.result-glow{position:absolute;inset:0;pointer-events:none;opacity:0;}\n#resultScreen.keep .result-glow{background:radial-gradient(ellipse at center,rgba(0,230,118,0.2) 0%,transparent 70%);opacity:1;}\n#resultScreen.lot .result-glow{background:radial-gradient(ellipse at center,rgba(255,159,28,0.2) 0%,transparent 70%);opacity:1;}\n#resultScreen.recycle .result-glow{background:radial-gradient(ellipse at center,rgba(255,23,68,0.2) 0%,transparent 70%);opacity:1;}\n.result-inner{position:relative;z-index:2;display:flex;flex-direction:column;align-items:center;padding:0 28px;text-align:center;width:100%;}\n.result-verdict-word{font-family:var(--display);font-size:clamp(5.5rem,24vw,10rem);line-height:0.88;letter-spacing:0.03em;animation:verdictPop 0.32s cubic-bezier(0.34,1.56,0.64,1) both;}\n#resultScreen.keep .result-verdict-word{color:var(--keep);}\n#resultScreen.lot .result-verdict-word{color:var(--lot);}\n#resultScreen.recycle .result-verdict-word{color:var(--recycle);}\n@keyframes verdictPop{from{transform:scale(0.65);opacity:0;}to{transform:scale(1);opacity:1;}}\n.result-divider{width:48px;height:2px;margin:14px auto;opacity:0.35;}\n#resultScreen.keep .result-divider{background:var(--keep);}\n#resultScreen.lot .result-divider{background:var(--lot);}\n#resultScreen.recycle .result-divider{background:var(--recycle);}\n.result-item-name{font-size:1.1rem;font-weight:700;line-height:1.3;color:rgba(255,255,255,0.88);max-width:300px;animation:fadeUp 0.36s 0.12s both;}\n.result-price{font-family:var(--display);font-size:2.8rem;margin-top:10px;animation:fadeUp 0.36s 0.2s both;}\n#resultScreen.keep .result-price{color:var(--keep);}\n#resultScreen.lot .result-price{color:var(--lot);}\n#resultScreen.recycle .result-price{color:var(--recycle);}\n.result-price-label{font-family:var(--mono);font-size:0.58rem;letter-spacing:0.14em;color:rgba(255,255,255,0.38);text-transform:uppercase;margin-top:-2px;animation:fadeUp 0.36s 0.24s both;}\n.result-reason{margin-top:16px;font-size:0.88rem;color:rgba(255,255,255,0.5);max-width:280px;line-height:1.55;animation:fadeUp 0.36s 0.28s both;}\n@keyframes fadeUp{from{opacity:0;transform:translateY(12px);}to{opacity:1;transform:translateY(0);}}\n.result-countdown{position:absolute;bottom:44px;left:50%;transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;gap:8px;}\n.countdown-bar-track{width:130px;height:3px;background:rgba(255,255,255,0.1);border-radius:2px;overflow:hidden;}\n.countdown-bar{height:100%;border-radius:2px;}\n#resultScreen.keep .countdown-bar{background:var(--keep);}\n#resultScreen.lot .countdown-bar{background:var(--lot);}\n#resultScreen.recycle .countdown-bar{background:var(--recycle);}\n.countdown-label{font-family:var(--mono);font-size:0.58rem;letter-spacing:0.1em;color:rgba(255,255,255,0.28);text-transform:uppercase;}\n#loadingScreen{background:#080808;z-index:40;justify-content:center;align-items:center;gap:22px;}\n.loading-ring{width:60px;height:60px;border-radius:50%;border:2px solid var(--border);border-top-color:var(--accent);animation:spin 0.72s linear infinite;}\n@keyframes spin{to{transform:rotate(360deg);}}\n.loading-info{text-align:center;}\n.loading-step{font-family:var(--display);font-size:1.5rem;letter-spacing:0.05em;color:#fff;margin-bottom:5px;}\n.loading-sub{font-family:var(--mono);font-size:0.6rem;color:var(--muted);letter-spacing:0.1em;text-transform:uppercase;}\n#historyScreen{z-index:60;background:var(--bg);flex-direction:column;}\n.history-topbar{padding:16px 18px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--border);}\n.history-title{font-family:var(--display);font-size:1.8rem;letter-spacing:0.04em;}\n.history-actions{display:flex;gap:10px;}\n.history-btn{font-family:var(--mono);font-size:0.6rem;letter-spacing:0.08em;text-transform:uppercase;padding:8px 14px;border-radius:6px;border:1px solid var(--border);background:transparent;color:var(--muted);cursor:pointer;}\n.history-btn.accent{border-color:var(--accent);color:var(--accent);}\n.history-list{flex:1;overflow-y:auto;padding:12px 16px;}\n.history-item{display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid var(--border);}\n.history-verdict{font-family:var(--display);font-size:1.1rem;letter-spacing:0.04em;width:80px;flex-shrink:0;}\n.history-verdict.keep{color:var(--keep);}.history-verdict.lot{color:var(--lot);}.history-verdict.recycle{color:var(--recycle);}\n.history-info{flex:1;min-width:0;}\n.history-name{font-size:0.85rem;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}\n.history-price{font-family:var(--mono);font-size:0.65rem;color:var(--muted);margin-top:2px;}\n.history-time{font-family:var(--mono);font-size:0.58rem;color:var(--border);flex-shrink:0;}\n.history-empty{text-align:center;padding:60px 20px;font-family:var(--mono);font-size:0.65rem;color:var(--muted);letter-spacing:0.08em;text-transform:uppercase;}\n.legend-bar{display:flex;gap:0;border-bottom:1px solid var(--border);}\n.legend-item{flex:1;text-align:center;padding:8px 4px;font-family:var(--mono);font-size:0.55rem;letter-spacing:0.08em;text-transform:uppercase;}\n.legend-item.keep{color:var(--keep);}.legend-item.lot{color:var(--lot);}.legend-item.recycle{color:var(--recycle);}\n#settingsPanel{position:fixed;bottom:0;left:0;right:0;background:var(--surface);border-top:1px solid var(--border);border-radius:20px 20px 0 0;padding:18px 24px calc(env(safe-area-inset-bottom) + 28px);z-index:100;transform:translateY(100%);transition:transform 0.3s cubic-bezier(0.32,0.72,0,1);}\n#settingsPanel.open{transform:translateY(0);}\n.settings-handle{width:40px;height:4px;background:var(--border);border-radius:2px;margin:0 auto 22px;}\n.settings-title{font-family:var(--display);font-size:1.6rem;letter-spacing:0.04em;margin-bottom:26px;}\n.setting-row{margin-bottom:24px;}\n.setting-label{font-family:var(--mono);font-size:0.6rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--muted);margin-bottom:12px;display:flex;justify-content:space-between;align-items:center;}\n.setting-label span{font-size:0.8rem;color:var(--accent);font-family:var(--display);letter-spacing:0.06em;}\n.threshold-slider{width:100%;-webkit-appearance:none;appearance:none;height:4px;background:var(--border);border-radius:2px;outline:none;}\n.threshold-slider::-webkit-slider-thumb{-webkit-appearance:none;width:24px;height:24px;border-radius:50%;background:var(--accent);cursor:pointer;border:3px solid #000;box-shadow:0 0 0 2px var(--accent);}\n.lot-slider::-webkit-slider-thumb{-webkit-appearance:none;width:24px;height:24px;border-radius:50%;background:var(--lot);cursor:pointer;border:3px solid #000;box-shadow:0 0 0 2px var(--lot);}\n.toggle-row{display:grid;grid-template-columns:1fr 1fr;gap:10px;}\n.toggle-opt{border:1.5px solid var(--border);border-radius:10px;padding:14px 16px;cursor:pointer;transition:all 0.15s;text-align:center;}\n.toggle-opt.selected{border-color:var(--accent);background:rgba(232,255,0,0.06);}\n.toggle-opt-name{font-weight:700;font-size:0.95rem;margin-bottom:4px;}\n.toggle-opt-desc{font-family:var(--mono);font-size:0.58rem;color:var(--muted);line-height:1.4;}\n.toggle-opt.selected .toggle-opt-name{color:var(--accent);}\n.settings-close{width:100%;margin-top:6px;padding:15px;background:var(--border);border:none;border-radius:10px;font-family:var(--display);font-size:1.15rem;letter-spacing:0.06em;color:var(--text);cursor:pointer;}\n.settings-backdrop{position:fixed;inset:0;background:rgba(0,0,0,0.65);z-index:99;display:none;backdrop-filter:blur(3px);}\n.settings-backdrop.open{display:block;}\n</style>\n</head>\n<body>\n<div class=\"screen active\" id=\"scannerScreen\">\n  <video id=\"videoEl\" autoplay playsinline muted></video>\n  <canvas id=\"captureCanvas\" style=\"display:none\"></canvas>\n  <div class=\"vf-overlay\">\n    <div class=\"vf-corner tl\"></div><div class=\"vf-corner tr\"></div>\n    <div class=\"vf-corner bl\"></div><div class=\"vf-corner br\"></div>\n    <div class=\"scan-line\" id=\"scanLine\"></div>\n  </div>\n  <div class=\"scanner-topbar\">\n    <div class=\"topbar-brand\">XRT<span>&#183;</span>SCAN</div>\n    <div class=\"topbar-right\">\n      <div class=\"mode-badge\" id=\"modeBadge\">MANUAL</div>\n      <div class=\"icon-btn\" onclick=\"showHistory()\">\n        <svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"white\" stroke-width=\"1.8\" width=\"18\" height=\"18\">\n          <path d=\"M12 8v4l3 3m6-3a9 9 0 1 1-18 0 9 9 0 0 1 18 0z\"/>\n        </svg>\n      </div>\n      <div class=\"icon-btn\" onclick=\"openSettings()\">\n        <svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"white\" stroke-width=\"1.8\" width=\"18\" height=\"18\">\n          <circle cx=\"12\" cy=\"12\" r=\"3\"/>\n          <path d=\"M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z\"/>\n        </svg>\n      </div>\n    </div>\n  </div>\n  <div class=\"status-pill\" id=\"statusPill\">Starting camera...</div>\n  <div class=\"scanner-bottombar\">\n    <div class=\"threshold-display\">\n      <div class=\"label\">Min Value</div>\n      <div class=\"value\" id=\"thresholdDisplay\">$30</div>\n    </div>\n    <div class=\"scan-btn\" id=\"scanBtn\" onclick=\"triggerManualScan()\">\n      <svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"black\" stroke-width=\"2.2\" width=\"30\" height=\"30\">\n        <circle cx=\"11\" cy=\"11\" r=\"8\"/><path d=\"m21 21-4.35-4.35\"/>\n      </svg>\n    </div>\n    <div class=\"sound-toggle\">\n      <div class=\"label\">Sound Pack</div>\n      <div class=\"pack-btn\" id=\"packToggleBtn\" onclick=\"cycleSoundPack()\">PACK 1</div>\n    </div>\n  </div>\n</div>\n\n<div class=\"screen\" id=\"loadingScreen\">\n  <div class=\"loading-ring\"></div>\n  <div class=\"loading-info\">\n    <div class=\"loading-step\" id=\"loadingStep\">Identifying item...</div>\n    <div class=\"loading-sub\" id=\"loadingSub\">Checking eBay sold listings</div>\n  </div>\n</div>\n\n<div class=\"screen\" id=\"resultScreen\" onclick=\"dismissResult()\">\n  <div class=\"result-glow\"></div>\n  <div class=\"result-inner\">\n    <div class=\"result-verdict-word\" id=\"resultVerdict\">KEEP</div>\n    <div class=\"result-divider\"></div>\n    <div class=\"result-item-name\" id=\"resultItemName\">--</div>\n    <div class=\"result-price\" id=\"resultPrice\">--</div>\n    <div class=\"result-price-label\" id=\"resultPriceLabel\">avg sold on eBay</div>\n    <div class=\"result-reason\" id=\"resultReason\">--</div>\n  </div>\n  <div class=\"result-countdown\">\n    <div class=\"countdown-bar-track\">\n      <div class=\"countdown-bar\" id=\"countdownBar\" style=\"width:100%\"></div>\n    </div>\n    <div class=\"countdown-label\">Tap to scan next item</div>\n  </div>\n</div>\n\n<div class=\"screen\" id=\"historyScreen\">\n  <div class=\"history-topbar\">\n    <div class=\"history-title\">Scan History</div>\n    <div class=\"history-actions\">\n      <button class=\"history-btn accent\" onclick=\"copyHistory()\">Export CSV</button>\n      <button class=\"history-btn\" onclick=\"hideHistory()\">Close</button>\n    </div>\n  </div>\n  <div class=\"legend-bar\">\n    <div class=\"legend-item keep\">&#9646; Keep</div>\n    <div class=\"legend-item lot\">&#9646; Lot</div>\n    <div class=\"legend-item recycle\">&#9646; Recycle</div>\n  </div>\n  <div class=\"history-list\" id=\"historyList\">\n    <div class=\"history-empty\">No scans yet this session</div>\n  </div>\n</div>\n\n<div class=\"settings-backdrop\" id=\"settingsBackdrop\" onclick=\"closeSettings()\"></div>\n<div id=\"settingsPanel\">\n  <div class=\"settings-handle\"></div>\n  <div class=\"settings-title\">Settings</div>\n  <div class=\"setting-row\">\n    <div class=\"setting-label\">Sell Threshold (single unit) <span id=\"sliderValueLabel\">$30</span></div>\n    <input type=\"range\" class=\"threshold-slider\" id=\"thresholdSlider\" min=\"20\" max=\"80\" value=\"30\" step=\"5\" oninput=\"updateThreshold(this.value)\">\n  </div>\n  <div class=\"setting-row\">\n    <div class=\"setting-label\">Lot Minimum (per unit) <span id=\"lotValueLabel\">$8</span></div>\n    <input type=\"range\" class=\"threshold-slider lot-slider\" id=\"lotSlider\" min=\"3\" max=\"25\" value=\"8\" step=\"1\" oninput=\"updateLotThreshold(this.value)\">\n  </div>\n  <div class=\"setting-row\">\n    <div class=\"setting-label\">Scan Mode</div>\n    <div class=\"toggle-row\">\n      <div class=\"toggle-opt selected\" id=\"modeManualOpt\" onclick=\"setScanMode('manual')\">\n        <div class=\"toggle-opt-name\">Manual</div>\n        <div class=\"toggle-opt-desc\">Tap button to scan only.</div>\n      </div>\n      <div class=\"toggle-opt\" id=\"modeAutoOpt\" onclick=\"setScanMode('auto')\">\n        <div class=\"toggle-opt-name\">Auto</div>\n        <div class=\"toggle-opt-desc\">Fires when camera is steady.</div>\n      </div>\n    </div>\n  </div>\n  <div class=\"setting-row\">\n    <div class=\"setting-label\">Sound Pack</div>\n    <div class=\"toggle-row\">\n      <div class=\"toggle-opt selected\" id=\"pack1Opt\" onclick=\"selectPack(1)\">\n        <div class=\"toggle-opt-name\">Pack 1</div>\n        <div class=\"toggle-opt-desc\">Cash register / Chime / Buzzer</div>\n      </div>\n      <div class=\"toggle-opt\" id=\"pack2Opt\" onclick=\"selectPack(2)\">\n        <div class=\"toggle-opt-name\">Pack 2</div>\n        <div class=\"toggle-opt-desc\">Rising chime / Ding / Low thud</div>\n      </div>\n    </div>\n  </div>\n  <button class=\"settings-close\" onclick=\"closeSettings()\">Done</button>\n</div>\n\n<script>\nvar threshold=30,lotThreshold=8,soundPack=1,isAnalyzing=false,countdownTimer=null;\nvar lastFrameData=null,stableFrames=0,motionInterval=null,scanMode='manual';\nvar scanLocked=false,cooldownTimer=null,cooldownTick=null;\nvar STABLE_NEEDED=8,MOTION_MS=220,RESULT_MS=5000,COOLDOWN_MS=8000;\nvar scanHistory=[];\nvar audioCtx=new(window.AudioContext||window.webkitAudioContext)();\n\nfunction playCashRegister(){var ctx=audioCtx,now=ctx.currentTime;var c=ctx.createOscillator(),cg=ctx.createGain();c.connect(cg);cg.connect(ctx.destination);c.frequency.setValueAtTime(1200,now);c.frequency.exponentialRampToValueAtTime(800,now+0.05);cg.gain.setValueAtTime(0.28,now);cg.gain.exponentialRampToValueAtTime(0.001,now+0.07);c.start(now);c.stop(now+0.08);[[0.1,1046],[0.18,1318],[0.27,1568]].forEach(function(x){var o=ctx.createOscillator(),g=ctx.createGain();o.connect(g);g.connect(ctx.destination);o.type='sine';o.frequency.value=x[1];g.gain.setValueAtTime(0.26,now+x[0]);g.gain.exponentialRampToValueAtTime(0.001,now+x[0]+0.38);o.start(now+x[0]);o.stop(now+x[0]+0.39);});}\nfunction playMidChime(){var ctx=audioCtx,now=ctx.currentTime;[659,784].forEach(function(f,i){var o=ctx.createOscillator(),g=ctx.createGain();o.type='sine';o.connect(g);g.connect(ctx.destination);o.frequency.value=f;var t=now+i*0.14;g.gain.setValueAtTime(0.28,t);g.gain.exponentialRampToValueAtTime(0.001,t+0.5);o.start(t);o.stop(t+0.51);});}\nfunction playBuzzer(){var ctx=audioCtx,now=ctx.currentTime;[0,0.2].forEach(function(t){var o=ctx.createOscillator(),g=ctx.createGain();o.type='sawtooth';o.connect(g);g.connect(ctx.destination);o.frequency.setValueAtTime(145,now+t);o.frequency.exponentialRampToValueAtTime(88,now+t+0.15);g.gain.setValueAtTime(0.32,now+t);g.gain.exponentialRampToValueAtTime(0.001,now+t+0.16);o.start(now+t);o.stop(now+t+0.17);});}\nfunction playRisingChime(){var ctx=audioCtx,now=ctx.currentTime;[523,659,784,1047].forEach(function(f,i){var o=ctx.createOscillator(),g=ctx.createGain();o.type='sine';o.connect(g);g.connect(ctx.destination);o.frequency.value=f;var t=now+i*0.11;g.gain.setValueAtTime(0.24,t);g.gain.exponentialRampToValueAtTime(0.001,t+0.55);o.start(t);o.stop(t+0.56);});}\nfunction playSingleDing(){var ctx=audioCtx,now=ctx.currentTime;var o=ctx.createOscillator(),g=ctx.createGain();o.type='sine';o.connect(g);g.connect(ctx.destination);o.frequency.value=880;g.gain.setValueAtTime(0.3,now);g.gain.exponentialRampToValueAtTime(0.001,now+0.6);o.start(now);o.stop(now+0.61);}\nfunction playLowThud(){var ctx=audioCtx,now=ctx.currentTime;var o=ctx.createOscillator(),g=ctx.createGain();o.type='sine';o.connect(g);g.connect(ctx.destination);o.frequency.setValueAtTime(185,now);o.frequency.exponentialRampToValueAtTime(50,now+0.24);g.gain.setValueAtTime(0.5,now);g.gain.exponentialRampToValueAtTime(0.001,now+0.28);o.start(now);o.stop(now+0.29);setTimeout(function(){var o2=ctx.createOscillator(),g2=ctx.createGain();o2.type='sine';o2.connect(g2);g2.connect(ctx.destination);o2.frequency.setValueAtTime(120,ctx.currentTime);o2.frequency.exponentialRampToValueAtTime(38,ctx.currentTime+0.2);g2.gain.setValueAtTime(0.3,ctx.currentTime);g2.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+0.22);o2.start(ctx.currentTime);o2.stop(ctx.currentTime+0.23);},170);}\n\nfunction playSound(verdict){\n  audioCtx.resume();\n  var v=verdict.toUpperCase();\n  if(soundPack===1){if(v==='KEEP')playCashRegister();else if(v==='LOT')playMidChime();else playBuzzer();}\n  else{if(v==='KEEP')playRisingChime();else if(v==='LOT')playSingleDing();else playLowThud();}\n}\n\nfunction startCamera(){navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:1280},height:{ideal:720}},audio:false}).then(function(stream){var v=document.getElementById('videoEl');v.srcObject=stream;v.play();setStatus('Ready','ready');startMotionDetection();}).catch(function(e){setStatus('Camera error: '+e.message,'');});}\n\nfunction startMotionDetection(){var video=document.getElementById('videoEl');var canvas=document.getElementById('captureCanvas');if(motionInterval)clearInterval(motionInterval);motionInterval=setInterval(function(){if(isAnalyzing||scanLocked||scanMode!=='auto'||!video.videoWidth)return;canvas.width=80;canvas.height=45;var ctx=canvas.getContext('2d');ctx.drawImage(video,0,0,80,45);var frame=ctx.getImageData(0,0,80,45).data;if(lastFrameData){var diff=0;for(var i=0;i<frame.length;i+=4)diff+=Math.abs(frame[i]-lastFrameData[i]);var avg=diff/(frame.length/4);if(avg<6){stableFrames++;if(stableFrames===3)setStatus('Hold still...','scanning');if(stableFrames>=STABLE_NEEDED){stableFrames=0;lastFrameData=null;captureAndAnalyze();}}else{stableFrames=0;if(!isAnalyzing&&!scanLocked)setStatus('Point at item','');}}lastFrameData=new Uint8ClampedArray(frame);},MOTION_MS);}\n\nfunction captureAndAnalyze(){var video=document.getElementById('videoEl');var canvas=document.getElementById('captureCanvas');var maxW=800;var scale=Math.min(1,maxW/video.videoWidth);canvas.width=Math.round(video.videoWidth*scale);canvas.height=Math.round(video.videoHeight*scale);canvas.getContext('2d').drawImage(video,0,0,canvas.width,canvas.height);analyze(canvas.toDataURL('image/jpeg',0.75).split(',')[1]);}\n\nfunction triggerManualScan(){if(isAnalyzing||scanLocked)return;stableFrames=0;captureAndAnalyze();}\n\nfunction lockScanner(ms){\n  scanLocked=true;\n  var btn=document.getElementById('scanBtn');\n  btn.classList.add('locked');\n  var remaining=Math.ceil(ms/1000);\n  setStatus('Ready in '+remaining+'s...','waiting');\n  if(cooldownTick)clearInterval(cooldownTick);\n  cooldownTick=setInterval(function(){remaining--;if(remaining<=0){clearInterval(cooldownTick);}else{setStatus('Ready in '+remaining+'s...','waiting');}},1000);\n  clearTimeout(cooldownTimer);\n  cooldownTimer=setTimeout(function(){scanLocked=false;btn.classList.remove('locked');setStatus(scanMode==='auto'?'Point at item':'Ready','ready');},ms);\n}\n\nvar steps=[['Identifying item...','Vision scan in progress'],['Searching eBay...','Checking sold listings'],['Evaluating lot potential...','Checking demand velocity'],['Almost done...','Generating verdict']];\n\nfunction analyze(imageBase64){\n  if(isAnalyzing||scanLocked)return;\n  isAnalyzing=true;\n  showScreen('loadingScreen');\n  var si=0;updateStep(0);\n  var iv=setInterval(function(){si=Math.min(si+1,steps.length-1);updateStep(si);},2200);\n  fetch('/api/analyze',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({image:imageBase64,threshold:threshold,lotThreshold:lotThreshold})})\n  .then(function(r){if(!r.ok)throw new Error('HTTP '+r.status);return r.json();})\n  .then(function(data){clearInterval(iv);showResult(data);})\n  .catch(function(e){clearInterval(iv);showResult({verdict:'KEEP',item_name:'Network error - set aside',avg_sold_price:0,reason:'Could not reach server. Set aside for manual review.'});});\n}\n\nfunction updateStep(i){document.getElementById('loadingStep').textContent=steps[i][0];document.getElementById('loadingSub').textContent=steps[i][1];}\n\nfunction showResult(r){\n  var verdict=(r.verdict||'KEEP').toUpperCase();\n  var rs=document.getElementById('resultScreen');\n  var cls=verdict==='KEEP'?'keep':verdict==='LOT'?'lot':'recycle';\n  rs.className='screen active '+cls;\n  document.getElementById('resultVerdict').textContent=verdict;\n  document.getElementById('resultItemName').textContent=r.item_name||'Set aside for review';\n  var priceVal=r.avg_sold_price&&r.avg_sold_price>0?'$'+Number(r.avg_sold_price).toFixed(0):'--';\n  document.getElementById('resultPrice').textContent=priceVal;\n  document.getElementById('resultPriceLabel').textContent=verdict==='LOT'?'est. per unit':'avg sold on eBay';\n  document.getElementById('resultReason').textContent=r.reason||'';\n  showScreen('resultScreen');\n  playSound(verdict);\n  var now=new Date();\n  var timeStr=now.getHours()+':'+(now.getMinutes()<10?'0':'')+now.getMinutes();\n  scanHistory.unshift({verdict:verdict,item_name:r.item_name||'Unknown',avg_sold_price:r.avg_sold_price||0,reason:r.reason||'',time:timeStr});\n  var bar=document.getElementById('countdownBar');\n  bar.style.transition='none';bar.style.width='100%';\n  setTimeout(function(){bar.style.transition='width '+RESULT_MS+'ms linear';bar.style.width='0%';},30);\n  clearTimeout(countdownTimer);\n  countdownTimer=setTimeout(function(){dismissResult();},RESULT_MS);\n}\n\nfunction dismissResult(){\n  clearTimeout(countdownTimer);\n  isAnalyzing=false;stableFrames=0;lastFrameData=null;\n  showScreen('scannerScreen');\n  lockScanner(COOLDOWN_MS);\n}\n\nfunction showScreen(id){document.querySelectorAll('.screen').forEach(function(s){s.classList.remove('active');});document.getElementById(id).classList.add('active');}\nfunction setStatus(t,c){var p=document.getElementById('statusPill');p.textContent=t;p.className='status-pill'+(c?' '+c:'');}\n\nfunction showHistory(){\n  var list=document.getElementById('historyList');\n  if(scanHistory.length===0){list.innerHTML='<div class=\"history-empty\">No scans yet this session</div>';}\n  else{\n    var counts={KEEP:0,LOT:0,RECYCLE:0};\n    scanHistory.forEach(function(s){if(counts[s.verdict]!==undefined)counts[s.verdict]++;});\n    list.innerHTML='<div style=\"font-family:var(--mono);font-size:0.6rem;color:var(--muted);padding:10px 0 16px;letter-spacing:0.08em;\">SESSION: '+scanHistory.length+' scans &nbsp;|&nbsp; <span style=\"color:var(--keep)\">'+counts.KEEP+' KEEP</span> &nbsp;|&nbsp; <span style=\"color:var(--lot)\">'+counts.LOT+' LOT</span> &nbsp;|&nbsp; <span style=\"color:var(--recycle)\">'+counts.RECYCLE+' RECYCLE</span></div>'+\n    scanHistory.map(function(s){\n      var v=s.verdict.toUpperCase();\n      var cls=v==='KEEP'?'keep':v==='LOT'?'lot':'recycle';\n      var price=s.avg_sold_price>0?'$'+Number(s.avg_sold_price).toFixed(0):'--';\n      return '<div class=\"history-item\"><div class=\"history-verdict '+cls+'\">'+v+'</div><div class=\"history-info\"><div class=\"history-name\">'+s.item_name+'</div><div class=\"history-price\">'+price+' &middot; '+s.reason.slice(0,55)+'...</div></div><div class=\"history-time\">'+s.time+'</div></div>';\n    }).join('');\n  }\n  showScreen('historyScreen');\n}\n\nfunction hideHistory(){showScreen('scannerScreen');}\n\nfunction copyHistory(){\n  if(scanHistory.length===0){alert('No scans to export yet.');return;}\n  var csv='Time,Verdict,Item,Avg Unit Price,Reason\\n';\n  csv+=scanHistory.map(function(s){return s.time+','+s.verdict+',\"'+s.item_name.replace(/\"/g,'')+'\",'+s.avg_sold_price+',\"'+s.reason.replace(/\"/g,'')+'\"';}).join('\\n');\n  navigator.clipboard.writeText(csv).then(function(){alert('Copied! Paste into any spreadsheet.');}).catch(function(){alert('Copy failed - try again.');});\n}\n\nfunction updateThreshold(v){threshold=parseInt(v);document.getElementById('sliderValueLabel').textContent='$'+threshold;document.getElementById('thresholdDisplay').textContent='$'+threshold;}\nfunction updateLotThreshold(v){lotThreshold=parseInt(v);document.getElementById('lotValueLabel').textContent='$'+v;}\nfunction setScanMode(mode){scanMode=mode;document.getElementById('modeManualOpt').classList.toggle('selected',mode==='manual');document.getElementById('modeAutoOpt').classList.toggle('selected',mode==='auto');var badge=document.getElementById('modeBadge');badge.textContent=mode.toUpperCase();badge.className='mode-badge'+(mode==='auto'?' auto':'');document.getElementById('scanLine').classList.toggle('active',mode==='auto');setStatus(mode==='auto'?'Point at item':'Ready','ready');stableFrames=0;lastFrameData=null;}\nfunction openSettings(){document.getElementById('settingsPanel').classList.add('open');document.getElementById('settingsBackdrop').classList.add('open');}\nfunction closeSettings(){document.getElementById('settingsPanel').classList.remove('open');document.getElementById('settingsBackdrop').classList.remove('open');}\nfunction selectPack(n){soundPack=n;document.getElementById('pack1Opt').classList.toggle('selected',n===1);document.getElementById('pack2Opt').classList.toggle('selected',n===2);document.getElementById('packToggleBtn').textContent='PACK '+n;playSound('KEEP');}\nfunction cycleSoundPack(){selectPack(soundPack===1?2:1);}\nwindow.addEventListener('load',function(){audioCtx.resume();startCamera();});\ndocument.addEventListener('touchstart',function(){audioCtx.resume();},{once:true});\ndocument.addEventListener('click',function(){audioCtx.resume();},{once:true});\n</script>\n</body>\n</html>";
const PROCESSOR_HTML = "<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n<meta charset=\"UTF-8\">\n<meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0, user-scalable=no\">\n<meta name=\"mobile-web-app-capable\" content=\"yes\">\n<meta name=\"apple-mobile-web-app-capable\" content=\"yes\">\n<meta name=\"theme-color\" content=\"#0f0f0f\">\n<title>XRT Processor</title>\n<link href=\"https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Barlow:wght@400;600;700;900&family=DM+Mono:wght@400;500&display=swap\" rel=\"stylesheet\">\n<style>\n:root{--bg:#0f0f0f;--surface:#1a1a1a;--surface2:#222;--border:#2c2c2c;--text:#f2f2f2;--muted:#666;--accent:#e8ff00;--green:#00e676;--red:#ff1744;--orange:#ff9f1c;--blue:#448aff;--display:'Bebas Neue',sans-serif;--body:'Barlow',sans-serif;--mono:'DM Mono',monospace;}\n*{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent;}\nhtml,body{height:100%;overflow:hidden;background:var(--bg);font-family:var(--body);color:var(--text);user-select:none;touch-action:manipulation;}\n.screen{position:fixed;inset:0;display:none;flex-direction:column;background:var(--bg);}.screen.active{display:flex;}\n.topbar{display:flex;align-items:center;justify-content:space-between;padding:14px 20px 12px;background:var(--bg);border-bottom:1px solid var(--border);flex-shrink:0;gap:10px;}\n.topbar-brand{font-family:var(--display);font-size:1.3rem;letter-spacing:0.06em;color:var(--text);white-space:nowrap;}.topbar-brand span{color:var(--accent);}\n.topbar-right{font-family:var(--mono);font-size:0.65rem;letter-spacing:0.1em;color:var(--accent);text-align:right;}\n.back-btn{background:transparent;border:1px solid var(--border);color:var(--muted);padding:6px 12px;border-radius:6px;font-family:var(--mono);font-size:0.6rem;letter-spacing:0.08em;cursor:pointer;white-space:nowrap;flex-shrink:0;}\n.back-btn:active{background:var(--surface2);}\n.status-dot{width:10px;height:10px;border-radius:50%;background:var(--green);flex-shrink:0;}\n.status-dot.offline{background:var(--orange);}\n.status-row{display:flex;align-items:center;gap:6px;}\n.status-text{font-family:var(--mono);font-size:0.6rem;color:var(--muted);letter-spacing:0.08em;}\n.scroll-content{flex:1;overflow-y:auto;padding:22px 20px;}\n.btn{width:100%;padding:18px;border:none;border-radius:8px;font-family:var(--display);font-size:1.3rem;letter-spacing:0.06em;cursor:pointer;transition:all 0.15s;margin-bottom:10px;}\n.btn-primary{background:var(--accent);color:#000;}.btn-primary:active{background:#c8df00;}\n.btn-primary:disabled{background:var(--border);color:var(--muted);cursor:not-allowed;}\n.btn-secondary{background:var(--surface2);color:var(--text);border:1px solid var(--border);}.btn-secondary:active{background:#2a2a2a;}\n.btn-skip{background:transparent;color:var(--muted);border:1px solid var(--border);font-size:1rem;padding:14px;}\n.section-title{font-family:var(--display);font-size:1.8rem;letter-spacing:0.04em;color:var(--text);margin-bottom:4px;}\n.section-sub{font-size:0.9rem;color:var(--muted);margin-bottom:22px;line-height:1.5;}\n.grade-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px;}\n.grade-btn{padding:20px 12px;border:2px solid var(--border);border-radius:10px;background:var(--surface);cursor:pointer;transition:all 0.15s;text-align:center;}\n.grade-btn:active{transform:scale(0.96);}\n.grade-btn.selected{border-color:var(--accent);background:rgba(232,255,0,0.06);}\n.grade-letter{font-family:var(--display);font-size:3rem;line-height:1;margin-bottom:4px;color:var(--text);}\n.grade-name{font-size:0.85rem;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.04em;margin-bottom:4px;}\n.grade-desc{font-size:0.75rem;color:var(--muted);line-height:1.4;}\n.grade-btn.selected .grade-letter{color:var(--accent);}.grade-btn.selected .grade-name{color:var(--accent);}\n.pf-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px;}\n.pf-btn{padding:24px 12px;border:2px solid var(--border);border-radius:10px;background:var(--surface);cursor:pointer;transition:all 0.15s;text-align:center;}\n.pf-btn:active{transform:scale(0.96);}\n.pf-pass.selected{border-color:var(--green);background:rgba(0,230,118,0.06);}\n.pf-fail.selected{border-color:var(--red);background:rgba(255,23,68,0.06);}\n.pf-icon{font-size:2.5rem;margin-bottom:8px;}\n.pf-label{font-family:var(--display);font-size:1.8rem;letter-spacing:0.04em;}\n.pf-pass.selected .pf-label{color:var(--green);}\n.pf-fail.selected .pf-label{color:var(--red);}\n.conflict-banner{background:rgba(255,159,28,0.1);border:1px solid var(--orange);border-radius:8px;padding:12px 16px;margin-bottom:16px;font-size:0.85rem;color:var(--orange);line-height:1.5;}\n.notes-input{width:100%;background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:14px 16px;color:var(--text);font-family:var(--body);font-size:1rem;line-height:1.5;resize:none;outline:none;min-height:120px;-webkit-appearance:none;}\n.notes-input:focus{border-color:var(--accent);}\n.notes-input::placeholder{color:var(--muted);}\n.notes-example{font-family:var(--mono);font-size:0.6rem;letter-spacing:0.06em;color:var(--muted);padding:4px 0;border-bottom:1px solid var(--border);}\n/* Camera */\n#photoScreen{display:none;flex-direction:column;}\n#photoScreen.active{display:flex;}\n#photoScreen .topbar{flex-shrink:0;}\n#camContainer{flex:1;position:relative;background:#000;overflow:hidden;min-height:0;}\n#photoVideo{position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover;}\n#camPrompt{position:absolute;bottom:60px;left:0;right:0;text-align:center;font-family:var(--mono);font-size:0.6rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--accent);pointer-events:none;}\n#camCount{position:absolute;top:12px;right:12px;background:rgba(0,0,0,0.65);border-radius:100px;padding:4px 12px;font-family:var(--mono);font-size:0.65rem;color:#fff;}\n#camThumbs{position:absolute;bottom:8px;left:12px;display:flex;gap:6px;}\n#camThumbs img{width:44px;height:44px;border-radius:5px;object-fit:cover;border:2px solid rgba(255,255,255,0.4);}\n#photoControls{display:flex;gap:10px;padding:10px 16px;background:var(--bg);flex-shrink:0;border-top:1px solid var(--border);}\n#photoControls button{flex:1;padding:14px;border:none;border-radius:8px;font-family:var(--display);font-size:1rem;letter-spacing:0.05em;cursor:pointer;}\n#shootBtn{background:var(--surface2);color:var(--text);border:2px solid var(--border)!important;display:flex;align-items:center;justify-content:center;gap:8px;}\n#shootBtn:active{background:#2a2a2a;}\n#shootBtn svg{width:18px;height:18px;}\n#photoDoneBtn{background:var(--accent);color:#000;}\n#photoDoneBtn:disabled{background:var(--border);color:var(--muted);}\n#photoSkipBtn{background:transparent;color:var(--muted);border:1px solid var(--border)!important;font-size:0.9rem;max-width:80px;}\n/* Shelf */\n#shelfScreen{display:none;flex-direction:column;}\n#shelfScreen.active{display:flex;}\n#shelfCamContainer{flex:1;position:relative;background:#000;overflow:hidden;}\n#shelfVideo{position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover;}\n#shelfPrompt{position:absolute;bottom:0;left:0;right:0;padding:10px 14px;background:linear-gradient(to top,rgba(0,0,0,0.9),transparent);font-family:var(--mono);font-size:0.6rem;letter-spacing:0.1em;text-transform:uppercase;color:var(--accent);}\n#shelfControls{padding:16px 20px;background:var(--bg);border-top:1px solid var(--border);flex-shrink:0;}\n.shelf-result{background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:16px;text-align:center;margin-bottom:12px;}\n.shelf-code{font-family:var(--display);font-size:3.5rem;color:var(--accent);line-height:1;}\n.shelf-code-label{font-family:var(--mono);font-size:0.6rem;letter-spacing:0.12em;color:var(--muted);text-transform:uppercase;margin-top:4px;}\n.shelf-manual-input{width:100%;background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:14px 16px;color:var(--text);font-family:var(--mono);font-size:1.2rem;letter-spacing:0.15em;text-align:center;outline:none;-webkit-appearance:none;text-transform:uppercase;margin-bottom:12px;}\n.shelf-manual-input:focus{border-color:var(--accent);}\n/* Review */\n.review-card{background:var(--surface);border:1px solid var(--border);border-radius:10px;overflow:hidden;margin-bottom:16px;}\n.review-row{display:flex;justify-content:space-between;align-items:flex-start;padding:12px 16px;border-bottom:1px solid var(--border);}\n.review-row:last-child{border-bottom:none;}\n.review-label{font-family:var(--mono);font-size:0.6rem;letter-spacing:0.1em;text-transform:uppercase;color:var(--muted);flex-shrink:0;margin-right:12px;padding-top:2px;}\n.review-value{font-size:0.9rem;font-weight:600;color:var(--text);text-align:right;}\n/* Success */\n.success-banner{background:rgba(0,230,118,0.08);border:1px solid rgba(0,230,118,0.3);border-radius:8px;padding:12px 16px;margin-bottom:16px;}\n.success-title{font-family:var(--display);font-size:1.3rem;color:var(--green);margin-bottom:4px;}\n.success-sub{font-family:var(--mono);font-size:0.6rem;color:var(--muted);letter-spacing:0.08em;line-height:1.6;}\n.sku-display{font-family:var(--display);font-size:5rem;color:var(--accent);line-height:1;text-align:center;margin-bottom:8px;}\n/* Offline */\n.offline-bar{background:rgba(255,159,28,0.1);border-top:1px solid var(--orange);padding:8px 20px;display:none;font-family:var(--mono);font-size:0.6rem;letter-spacing:0.08em;color:var(--orange);text-align:center;text-transform:uppercase;flex-shrink:0;}\n.offline-bar.show{display:block;}\ncanvas{display:none;}\n</style>\n</head>\n<body>\n\n<!-- HOME -->\n<div class=\"screen active\" id=\"homeScreen\">\n  <div class=\"topbar\">\n    <div class=\"topbar-brand\">XRT<span>&#183;</span>PROC</div>\n    <div class=\"status-row\">\n      <div class=\"status-dot\" id=\"statusDot\"></div>\n      <div class=\"status-text\" id=\"statusText\">Online</div>\n    </div>\n  </div>\n  <div class=\"offline-bar\" id=\"offlineBar\">Offline \u2014 items queued locally</div>\n  <div class=\"scroll-content\" style=\"display:flex;flex-direction:column;justify-content:center;min-height:calc(100vh - 56px);\">\n    <div style=\"margin-bottom:8px;\">\n      <div style=\"font-family:var(--mono);font-size:0.6rem;letter-spacing:0.15em;text-transform:uppercase;color:var(--muted);margin-bottom:4px;\">Next SKU</div>\n      <div style=\"font-family:var(--display);font-size:5rem;color:var(--accent);line-height:0.9;margin-bottom:4px;\" id=\"homeSku\">---</div>\n    </div>\n    <div style=\"font-size:1rem;font-weight:600;color:var(--text);margin-bottom:8px;\">Ready to process</div>\n    <div style=\"font-size:0.85rem;color:var(--muted);line-height:1.5;margin-bottom:28px;\">Write SKU on sticker and attach to item before starting.</div>\n    <div id=\"queueBadge\" style=\"display:none;background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:10px 14px;margin-bottom:20px;font-family:var(--mono);font-size:0.65rem;color:var(--muted);display:none;\">\n      <span style=\"font-family:var(--display);font-size:1.4rem;color:var(--orange);\" id=\"queueNum\">0</span> items queued offline\n    </div>\n    <button class=\"btn btn-primary\" onclick=\"startItem()\">New Item</button>\n    <button class=\"btn btn-secondary\" onclick=\"window.open('/api/listings','_blank')\">View Listings</button>\n  </div>\n</div>\n\n<!-- GRADE -->\n<div class=\"screen\" id=\"gradeScreen\">\n  <div class=\"topbar\">\n    <div class=\"topbar-brand\">Grade</div>\n    <div class=\"topbar-right\" id=\"gradeSkuLabel\">SKU \u2014</div>\n  </div>\n  <div class=\"scroll-content\">\n    <div class=\"section-title\">Assign Grade</div>\n    <div class=\"section-sub\">Pick the grade that matches what you saw and tested. When between two grades, always choose the lower one.</div>\n    <div class=\"grade-grid\">\n      <div class=\"grade-btn\" id=\"gradeA\" onclick=\"selectGrade('A')\"><div class=\"grade-letter\">A</div><div class=\"grade-name\">Like New</div><div class=\"grade-desc\">Works perfectly. Looks almost new.</div></div>\n      <div class=\"grade-btn\" id=\"gradeB\" onclick=\"selectGrade('B')\"><div class=\"grade-letter\">B</div><div class=\"grade-name\">Good &#9733;</div><div class=\"grade-desc\">Works perfectly. Normal light wear.</div></div>\n      <div class=\"grade-btn\" id=\"gradeC\" onclick=\"selectGrade('C')\"><div class=\"grade-letter\">C</div><div class=\"grade-name\">Fair</div><div class=\"grade-desc\">Works. Heavy visible wear.</div></div>\n      <div class=\"grade-btn\" id=\"gradeD\" onclick=\"selectGrade('D')\"><div class=\"grade-letter\">D</div><div class=\"grade-name\">Parts</div><div class=\"grade-desc\">Does not work or untested.</div></div>\n    </div>\n    <button class=\"btn btn-primary\" id=\"gradeContinue\" onclick=\"goToPowerTest()\" disabled>Continue</button>\n    <button class=\"btn btn-skip\" onclick=\"goHome()\">Cancel</button>\n  </div>\n</div>\n\n<!-- POWER TEST -->\n<div class=\"screen\" id=\"powerScreen\">\n  <div class=\"topbar\">\n    <div class=\"topbar-brand\">Power Test</div>\n    <div class=\"topbar-right\" id=\"powerSkuLabel\">SKU \u2014</div>\n    <button class=\"back-btn\" onclick=\"goToGrade()\">&#8592; Back</button>\n  </div>\n  <div class=\"scroll-content\">\n    <div class=\"section-title\">Power Test Result</div>\n    <div class=\"section-sub\">Did the item power on and perform its basic function?</div>\n    <div class=\"pf-grid\">\n      <div class=\"pf-btn pf-pass\" id=\"pfPass\" onclick=\"selectPowerTest('Pass')\">\n        <div class=\"pf-icon\">&#10003;</div>\n        <div class=\"pf-label\">Pass</div>\n      </div>\n      <div class=\"pf-btn pf-fail\" id=\"pfFail\" onclick=\"selectPowerTest('Fail')\">\n        <div class=\"pf-icon\">&#10007;</div>\n        <div class=\"pf-label\">Fail</div>\n      </div>\n    </div>\n    <div class=\"conflict-banner\" id=\"pfConflict\" style=\"display:none;\">\n      &#9888; Grade <span id=\"conflictGrade\"></span> selected but power test failed. Consider changing grade to D.\n    </div>\n    <button class=\"btn btn-primary\" id=\"pfContinue\" onclick=\"goToNotes()\" disabled>Continue</button>\n  </div>\n</div>\n\n<!-- NOTES -->\n<div class=\"screen\" id=\"notesScreen\">\n  <div class=\"topbar\">\n    <div class=\"topbar-brand\">Notes</div>\n    <div class=\"topbar-right\" id=\"notesSkuLabel\">SKU \u2014</div>\n    <button class=\"back-btn\" onclick=\"goToPowerTest()\">&#8592; Back</button>\n  </div>\n  <div class=\"scroll-content\">\n    <div class=\"section-title\">Additional Notes</div>\n    <div class=\"section-sub\">Optional. Anything not visible in photos \u2014 defects, what is included, anything unusual.</div>\n    <textarea class=\"notes-input\" id=\"notesInput\" placeholder=\"e.g. Disc tray does not eject. Includes power adapter.\"></textarea>\n    <div style=\"margin-top:10px;\">\n      <div class=\"notes-example\">Screen has dead pixel bottom right</div>\n      <div class=\"notes-example\">Powers on, no sound output</div>\n      <div class=\"notes-example\">Includes original box and cables</div>\n      <div class=\"notes-example\">No power cable found</div>\n    </div>\n    <br>\n    <button class=\"btn btn-primary\" onclick=\"goToPhotos()\">Continue</button>\n    <button class=\"btn btn-skip\" onclick=\"goToPhotos()\">Skip \u2014 No Notes</button>\n  </div>\n</div>\n\n<!-- PHOTOS -->\n<div class=\"screen\" id=\"photoScreen\">\n  <div class=\"topbar\">\n    <div class=\"topbar-brand\">Photos</div>\n    <div class=\"topbar-right\" id=\"photoSkuLabel\">SKU \u2014</div>\n    <button class=\"back-btn\" onclick=\"goToNotes()\">&#8592; Back</button>\n  </div>\n  <div id=\"camContainer\">\n    <video id=\"photoVideo\" autoplay playsinline muted></video>\n    <div id=\"camPrompt\">Full item, front, label+item, details, weight last</div>\n    <div id=\"camCount\">0 photos</div>\n    <div id=\"camThumbs\"></div>\n  </div>\n  <div id=\"photoControls\">\n    <button id=\"shootBtn\" onclick=\"takePhoto()\">\n      <svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\"><path d=\"M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z\"/><circle cx=\"12\" cy=\"13\" r=\"4\"/></svg>\n      Take Photo\n    </button>\n    <button id=\"photoDoneBtn\" onclick=\"goToShelf()\" disabled>Next &#10003;</button>\n    <button id=\"photoSkipBtn\" onclick=\"goToShelf()\">Skip</button>\n  </div>\n  <canvas id=\"photoCanvas\"></canvas>\n</div>\n\n<!-- SHELF -->\n<div class=\"screen\" id=\"shelfScreen\">\n  <div class=\"topbar\">\n    <div class=\"topbar-brand\">Shelf</div>\n    <div class=\"topbar-right\" id=\"shelfSkuLabel\">SKU \u2014</div>\n    <button class=\"back-btn\" onclick=\"goToPhotos()\">&#8592; Back</button>\n  </div>\n  <div id=\"shelfCamContainer\">\n    <video id=\"shelfVideo\" autoplay playsinline muted></video>\n    <div id=\"shelfPrompt\">Point at shelf location sticker</div>\n  </div>\n  <div id=\"shelfControls\">\n    <button class=\"btn btn-secondary\" style=\"margin-bottom:10px;\" onclick=\"scanShelf()\">\n      &#128247; Scan Shelf Sticker\n    </button>\n    <div id=\"shelfResultBox\" style=\"display:none;\" class=\"shelf-result\">\n      <div class=\"shelf-code\" id=\"shelfCode\">--</div>\n      <div class=\"shelf-code-label\">Shelf Location Detected</div>\n    </div>\n    <div style=\"font-family:var(--mono);font-size:0.6rem;letter-spacing:0.1em;color:var(--muted);text-align:center;text-transform:uppercase;margin-bottom:8px;\">or type manually</div>\n    <input class=\"shelf-manual-input\" id=\"shelfInput\" type=\"text\" placeholder=\"e.g. F4\" maxlength=\"6\" oninput=\"onShelfInput(this.value)\">\n    <button class=\"btn btn-primary\" id=\"shelfContinue\" onclick=\"goToReview()\" disabled>Continue</button>\n  </div>\n  <canvas id=\"shelfCanvas\"></canvas>\n</div>\n\n<!-- REVIEW -->\n<div class=\"screen\" id=\"reviewScreen\">\n  <div class=\"topbar\">\n    <div class=\"topbar-brand\">Review</div>\n    <div class=\"topbar-right\" id=\"reviewSkuLabel\">SKU \u2014</div>\n    <button class=\"back-btn\" onclick=\"goToShelf()\">&#8592; Back</button>\n  </div>\n  <div class=\"scroll-content\">\n    <div class=\"section-title\">Review &amp; Submit</div>\n    <div class=\"section-sub\">Confirm everything looks correct before submitting.</div>\n    <div class=\"conflict-banner\" id=\"reviewConflict\" style=\"display:none;\"></div>\n    <div class=\"review-card\">\n      <div class=\"review-row\"><div class=\"review-label\">SKU</div><div class=\"review-value\" id=\"reviewSku\">--</div></div>\n      <div class=\"review-row\"><div class=\"review-label\">Grade</div><div class=\"review-value\" id=\"reviewGrade\">--</div></div>\n      <div class=\"review-row\"><div class=\"review-label\">Power Test</div><div class=\"review-value\" id=\"reviewPower\">--</div></div>\n      <div class=\"review-row\"><div class=\"review-label\">Notes</div><div class=\"review-value\" id=\"reviewNotes\">None</div></div>\n      <div class=\"review-row\"><div class=\"review-label\">Shelf</div><div class=\"review-value\" id=\"reviewShelf\">--</div></div>\n      <div class=\"review-row\"><div class=\"review-label\">Photos</div><div class=\"review-value\" id=\"reviewPhotos\">0</div></div>\n    </div>\n    <button class=\"btn btn-primary\" onclick=\"submitItem()\">Submit Item</button>\n    <button class=\"btn btn-secondary\" onclick=\"goToShelf()\">Go Back &amp; Edit</button>\n  </div>\n</div>\n\n<!-- SUCCESS -->\n<div class=\"screen\" id=\"successScreen\">\n  <div class=\"topbar\">\n    <div class=\"topbar-brand\">XRT<span>&#183;</span>PROC</div>\n    <div class=\"status-row\">\n      <div class=\"status-dot\" id=\"successDot\"></div>\n    </div>\n  </div>\n  <div class=\"scroll-content\" style=\"display:flex;flex-direction:column;justify-content:center;min-height:calc(100vh - 56px);\">\n    <div class=\"sku-display\" id=\"successSku\">2000</div>\n    <div class=\"success-banner\" style=\"margin-bottom:24px;\">\n      <div class=\"success-title\">&#10003; Submitted</div>\n      <div class=\"success-sub\" id=\"successMsg\">Photos uploaded. Listing generating in background.</div>\n    </div>\n    <button class=\"btn btn-primary\" onclick=\"nextItem()\">Next Item</button>\n    <button class=\"btn btn-secondary\" onclick=\"goHome()\">Back to Home</button>\n  </div>\n</div>\n\n<script>\nvar currentItem={};\nvar photoB64s=[];\nvar photoStream=null;\nvar shelfStream=null;\nvar nextSku=2000;\nvar offlineQueue=[];\nvar isOnline=true;\nvar wakeLock=null;\n\nwindow.addEventListener('load',function(){\n  loadNextSku();\n  checkOnline();\n  setInterval(checkOnline,10000);\n  setInterval(flushQueue,30000);\n});\n\nfunction loadNextSku(){\n  // Fetch next SKU from server - shared across all phones\n  fetch('/api/next-sku')\n  .then(function(r){return r.json();})\n  .then(function(d){\n    nextSku=d.sku||2000;\n    document.getElementById('homeSku').textContent=nextSku;\n  })\n  .catch(function(){\n    // Fallback to localStorage if offline\n    var s=localStorage.getItem('xrt_next_sku');\n    nextSku=s?parseInt(s):2000;\n    document.getElementById('homeSku').textContent=nextSku;\n  });\n}\n\nfunction checkOnline(){\n  fetch('/ping').then(function(){\n    isOnline=true;setStatusDot(true);flushQueue();\n  }).catch(function(){isOnline=false;setStatusDot(false);});\n  updateQueueBadge();\n}\n\nfunction setStatusDot(online){\n  document.querySelectorAll('.status-dot').forEach(function(d){d.className='status-dot'+(online?'':' offline');});\n  var t=document.getElementById('statusText');if(t)t.textContent=online?'Online':'Offline';\n  var bar=document.getElementById('offlineBar');if(bar)bar.className='offline-bar'+(online?'':' show');\n}\n\nfunction getQueue(){try{return JSON.parse(localStorage.getItem('xrt_queue')||'[]');}catch(e){return[];}}\nfunction saveQueue(q){localStorage.setItem('xrt_queue',JSON.stringify(q));}\nfunction updateQueueBadge(){\n  var q=getQueue();\n  var badge=document.getElementById('queueBadge');\n  if(badge){badge.style.display=q.length>0?'flex':'none';}\n  var num=document.getElementById('queueNum');if(num)num.textContent=q.length;\n}\n\nfunction showScreen(id){document.querySelectorAll('.screen').forEach(function(s){s.classList.remove('active');});document.getElementById(id).classList.add('active');}\nfunction goHome(){stopAllCameras();showScreen('homeScreen');}\nfunction goToGrade(){showScreen('gradeScreen');}\nfunction goToPowerTest(){if(!currentItem.grade)return;showScreen('powerScreen');}\nfunction goToNotes(){if(!currentItem.powerTest)return;showScreen('notesScreen');}\n\nfunction goToPhotos(){\n  currentItem.notes=document.getElementById('notesInput').value.trim();\n  document.getElementById('photoSkuLabel').textContent='SKU '+currentItem.sku;\n  startPhotoCamera();showScreen('photoScreen');\n}\n\nfunction goToShelf(){\n  stopPhotoCamera();\n  document.getElementById('shelfSkuLabel').textContent='SKU '+currentItem.sku;\n  document.getElementById('shelfInput').value='';\n  document.getElementById('shelfResultBox').style.display='none';\n  document.getElementById('shelfContinue').disabled=true;\n  startShelfCamera();showScreen('shelfScreen');\n}\n\nfunction goToReview(){\n  stopShelfCamera();\n  document.getElementById('reviewSku').textContent=currentItem.sku;\n  document.getElementById('reviewGrade').textContent=currentItem.grade;\n  document.getElementById('reviewPower').textContent=currentItem.powerTest;\n  document.getElementById('reviewNotes').textContent=currentItem.notes||'None';\n  document.getElementById('reviewShelf').textContent=currentItem.shelf;\n  document.getElementById('reviewPhotos').textContent=photoB64s.length+' photos';\n  var conflict=document.getElementById('reviewConflict');\n  if(currentItem.powerTest==='Fail'&&currentItem.grade!=='D'){\n    conflict.textContent='&#9888; Grade '+currentItem.grade+' with failed power test. Flagged for review.';\n    conflict.style.display='block';\n  } else {conflict.style.display='none';}\n  showScreen('reviewScreen');\n}\n\nfunction startItem(){\n  // Claim next SKU from server before starting\n  fetch('/api/claim-sku',{method:'POST'})\n  .then(function(r){return r.json();})\n  .then(function(d){\n    nextSku=d.sku||nextSku;\n    localStorage.setItem('xrt_next_sku',nextSku); // backup for offline\n    initItem(nextSku);\n  })\n  .catch(function(){\n    // Offline fallback - use local SKU\n    initItem(nextSku);\n  });\n}\n\nfunction initItem(sku){\n  currentItem={sku:sku,grade:null,powerTest:null,notes:'',shelf:'',timestamp:new Date().toISOString()};\n  photoB64s=[];\n  document.querySelectorAll('.grade-btn').forEach(function(b){b.classList.remove('selected');});\n  document.querySelectorAll('.pf-btn').forEach(function(b){b.classList.remove('selected');});\n  document.getElementById('notesInput').value='';\n  document.getElementById('gradeContinue').disabled=true;\n  document.getElementById('pfContinue').disabled=true;\n  document.getElementById('pfConflict').style.display='none';\n  document.getElementById('gradeSkuLabel').textContent='SKU '+sku;\n  document.getElementById('powerSkuLabel').textContent='SKU '+sku;\n  document.getElementById('notesSkuLabel').textContent='SKU '+sku;\n  document.getElementById('camCount').textContent='0 photos';\n  document.getElementById('camThumbs').innerHTML='';\n  document.getElementById('photoDoneBtn').disabled=true;\n  showScreen('gradeScreen');\n}\n\nfunction selectGrade(g){\n  currentItem.grade=g;\n  document.querySelectorAll('.grade-btn').forEach(function(b){b.classList.remove('selected');});\n  document.getElementById('grade'+g).classList.add('selected');\n  document.getElementById('gradeContinue').disabled=false;\n}\n\nfunction selectPowerTest(r){\n  currentItem.powerTest=r;\n  document.querySelectorAll('.pf-btn').forEach(function(b){b.classList.remove('selected');});\n  document.getElementById(r==='Pass'?'pfPass':'pfFail').classList.add('selected');\n  document.getElementById('pfContinue').disabled=false;\n  var conflict=document.getElementById('pfConflict');\n  if(r==='Fail'&&currentItem.grade&&currentItem.grade!=='D'){\n    document.getElementById('conflictGrade').textContent=currentItem.grade;\n    conflict.style.display='block';\n  } else {conflict.style.display='none';}\n}\n\nfunction startPhotoCamera(){\n  var video=document.getElementById('photoVideo');\n  if(photoStream)return;\n  navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:1080},height:{ideal:1920}},audio:false})\n  .then(function(stream){photoStream=stream;video.srcObject=stream;video.play();})\n  .catch(function(e){console.error('Camera error',e);});\n}\n\nfunction playShutter(){\n  try{\n    var ctx=new(window.AudioContext||window.webkitAudioContext)();\n    var buf=ctx.createBuffer(1,Math.floor(ctx.sampleRate*0.06),ctx.sampleRate);\n    var data=buf.getChannelData(0);\n    for(var i=0;i<data.length;i++){data[i]=(Math.random()*2-1)*Math.pow(1-i/data.length,2)*0.15;}\n    var src=ctx.createBufferSource();src.buffer=buf;\n    var gain=ctx.createGain();gain.gain.value=0.15;\n    src.connect(gain);gain.connect(ctx.destination);src.start();\n    setTimeout(function(){ctx.close();},300);\n  }catch(e){}\n}\n\nfunction stopPhotoCamera(){if(photoStream){photoStream.getTracks().forEach(function(t){t.stop();});photoStream=null;}}\n\nfunction startShelfCamera(){\n  var video=document.getElementById('shelfVideo');\n  if(shelfStream)return;\n  navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:1080},height:{ideal:720}},audio:false})\n  .then(function(stream){shelfStream=stream;video.srcObject=stream;video.play();})\n  .catch(function(e){console.error('Shelf camera error',e);});\n}\n\nfunction stopShelfCamera(){if(shelfStream){shelfStream.getTracks().forEach(function(t){t.stop();});shelfStream=null;}}\nfunction stopAllCameras(){stopPhotoCamera();stopShelfCamera();}\n\nfunction acquireWakeLock(){if('wakeLock' in navigator){navigator.wakeLock.request('screen').then(function(wl){wakeLock=wl;}).catch(function(){});}}\nfunction releaseWakeLock(){if(wakeLock){wakeLock.release().catch(function(){});wakeLock=null;}}\n\nfunction playShutter(){\n  try{\n    var ctx=new(window.AudioContext||window.webkitAudioContext)();\n    var buf=ctx.createBuffer(1,Math.floor(ctx.sampleRate*0.06),ctx.sampleRate);\n    var data=buf.getChannelData(0);\n    for(var i=0;i<data.length;i++){data[i]=(Math.random()*2-1)*Math.pow(1-i/data.length,2)*0.15;}\n    var src=ctx.createBufferSource();src.buffer=buf;\n    var gain=ctx.createGain();gain.gain.value=0.15;\n    src.connect(gain);gain.connect(ctx.destination);src.start();\n    setTimeout(function(){ctx.close();},300);\n  }catch(e){}\n}\n\nfunction takePhoto(){\n  var video=document.getElementById('photoVideo');\n  var canvas=document.getElementById('photoCanvas');\n  if(!video.videoWidth){alert('Camera not ready yet.');return;}\n  playShutter();\n  var vw=video.videoWidth,vh=video.videoHeight;\n  var size=Math.min(vw,vh);\n  var srcX=Math.round((vw-size)/2),srcY=Math.round((vh-size)/2);\n  var outSize=Math.min(size,1080);\n  canvas.width=outSize;canvas.height=outSize;\n  canvas.getContext('2d').drawImage(video,srcX,srcY,size,size,0,0,outSize,outSize);\n  var b64=canvas.toDataURL('image/jpeg',0.92).split(',')[1];\n  photoB64s.push(b64);\n  var img=document.createElement('img');\n  img.src='data:image/jpeg;base64,'+b64;\n  document.getElementById('camThumbs').appendChild(img);\n  document.getElementById('camCount').textContent=photoB64s.length+' photo'+(photoB64s.length!==1?'s':'');\n  document.getElementById('photoDoneBtn').disabled=false;\n}\n\nfunction scanShelf(){\n  var video=document.getElementById('shelfVideo');\n  var canvas=document.getElementById('shelfCanvas');\n  if(!video.videoWidth){alert('Camera not ready.');return;}\n  canvas.width=video.videoWidth;canvas.height=video.videoHeight;\n  canvas.getContext('2d').drawImage(video,0,0);\n  var b64=canvas.toDataURL('image/jpeg',0.85).split(',')[1];\n  fetch('/api/read-shelf',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({image:b64})})\n  .then(function(r){return r.json();})\n  .then(function(d){\n    if(d.code){\n      document.getElementById('shelfCode').textContent=d.code;\n      document.getElementById('shelfResultBox').style.display='block';\n      document.getElementById('shelfInput').value=d.code;\n      currentItem.shelf=d.code;\n      document.getElementById('shelfContinue').disabled=false;\n    } else {alert('Could not read sticker. Type code manually below.');}\n  })\n  .catch(function(){alert('Could not read sticker. Type code manually below.');});\n}\n\nfunction onShelfInput(val){\n  var v=val.trim().toUpperCase();\n  currentItem.shelf=v;\n  document.getElementById('shelfContinue').disabled=v.length<1;\n}\n\nfunction submitItem(){\n  var payload={sku:currentItem.sku,grade:currentItem.grade,powerTest:currentItem.powerTest,notes:currentItem.notes,shelf:currentItem.shelf,timestamp:currentItem.timestamp,photos:photoB64s};\n  if(isOnline){uploadItem(payload);}\n  else{queueItem(payload);showSuccess(true);}\n}\n\nfunction uploadItem(payload){\n  acquireWakeLock();\n  fetch('/api/submit-item',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)})\n  .then(function(r){if(!r.ok)throw new Error('Server error');return r.json();})\n  .then(function(){advanceSku();showSuccess(false);releaseWakeLock();})\n  .catch(function(){queueItem(payload);showSuccess(true);releaseWakeLock();});\n}\n\nfunction queueItem(payload){\n  var q=getQueue();q.push(payload);saveQueue(q);updateQueueBadge();\n}\n\nfunction flushQueue(){\n  if(!isOnline)return;\n  var q=getQueue();if(q.length===0)return;\n  var item=q[0];\n  fetch('/api/submit-item',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(item)})\n  .then(function(r){if(!r.ok)throw new Error();q.shift();saveQueue(q);updateQueueBadge();if(q.length>0)setTimeout(flushQueue,2000);})\n  .catch(function(){});\n}\n\nfunction advanceSku(){\n  // Refresh SKU display from server\n  fetch('/api/next-sku')\n  .then(function(r){return r.json();})\n  .then(function(d){\n    nextSku=d.sku||nextSku;\n    document.getElementById('homeSku').textContent=nextSku;\n  })\n  .catch(function(){\n    nextSku++;\n    document.getElementById('homeSku').textContent=nextSku;\n  });\n}\n\nfunction showSuccess(queued){\n  document.getElementById('successSku').textContent=currentItem.sku;\n  document.getElementById('successMsg').textContent=queued?'Saved locally. Will upload when WiFi reconnects.':'Photos uploaded. Listing generating in background.';\n  showScreen('successScreen');\n}\n\nfunction nextItem(){advanceSku();document.getElementById('homeSku').textContent=nextSku;startItem();}\n</script>\n</body>\n</html>";

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

  // Get next SKU from server (shared across all phones)
  if(req.method==='GET' && req.url==='/api/next-sku'){
    var nextSku = peekNextSku();
    sendJSON(res,200,{sku:nextSku});
    return;
  }

  // Claim next SKU (called when processor starts a new item)
  if(req.method==='POST' && req.url==='/api/claim-sku'){
    var claimedSku = getNextSku();
    console.log('[SKU] Claimed SKU:', claimedSku);
    sendJSON(res,200,{sku:claimedSku});
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
            'Base your verdict ONLY on what you actually find in eBay completed/sold search results. Never infer or assume demand.',
            '',
            'SEARCH STRATEGY:',
            '1. Search eBay completed sold listings for the single unit price of the item.',
            '2. If single unit price is below $'+thresh+': do a SECOND search specifically for completed LOT listings of this item (search "lot of [item] sold" on eBay).',
            '3. Only assign LOT if you find real evidence of lot sales in your search results.',
            '',
            'VERDICT RULES:',
            '- KEEP: single unit avg sold price >= $'+thresh,
            '- LOT: ALL of the following must be true based on actual search results:',
            '    * Single unit price is between $'+lotThresh+' and $'+(thresh-1),
            '    * You found 3 or more completed lot sales in the last 90 days on eBay',
            '    * The lot total sale price is at least $30',
            '    * The per-unit value within those lots is at least $10 per item (e.g. lot of 3 must sell for $30+, lot of 5 must sell for $50+)',
            '    * Pricing is consistent — not just one outlier sale',
            '    * Common genuine lot items: office phones, VoIP phones, network switches, keyboards, RAM sticks, power supplies',
            '- RECYCLE: single unit avg sold < $'+lotThresh+', OR no meaningful eBay market, OR lot search found fewer than 3 completed lot sales, OR lot per-unit value is below $10',
            '- When single unit price is uncertain return KEEP',
            '- Vintage electronics (Apple, Tandy, Commodore, Atari, IBM, HP vintage) almost always have eBay markets — search carefully before returning RECYCLE',
            '- Medical or regulated equipment: always RECYCLE',
            '',
            'CRITICAL: If your lot search found zero or fewer than 3 completed lot listings — return RECYCLE, not LOT.',
            'CRITICAL: If the lot per-unit value is under $10 — return RECYCLE, not LOT.',
            'Never assign LOT based on assumptions. Only assign LOT when search results prove it.',
            '',
            'Return ONLY this JSON, no markdown:',
            '{"verdict":"KEEP","item_name":"name","avg_sold_price":45,"reason":"One plain English sentence for a warehouse employee. If LOT cite the lot evidence: how many lot sales found and typical lot price."}'
          ].join('\n'),
          messages:[{role:'user',content:'Search eBay completed sold listings for: '+itemName+'. First check single unit price. If below $'+thresh+', do a second search for completed lot listings of this specific item. Return JSON verdict based only on what your searches actually found — not assumptions.'}]
        };

        callClaude(step2,function(err2,r2){
          if(err2||r2.type==='error'){
            sendJSON(res,200,{verdict:'KEEP',item_name:itemName,avg_sold_price:0,reason:'Could not retrieve pricing. Set aside for review.'});
            return;
          }
          var text=extractText(r2.content);
          var result=extractResult(text,itemName);
          if(!result.item_name||result.item_name.length<3) result.item_name=itemName;

          // SERVER-SIDE VERDICT ENFORCEMENT
          // KEEP threshold is hard — if price >= threshold, always KEEP regardless of AI verdict
          // Below threshold — trust AI on LOT vs RECYCLE since AI evaluated actual lot demand
          var price = result.avg_sold_price || 0;
          if(price > 0) {
            if(price >= thresh) {
              // Price clears threshold — force KEEP
              result.verdict = 'KEEP';
            } else if(price < lotThresh) {
              // Price below lot minimum — force RECYCLE regardless of AI
              result.verdict = 'RECYCLE';
            }
            // Between lotThresh and thresh — trust AI verdict (LOT or RECYCLE)
            // AI evaluated whether actual lot demand exists on eBay
          } else {
            // No price found — default KEEP (err on side of value)
            result.verdict = 'KEEP';
          }

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

      // Auto-generate listing in background
      setTimeout(function(){
        var pendingDir = path.join(itemsDir, String(sku));
        var metaPath = path.join(pendingDir, 'meta.json');
        if(fs.existsSync(metaPath)){
          try {
            var itemMeta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
            if(!itemMeta.processed){
              console.log('[AUTO-LIST] Starting background listing for SKU', sku);
              processItem({meta:itemMeta, dir:pendingDir}, function(result){
                var listings = loadListings();
                listings.unshift(result);
                saveListings(listings);
                console.log('[AUTO-LIST] Complete for SKU', sku);
              });
            }
          } catch(e){ console.log('[AUTO-LIST] Error:', e.message); }
        }
      }, 500);
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
            if(!meta.processed){
              meta.itemId = dir; // expose itemId for photo fetching
              items.push(meta);
            }
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
    var listings = loadListings();
    if(listings.length === 0){
      res.writeHead(200,{'Content-Type':'text/html'});
      res.end('<html><body><p style="font-family:sans-serif;padding:40px;color:#666;">No listings yet. Submit items via the processor app and they will appear here automatically.</p></body></html>');
    } else {
      res.writeHead(200,{'Content-Type':'text/html'});
      res.end(generateListingsPage(listings));
    }
    return;
  }

  res.writeHead(404);res.end('Not found');
});

// ── LISTINGS STORAGE ──
function loadListings(){
  var lp = path.join(DATA_DIR, 'listings.json');
  try{ if(fs.existsSync(lp)) return JSON.parse(fs.readFileSync(lp,'utf8')); }catch(e){}
  return [];
}
function saveListings(listings){
  var lp = path.join(DATA_DIR, 'listings.json');
  try{ fs.writeFileSync(lp, JSON.stringify(listings)); }catch(e){ console.log('[SAVE] Error:',e.message); }
}

// ── LISTINGS HTML PAGE ──
function generateListingsPage(listings){
  var colors=['#1565c0','#2e7d32','#e65100','#6a1b9a','#00838f','#c62828','#37474f','#558b2f'];
  var cards = listings.map(function(r, i) {
    var sku = r.sku;
    var meta = r.meta||{};
    var listing = r.listing||{};
    var grade = r.gradeConflict ? r.gradeConflict.claude : (meta.grade||'B');
    var headerColor = colors[i%colors.length];
    var price = listing.avg_sold_price||0;
    var suggest = listing.suggested_price||Math.round(price*0.9);
    var accept = listing.accept_price||Math.round(price*0.8);
    var decline = listing.decline_price||Math.round(price*0.6);

    var conflictFlag = r.gradeConflict ?
      '<div style="background:#fff8e1;border-left:4px solid #f9a825;padding:8px 14px;font-size:13px;color:#5d4037;"><strong>&#9888; GRADE CONFLICT</strong> — Processor: '+r.gradeConflict.processor+' | Claude: '+r.gradeConflict.claude+'. Claude grade applied.</div>' : '';

    var title = listing.title || (r.visionData&&r.visionData.item_name)||('SKU '+sku);
    var condBox = listing.condition_box || 'See photos for condition details.';
    var descHtml = listing.description_html || '<p>'+title+'</p>';

    return '<div style="background:#fff;border-radius:6px;box-shadow:0 1px 4px rgba(0,0,0,0.15);margin-bottom:28px;overflow:hidden;">'
      +'<div style="background:'+headerColor+';color:#fff;padding:12px 16px;display:flex;align-items:center;gap:12px;">'
      +'<span style="background:rgba(255,255,255,0.25);border-radius:4px;padding:2px 8px;font-size:13px;font-weight:bold;">SKU '+sku+'</span>'
      +'<span style="font-size:15px;font-weight:bold;flex:1;">'+title+'</span>'
      +'<span style="background:rgba(255,255,255,0.2);padding:2px 8px;border-radius:4px;font-size:12px;">Grade '+grade+'</span>'
      +'</div>'
      +conflictFlag
      +'<div style="background:#f5f5f5;border-bottom:1px solid #ddd;padding:8px 16px;font-size:12.5px;color:#444;display:flex;flex-wrap:wrap;gap:6px 18px;">'
      +'<span><b>Suggest:</b> $'+suggest+'</span><span><b>Accept:</b> $'+accept+'</span><span><b>Decline:</b> $'+decline+'</span>'
      +'<span><b>Shelf:</b> '+(meta.shelf||'—')+'</span>'
      +'</div>'
      +'<div style="padding:14px 16px;">'
      +'<div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px;">'
      +'<button data-id="'+sku+'_t" onclick="copy(this)" style="padding:8px 16px;border:none;border-radius:4px;cursor:pointer;font-size:13px;font-weight:bold;background:#1565c0;color:#fff;">Copy Title</button>'
      +'<button data-id="'+sku+'_c" onclick="copy(this)" style="padding:8px 16px;border:none;border-radius:4px;cursor:pointer;font-size:13px;font-weight:bold;background:#37474f;color:#fff;">Copy Condition</button>'
      +'<button data-id="'+sku+'_h" onclick="copy(this)" style="padding:8px 16px;border:none;border-radius:4px;cursor:pointer;font-size:13px;font-weight:bold;background:#2e7d32;color:#fff;">Copy HTML</button>'
      +'</div>'
      +'<textarea id="'+sku+'_t" style="display:none;">'+title+'</textarea>'
      +'<textarea id="'+sku+'_c" style="display:none;">'+condBox+'</textarea>'
      +'<textarea id="'+sku+'_h" style="display:none;">'+descHtml+'</textarea>'
      +'</div></div>';
  }).join('');

  return '<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>XRT Listings</title>'
    +'<style>*{box-sizing:border-box;margin:0;padding:0;}body{font-family:Arial,sans-serif;background:#f0f0f0;padding:20px;}h1{font-size:18px;color:#333;margin-bottom:4px;}.meta{font-size:12px;color:#777;margin-bottom:20px;}</style>'
    +'<script>function copy(btn){var id=btn.getAttribute("data-id");var el=document.getElementById(id);if(!el)return;navigator.clipboard.writeText(el.value.trim()).then(function(){var o=btn.textContent;btn.textContent="Copied!";setTimeout(function(){btn.textContent=o;},1500);});}<\/script>'
    +'</head><body>'
    +'<h1>XRT eBay Listing Descriptions</h1>'
    +'<p class="meta">'+listings.length+' items &nbsp;·&nbsp; '+new Date().toISOString().slice(0,16).replace('T',' ')+' &nbsp;·&nbsp; <a href="/api/listings" style="color:#1565c0;">Refresh</a></p>'
    +cards
    +'</body></html>';
}

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

// ── LISTINGS STORAGE ──
function loadListings(){
  var lp = path.join(DATA_DIR, 'listings.json');
  try{ if(fs.existsSync(lp)) return JSON.parse(fs.readFileSync(lp,'utf8')); }catch(e){}
  return [];
}
function saveListings(listings){
  var lp = path.join(DATA_DIR, 'listings.json');
  try{ fs.writeFileSync(lp, JSON.stringify(listings)); }catch(e){ console.log('[SAVE] Error:',e.message); }
}

function generateListingsPage(listings){
  var colors=['#1565c0','#2e7d32','#e65100','#6a1b9a','#00838f','#c62828','#37474f','#558b2f'];
  var cards = listings.map(function(r, i) {
    var sku = r.sku;
    var meta = r.meta||{};
    var listing = r.listing||{};
    var grade = r.gradeConflict ? r.gradeConflict.claude : (meta.grade||'B');
    var headerColor = colors[i%colors.length];
    var price = listing.avg_sold_price||0;
    var suggest = listing.suggested_price||Math.round(price*0.9);
    var accept = listing.accept_price||Math.round(price*0.8);
    var decline = listing.decline_price||Math.round(price*0.6);

    var conflictFlag = r.gradeConflict ?
      '<div style="background:#fff8e1;border-left:4px solid #f9a825;padding:8px 14px;font-size:13px;color:#5d4037;"><strong>&#9888; GRADE CONFLICT</strong> Processor: '+r.gradeConflict.processor+' | Claude: '+r.gradeConflict.claude+'</div>' : '';

    var title = (listing.title) || (r.visionData&&r.visionData.item_name) || ('SKU '+sku);
    var condBox = listing.condition_box || 'See photos.';
    var descHtml = listing.description_html || '<p>'+title+'</p>';
    var skuStr = String(sku);

    return '<div style="background:#fff;border-radius:6px;box-shadow:0 1px 4px rgba(0,0,0,0.15);margin-bottom:28px;overflow:hidden;">'
      +'<div style="background:'+headerColor+';color:#fff;padding:12px 16px;display:flex;align-items:center;gap:12px;">'
      +'<span style="background:rgba(255,255,255,0.25);border-radius:4px;padding:2px 8px;font-size:13px;font-weight:bold;">SKU '+skuStr+'</span>'
      +'<span style="font-size:15px;font-weight:bold;flex:1;">'+title+'</span>'
      +'<span style="background:rgba(255,255,255,0.2);padding:2px 8px;border-radius:4px;font-size:12px;">Grade '+grade+'</span>'
      +'</div>'
      +conflictFlag
      +'<div style="background:#f5f5f5;border-bottom:1px solid #ddd;padding:8px 16px;font-size:12.5px;color:#444;display:flex;flex-wrap:wrap;gap:6px 18px;">'
      +'<span><b>Suggest:</b> $'+suggest+'</span>'
      +'<span><b>Accept:</b> $'+accept+'</span>'
      +'<span><b>Decline:</b> $'+decline+'</span>'
      +'<span><b>Shelf:</b> '+(meta.shelf||'&mdash;')+'</span>'
      +'</div>'
      +'<div style="padding:14px 16px;">'
      +'<div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px;">'
      +'<button id="btn_t_'+skuStr+'" onclick="cp(this.id.slice(4))" style="padding:8px 16px;border:none;border-radius:4px;cursor:pointer;font-size:13px;font-weight:bold;background:#1565c0;color:#fff;">Copy Title</button>'
      +'<button id="btn_c_'+skuStr+'" onclick="cp(this.id.slice(4))" style="padding:8px 16px;border:none;border-radius:4px;cursor:pointer;font-size:13px;font-weight:bold;background:#37474f;color:#fff;">Copy Condition</button>'
      +'<button id="btn_h_'+skuStr+'" onclick="cp(this.id.slice(4))" style="padding:8px 16px;border:none;border-radius:4px;cursor:pointer;font-size:13px;font-weight:bold;background:#2e7d32;color:#fff;">Copy HTML</button>'
      +'</div>'
      +'<textarea id="t_'+skuStr+'" style="display:none;">'+title+'</textarea>'
      +'<textarea id="c_'+skuStr+'" style="display:none;">'+condBox+'</textarea>'
      +'<textarea id="h_'+skuStr+'" style="display:none;">'+descHtml+'</textarea>'
      +'</div></div>';
  }).join('');

  return '<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>XRT Listings</title>'
    +'<style>*{box-sizing:border-box;margin:0;padding:0;}body{font-family:Arial,sans-serif;background:#f0f0f0;padding:20px;}h1{font-size:18px;color:#333;margin-bottom:4px;}.meta{font-size:12px;color:#777;margin-bottom:20px;}</style>'
    +'<script>function cp(id){var el=document.getElementById(id);if(!el)return;var btn=document.querySelector("[id=btn_"+id+"]");navigator.clipboard.writeText(el.value.trim()).then(function(){if(btn){var o=btn.textContent;btn.textContent="Copied!";setTimeout(function(){btn.textContent=o;},1500);}});}<\/script>'
    +'</head><body>'
    +'<h1>XRT eBay Listing Descriptions</h1>'
    +'<p class="meta">'+listings.length+' items &nbsp;&middot;&nbsp; <a href="/api/listings" style="color:#1565c0;">Refresh</a></p>'
    +cards
    +'</body></html>';
}

function generateHTML(results) {
  var listings = results.filter(function(r){ return r && r.sku; });
  saveListings(listings);
  console.log('[BATCH] Saved', listings.length, 'listings');
}

server.listen(PORT, function(){console.log('XRT Server running on port '+PORT);});
