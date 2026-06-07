'use strict';
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const API_KEY = process.env.ANTHROPIC_API_KEY || process.env.anthropic_api_key || '';
const DATA_DIR = process.env.DATA_DIR || '/data/xrt-data'; // Render persistent disk mounts at /data

console.log('[STARTUP] API key found:', API_KEY.length > 0);

if(!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, {recursive:true});
if(!fs.existsSync(path.join(DATA_DIR, 'items'))) fs.mkdirSync(path.join(DATA_DIR, 'items'), {recursive:true});

// Configurable minimum value threshold (below this = flagged / value-check)
const MIN_THRESHOLD = parseInt(process.env.MIN_THRESHOLD || '30', 10);

// ── PERSISTENT SKU COUNTER (FIX 2) ──
// In-memory value is primary; file is backup written after every claim.
// On startup: counter = max(stored_next, highest_folder + 1, 2000) so the
// SKU never repeats even if /tmp is partially wiped.
var SKU_FILE = path.join(DATA_DIR, 'sku_counter.json');
var SKU_NEXT = 2000;

function scanHighestItemFolder(){
  var max = 0;
  try {
    fs.readdirSync(path.join(DATA_DIR, 'items')).forEach(function(f){
      var n = parseInt(f, 10);
      if(!isNaN(n) && n > max) max = n;
    });
  } catch(e){}
  return max;
}

function writeSkuFile(){
  try { fs.writeFileSync(SKU_FILE, JSON.stringify({next: SKU_NEXT})); }
  catch(e){ console.log('[SKU] write error:', e.message); }
}

function initSku(){
  var stored = 0;
  try { if(fs.existsSync(SKU_FILE)) stored = JSON.parse(fs.readFileSync(SKU_FILE,'utf8')).next || 0; } catch(e){}
  var highest = scanHighestItemFolder();
  SKU_NEXT = Math.max(stored, highest + 1, 2000);
  writeSkuFile();
  console.log('[SKU] Initialized next SKU to', SKU_NEXT, '(stored:', stored, '| highest folder:', highest, ')');
}

// Claim and increment atomically (single-threaded event loop = atomic)
function getNextSku(){
  var current = SKU_NEXT;
  SKU_NEXT = SKU_NEXT + 1;
  writeSkuFile();
  return current;
}
// Peek without incrementing
function peekNextSku(){
  return SKU_NEXT;
}

initSku();

const SCANNER_HTML = "<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n<meta charset=\"UTF-8\">\n<meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0, user-scalable=no\">\n<meta name=\"mobile-web-app-capable\" content=\"yes\">\n<meta name=\"apple-mobile-web-app-capable\" content=\"yes\">\n<meta name=\"theme-color\" content=\"#000000\">\n<title>XRT Floor Scanner</title>\n<link rel=\"preconnect\" href=\"https://fonts.googleapis.com\">\n<link href=\"https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Mono:wght@400;500&family=Barlow:wght@400;600;700;900&display=swap\" rel=\"stylesheet\">\n<style>\n:root{--bg:#111;--surface:#1a1a1a;--border:#2c2c2c;--text:#f2f2f2;--muted:#555;--accent:#e8ff00;--keep:#00e676;--lot:#ff9f1c;--recycle:#ff1744;--keep-dark:#003d1a;--lot-dark:#3d2000;--recycle-dark:#4a000e;--display:'Bebas Neue',sans-serif;--body:'Barlow',sans-serif;--mono:'DM Mono',monospace;}\n*{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent;}\nhtml,body{height:100%;overflow:hidden;background:#000;font-family:var(--body);color:var(--text);user-select:none;touch-action:manipulation;}\n.screen{position:fixed;inset:0;display:none;flex-direction:column;}.screen.active{display:flex;}\n#scannerScreen{background:#000;}\n#videoEl{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;}\n.vf-overlay{position:absolute;inset:0;pointer-events:none;}\n.vf-corner{position:absolute;width:32px;height:32px;border-color:var(--accent);border-style:solid;opacity:0.85;}\n.vf-corner.tl{top:22%;left:10%;border-width:3px 0 0 3px;}.vf-corner.tr{top:22%;right:10%;border-width:3px 3px 0 0;}\n.vf-corner.bl{bottom:30%;left:10%;border-width:0 0 3px 3px;}.vf-corner.br{bottom:30%;right:10%;border-width:0 3px 3px 0;}\n.scan-line{position:absolute;left:10%;right:10%;height:2px;background:linear-gradient(90deg,transparent,var(--accent),transparent);top:22%;opacity:0;animation:scanAnim 2.4s ease-in-out infinite;}\n.scan-line.active{opacity:1;}@keyframes scanAnim{0%{top:22%;}50%{top:70%;}100%{top:22%;}}\n.scanner-topbar{position:absolute;top:0;left:0;right:0;padding:16px 18px 12px;display:flex;align-items:center;justify-content:space-between;background:linear-gradient(to bottom,rgba(0,0,0,0.88),transparent);z-index:10;}\n.topbar-brand{font-family:var(--display);font-size:1.6rem;letter-spacing:0.06em;color:#fff;line-height:1;}.topbar-brand span{color:var(--accent);}\n.topbar-right{display:flex;gap:10px;align-items:center;}\n.icon-btn{width:40px;height:40px;border-radius:50%;background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.15);display:flex;align-items:center;justify-content:center;cursor:pointer;backdrop-filter:blur(8px);}\n.mode-badge{font-family:var(--mono);font-size:0.58rem;letter-spacing:0.1em;text-transform:uppercase;padding:5px 10px;border-radius:100px;border:1px solid rgba(255,255,255,0.2);color:#ccc;background:rgba(0,0,0,0.4);}\n.mode-badge.auto{color:var(--accent);border-color:rgba(232,255,0,0.4);}\n.status-pill{position:absolute;bottom:28%;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.72);border:1px solid rgba(255,255,255,0.1);backdrop-filter:blur(12px);border-radius:100px;padding:8px 20px;font-family:var(--mono);font-size:0.65rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--muted);white-space:nowrap;transition:all 0.2s;z-index:10;}\n.status-pill.scanning{color:var(--accent);border-color:rgba(232,255,0,0.35);}.status-pill.ready{color:#fff;}.status-pill.waiting{color:var(--lot);border-color:rgba(255,159,28,0.35);}\n.scanner-bottombar{position:absolute;bottom:0;left:0;right:0;padding:16px 24px calc(env(safe-area-inset-bottom) + 18px);background:linear-gradient(to top,rgba(0,0,0,0.92),transparent);z-index:10;display:flex;align-items:center;justify-content:space-between;}\n.threshold-display{display:flex;flex-direction:column;}\n.threshold-display .label{font-family:var(--mono);font-size:0.55rem;color:var(--muted);letter-spacing:0.1em;text-transform:uppercase;}\n.threshold-display .value{font-family:var(--display);font-size:1.8rem;color:var(--accent);line-height:1;}\n.scan-btn{width:72px;height:72px;border-radius:50%;background:#fff;border:3px solid rgba(255,255,255,0.25);display:flex;align-items:center;justify-content:center;cursor:pointer;transition:transform 0.1s,background 0.1s;position:relative;}\n.scan-btn::after{content:'';position:absolute;inset:-7px;border-radius:50%;border:2px solid rgba(255,255,255,0.18);}\n.scan-btn:active{transform:scale(0.91);background:#ddd;}\n.scan-btn.locked{background:#333;cursor:not-allowed;}\n.scan-btn.locked svg{stroke:#666;}\n.scan-btn.locked:active{transform:none;}\n.sound-toggle{display:flex;flex-direction:column;align-items:flex-end;}\n.sound-toggle .label{font-family:var(--mono);font-size:0.55rem;color:var(--muted);letter-spacing:0.1em;text-transform:uppercase;margin-bottom:4px;}\n.pack-btn{background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.14);border-radius:5px;padding:5px 12px;font-family:var(--mono);font-size:0.62rem;color:#ccc;cursor:pointer;letter-spacing:0.06em;}\n#resultScreen{z-index:50;justify-content:center;align-items:center;}\n#resultScreen.keep{background:var(--keep-dark);}\n#resultScreen.lot{background:var(--lot-dark);}\n#resultScreen.recycle{background:var(--recycle-dark);}\n.result-glow{position:absolute;inset:0;pointer-events:none;opacity:0;}\n#resultScreen.keep .result-glow{background:radial-gradient(ellipse at center,rgba(0,230,118,0.2) 0%,transparent 70%);opacity:1;}\n#resultScreen.lot .result-glow{background:radial-gradient(ellipse at center,rgba(255,159,28,0.2) 0%,transparent 70%);opacity:1;}\n#resultScreen.recycle .result-glow{background:radial-gradient(ellipse at center,rgba(255,23,68,0.2) 0%,transparent 70%);opacity:1;}\n.result-inner{position:relative;z-index:2;display:flex;flex-direction:column;align-items:center;padding:0 28px;text-align:center;width:100%;}\n.result-verdict-word{font-family:var(--display);font-size:clamp(5.5rem,24vw,10rem);line-height:0.88;letter-spacing:0.03em;animation:verdictPop 0.32s cubic-bezier(0.34,1.56,0.64,1) both;}\n#resultScreen.keep .result-verdict-word{color:var(--keep);}\n#resultScreen.lot .result-verdict-word{color:var(--lot);}\n#resultScreen.recycle .result-verdict-word{color:var(--recycle);}\n@keyframes verdictPop{from{transform:scale(0.65);opacity:0;}to{transform:scale(1);opacity:1;}}\n.result-divider{width:48px;height:2px;margin:14px auto;opacity:0.35;}\n#resultScreen.keep .result-divider{background:var(--keep);}\n#resultScreen.lot .result-divider{background:var(--lot);}\n#resultScreen.recycle .result-divider{background:var(--recycle);}\n.result-item-name{font-size:1.1rem;font-weight:700;line-height:1.3;color:rgba(255,255,255,0.88);max-width:300px;animation:fadeUp 0.36s 0.12s both;}\n.result-price{font-family:var(--display);font-size:2.8rem;margin-top:10px;animation:fadeUp 0.36s 0.2s both;}\n#resultScreen.keep .result-price{color:var(--keep);}\n#resultScreen.lot .result-price{color:var(--lot);}\n#resultScreen.recycle .result-price{color:var(--recycle);}\n.result-price-label{font-family:var(--mono);font-size:0.58rem;letter-spacing:0.14em;color:rgba(255,255,255,0.38);text-transform:uppercase;margin-top:-2px;animation:fadeUp 0.36s 0.24s both;}\n.result-reason{margin-top:16px;font-size:0.88rem;color:rgba(255,255,255,0.5);max-width:280px;line-height:1.55;animation:fadeUp 0.36s 0.28s both;}\n@keyframes fadeUp{from{opacity:0;transform:translateY(12px);}to{opacity:1;transform:translateY(0);}}\n.result-countdown{position:absolute;bottom:44px;left:50%;transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;gap:8px;}\n.countdown-bar-track{width:130px;height:3px;background:rgba(255,255,255,0.1);border-radius:2px;overflow:hidden;}\n.countdown-bar{height:100%;border-radius:2px;}\n#resultScreen.keep .countdown-bar{background:var(--keep);}\n#resultScreen.lot .countdown-bar{background:var(--lot);}\n#resultScreen.recycle .countdown-bar{background:var(--recycle);}\n.countdown-label{font-family:var(--mono);font-size:0.58rem;letter-spacing:0.1em;color:rgba(255,255,255,0.28);text-transform:uppercase;}\n#loadingScreen{background:#080808;z-index:40;justify-content:center;align-items:center;gap:22px;}\n.loading-ring{width:60px;height:60px;border-radius:50%;border:2px solid var(--border);border-top-color:var(--accent);animation:spin 0.72s linear infinite;}\n@keyframes spin{to{transform:rotate(360deg);}}\n.loading-info{text-align:center;}\n.loading-step{font-family:var(--display);font-size:1.5rem;letter-spacing:0.05em;color:#fff;margin-bottom:5px;}\n.loading-sub{font-family:var(--mono);font-size:0.6rem;color:var(--muted);letter-spacing:0.1em;text-transform:uppercase;}\n#historyScreen{z-index:60;background:var(--bg);flex-direction:column;}\n.history-topbar{padding:16px 18px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--border);}\n.history-title{font-family:var(--display);font-size:1.8rem;letter-spacing:0.04em;}\n.history-actions{display:flex;gap:10px;}\n.history-btn{font-family:var(--mono);font-size:0.6rem;letter-spacing:0.08em;text-transform:uppercase;padding:8px 14px;border-radius:6px;border:1px solid var(--border);background:transparent;color:var(--muted);cursor:pointer;}\n.history-btn.accent{border-color:var(--accent);color:var(--accent);}\n.history-list{flex:1;overflow-y:auto;padding:12px 16px;}\n.history-item{display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid var(--border);}\n.history-verdict{font-family:var(--display);font-size:1.1rem;letter-spacing:0.04em;width:80px;flex-shrink:0;}\n.history-verdict.keep{color:var(--keep);}.history-verdict.lot{color:var(--lot);}.history-verdict.recycle{color:var(--recycle);}\n.history-info{flex:1;min-width:0;}\n.history-name{font-size:0.85rem;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}\n.history-price{font-family:var(--mono);font-size:0.65rem;color:var(--muted);margin-top:2px;}\n.history-time{font-family:var(--mono);font-size:0.58rem;color:var(--border);flex-shrink:0;}\n.history-empty{text-align:center;padding:60px 20px;font-family:var(--mono);font-size:0.65rem;color:var(--muted);letter-spacing:0.08em;text-transform:uppercase;}\n.legend-bar{display:flex;gap:0;border-bottom:1px solid var(--border);}\n.legend-item{flex:1;text-align:center;padding:8px 4px;font-family:var(--mono);font-size:0.55rem;letter-spacing:0.08em;text-transform:uppercase;}\n.legend-item.keep{color:var(--keep);}.legend-item.lot{color:var(--lot);}.legend-item.recycle{color:var(--recycle);}\n#settingsPanel{position:fixed;bottom:0;left:0;right:0;background:var(--surface);border-top:1px solid var(--border);border-radius:20px 20px 0 0;padding:18px 24px calc(env(safe-area-inset-bottom) + 28px);z-index:100;transform:translateY(100%);transition:transform 0.3s cubic-bezier(0.32,0.72,0,1);}\n#settingsPanel.open{transform:translateY(0);}\n.settings-handle{width:40px;height:4px;background:var(--border);border-radius:2px;margin:0 auto 22px;}\n.settings-title{font-family:var(--display);font-size:1.6rem;letter-spacing:0.04em;margin-bottom:26px;}\n.setting-row{margin-bottom:24px;}\n.setting-label{font-family:var(--mono);font-size:0.6rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--muted);margin-bottom:12px;display:flex;justify-content:space-between;align-items:center;}\n.setting-label span{font-size:0.8rem;color:var(--accent);font-family:var(--display);letter-spacing:0.06em;}\n.threshold-slider{width:100%;-webkit-appearance:none;appearance:none;height:4px;background:var(--border);border-radius:2px;outline:none;}\n.threshold-slider::-webkit-slider-thumb{-webkit-appearance:none;width:24px;height:24px;border-radius:50%;background:var(--accent);cursor:pointer;border:3px solid #000;box-shadow:0 0 0 2px var(--accent);}\n.lot-slider::-webkit-slider-thumb{-webkit-appearance:none;width:24px;height:24px;border-radius:50%;background:var(--lot);cursor:pointer;border:3px solid #000;box-shadow:0 0 0 2px var(--lot);}\n.toggle-row{display:grid;grid-template-columns:1fr 1fr;gap:10px;}\n.toggle-opt{border:1.5px solid var(--border);border-radius:10px;padding:14px 16px;cursor:pointer;transition:all 0.15s;text-align:center;}\n.toggle-opt.selected{border-color:var(--accent);background:rgba(232,255,0,0.06);}\n.toggle-opt-name{font-weight:700;font-size:0.95rem;margin-bottom:4px;}\n.toggle-opt-desc{font-family:var(--mono);font-size:0.58rem;color:var(--muted);line-height:1.4;}\n.toggle-opt.selected .toggle-opt-name{color:var(--accent);}\n.settings-close{width:100%;margin-top:6px;padding:15px;background:var(--border);border:none;border-radius:10px;font-family:var(--display);font-size:1.15rem;letter-spacing:0.06em;color:var(--text);cursor:pointer;}\n.settings-backdrop{position:fixed;inset:0;background:rgba(0,0,0,0.65);z-index:99;display:none;backdrop-filter:blur(3px);}\n.settings-backdrop.open{display:block;}\n</style>\n</head>\n<body>\n<div class=\"screen active\" id=\"scannerScreen\">\n  <video id=\"videoEl\" autoplay playsinline muted></video>\n  <canvas id=\"captureCanvas\" style=\"display:none\"></canvas>\n  <div class=\"vf-overlay\">\n    <div class=\"vf-corner tl\"></div><div class=\"vf-corner tr\"></div>\n    <div class=\"vf-corner bl\"></div><div class=\"vf-corner br\"></div>\n    <div class=\"scan-line\" id=\"scanLine\"></div>\n  </div>\n  <div class=\"scanner-topbar\">\n    <div class=\"topbar-brand\">XRT<span>&#183;</span>SCAN</div>\n    <div class=\"topbar-right\">\n      <div class=\"mode-badge\" id=\"modeBadge\">MANUAL</div>\n      <div class=\"icon-btn\" onclick=\"showHistory()\">\n        <svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"white\" stroke-width=\"1.8\" width=\"18\" height=\"18\">\n          <path d=\"M12 8v4l3 3m6-3a9 9 0 1 1-18 0 9 9 0 0 1 18 0z\"/>\n        </svg>\n      </div>\n      <div class=\"icon-btn\" onclick=\"openSettings()\">\n        <svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"white\" stroke-width=\"1.8\" width=\"18\" height=\"18\">\n          <circle cx=\"12\" cy=\"12\" r=\"3\"/>\n          <path d=\"M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z\"/>\n        </svg>\n      </div>\n    </div>\n  </div>\n  <div class=\"status-pill\" id=\"statusPill\">Starting camera...</div>\n  <div class=\"scanner-bottombar\">\n    <div class=\"threshold-display\">\n      <div class=\"label\">Min Value</div>\n      <div class=\"value\" id=\"thresholdDisplay\">$30</div>\n    </div>\n    <div class=\"scan-btn\" id=\"scanBtn\" onclick=\"triggerManualScan()\">\n      <svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"black\" stroke-width=\"2.2\" width=\"30\" height=\"30\">\n        <circle cx=\"11\" cy=\"11\" r=\"8\"/><path d=\"m21 21-4.35-4.35\"/>\n      </svg>\n    </div>\n    <div class=\"sound-toggle\">\n      <div class=\"label\">Sound Pack</div>\n      <div class=\"pack-btn\" id=\"packToggleBtn\" onclick=\"cycleSoundPack()\">PACK 1</div>\n    </div>\n  </div>\n</div>\n\n<div class=\"screen\" id=\"loadingScreen\">\n  <div class=\"loading-ring\"></div>\n  <div class=\"loading-info\">\n    <div class=\"loading-step\" id=\"loadingStep\">Identifying item...</div>\n    <div class=\"loading-sub\" id=\"loadingSub\">Checking eBay sold listings</div>\n  </div>\n</div>\n\n<div class=\"screen\" id=\"resultScreen\" onclick=\"dismissResult()\">\n  <div class=\"result-glow\"></div>\n  <div class=\"result-inner\">\n    <div class=\"result-verdict-word\" id=\"resultVerdict\">KEEP</div>\n    <div class=\"result-divider\"></div>\n    <div class=\"result-item-name\" id=\"resultItemName\">--</div>\n    <div class=\"result-price\" id=\"resultPrice\">--</div>\n    <div class=\"result-price-label\" id=\"resultPriceLabel\">avg sold on eBay</div>\n    <div class=\"result-reason\" id=\"resultReason\">--</div>\n  </div>\n  <div class=\"result-countdown\">\n    <div class=\"countdown-bar-track\">\n      <div class=\"countdown-bar\" id=\"countdownBar\" style=\"width:100%\"></div>\n    </div>\n    <div class=\"countdown-label\">Tap to scan next item</div>\n  </div>\n</div>\n\n<div class=\"screen\" id=\"historyScreen\">\n  <div class=\"history-topbar\">\n    <div class=\"history-title\">Scan History</div>\n    <div class=\"history-actions\">\n      <button class=\"history-btn accent\" onclick=\"copyHistory()\">Export CSV</button>\n      <button class=\"history-btn\" onclick=\"hideHistory()\">Close</button>\n    </div>\n  </div>\n  <div class=\"legend-bar\">\n    <div class=\"legend-item keep\">&#9646; Keep</div>\n    <div class=\"legend-item lot\">&#9646; Lot</div>\n    <div class=\"legend-item recycle\">&#9646; Recycle</div>\n  </div>\n  <div class=\"history-list\" id=\"historyList\">\n    <div class=\"history-empty\">No scans yet this session</div>\n  </div>\n</div>\n\n<div class=\"settings-backdrop\" id=\"settingsBackdrop\" onclick=\"closeSettings()\"></div>\n<div id=\"settingsPanel\">\n  <div class=\"settings-handle\"></div>\n  <div class=\"settings-title\">Settings</div>\n  <div class=\"setting-row\">\n    <div class=\"setting-label\">Sell Threshold (single unit) <span id=\"sliderValueLabel\">$30</span></div>\n    <input type=\"range\" class=\"threshold-slider\" id=\"thresholdSlider\" min=\"20\" max=\"80\" value=\"30\" step=\"5\" oninput=\"updateThreshold(this.value)\">\n  </div>\n  <div class=\"setting-row\">\n    <div class=\"setting-label\">Lot Minimum (per unit) <span id=\"lotValueLabel\">$8</span></div>\n    <input type=\"range\" class=\"threshold-slider lot-slider\" id=\"lotSlider\" min=\"3\" max=\"25\" value=\"8\" step=\"1\" oninput=\"updateLotThreshold(this.value)\">\n  </div>\n  <div class=\"setting-row\">\n    <div class=\"setting-label\">Scan Mode</div>\n    <div class=\"toggle-row\">\n      <div class=\"toggle-opt selected\" id=\"modeManualOpt\" onclick=\"setScanMode('manual')\">\n        <div class=\"toggle-opt-name\">Manual</div>\n        <div class=\"toggle-opt-desc\">Tap button to scan only.</div>\n      </div>\n      <div class=\"toggle-opt\" id=\"modeAutoOpt\" onclick=\"setScanMode('auto')\">\n        <div class=\"toggle-opt-name\">Auto</div>\n        <div class=\"toggle-opt-desc\">Fires when camera is steady.</div>\n      </div>\n    </div>\n  </div>\n  <div class=\"setting-row\">\n    <div class=\"setting-label\">Sound Pack</div>\n    <div class=\"toggle-row\">\n      <div class=\"toggle-opt selected\" id=\"pack1Opt\" onclick=\"selectPack(1)\">\n        <div class=\"toggle-opt-name\">Pack 1</div>\n        <div class=\"toggle-opt-desc\">Cash register / Chime / Buzzer</div>\n      </div>\n      <div class=\"toggle-opt\" id=\"pack2Opt\" onclick=\"selectPack(2)\">\n        <div class=\"toggle-opt-name\">Pack 2</div>\n        <div class=\"toggle-opt-desc\">Rising chime / Ding / Low thud</div>\n      </div>\n    </div>\n  </div>\n  <button class=\"settings-close\" onclick=\"closeSettings()\">Done</button>\n</div>\n\n<script>\nvar threshold=30,lotThreshold=8,soundPack=1,isAnalyzing=false,countdownTimer=null;\nvar lastFrameData=null,stableFrames=0,motionInterval=null,scanMode='manual';\nvar scanLocked=false,cooldownTimer=null,cooldownTick=null;\nvar STABLE_NEEDED=8,MOTION_MS=220,RESULT_MS=5000,COOLDOWN_MS=2000;\nvar scanHistory=[];\nvar audioCtx=new(window.AudioContext||window.webkitAudioContext)();\n\nfunction playCashRegister(){var ctx=audioCtx,now=ctx.currentTime;var c=ctx.createOscillator(),cg=ctx.createGain();c.connect(cg);cg.connect(ctx.destination);c.frequency.setValueAtTime(1200,now);c.frequency.exponentialRampToValueAtTime(800,now+0.05);cg.gain.setValueAtTime(0.28,now);cg.gain.exponentialRampToValueAtTime(0.001,now+0.07);c.start(now);c.stop(now+0.08);[[0.1,1046],[0.18,1318],[0.27,1568]].forEach(function(x){var o=ctx.createOscillator(),g=ctx.createGain();o.connect(g);g.connect(ctx.destination);o.type='sine';o.frequency.value=x[1];g.gain.setValueAtTime(0.26,now+x[0]);g.gain.exponentialRampToValueAtTime(0.001,now+x[0]+0.38);o.start(now+x[0]);o.stop(now+x[0]+0.39);});}\nfunction playMidChime(){var ctx=audioCtx,now=ctx.currentTime;[659,784].forEach(function(f,i){var o=ctx.createOscillator(),g=ctx.createGain();o.type='sine';o.connect(g);g.connect(ctx.destination);o.frequency.value=f;var t=now+i*0.14;g.gain.setValueAtTime(0.28,t);g.gain.exponentialRampToValueAtTime(0.001,t+0.5);o.start(t);o.stop(t+0.51);});}\nfunction playBuzzer(){var ctx=audioCtx,now=ctx.currentTime;[0,0.2].forEach(function(t){var o=ctx.createOscillator(),g=ctx.createGain();o.type='sawtooth';o.connect(g);g.connect(ctx.destination);o.frequency.setValueAtTime(145,now+t);o.frequency.exponentialRampToValueAtTime(88,now+t+0.15);g.gain.setValueAtTime(0.32,now+t);g.gain.exponentialRampToValueAtTime(0.001,now+t+0.16);o.start(now+t);o.stop(now+t+0.17);});}\nfunction playRisingChime(){var ctx=audioCtx,now=ctx.currentTime;[523,659,784,1047].forEach(function(f,i){var o=ctx.createOscillator(),g=ctx.createGain();o.type='sine';o.connect(g);g.connect(ctx.destination);o.frequency.value=f;var t=now+i*0.11;g.gain.setValueAtTime(0.24,t);g.gain.exponentialRampToValueAtTime(0.001,t+0.55);o.start(t);o.stop(t+0.56);});}\nfunction playSingleDing(){var ctx=audioCtx,now=ctx.currentTime;var o=ctx.createOscillator(),g=ctx.createGain();o.type='sine';o.connect(g);g.connect(ctx.destination);o.frequency.value=880;g.gain.setValueAtTime(0.3,now);g.gain.exponentialRampToValueAtTime(0.001,now+0.6);o.start(now);o.stop(now+0.61);}\nfunction playLowThud(){var ctx=audioCtx,now=ctx.currentTime;var o=ctx.createOscillator(),g=ctx.createGain();o.type='sine';o.connect(g);g.connect(ctx.destination);o.frequency.setValueAtTime(185,now);o.frequency.exponentialRampToValueAtTime(50,now+0.24);g.gain.setValueAtTime(0.5,now);g.gain.exponentialRampToValueAtTime(0.001,now+0.28);o.start(now);o.stop(now+0.29);setTimeout(function(){var o2=ctx.createOscillator(),g2=ctx.createGain();o2.type='sine';o2.connect(g2);g2.connect(ctx.destination);o2.frequency.setValueAtTime(120,ctx.currentTime);o2.frequency.exponentialRampToValueAtTime(38,ctx.currentTime+0.2);g2.gain.setValueAtTime(0.3,ctx.currentTime);g2.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+0.22);o2.start(ctx.currentTime);o2.stop(ctx.currentTime+0.23);},170);}\n\nfunction playSound(verdict){\n  audioCtx.resume();\n  var v=verdict.toUpperCase();\n  if(soundPack===1){if(v==='KEEP')playCashRegister();else if(v==='LOT')playMidChime();else playBuzzer();}\n  else{if(v==='KEEP')playRisingChime();else if(v==='LOT')playSingleDing();else playLowThud();}\n}\n\nfunction startCamera(){navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:1280},height:{ideal:720}},audio:false}).then(function(stream){var v=document.getElementById('videoEl');v.srcObject=stream;v.play();setStatus('Ready','ready');startMotionDetection();}).catch(function(e){setStatus('Camera error: '+e.message,'');});}\n\nfunction startMotionDetection(){var video=document.getElementById('videoEl');var canvas=document.getElementById('captureCanvas');if(motionInterval)clearInterval(motionInterval);motionInterval=setInterval(function(){if(isAnalyzing||scanLocked||scanMode!=='auto'||!video.videoWidth)return;canvas.width=80;canvas.height=45;var ctx=canvas.getContext('2d');ctx.drawImage(video,0,0,80,45);var frame=ctx.getImageData(0,0,80,45).data;if(lastFrameData){var diff=0;for(var i=0;i<frame.length;i+=4)diff+=Math.abs(frame[i]-lastFrameData[i]);var avg=diff/(frame.length/4);if(avg<6){stableFrames++;if(stableFrames===3)setStatus('Hold still...','scanning');if(stableFrames>=STABLE_NEEDED){stableFrames=0;lastFrameData=null;captureAndAnalyze();}}else{stableFrames=0;if(!isAnalyzing&&!scanLocked)setStatus('Point at item','');}}lastFrameData=new Uint8ClampedArray(frame);},MOTION_MS);}\n\nfunction captureAndAnalyze(){var video=document.getElementById('videoEl');var canvas=document.getElementById('captureCanvas');var maxW=800;var scale=Math.min(1,maxW/video.videoWidth);canvas.width=Math.round(video.videoWidth*scale);canvas.height=Math.round(video.videoHeight*scale);canvas.getContext('2d').drawImage(video,0,0,canvas.width,canvas.height);analyze(canvas.toDataURL('image/jpeg',0.75).split(',')[1]);}\n\nfunction triggerManualScan(){if(isAnalyzing||scanLocked)return;stableFrames=0;captureAndAnalyze();}\n\nfunction lockScanner(ms){\n  scanLocked=true;\n  var btn=document.getElementById('scanBtn');\n  btn.classList.add('locked');\n  var remaining=Math.ceil(ms/1000);\n  setStatus('Ready in '+remaining+'s...','waiting');\n  if(cooldownTick)clearInterval(cooldownTick);\n  cooldownTick=setInterval(function(){remaining--;if(remaining<=0){clearInterval(cooldownTick);}else{setStatus('Ready in '+remaining+'s...','waiting');}},1000);\n  clearTimeout(cooldownTimer);\n  cooldownTimer=setTimeout(function(){scanLocked=false;btn.classList.remove('locked');setStatus(scanMode==='auto'?'Point at item':'Ready','ready');},ms);\n}\n\nvar steps=[['Identifying item...','Vision scan in progress'],['Searching eBay...','Checking sold listings'],['Evaluating lot potential...','Checking demand velocity'],['Almost done...','Generating verdict']];\n\nfunction analyze(imageBase64){\n  if(isAnalyzing||scanLocked)return;\n  isAnalyzing=true;\n  showScreen('loadingScreen');\n  var si=0;updateStep(0);\n  var iv=setInterval(function(){si=Math.min(si+1,steps.length-1);updateStep(si);},2200);\n  fetch('/api/analyze',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({image:imageBase64,threshold:threshold,lotThreshold:lotThreshold})})\n  .then(function(r){if(!r.ok)throw new Error('HTTP '+r.status);return r.json();})\n  .then(function(data){clearInterval(iv);showResult(data);})\n  .catch(function(e){clearInterval(iv);showResult({verdict:'KEEP',item_name:'Network error - set aside',avg_sold_price:0,reason:'Could not reach server. Set aside for manual review.'});});\n}\n\nfunction updateStep(i){document.getElementById('loadingStep').textContent=steps[i][0];document.getElementById('loadingSub').textContent=steps[i][1];}\n\nfunction showResult(r){\n  var verdict=(r.verdict||'KEEP').toUpperCase();\n  var rs=document.getElementById('resultScreen');\n  var cls=verdict==='KEEP'?'keep':verdict==='LOT'?'lot':'recycle';\n  rs.className='screen active '+cls;\n  document.getElementById('resultVerdict').textContent=verdict;\n  document.getElementById('resultItemName').textContent=r.item_name||'Set aside for review';\n  var priceVal=r.avg_sold_price&&r.avg_sold_price>0?'$'+Number(r.avg_sold_price).toFixed(0):'--';\n  document.getElementById('resultPrice').textContent=priceVal;\n  document.getElementById('resultPriceLabel').textContent=verdict==='LOT'?'est. per unit':'avg sold on eBay';\n  document.getElementById('resultReason').textContent=r.reason||'';\n  showScreen('resultScreen');\n  playSound(verdict);\n  var now=new Date();\n  var timeStr=now.getHours()+':'+(now.getMinutes()<10?'0':'')+now.getMinutes();\n  scanHistory.unshift({verdict:verdict,item_name:r.item_name||'Unknown',avg_sold_price:r.avg_sold_price||0,reason:r.reason||'',time:timeStr});\n  var bar=document.getElementById('countdownBar');\n  bar.style.transition='none';bar.style.width='100%';\n  setTimeout(function(){bar.style.transition='width '+RESULT_MS+'ms linear';bar.style.width='0%';},30);\n  clearTimeout(countdownTimer);\n  countdownTimer=setTimeout(function(){dismissResult();},RESULT_MS);\n}\n\nfunction dismissResult(){\n  clearTimeout(countdownTimer);\n  isAnalyzing=false;stableFrames=0;lastFrameData=null;\n  showScreen('scannerScreen');\n  lockScanner(COOLDOWN_MS);\n}\n\nfunction showScreen(id){document.querySelectorAll('.screen').forEach(function(s){s.classList.remove('active');});document.getElementById(id).classList.add('active');}\nfunction setStatus(t,c){var p=document.getElementById('statusPill');p.textContent=t;p.className='status-pill'+(c?' '+c:'');}\n\nfunction showHistory(){\n  var list=document.getElementById('historyList');\n  if(scanHistory.length===0){list.innerHTML='<div class=\"history-empty\">No scans yet this session</div>';}\n  else{\n    var counts={KEEP:0,LOT:0,RECYCLE:0};\n    scanHistory.forEach(function(s){if(counts[s.verdict]!==undefined)counts[s.verdict]++;});\n    list.innerHTML='<div style=\"font-family:var(--mono);font-size:0.6rem;color:var(--muted);padding:10px 0 16px;letter-spacing:0.08em;\">SESSION: '+scanHistory.length+' scans &nbsp;|&nbsp; <span style=\"color:var(--keep)\">'+counts.KEEP+' KEEP</span> &nbsp;|&nbsp; <span style=\"color:var(--lot)\">'+counts.LOT+' LOT</span> &nbsp;|&nbsp; <span style=\"color:var(--recycle)\">'+counts.RECYCLE+' RECYCLE</span></div>'+\n    scanHistory.map(function(s){\n      var v=s.verdict.toUpperCase();\n      var cls=v==='KEEP'?'keep':v==='LOT'?'lot':'recycle';\n      var price=s.avg_sold_price>0?'$'+Number(s.avg_sold_price).toFixed(0):'--';\n      return '<div class=\"history-item\"><div class=\"history-verdict '+cls+'\">'+v+'</div><div class=\"history-info\"><div class=\"history-name\">'+s.item_name+'</div><div class=\"history-price\">'+price+' &middot; '+s.reason.slice(0,55)+'...</div></div><div class=\"history-time\">'+s.time+'</div></div>';\n    }).join('');\n  }\n  showScreen('historyScreen');\n}\n\nfunction hideHistory(){showScreen('scannerScreen');}\n\nfunction copyHistory(){\n  if(scanHistory.length===0){alert('No scans to export yet.');return;}\n  var csv='Time,Verdict,Item,Avg Unit Price,Reason\\n';\n  csv+=scanHistory.map(function(s){return s.time+','+s.verdict+',\"'+s.item_name.replace(/\"/g,'')+'\",'+s.avg_sold_price+',\"'+s.reason.replace(/\"/g,'')+'\"';}).join('\\n');\n  navigator.clipboard.writeText(csv).then(function(){alert('Copied! Paste into any spreadsheet.');}).catch(function(){alert('Copy failed - try again.');});\n}\n\nfunction updateThreshold(v){threshold=parseInt(v);document.getElementById('sliderValueLabel').textContent='$'+threshold;document.getElementById('thresholdDisplay').textContent='$'+threshold;}\nfunction updateLotThreshold(v){lotThreshold=parseInt(v);document.getElementById('lotValueLabel').textContent='$'+v;}\nfunction setScanMode(mode){scanMode=mode;document.getElementById('modeManualOpt').classList.toggle('selected',mode==='manual');document.getElementById('modeAutoOpt').classList.toggle('selected',mode==='auto');var badge=document.getElementById('modeBadge');badge.textContent=mode.toUpperCase();badge.className='mode-badge'+(mode==='auto'?' auto':'');document.getElementById('scanLine').classList.toggle('active',mode==='auto');setStatus(mode==='auto'?'Point at item':'Ready','ready');stableFrames=0;lastFrameData=null;}\nfunction openSettings(){document.getElementById('settingsPanel').classList.add('open');document.getElementById('settingsBackdrop').classList.add('open');}\nfunction closeSettings(){document.getElementById('settingsPanel').classList.remove('open');document.getElementById('settingsBackdrop').classList.remove('open');}\nfunction selectPack(n){soundPack=n;document.getElementById('pack1Opt').classList.toggle('selected',n===1);document.getElementById('pack2Opt').classList.toggle('selected',n===2);document.getElementById('packToggleBtn').textContent='PACK '+n;playSound('KEEP');}\nfunction cycleSoundPack(){selectPack(soundPack===1?2:1);}\nwindow.addEventListener('load',function(){audioCtx.resume();startCamera();});\ndocument.addEventListener('visibilitychange',function(){\n  if(document.visibilityState==='visible'){\n    var video=document.getElementById('videoEl');\n    if(!video.srcObject||video.paused){startCamera();}\n  }\n});\ndocument.addEventListener('touchstart',function(){audioCtx.resume();},{once:true});\ndocument.addEventListener('click',function(){audioCtx.resume();},{once:true});\n</script>\n</body>\n</html>";
const PROCESSOR_HTML = "<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n<meta charset=\"UTF-8\">\n<meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0, user-scalable=no\">\n<meta name=\"mobile-web-app-capable\" content=\"yes\">\n<meta name=\"apple-mobile-web-app-capable\" content=\"yes\">\n<meta name=\"theme-color\" content=\"#0f0f0f\">\n<title>XRT Processor</title>\n<link href=\"https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Barlow:wght@400;600;700;900&family=DM+Mono:wght@400;500&display=swap\" rel=\"stylesheet\">\n<style>\n:root{--bg:#0f0f0f;--surface:#1a1a1a;--surface2:#222;--border:#2c2c2c;--text:#f2f2f2;--muted:#666;--accent:#e8ff00;--green:#00e676;--red:#ff1744;--orange:#ff9f1c;--blue:#448aff;--display:'Bebas Neue',sans-serif;--body:'Barlow',sans-serif;--mono:'DM Mono',monospace;}\n*{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent;}\nhtml,body{height:100%;overflow:hidden;background:var(--bg);font-family:var(--body);color:var(--text);user-select:none;touch-action:manipulation;}\n.screen{position:fixed;inset:0;display:none;flex-direction:column;background:var(--bg);}.screen.active{display:flex;}\n.topbar{display:flex;align-items:center;justify-content:space-between;padding:14px 20px 12px;background:var(--bg);border-bottom:1px solid var(--border);flex-shrink:0;gap:10px;}\n.topbar-brand{font-family:var(--display);font-size:1.3rem;letter-spacing:0.06em;color:var(--text);white-space:nowrap;}.topbar-brand span{color:var(--accent);}\n.topbar-right{font-family:var(--mono);font-size:0.65rem;letter-spacing:0.1em;color:var(--accent);text-align:right;}\n.back-btn{background:transparent;border:1px solid var(--border);color:var(--muted);padding:6px 12px;border-radius:6px;font-family:var(--mono);font-size:0.6rem;letter-spacing:0.08em;cursor:pointer;white-space:nowrap;flex-shrink:0;}\n.back-btn:active{background:var(--surface2);}\n.status-dot{width:10px;height:10px;border-radius:50%;background:var(--green);flex-shrink:0;}\n.status-dot.offline{background:var(--orange);}\n.status-row{display:flex;align-items:center;gap:6px;}\n.status-text{font-family:var(--mono);font-size:0.6rem;color:var(--muted);letter-spacing:0.08em;}\n.scroll-content{flex:1;overflow-y:auto;padding:22px 20px;}\n.btn{width:100%;padding:18px;border:none;border-radius:8px;font-family:var(--display);font-size:1.3rem;letter-spacing:0.06em;cursor:pointer;transition:all 0.15s;margin-bottom:10px;}\n.btn-primary{background:var(--accent);color:#000;}.btn-primary:active{background:#c8df00;}\n.btn-primary:disabled{background:var(--border);color:var(--muted);cursor:not-allowed;}\n.btn-secondary{background:var(--surface2);color:var(--text);border:1px solid var(--border);}.btn-secondary:active{background:#2a2a2a;}\n.btn-skip{background:transparent;color:var(--muted);border:1px solid var(--border);font-size:1rem;padding:14px;}\n.section-title{font-family:var(--display);font-size:1.8rem;letter-spacing:0.04em;color:var(--text);margin-bottom:4px;}\n.section-sub{font-size:0.9rem;color:var(--muted);margin-bottom:22px;line-height:1.5;}\n.grade-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px;}\n.grade-btn{padding:20px 12px;border:2px solid var(--border);border-radius:10px;background:var(--surface);cursor:pointer;transition:all 0.15s;text-align:center;}\n.grade-btn:active{transform:scale(0.96);}\n.grade-btn.selected{border-color:var(--accent);background:rgba(232,255,0,0.06);}\n.grade-letter{font-family:var(--display);font-size:3rem;line-height:1;margin-bottom:4px;color:var(--text);}\n.grade-name{font-size:0.85rem;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.04em;margin-bottom:4px;}\n.grade-desc{font-size:0.75rem;color:var(--muted);line-height:1.4;}\n.grade-btn.selected .grade-letter{color:var(--accent);}.grade-btn.selected .grade-name{color:var(--accent);}\n.pf-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px;}\n.pf-btn{padding:24px 12px;border:2px solid var(--border);border-radius:10px;background:var(--surface);cursor:pointer;transition:all 0.15s;text-align:center;}\n.pf-btn:active{transform:scale(0.96);}\n.pf-pass.selected{border-color:var(--green);background:rgba(0,230,118,0.06);}\n.pf-fail.selected{border-color:var(--red);background:rgba(255,23,68,0.06);}\n.pf-icon{font-size:2.5rem;margin-bottom:8px;}\n.pf-label{font-family:var(--display);font-size:1.8rem;letter-spacing:0.04em;}\n.pf-pass.selected .pf-label{color:var(--green);}\n.pf-fail.selected .pf-label{color:var(--red);}\n.conflict-banner{background:rgba(255,159,28,0.1);border:1px solid var(--orange);border-radius:8px;padding:12px 16px;margin-bottom:16px;font-size:0.85rem;color:var(--orange);line-height:1.5;}\n.notes-input{width:100%;background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:14px 16px;color:var(--text);font-family:var(--body);font-size:1rem;line-height:1.5;resize:none;outline:none;min-height:120px;-webkit-appearance:none;}\n.notes-input:focus{border-color:var(--accent);}\n.notes-input::placeholder{color:var(--muted);}\n.notes-example{font-family:var(--mono);font-size:0.6rem;letter-spacing:0.06em;color:var(--muted);padding:4px 0;border-bottom:1px solid var(--border);}\n/* Camera */\n#photoScreen{display:none;flex-direction:column;}\n#photoScreen.active{display:flex;}\n#photoScreen .topbar{flex-shrink:0;}\n#camContainer{position:relative;background:#000;overflow:hidden;width:100%;aspect-ratio:1/1;max-height:calc(100vh - 200px);margin:0 auto;}\n#photoVideo{position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover;}\n#camPrompt{position:absolute;bottom:60px;left:0;right:0;text-align:center;font-family:var(--mono);font-size:0.6rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--accent);pointer-events:none;}\n#camCount{position:absolute;top:12px;right:12px;background:rgba(0,0,0,0.65);border-radius:100px;padding:4px 12px;font-family:var(--mono);font-size:0.65rem;color:#fff;}\n#camThumbs{position:absolute;bottom:8px;left:12px;right:12px;display:flex;gap:6px;overflow-x:auto;flex-wrap:nowrap;-webkit-overflow-scrolling:touch;white-space:nowrap;}\n#camThumbs img{width:44px;height:44px;border-radius:5px;object-fit:cover;border:2px solid rgba(255,255,255,0.4);}\n#photoControls{display:flex;gap:10px;padding:10px 16px;background:var(--bg);flex-shrink:0;border-top:1px solid var(--border);}\n#photoControls button{flex:1;padding:14px;border:none;border-radius:8px;font-family:var(--display);font-size:1rem;letter-spacing:0.05em;cursor:pointer;}\n#shootBtn{background:var(--surface2);color:var(--text);border:2px solid var(--border)!important;display:flex;align-items:center;justify-content:center;gap:8px;}\n#shootBtn:active{background:#2a2a2a;}\n#shootBtn svg{width:18px;height:18px;}\n#photoDoneBtn{background:var(--accent);color:#000;}\n#photoDoneBtn:disabled{background:var(--border);color:var(--muted);}\n#photoSkipBtn{background:transparent;color:var(--muted);border:1px solid var(--border)!important;font-size:0.9rem;max-width:80px;}\n/* Shelf */\n#shelfScreen{display:none;flex-direction:column;}\n#shelfScreen.active{display:flex;}\n#shelfCamContainer{flex:1;position:relative;background:#000;overflow:hidden;}\n#shelfVideo{position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover;}\n#shelfPrompt{position:absolute;bottom:0;left:0;right:0;padding:10px 14px;background:linear-gradient(to top,rgba(0,0,0,0.9),transparent);font-family:var(--mono);font-size:0.6rem;letter-spacing:0.1em;text-transform:uppercase;color:var(--accent);}\n#shelfControls{padding:16px 20px;background:var(--bg);border-top:1px solid var(--border);flex-shrink:0;}\n.shelf-result{background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:16px;text-align:center;margin-bottom:12px;}\n.shelf-code{font-family:var(--display);font-size:3.5rem;color:var(--accent);line-height:1;}\n.shelf-code-label{font-family:var(--mono);font-size:0.6rem;letter-spacing:0.12em;color:var(--muted);text-transform:uppercase;margin-top:4px;}\n.shelf-manual-input{width:100%;background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:14px 16px;color:var(--text);font-family:var(--mono);font-size:1.2rem;letter-spacing:0.15em;text-align:center;outline:none;-webkit-appearance:none;text-transform:uppercase;margin-bottom:12px;}\n.shelf-manual-input:focus{border-color:var(--accent);}\n/* Review */\n.review-card{background:var(--surface);border:1px solid var(--border);border-radius:10px;overflow:hidden;margin-bottom:16px;}\n.review-row{display:flex;justify-content:space-between;align-items:flex-start;padding:12px 16px;border-bottom:1px solid var(--border);}\n.review-row:last-child{border-bottom:none;}\n.review-label{font-family:var(--mono);font-size:0.6rem;letter-spacing:0.1em;text-transform:uppercase;color:var(--muted);flex-shrink:0;margin-right:12px;padding-top:2px;}\n.review-value{font-size:0.9rem;font-weight:600;color:var(--text);text-align:right;}\n/* Success */\n.success-banner{background:rgba(0,230,118,0.08);border:1px solid rgba(0,230,118,0.3);border-radius:8px;padding:12px 16px;margin-bottom:16px;}\n.success-title{font-family:var(--display);font-size:1.3rem;color:var(--green);margin-bottom:4px;}\n.success-sub{font-family:var(--mono);font-size:0.6rem;color:var(--muted);letter-spacing:0.08em;line-height:1.6;}\n.sku-display{font-family:var(--display);font-size:5rem;color:var(--accent);line-height:1;text-align:center;margin-bottom:8px;}\n/* Offline */\n.offline-bar{background:rgba(255,159,28,0.1);border-top:1px solid var(--orange);padding:8px 20px;display:none;font-family:var(--mono);font-size:0.6rem;letter-spacing:0.08em;color:var(--orange);text-align:center;text-transform:uppercase;flex-shrink:0;}\n.offline-bar.show{display:block;}\n/* Identifier (Feature 1) + tap-to-focus (FIX 7) */\n#idCamContainer{position:relative;background:#000;overflow:hidden;width:100%;aspect-ratio:1/1;max-height:calc(100vh - 200px);margin:0 auto;}\n#idVideo{position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover;}\n.id-cam-prompt{position:absolute;bottom:60px;left:0;right:0;text-align:center;font-family:var(--mono);font-size:0.6rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--accent);pointer-events:none;}\n.focus-ring{position:absolute;width:64px;height:64px;border:2px solid var(--accent);border-radius:50%;margin-left:-32px;margin-top:-32px;pointer-events:none;opacity:0;z-index:5;}\n.focus-ring.show{animation:focusFade 0.5s ease-out forwards;}\n@keyframes focusFade{0%{transform:scale(1.4);opacity:1;}100%{transform:scale(1);opacity:0;}}\n.id-result-card{background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:20px;margin-bottom:16px;}\n.id-name{font-family:var(--display);font-size:2rem;letter-spacing:0.02em;line-height:1.05;color:var(--text);margin-bottom:10px;}\n.id-value{font-family:var(--display);font-size:1.6rem;color:var(--green);margin-bottom:6px;}\n.id-qty{font-family:var(--mono);font-size:0.7rem;letter-spacing:0.08em;text-transform:uppercase;color:var(--accent);}\n.qty-control{display:flex;align-items:center;justify-content:center;gap:24px;margin:24px 0;}\n.qty-btn{width:64px;height:64px;border-radius:50%;border:2px solid var(--accent);background:var(--surface);color:var(--accent);font-family:var(--display);font-size:2.2rem;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center;}\n.qty-btn:active{background:rgba(232,255,0,0.1);}\n.qty-num{font-family:var(--display);font-size:4rem;color:var(--text);min-width:90px;text-align:center;}\n.value-warn{background:rgba(255,159,28,0.12);border:1px solid var(--orange);border-radius:8px;padding:14px 16px;margin-bottom:18px;font-size:0.95rem;color:var(--orange);font-weight:600;line-height:1.5;}\n.test-bullet{display:flex;gap:10px;align-items:flex-start;padding:12px 14px;background:var(--surface);border:1px solid var(--border);border-radius:8px;margin-bottom:8px;font-size:0.95rem;line-height:1.4;}\n.test-bullet .dot{color:var(--accent);font-weight:bold;flex-shrink:0;}\n.chips{display:flex;flex-wrap:wrap;gap:8px;margin:14px 0;}\n.chip{padding:9px 14px;border:1px solid var(--border);border-radius:100px;background:var(--surface);color:var(--text);font-size:0.85rem;cursor:pointer;}\n.chip.selected{border-color:var(--accent);background:rgba(232,255,0,0.08);color:var(--accent);}\n.pf-grid.three{grid-template-columns:1fr 1fr 1fr;}\n.pf-na.selected{border-color:var(--blue);background:rgba(68,138,255,0.08);}\n.pf-na.selected .pf-label{color:var(--blue);}\n/* v4: camera format toggle (FIX 1) */\n.cam-format-toggle{position:absolute;top:12px;left:12px;background:rgba(0,0,0,0.65);border:1px solid rgba(255,255,255,0.25);border-radius:100px;padding:5px 12px;font-family:var(--mono);font-size:0.6rem;letter-spacing:0.06em;color:var(--accent);cursor:pointer;z-index:6;}\n/* v4: photo management (Feature 2) */\n.thumb-wrap{position:relative;display:inline-block;flex:0 0 auto;}\n.thumb-wrap.dragging{opacity:0.4;}\n.thumb-wrap.drop-target{outline:2px dashed var(--accent);outline-offset:2px;}\n.thumb-del{position:absolute;top:-6px;right:-6px;width:22px;height:22px;border-radius:50%;background:var(--red);color:#fff;border:2px solid var(--bg);font-size:0.85rem;line-height:1;display:flex;align-items:center;justify-content:center;cursor:pointer;z-index:3;}\n.undo-bar{position:fixed;bottom:84px;left:50%;transform:translateX(-50%);background:var(--surface2);border:1px solid var(--border);border-radius:100px;padding:10px 18px;display:none;align-items:center;gap:14px;z-index:200;font-size:0.85rem;color:var(--text);}\n.undo-bar.show{display:flex;}\n.undo-bar button{background:var(--accent);color:#000;border:none;border-radius:6px;padding:6px 14px;font-weight:700;cursor:pointer;}\n/* v4: testing photos (Feature 1) */\n.test-cap-btn{width:100%;padding:14px;border:1px solid var(--blue);border-radius:8px;background:rgba(68,138,255,0.08);color:var(--blue);font-family:var(--display);font-size:1.1rem;letter-spacing:0.04em;cursor:pointer;margin:6px 0 10px;}\n#testCamContainer{position:relative;background:#000;overflow:hidden;width:100%;aspect-ratio:1/1;max-height:50vh;margin:0 auto 10px;border-radius:8px;}\n#testVideo{position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover;}\n.test-photo-thumbs{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0;}\n.test-photo-thumbs img{width:64px;height:64px;border-radius:6px;object-fit:cover;border:2px solid var(--green);}\n.parts-banner{background:rgba(255,159,28,0.12);border:1px solid var(--orange);border-radius:8px;padding:14px 16px;margin:14px 0;font-size:0.9rem;color:var(--orange);line-height:1.6;}\ncanvas{display:none;}\n</style>\n</head>\n<body>\n\n<!-- HOME -->\n<div class=\"screen active\" id=\"homeScreen\">\n  <div class=\"topbar\">\n    <div class=\"topbar-brand\">XRT<span>&#183;</span>PROC</div>\n    <div class=\"status-row\">\n      <div class=\"status-dot\" id=\"statusDot\"></div>\n      <div class=\"status-text\" id=\"statusText\">Online</div>\n    </div>\n  </div>\n  <div class=\"offline-bar\" id=\"offlineBar\">Offline \u2014 items queued locally</div>\n  <div class=\"scroll-content\" style=\"display:flex;flex-direction:column;justify-content:center;min-height:calc(100vh - 56px);\">\n    <div style=\"margin-bottom:8px;\">\n      <div style=\"font-family:var(--mono);font-size:0.6rem;letter-spacing:0.15em;text-transform:uppercase;color:var(--muted);margin-bottom:4px;\">Next SKU</div>\n      <div style=\"font-family:var(--display);font-size:5rem;color:var(--accent);line-height:0.9;margin-bottom:4px;\" id=\"homeSku\">---</div>\n    </div>\n    <div style=\"font-size:1rem;font-weight:600;color:var(--text);margin-bottom:8px;\">Ready to process</div>\n    <div style=\"font-size:0.85rem;color:var(--muted);line-height:1.5;margin-bottom:28px;\">Write SKU on sticker and attach to item before starting.</div>\n    <div id=\"queueBadge\" style=\"display:none;background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:10px 14px;margin-bottom:20px;font-family:var(--mono);font-size:0.65rem;color:var(--muted);display:none;\">\n      <span style=\"font-family:var(--display);font-size:1.4rem;color:var(--orange);\" id=\"queueNum\">0</span> items queued offline\n    </div>\n    <button class=\"btn btn-primary\" onclick=\"startItem()\">New Item</button>\n    <button class=\"btn btn-secondary\" onclick=\"window.open('/api/listings','_blank')\">View Listings</button>\n  </div>\n</div>\n\n<!-- IDENTIFY (Feature 1, Step A) -->\n<div class=\"screen\" id=\"identifyScreen\">\n  <div class=\"topbar\">\n    <div class=\"topbar-brand\">Identify</div>\n    <button class=\"back-btn\" onclick=\"goHome()\">Cancel</button>\n  </div>\n  <div id=\"idCamContainer\">\n    <video id=\"idVideo\" autoplay playsinline muted></video>\n    <div class=\"focus-ring\" id=\"idFocusRing\"></div>\n    <div class=\"id-cam-prompt\" id=\"idPrompt\">Center the item, then tap Identify</div>\n  </div>\n  <div id=\"idControls\" style=\"padding:10px 16px;background:var(--bg);border-top:1px solid var(--border);flex-shrink:0;\">\n    <button class=\"btn btn-primary\" style=\"margin-bottom:0;\" id=\"identifyBtn\" onclick=\"identifyCapture()\">Identify Item</button>\n    <button onclick='skipIdentify()' style='margin-top:10px;width:100%;padding:10px;border:2px solid #2e7d32;border-radius:6px;background:transparent;color:#2e7d32;font-weight:600;font-size:14px;'>Skip - I know this item</button>\n    <div id='skipSearchBox' style='display:none;margin-top:10px;'><div style='font-size:13px;font-weight:600;margin-bottom:6px;'>Enter item name or model number</div><input id='skipSearchInput' type='text' placeholder='e.g. Klipsch KG4 Vintage Bookshelf Speakers' style='width:100%;padding:10px;border:1px solid var(--border);border-radius:6px;font-size:14px;margin-bottom:8px;'><button onclick='manualSearch(&quot;skipSearchInput&quot;,&quot;skipSearchStatus&quot;)' style='width:100%;padding:10px;border:none;border-radius:6px;background:#2e7d32;color:#fff;font-weight:600;font-size:14px;'>Search eBay</button><div id='skipSearchStatus' style='font-size:13px;font-weight:600;color:#2e7d32;margin-top:6px;'></div></div>\n    <div style='margin-top:10px;'><div style='font-size:13px;font-weight:600;margin-bottom:6px;'>Know what this is? Search directly:</div><div style='display:flex;gap:8px;'><input id='manualSearchInput' type='text' placeholder='e.g. Klipsch KG4 vintage speakers' style='flex:1;padding:10px;border:1px solid var(--border);border-radius:6px;font-size:14px;'><button onclick='manualSearch(&quot;manualSearchInput&quot;)' style='padding:10px 16px;border:none;border-radius:6px;background:#2e7d32;color:#fff;font-weight:600;font-size:14px;'>Search</button></div></div>\n  </div>\n  <canvas id=\"idCanvas\"></canvas>\n</div>\n\n<!-- IDENTIFY RESULT (Feature 1, Step A result) -->\n<div class=\"screen\" id=\"idResultScreen\">\n  <div class=\"topbar\">\n    <div class=\"topbar-brand\">Identified</div>\n    <button class=\"back-btn\" onclick=\"goHome()\">Cancel</button>\n  </div>\n  <div class=\"scroll-content\">\n    <div class=\"id-result-card\">\n      <div class=\"id-name\" id=\"idName\">--</div>\n      <div class=\"id-value\" id=\"idValue\">--</div>\n      <div class=\"id-qty\" id=\"idQty\">--</div>\n      <div class=\"id-qty\" id=\"idCategory\" style=\"display:none;margin-top:6px;font-weight:600;\"></div>\n    </div>\n    <button class=\"btn btn-secondary\" onclick=\"showManualSearch()\">Wrong item? Search again</button>\n    <div id=\"manualSearchBox\" style=\"display:none;margin-bottom:12px;\"><input id=\"manualSearchInput2\" type=\"text\" placeholder=\"Enter item name or model number\" style=\"width:100%;padding:10px;border:1px solid var(--border);border-radius:6px;font-size:14px;margin-bottom:8px;\"><button onclick=\"manualSearch('manualSearchInput2')\" style=\"width:100%;padding:10px;border:none;border-radius:6px;background:#2e7d32;color:#fff;font-weight:600;font-size:14px;\">Search</button></div>\n    <button class=\"btn btn-primary\" id=\"idConfirmBtn\" onclick=\"idConfirm()\">Yes, that's it</button>\n    <button class=\"btn btn-secondary\" onclick=\"idRescan()\">Rescan</button>\n    <button class=\"btn btn-skip\" onclick=\"idSkip()\">Skip ID</button>\n  </div>\n</div>\n\n<!-- QUANTITY (Feature 1, Step B) -->\n<div class=\"screen\" id=\"quantityScreen\">\n  <div class=\"topbar\">\n    <div class=\"topbar-brand\">Quantity</div>\n    <button class=\"back-btn\" onclick=\"goHome()\">Cancel</button>\n  </div>\n  <div class=\"scroll-content\">\n    <div class=\"section-title\">How Many?</div>\n    <div class=\"section-sub\" id=\"qtyPrompt\">Identical items detected. How many are you listing?</div>\n    <div class=\"qty-control\">\n      <div class=\"qty-btn\" onclick=\"qtyAdjust(-1)\">&#8722;</div>\n      <div class=\"qty-num\" id=\"qtyNum\">1</div>\n      <div class=\"qty-btn\" onclick=\"qtyAdjust(1)\">+</div>\n    </div>\n    <button class=\"btn btn-primary\" onclick=\"qtyConfirm()\">Confirm Quantity</button>\n  </div>\n</div>\n\n<!-- VALUE CHECK (Feature 1, Step C) -->\n<div class=\"screen\" id=\"valueScreen\">\n  <div class=\"topbar\">\n    <div class=\"topbar-brand\">Value Check</div>\n    <button class=\"back-btn\" onclick=\"goHome()\">Cancel</button>\n  </div>\n  <div class=\"scroll-content\">\n    <div class=\"value-warn\" id=\"valueWarn\">Below minimum — estimated $0</div>\n    <div class=\"section-sub\">This item looks low value. What do you want to do?</div>\n    <button class=\"btn btn-primary\" onclick=\"valueListAnyway()\">List It Anyway</button>\n    <button class=\"btn btn-secondary\" onclick=\"valueAction('recycle')\">Recycle</button>\n    <button class=\"btn btn-secondary\" onclick=\"valueAction('hold')\">Hold for Review</button>\n  </div>\n</div>\n\n<!-- TESTING INSTRUCTIONS (Feature 1, Step D) -->\n<div class=\"screen\" id=\"testingScreen\">\n  <div class=\"topbar\">\n    <div class=\"topbar-brand\">Testing</div>\n    <button class=\"back-btn\" onclick=\"goHome()\">Cancel</button>\n  </div>\n  <div class=\"scroll-content\">\n    <div class=\"section-title\" id=\"testItemName\">Item</div>\n    <div class=\"section-sub\">5-Minute Test — Critical checks only</div>\n    <div id=\"testList\"></div>\n    <div class=\"parts-banner\" id=\"partsBanner\" style=\"display:none;\"></div>\n    <button class=\"test-cap-btn\" onclick=\"toggleTestCam()\">&#128247; Capture Testing Photo</button>\n    <div id=\"testCamWrap\" style=\"display:none;\">\n      <div id=\"testCamContainer\"><video id=\"testVideo\" autoplay playsinline muted></video></div>\n      <button class=\"btn btn-secondary\" onclick=\"captureTestPhoto()\">Capture</button>\n    </div>\n    <div class=\"test-photo-thumbs\" id=\"testPhotoThumbs\"></div>\n    <br>\n    <button class=\"btn btn-primary\" onclick=\"goToTestNotes()\">Done Testing — Add Notes</button>\n    <button class=\"btn btn-skip\" onclick=\"skipTestNotes()\">Skip Notes</button>\n  </div>\n  <canvas id=\"testCanvas\"></canvas>\n</div>\n\n<!-- TEST NOTES (Feature 1, Step E) -->\n<div class=\"screen\" id=\"testNotesScreen\">\n  <div class=\"topbar\">\n    <div class=\"topbar-brand\">Test Notes</div>\n    <button class=\"back-btn\" onclick=\"showScreen('testingScreen')\">&#8592; Back</button>\n  </div>\n  <div class=\"scroll-content\">\n    <div class=\"section-title\">What Did You Find?</div>\n    <textarea class=\"notes-input\" id=\"testNotesInput\" placeholder=\"What did you find? (or leave blank)\"></textarea>\n    <div class=\"chips\" id=\"testChips\"></div>\n    <button class=\"btn btn-primary\" onclick=\"testNotesContinue()\">Continue</button>\n  </div>\n</div>\n\n<!-- SKU CLAIM (Feature 1, Step F) -->\n<div class=\"screen\" id=\"skuClaimScreen\">\n  <div class=\"topbar\">\n    <div class=\"topbar-brand\">XRT<span>&#183;</span>PROC</div>\n  </div>\n  <div class=\"scroll-content\" style=\"display:flex;flex-direction:column;justify-content:center;min-height:calc(100vh - 56px);\">\n    <div style=\"font-family:var(--mono);font-size:0.6rem;letter-spacing:0.15em;text-transform:uppercase;color:var(--muted);text-align:center;margin-bottom:4px;\">SKU Claimed</div>\n    <div class=\"sku-display\" id=\"claimSku\">2000</div>\n    <div class=\"section-sub\" style=\"text-align:center;\">Write this on a sticker and attach to the item.</div>\n    <button class=\"btn btn-primary\" onclick=\"goToGradeFromClaim()\">Ready — Continue to Grade</button>\n  </div>\n</div>\n\n<!-- GRADE -->\n<div class=\"screen\" id=\"gradeScreen\">\n  <div class=\"topbar\">\n    <div class=\"topbar-brand\">Grade</div>\n    <div class=\"topbar-right\" id=\"gradeSkuLabel\">SKU \u2014</div>\n  </div>\n  <div class=\"scroll-content\">\n    <div class=\"section-title\">Assign Grade</div>\n    <div class=\"section-sub\">Pick the grade that matches what you saw and tested. When between two grades, always choose the lower one.</div>\n    <div class=\"grade-grid\">\n      <div class=\"grade-btn\" id=\"gradeA\" onclick=\"selectGrade('A')\"><div class=\"grade-letter\">A</div><div class=\"grade-name\">Like New</div><div class=\"grade-desc\">Works perfectly. Looks almost new.</div></div>\n      <div class=\"grade-btn\" id=\"gradeB\" onclick=\"selectGrade('B')\"><div class=\"grade-letter\">B</div><div class=\"grade-name\">Good &#9733;</div><div class=\"grade-desc\">Works perfectly. Normal light wear.</div></div>\n      <div class=\"grade-btn\" id=\"gradeC\" onclick=\"selectGrade('C')\"><div class=\"grade-letter\">C</div><div class=\"grade-name\">Fair</div><div class=\"grade-desc\">Works. Heavy visible wear.</div></div>\n      <div class=\"grade-btn\" id=\"gradeD\" onclick=\"selectGrade('D')\"><div class=\"grade-letter\">D</div><div class=\"grade-name\">Parts</div><div class=\"grade-desc\">Does not work or untested.</div></div>\n    </div>\n    <button class=\"btn btn-primary\" id=\"gradeContinue\" onclick=\"goToPowerTest()\" disabled>Continue</button>\n    <button class=\"btn btn-skip\" onclick=\"goHome()\">Cancel</button>\n  </div>\n</div>\n\n<!-- POWER TEST -->\n<div class=\"screen\" id=\"powerScreen\">\n  <div class=\"topbar\">\n    <div class=\"topbar-brand\">Power Test</div>\n    <div class=\"topbar-right\" id=\"powerSkuLabel\">SKU \u2014</div>\n    <button class=\"back-btn\" onclick=\"goToGrade()\">&#8592; Back</button>\n  </div>\n  <div class=\"scroll-content\">\n    <div class=\"section-title\">Power Test Result</div>\n    <div class=\"section-sub\">Did the item power on and perform its basic function?</div>\n    <div class=\"pf-grid three\">\n      <div class=\"pf-btn pf-pass\" id=\"pfPass\" onclick=\"selectPowerTest('Pass')\">\n        <div class=\"pf-icon\">&#10003;</div>\n        <div class=\"pf-label\">Pass</div>\n      </div>\n      <div class=\"pf-btn pf-fail\" id=\"pfFail\" onclick=\"selectPowerTest('Fail')\">\n        <div class=\"pf-icon\">&#10007;</div>\n        <div class=\"pf-label\">Fail</div>\n      </div>\n      <div class=\"pf-btn pf-na\" id=\"pfNA\" onclick=\"selectPowerTest('N/A')\">\n        <div class=\"pf-icon\">&#8211;</div>\n        <div class=\"pf-label\">N/A</div>\n      </div>\n    </div>\n    <div class=\"conflict-banner\" id=\"pfConflict\" style=\"display:none;\">\n      &#9888; Grade <span id=\"conflictGrade\"></span> selected but power test failed. Consider changing grade to D.\n    </div>\n    <button class=\"btn btn-primary\" id=\"pfContinue\" onclick=\"goToNotes()\" disabled>Continue</button>\n  </div>\n</div>\n\n<!-- NOTES -->\n<div class=\"screen\" id=\"notesScreen\">\n  <div class=\"topbar\">\n    <div class=\"topbar-brand\">Notes</div>\n    <div class=\"topbar-right\" id=\"notesSkuLabel\">SKU \u2014</div>\n    <button class=\"back-btn\" onclick=\"goToPowerTest()\">&#8592; Back</button>\n  </div>\n  <div class=\"scroll-content\">\n    <div class=\"section-title\">Additional Notes</div>\n    <div class=\"section-sub\">Optional. Anything not visible in photos \u2014 defects, what is included, anything unusual.</div>\n    <textarea class=\"notes-input\" id=\"notesInput\" placeholder=\"e.g. Disc tray does not eject. Includes power adapter.\"></textarea>\n    <div style=\"margin-top:10px;\">\n      <div class=\"notes-example\">Screen has dead pixel bottom right</div>\n      <div class=\"notes-example\">Powers on, no sound output</div>\n      <div class=\"notes-example\">Includes original box and cables</div>\n      <div class=\"notes-example\">No power cable found</div>\n    </div>\n    <br>\n    <button class=\"btn btn-primary\" onclick=\"goToPhotos()\">Continue</button>\n    <button class=\"btn btn-skip\" onclick=\"goToPhotos()\">Skip \u2014 No Notes</button>\n  </div>\n</div>\n\n<!-- PHOTOS -->\n<div class=\"screen\" id=\"photoScreen\">\n  <div class=\"topbar\">\n    <div class=\"topbar-brand\">Photos</div>\n    <div class=\"topbar-right\" id=\"photoSkuLabel\">SKU \u2014</div>\n    <button class=\"back-btn\" onclick=\"goToNotes()\">&#8592; Back</button>\n  </div>\n  <div id=\"camContainer\">\n    <video id=\"photoVideo\" autoplay playsinline muted></video>\n    <div class=\"focus-ring\" id=\"photoFocusRing\"></div>\n    <div class=\"cam-format-toggle\" id=\"camFormatToggle\" onclick=\"toggleCamFormat()\">1:1 Square</div>\n    <div id=\"camPrompt\">Full item, front, label+item, details, weight last</div>\n    <div id=\"camCount\">0 photos</div>\n    <div id=\"camThumbs\"></div>\n  </div>\n  <div class=\"undo-bar\" id=\"undoBar\"><span>Photo deleted</span><button onclick=\"undoDelete()\">Undo delete</button></div>\n  <div id=\"photoControls\">\n    <button id=\"shootBtn\" onclick=\"takePhoto()\">\n      <svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\"><path d=\"M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z\"/><circle cx=\"12\" cy=\"13\" r=\"4\"/></svg>\n      Take Photo\n    </button>\n    <button id=\"photoDoneBtn\" onclick=\"goToShelf()\" disabled>Next &#10003;</button>\n    <button id=\"photoSkipBtn\" onclick=\"goToShelf()\">Skip</button>\n  </div>\n  <canvas id=\"photoCanvas\"></canvas>\n</div>\n\n<!-- SHELF -->\n<div class=\"screen\" id=\"shelfScreen\">\n  <div class=\"topbar\">\n    <div class=\"topbar-brand\">Shelf</div>\n    <div class=\"topbar-right\" id=\"shelfSkuLabel\">SKU \u2014</div>\n    <button class=\"back-btn\" onclick=\"goToPhotos()\">&#8592; Back</button>\n  </div>\n  <div id=\"shelfCamContainer\">\n    <video id=\"shelfVideo\" autoplay playsinline muted></video>\n    <div id=\"shelfPrompt\">Point at shelf location sticker</div>\n  </div>\n  <div id=\"shelfControls\">\n    <button class=\"btn btn-secondary\" style=\"margin-bottom:10px;\" onclick=\"scanShelf()\">\n      &#128247; Scan Shelf Sticker\n    </button>\n    <div id=\"shelfResultBox\" style=\"display:none;\" class=\"shelf-result\">\n      <div class=\"shelf-code\" id=\"shelfCode\">--</div>\n      <div class=\"shelf-code-label\">Shelf Location Detected</div>\n    </div>\n    <div style=\"font-family:var(--mono);font-size:0.6rem;letter-spacing:0.1em;color:var(--muted);text-align:center;text-transform:uppercase;margin-bottom:8px;\">or type manually</div>\n    <input class=\"shelf-manual-input\" id=\"shelfInput\" type=\"text\" placeholder=\"e.g. A1 or A1A\" maxlength=\"4\" oninput=\"onShelfInput(this.value)\">\n    <button class=\"btn btn-primary\" id=\"shelfContinue\" onclick=\"goToReview()\" disabled>Continue</button>\n  </div>\n  <canvas id=\"shelfCanvas\"></canvas>\n</div>\n\n<!-- REVIEW -->\n<div class=\"screen\" id=\"reviewScreen\">\n  <div class=\"topbar\">\n    <div class=\"topbar-brand\">Review</div>\n    <div class=\"topbar-right\" id=\"reviewSkuLabel\">SKU \u2014</div>\n    <button class=\"back-btn\" onclick=\"goToShelf()\">&#8592; Back</button>\n  </div>\n  <div class=\"scroll-content\">\n    <div class=\"section-title\">Review &amp; Submit</div>\n    <div class=\"section-sub\">Confirm everything looks correct before submitting.</div>\n    <div class=\"conflict-banner\" id=\"reviewConflict\" style=\"display:none;\"></div>\n    <div class=\"review-card\">\n      <div class=\"review-row\"><div class=\"review-label\">SKU</div><div class=\"review-value\" id=\"reviewSku\">--</div></div>\n      <div class=\"review-row\"><div class=\"review-label\">Grade</div><div class=\"review-value\" id=\"reviewGrade\">--</div></div>\n      <div class=\"review-row\"><div class=\"review-label\">Power Test</div><div class=\"review-value\" id=\"reviewPower\">--</div></div>\n      <div class=\"review-row\"><div class=\"review-label\">Notes</div><div class=\"review-value\" id=\"reviewNotes\">None</div></div>\n      <div class=\"review-row\"><div class=\"review-label\">Shelf</div><div class=\"review-value\" id=\"reviewShelf\">--</div></div>\n      <div class=\"review-row\"><div class=\"review-label\">Photos</div><div class=\"review-value\" id=\"reviewPhotos\">0</div></div>\n    </div>\n    <button class=\"btn btn-primary\" onclick=\"submitItem()\">Submit Item</button>\n    <button class=\"btn btn-secondary\" onclick=\"goToShelf()\">Go Back &amp; Edit</button>\n  </div>\n</div>\n\n<!-- SUCCESS -->\n<div class=\"screen\" id=\"successScreen\">\n  <div class=\"topbar\">\n    <div class=\"topbar-brand\">XRT<span>&#183;</span>PROC</div>\n    <div class=\"status-row\">\n      <div class=\"status-dot\" id=\"successDot\"></div>\n    </div>\n  </div>\n  <div class=\"scroll-content\" style=\"display:flex;flex-direction:column;justify-content:center;min-height:calc(100vh - 56px);\">\n    <div class=\"sku-display\" id=\"successSku\">2000</div>\n    <div class=\"success-banner\" style=\"margin-bottom:24px;\">\n      <div class=\"success-title\">&#10003; Submitted</div>\n      <div class=\"success-sub\" id=\"successMsg\">Photos uploaded. Listing generating in background.</div>\n    </div>\n    <button class=\"btn btn-primary\" onclick=\"nextItem()\">Next Item</button>\n    <button class=\"btn btn-secondary\" onclick=\"goHome()\">Back to Home</button>\n  </div>\n</div>\n\n<script>\nvar currentItem={};\nvar photoB64s=[];\nvar photoStream=null;\nvar shelfStream=null;\nvar nextSku=2000;\nvar offlineQueue=[];\nvar isOnline=true;\nvar wakeLock=null;\nvar identState={item:null,quantity:1,testNotes:'',testPhotos:[]};\nvar identStream=null;\nvar VALUE_THRESHOLD=30;\nvar camFormat=localStorage.getItem('xrt_cam_format')||'1:1';\nvar testStream=null;\nvar dragFrom=null;\nvar deletedPhoto=null;\nvar deleteTimer=null;\n\nwindow.addEventListener('load',function(){\n  loadNextSku();\n  checkOnline();\n  setInterval(checkOnline,10000);\n  setInterval(flushQueue,30000);\n});\n\nfunction loadNextSku(){\n  // Fetch next SKU from server - shared across all phones\n  fetch('/api/next-sku')\n  .then(function(r){return r.json();})\n  .then(function(d){\n    nextSku=d.sku||2000;\n    document.getElementById('homeSku').textContent=nextSku;\n  })\n  .catch(function(){\n    // Fallback to localStorage if offline\n    var s=localStorage.getItem('xrt_next_sku');\n    nextSku=s?parseInt(s):2000;\n    document.getElementById('homeSku').textContent=nextSku;\n  });\n}\n\nfunction checkOnline(){\n  fetch('/ping').then(function(){\n    isOnline=true;setStatusDot(true);flushQueue();\n  }).catch(function(){isOnline=false;setStatusDot(false);});\n  updateQueueBadge();\n}\n\nfunction setStatusDot(online){\n  document.querySelectorAll('.status-dot').forEach(function(d){d.className='status-dot'+(online?'':' offline');});\n  var t=document.getElementById('statusText');if(t)t.textContent=online?'Online':'Offline';\n  var bar=document.getElementById('offlineBar');if(bar)bar.className='offline-bar'+(online?'':' show');\n}\n\nfunction getQueue(){try{return JSON.parse(localStorage.getItem('xrt_queue')||'[]');}catch(e){return[];}}\nfunction saveQueue(q){localStorage.setItem('xrt_queue',JSON.stringify(q));}\nfunction updateQueueBadge(){\n  var q=getQueue();\n  var badge=document.getElementById('queueBadge');\n  if(badge){badge.style.display=q.length>0?'flex':'none';}\n  var num=document.getElementById('queueNum');if(num)num.textContent=q.length;\n}\n\nfunction showScreen(id){document.querySelectorAll('.screen').forEach(function(s){s.classList.remove('active');});document.getElementById(id).classList.add('active');}\nfunction goHome(){stopAllCameras();showScreen('homeScreen');}\nfunction goToGrade(){showScreen('gradeScreen');}\nfunction goToPowerTest(){if(!currentItem.grade)return;showScreen('powerScreen');}\nfunction goToNotes(){if(!currentItem.powerTest)return;showScreen('notesScreen');}\n\nfunction goToPhotos(){\n  currentItem.notes=document.getElementById('notesInput').value.trim();\n  document.getElementById('photoSkuLabel').textContent='SKU '+currentItem.sku;\n  var cp=document.getElementById('camPrompt');\n  if(cp){ cp.textContent = currentItem.quantity>1 ? 'Photograph the unit with the most flaws — weight photo last' : 'Full item, front, label+item, details, weight last'; }\n  renderPhotoThumbs();\n  stopShelfCamera();startPhotoCamera();showScreen('photoScreen');\n}\n\nfunction goToShelf(){\n  stopPhotoCamera();\n  document.getElementById('shelfSkuLabel').textContent='SKU '+currentItem.sku;\n  document.getElementById('shelfInput').value='';\n  document.getElementById('shelfResultBox').style.display='none';\n  document.getElementById('shelfContinue').disabled=true;\n  startShelfCamera();showScreen('shelfScreen');\n}\n\nfunction goToReview(){\n  stopShelfCamera();\n  document.getElementById('reviewSku').textContent=currentItem.sku;\n  document.getElementById('reviewGrade').textContent=currentItem.grade;\n  document.getElementById('reviewPower').textContent=currentItem.powerTest;\n  document.getElementById('reviewNotes').textContent=currentItem.notes||'None';\n  document.getElementById('reviewShelf').textContent=currentItem.shelf;\n  document.getElementById('reviewPhotos').textContent=photoB64s.length+' photos'+(currentItem.quantity>1?' (Qty '+currentItem.quantity+')':'');\n  var conflict=document.getElementById('reviewConflict');\n  var msgs=[];\n  if(currentItem.powerTest==='Fail'&&currentItem.grade!=='D'){msgs.push('Grade '+currentItem.grade+' with failed power test. Flagged for review.');}\n  if(currentItem.belowThreshold){msgs.push('Below minimum threshold — estimated $'+(currentItem.estValue||0)+'.');}\n  if(msgs.length){conflict.textContent='\\u26A0 '+msgs.join(' ');conflict.style.display='block';}else{conflict.style.display='none';}\n  showScreen('reviewScreen');\n}\n\nfunction startItem(){\n  // Feature 1: identify the item BEFORE claiming a SKU\n  identState={item:null,quantity:1,testNotes:''};\n  startIdentifyCamera();\n  showScreen('identifyScreen');\n}\n\nfunction claimSkuAndContinue(){\n  // Step F: claim SKU only after the identifier flow\n  fetch('/api/claim-sku',{method:'POST'})\n  .then(function(r){return r.json();})\n  .then(function(d){\n    nextSku=d.sku||nextSku;\n    localStorage.setItem('xrt_next_sku',nextSku);\n    initItem(nextSku);\n  })\n  .catch(function(){ initItem(nextSku); });\n}\n\n// ── IDENTIFIER FLOW (Feature 1) ──\nfunction startIdentifyCamera(){\n  var video=document.getElementById('idVideo');\n  if(identStream)return;\n  navigator.mediaDevices.getUserMedia(camConstraints())\n  .then(function(stream){identStream=stream;video.srcObject=stream;video.play();attachTapToFocus(video,document.getElementById('idFocusRing'),function(){return identStream;});})\n  .catch(function(e){console.error('Identify camera error',e);});\n}\nfunction stopIdentifyCamera(){if(identStream){identStream.getTracks().forEach(function(t){t.stop();});identStream=null;}}\n\nfunction identifyCapture(){\n  var video=document.getElementById('idVideo');\n  var canvas=document.getElementById('idCanvas');\n  if(!video.videoWidth){alert('Camera not ready yet.');return;}\n  playShutter();\n  var b64=captureFrame(video,canvas);\n  var btn=document.getElementById('identifyBtn');\n  btn.disabled=true;btn.textContent='Identifying...';\n  fetch('/api/identify-item',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({image:b64})})\n  .then(function(r){return r.json();})\n  .then(function(d){\n    btn.disabled=false;btn.textContent='Identify Item';\n    if(!d||d.error){alert('Could not identify — try again or Skip ID.');return;}\n    identState.item=d;identState.quantity=(d.quantity&&d.quantity>1)?d.quantity:1;\n    stopIdentifyCamera();\n    showIdResult(d);\n  })\n  .catch(function(){btn.disabled=false;btn.textContent='Identify Item';alert('Identify failed — check connection or Skip ID.');});\n}\n\nfunction showIdResult(d){\n  document.getElementById('idName').textContent=d.item_name||'Unknown item';\n  var lo=d.estimated_low||0,hi=d.estimated_high||0;\n  document.getElementById('idValue').textContent=(lo||hi)?('$'+lo+' — $'+hi+' on eBay'):'Value estimate unavailable';\n  var q=(d.quantity&&d.quantity>1)?d.quantity:1;\n  document.getElementById('idQty').textContent=q>1?(q+' identical items detected'):'1 item';\n  var catEl=document.getElementById('idCategory');if(catEl){if(d.manual_override){if(d.category_confirmed&&d.ebay_category_name){catEl.textContent='Category: '+d.ebay_category_name;catEl.style.color='#2e7d32';}else{catEl.textContent='Category not confirmed - will use AI during listing';catEl.style.color='#b8860b';}catEl.style.display='block';}else{catEl.style.display='none';}}\n  var cb=document.getElementById('idConfirmBtn');if(cb){cb.textContent=d.manual_override?'Confirm \\u0026 Continue':('Yes, that'+String.fromCharCode(39)+'s it');}\n  showScreen('idResultScreen');\n}\n\nfunction idConfirm(){\n  var d=identState.item||{};\n  var q=(d.quantity&&d.quantity>1)?d.quantity:1;\n  if(q>1){\n    document.getElementById('qtyPrompt').textContent='I see '+q+' identical items. How many are you listing?';\n    document.getElementById('qtyNum').textContent=q;\n    identState.quantity=q;\n    showScreen('quantityScreen');\n  } else {\n    identState.quantity=1;\n    afterQuantity();\n  }\n}\nfunction manualSearch(inputId,statusId){var inp=document.getElementById(inputId);var term=inp?inp.value.trim():'';if(!term){alert('Type an item name to search.');return;}var st=statusId?document.getElementById(statusId):null;if(st){st.textContent='Searching eBay...';}fetch('/api/identify-manual',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({item_name:term})}).then(function(r){return r.json();}).then(function(d){if(st){st.textContent='';}if(!d||d.error){alert('Search failed - try again or use AI scan.');return;}identState.item=d;identState.quantity=(d.quantity&&d.quantity>1)?d.quantity:1;stopIdentifyCamera();showIdResult(d);}).catch(function(){if(st){st.textContent='';}alert('Search failed - check connection.');});}\nfunction showManualSearch(){var b=document.getElementById('manualSearchBox');if(b)b.style.display='block';}\nfunction skipIdentify(){try{stopIdentifyCamera();}catch(e){}var b=document.getElementById('skipSearchBox');if(b)b.style.display='block';var i=document.getElementById('skipSearchInput');if(i)i.focus();}\nfunction idRescan(){identState.item=null;startIdentifyCamera();showScreen('identifyScreen');}\nfunction idSkip(){identState.item=null;identState.quantity=1;identState.testNotes='';stopIdentifyCamera();claimSkuAndContinue();}\n\nfunction qtyAdjust(n){var el=document.getElementById('qtyNum');var v=parseInt(el.textContent,10)||1;v+=n;if(v<1)v=1;el.textContent=v;identState.quantity=v;}\nfunction qtyConfirm(){identState.quantity=parseInt(document.getElementById('qtyNum').textContent,10)||1;afterQuantity();}\n\nfunction afterQuantity(){\n  var d=identState.item||{};\n  var est=d.estimated_high||d.estimated_low||0;\n  if(est>0&&est<VALUE_THRESHOLD){\n    document.getElementById('valueWarn').textContent='Below minimum — estimated $'+est;\n    showScreen('valueScreen');\n  } else { showTesting(); }\n}\nfunction valueListAnyway(){showTesting();}\nfunction valueAction(kind){\n  var d=identState.item||{};\n  fetch('/api/log-action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:kind,item:d})}).catch(function(){});\n  alert(kind==='recycle'?'Logged as recycled.':'Held for review.');\n  goHome();\n}\n\nfunction showTesting(){\n  var d=identState.item||{};\n  document.getElementById('testItemName').textContent=d.item_name||'Item';\n  var ins=(d.testing_instructions&&d.testing_instructions.length)?d.testing_instructions.slice(0,3):['Visual inspect only — note any damage or missing parts'];\n  if(d.sealed){ins=['Unused — do not open. List as new in original packaging.'];}\n  else if(d.cannot_test){ins=['Visual inspect only — note any damage or missing parts'];}\n  document.getElementById('testList').innerHTML=ins.map(function(t){return '<div class=\"test-bullet\"><span class=\"dot\">&#9656;</span><span>'+t+'</span></div>';}).join('');\n  var pb=document.getElementById('partsBanner');\n  if(d.parts_repair_demand){\n    var wp=d.working_price||d.estimated_high||0; var pp=d.parts_repair_price||0;\n    pb.innerHTML='This item also sells AS-IS for parts/repair.<br>Working price: ~$'+wp+' | Parts/repair price: ~$'+pp+'<br>Worth 5 minutes to test for the price difference.';\n    pb.style.display='block';\n  } else { pb.style.display='none'; }\n  identState.testPhotos=identState.testPhotos||[]; renderTestThumbs();\n  document.getElementById('testCamWrap').style.display='none';\n  showScreen('testingScreen');\n}\nfunction goToTestNotes(){stopTestCam();buildTestChips();document.getElementById('testNotesInput').value='';showScreen('testNotesScreen');}\nfunction skipTestNotes(){stopTestCam();identState.testNotes='';claimSkuAndContinue();}\nfunction buildTestChips(){\n  var d=identState.item||{};\n  var chips=['Powers on','Does not power on','Complete','Missing part','Cosmetic damage','Tested working','Untested'];\n  if(d.sealed)chips=['Sealed / untested','Complete','Cosmetic damage'];\n  document.getElementById('testChips').innerHTML=chips.map(function(c){return '<div class=\"chip\" onclick=\"toggleChip(this)\">'+c+'</div>';}).join('');\n}\nfunction toggleChip(el){el.classList.toggle('selected');}\nfunction testNotesContinue(){\n  var typed=document.getElementById('testNotesInput').value.trim();\n  var tags=[];document.querySelectorAll('#testChips .chip.selected').forEach(function(c){tags.push(c.textContent);});\n  identState.testNotes=[tags.join(', '),typed].filter(function(s){return s;}).join(' — ');\n  claimSkuAndContinue();\n}\n\n// Tap-to-focus (FIX 7) — works on identify + photo cameras\nfunction attachTapToFocus(video,ring,getStream){\n  if(!video||video._tapBound)return;video._tapBound=true;\n  video.addEventListener('touchstart',function(ev){\n    var rect=video.getBoundingClientRect();\n    var t=(ev.touches&&ev.touches[0])?ev.touches[0]:ev;\n    var x=t.clientX-rect.left,y=t.clientY-rect.top;\n    if(ring){ring.style.left=x+'px';ring.style.top=y+'px';ring.classList.remove('show');void ring.offsetWidth;ring.classList.add('show');setTimeout(function(){ring.classList.remove('show');},500);}\n    // Manual focus override removed — it degraded camera quality on Pixel phones.\n    // Show the focus-ring indicator only and let the camera auto-focus naturally.\n  },{passive:true});\n}\n\nfunction goToGradeFromClaim(){showScreen('gradeScreen');}\n\n// v4: camera format (FIX 1)\nfunction camConstraints(){\n  var ar = camFormat==='4:3' ? 1.333 : 1;\n  return {video:{facingMode:{ideal:'environment'},aspectRatio:{ideal:ar},width:{ideal:1600},height:{ideal:1600}},audio:false};\n}\nfunction toggleCamFormat(){\n  camFormat = camFormat==='4:3' ? '1:1' : '4:3';\n  localStorage.setItem('xrt_cam_format',camFormat);\n  var lbl=document.getElementById('camFormatToggle'); if(lbl) lbl.textContent = camFormat==='4:3'?'4:3 Landscape':'1:1 Square';\n  if(photoStream){ stopPhotoCamera(); startPhotoCamera(); }\n}\n// Capture honoring camFormat: 4:3 crop (rotate 90 if phone portrait, using screen.orientation.angle); square 1:1 fallback at 1600.\nfunction captureFrame(video, canvas){\n  var vw=video.videoWidth, vh=video.videoHeight;\n  var angle=0; try{ angle=(screen.orientation&&typeof screen.orientation.angle==='number')?screen.orientation.angle:(window.orientation||0); }catch(e){}\n  if(camFormat==='4:3' && vw && vh){\n    var srcW, srcH;\n    if(vw/vh > 4/3){ srcH=vh; srcW=Math.round(vh*4/3); } else { srcW=vw; srcH=Math.round(vw*3/4); }\n    var sx=Math.round((vw-srcW)/2), sy=Math.round((vh-srcH)/2);\n    var portrait=vh>vw;\n    var rotate = portrait || angle===0 || angle===180;\n    if(angle===90||angle===270) rotate=false;\n    var outW=1600, outH=1200, ctx;\n    if(rotate){\n      canvas.width=outH; canvas.height=outW; ctx=canvas.getContext('2d');\n      ctx.save(); ctx.translate(canvas.width/2,canvas.height/2); ctx.rotate(Math.PI/2);\n      ctx.drawImage(video,sx,sy,srcW,srcH,-outW/2,-outH/2,outW,outH); ctx.restore();\n    } else {\n      canvas.width=outW; canvas.height=outH; canvas.getContext('2d').drawImage(video,sx,sy,srcW,srcH,0,0,outW,outH);\n    }\n    var d43=canvas.toDataURL('image/jpeg',0.92).split(',')[1];\n    if(d43 && d43.length>100) return d43;\n  }\n  var size=Math.min(vw,vh); var sx2=Math.round((vw-size)/2), sy2=Math.round((vh-size)/2); var outSize=1600;\n  canvas.width=outSize; canvas.height=outSize; canvas.getContext('2d').drawImage(video,sx2,sy2,size,size,0,0,outSize,outSize);\n  return canvas.toDataURL('image/jpeg',0.92).split(',')[1];\n}\n\n// v4: photo management (Feature 2)\nfunction renderPhotoThumbs(){\n  var c=document.getElementById('camThumbs'); if(!c)return; c.innerHTML='';\n  photoB64s.forEach(function(b64,idx){\n    var w=document.createElement('div'); w.className='thumb-wrap'; w.setAttribute('draggable','true');\n    var im=document.createElement('img'); im.src='data:image/jpeg;base64,'+b64; w.appendChild(im);\n    var x=document.createElement('div'); x.className='thumb-del'; x.innerHTML='&times;';\n    x.addEventListener('click',function(e){e.stopPropagation();deletePhoto(idx);}); w.appendChild(x);\n    var lp=null;\n    w.addEventListener('touchstart',function(){lp=setTimeout(function(){dragFrom=idx;w.classList.add('dragging');},500);},{passive:true});\n    w.addEventListener('touchend',function(){if(lp)clearTimeout(lp);});\n    w.addEventListener('dragstart',function(){dragFrom=idx;w.classList.add('dragging');});\n    w.addEventListener('dragend',function(){w.classList.remove('dragging');});\n    w.addEventListener('dragover',function(e){e.preventDefault();w.classList.add('drop-target');});\n    w.addEventListener('dragleave',function(){w.classList.remove('drop-target');});\n    w.addEventListener('drop',function(e){e.preventDefault();w.classList.remove('drop-target');movePhoto(dragFrom,idx);dragFrom=null;});\n    w.addEventListener('click',function(){ if(dragFrom!=null && dragFrom!==idx){ movePhoto(dragFrom,idx); dragFrom=null; } });\n    c.appendChild(w);\n  });\n  document.getElementById('camCount').textContent=photoB64s.length+' photo'+(photoB64s.length!==1?'s':'');\n  document.getElementById('photoDoneBtn').disabled = photoB64s.length===0;\n}\nfunction movePhoto(from,to){ if(from==null||to==null||from===to)return; var it=photoB64s.splice(from,1)[0]; photoB64s.splice(to,0,it); renderPhotoThumbs(); }\nfunction deletePhoto(idx){\n  deletedPhoto={b64:photoB64s[idx],idx:idx};\n  photoB64s.splice(idx,1); renderPhotoThumbs();\n  var bar=document.getElementById('undoBar'); if(bar)bar.classList.add('show');\n  if(deleteTimer)clearTimeout(deleteTimer);\n  deleteTimer=setTimeout(function(){ if(bar)bar.classList.remove('show'); deletedPhoto=null; },3000);\n}\nfunction undoDelete(){\n  if(deletedPhoto){ photoB64s.splice(Math.min(deletedPhoto.idx,photoB64s.length),0,deletedPhoto.b64); deletedPhoto=null; renderPhotoThumbs(); }\n  var bar=document.getElementById('undoBar'); if(bar)bar.classList.remove('show'); if(deleteTimer)clearTimeout(deleteTimer);\n}\n\n// v4: testing-phase photos (Feature 1)\nfunction toggleTestCam(){\n  var w=document.getElementById('testCamWrap');\n  if(w.style.display==='none'){ w.style.display='block'; startTestCam(); }\n  else { w.style.display='none'; stopTestCam(); }\n}\nfunction startTestCam(){\n  var v=document.getElementById('testVideo'); if(testStream)return;\n  navigator.mediaDevices.getUserMedia(camConstraints()).then(function(s){testStream=s;v.srcObject=s;v.play();attachTapToFocus(v,null,function(){return testStream;});}).catch(function(e){console.error('Test camera error',e);});\n}\nfunction stopTestCam(){ if(testStream){testStream.getTracks().forEach(function(t){t.stop();});testStream=null;} }\nfunction captureTestPhoto(){\n  var v=document.getElementById('testVideo'); var canvas=document.getElementById('testCanvas');\n  if(!v.videoWidth){alert('Camera not ready yet.');return;}\n  playShutter();\n  var b64=captureFrame(v,canvas);\n  identState.testPhotos=identState.testPhotos||[]; identState.testPhotos.push(b64);\n  renderTestThumbs();\n}\nfunction renderTestThumbs(){\n  var c=document.getElementById('testPhotoThumbs');\n  c.innerHTML=(identState.testPhotos||[]).map(function(b){return '<img src=\"data:image/jpeg;base64,'+b+'\">';}).join('');\n}\n\nfunction initItem(sku){\n  var d=identState.item||{};\n  var est=(d.estimated_high||d.estimated_low||0);\n  currentItem={sku:sku,grade:null,powerTest:null,notes:'',shelf:'',timestamp:new Date().toISOString(),\n    quantity:identState.quantity||1,identified_item:identState.item||null,test_notes:identState.testNotes||'',\n    testPhotos:(identState.testPhotos||[]),\n    estValue:est,belowThreshold:(est>0&&est<VALUE_THRESHOLD)};\n  photoB64s=[];\n  document.querySelectorAll('.grade-btn').forEach(function(b){b.classList.remove('selected');});\n  document.querySelectorAll('.pf-btn').forEach(function(b){b.classList.remove('selected');});\n  document.getElementById('notesInput').value=currentItem.test_notes||'';\n  document.getElementById('gradeContinue').disabled=true;\n  document.getElementById('pfContinue').disabled=true;\n  document.getElementById('pfConflict').style.display='none';\n  document.getElementById('gradeSkuLabel').textContent='SKU '+sku;\n  document.getElementById('powerSkuLabel').textContent='SKU '+sku;\n  document.getElementById('notesSkuLabel').textContent='SKU '+sku;\n  document.getElementById('camCount').textContent='0 photos';\n  document.getElementById('camThumbs').innerHTML='';\n  document.getElementById('photoDoneBtn').disabled=true;\n  document.getElementById('claimSku').textContent=sku;\n  showScreen('skuClaimScreen');\n}\n\nfunction selectGrade(g){\n  currentItem.grade=g;\n  document.querySelectorAll('.grade-btn').forEach(function(b){b.classList.remove('selected');});\n  document.getElementById('grade'+g).classList.add('selected');\n  document.getElementById('gradeContinue').disabled=false;\n}\n\nfunction selectPowerTest(r){\n  currentItem.powerTest=r;\n  document.querySelectorAll('.pf-btn').forEach(function(b){b.classList.remove('selected');});\n  var pid=r==='Pass'?'pfPass':(r==='Fail'?'pfFail':'pfNA');\n  document.getElementById(pid).classList.add('selected');\n  document.getElementById('pfContinue').disabled=false;\n  var conflict=document.getElementById('pfConflict');\n  if(r==='Fail'&&currentItem.grade&&currentItem.grade!=='D'){\n    document.getElementById('conflictGrade').textContent=currentItem.grade;\n    conflict.style.display='block';\n  } else {conflict.style.display='none';}\n}\n\nfunction startPhotoCamera(){\n  var video=document.getElementById('photoVideo');\n  var lbl=document.getElementById('camFormatToggle'); if(lbl) lbl.textContent = camFormat==='4:3'?'4:3 Landscape':'1:1 Square';\n  if(photoStream)return;\n  navigator.mediaDevices.getUserMedia(camConstraints())\n  .then(function(stream){photoStream=stream;video.srcObject=stream;video.play();attachTapToFocus(video,document.getElementById('photoFocusRing'),function(){return photoStream;});})\n  .catch(function(e){console.error('Camera error',e);});\n}\n\nfunction playShutter(){\n  try{\n    var ctx=new(window.AudioContext||window.webkitAudioContext)();\n    var buf=ctx.createBuffer(1,Math.floor(ctx.sampleRate*0.06),ctx.sampleRate);\n    var data=buf.getChannelData(0);\n    for(var i=0;i<data.length;i++){data[i]=(Math.random()*2-1)*Math.pow(1-i/data.length,2)*0.15;}\n    var src=ctx.createBufferSource();src.buffer=buf;\n    var gain=ctx.createGain();gain.gain.value=0.15;\n    src.connect(gain);gain.connect(ctx.destination);src.start();\n    setTimeout(function(){ctx.close();},300);\n  }catch(e){}\n}\n\nfunction stopPhotoCamera(){if(photoStream){photoStream.getTracks().forEach(function(t){t.stop();});photoStream=null;}}\n\nfunction startShelfCamera(){\n  var video=document.getElementById('shelfVideo');\n  if(shelfStream)return;\n  navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:1080},height:{ideal:720}},audio:false})\n  .then(function(stream){shelfStream=stream;video.srcObject=stream;video.play();})\n  .catch(function(e){console.error('Shelf camera error',e);});\n}\n\nfunction stopShelfCamera(){if(shelfStream){shelfStream.getTracks().forEach(function(t){t.stop();});shelfStream=null;}}\nfunction stopAllCameras(){stopPhotoCamera();stopShelfCamera();stopIdentifyCamera();stopTestCam();}\n\nfunction acquireWakeLock(){if('wakeLock' in navigator){navigator.wakeLock.request('screen').then(function(wl){wakeLock=wl;}).catch(function(){});}}\nfunction releaseWakeLock(){if(wakeLock){wakeLock.release().catch(function(){});wakeLock=null;}}\n\nfunction playShutter(){\n  try{\n    var ctx=new(window.AudioContext||window.webkitAudioContext)();\n    var buf=ctx.createBuffer(1,Math.floor(ctx.sampleRate*0.06),ctx.sampleRate);\n    var data=buf.getChannelData(0);\n    for(var i=0;i<data.length;i++){data[i]=(Math.random()*2-1)*Math.pow(1-i/data.length,2)*0.15;}\n    var src=ctx.createBufferSource();src.buffer=buf;\n    var gain=ctx.createGain();gain.gain.value=0.15;\n    src.connect(gain);gain.connect(ctx.destination);src.start();\n    setTimeout(function(){ctx.close();},300);\n  }catch(e){}\n}\n\nfunction takePhoto(){\n  var video=document.getElementById('photoVideo');\n  var canvas=document.getElementById('photoCanvas');\n  if(!video.videoWidth){alert('Camera not ready yet.');return;}\n  playShutter();\n  var b64=captureFrame(video,canvas);\n  photoB64s.push(b64);\n  renderPhotoThumbs();\n}\n\nfunction scanShelf(){\n  var video=document.getElementById('shelfVideo');\n  var canvas=document.getElementById('shelfCanvas');\n  if(!video.videoWidth){alert('Camera not ready.');return;}\n  canvas.width=video.videoWidth;canvas.height=video.videoHeight;\n  canvas.getContext('2d').drawImage(video,0,0);\n  var b64=canvas.toDataURL('image/jpeg',0.85).split(',')[1];\n  fetch('/api/read-shelf',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({image:b64})})\n  .then(function(r){return r.json();})\n  .then(function(d){\n    if(d.code){\n      document.getElementById('shelfCode').textContent=d.code;\n      document.getElementById('shelfResultBox').style.display='block';\n      document.getElementById('shelfInput').value=d.code;\n      currentItem.shelf=d.code;\n      document.getElementById('shelfContinue').disabled=false;\n    } else {alert('Could not read sticker. Type code manually below.');}\n  })\n  .catch(function(){alert('Could not read sticker. Type code manually below.');});\n}\n\nfunction onShelfInput(val){\n  var v=val.trim().toUpperCase().replace(/[^A-Z0-9]/g,'');\n  currentItem.shelf=v;\n  document.getElementById('shelfContinue').disabled=!(v.length>=2&&v.length<=4);\n}\n\nfunction submitItem(){\n  var payload={sku:currentItem.sku,grade:currentItem.grade,powerTest:currentItem.powerTest,notes:currentItem.notes,shelf:currentItem.shelf,timestamp:currentItem.timestamp,quantity:currentItem.quantity||1,identified_item:currentItem.identified_item||null,test_notes:currentItem.test_notes||'',testPhotos:currentItem.testPhotos||[],camFormat:camFormat,photos:photoB64s};\n  if(isOnline){uploadItem(payload);}\n  else{queueItem(payload);showSuccess(true);}\n}\n\nfunction uploadItem(payload){\n  acquireWakeLock();\n  fetch('/api/submit-item',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)})\n  .then(function(r){if(!r.ok)throw new Error('Server error');return r.json();})\n  .then(function(){advanceSku();showSuccess(false);releaseWakeLock();})\n  .catch(function(){queueItem(payload);showSuccess(true);releaseWakeLock();});\n}\n\nfunction queueItem(payload){\n  var q=getQueue();q.push(payload);saveQueue(q);updateQueueBadge();\n}\n\nfunction flushQueue(){\n  if(!isOnline)return;\n  var q=getQueue();if(q.length===0)return;\n  var item=q[0];\n  fetch('/api/submit-item',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(item)})\n  .then(function(r){if(!r.ok)throw new Error();q.shift();saveQueue(q);updateQueueBadge();if(q.length>0)setTimeout(flushQueue,2000);})\n  .catch(function(){});\n}\n\nfunction advanceSku(){\n  // Refresh SKU display from server\n  fetch('/api/next-sku')\n  .then(function(r){return r.json();})\n  .then(function(d){\n    nextSku=d.sku||nextSku;\n    document.getElementById('homeSku').textContent=nextSku;\n  })\n  .catch(function(){\n    nextSku++;\n    document.getElementById('homeSku').textContent=nextSku;\n  });\n}\n\nfunction showSuccess(queued){\n  document.getElementById('successSku').textContent=currentItem.sku;\n  document.getElementById('successMsg').textContent=queued?'Saved locally. Will upload when WiFi reconnects.':'Photos uploaded. Listing generating in background.';\n  showScreen('successScreen');\n}\n\nfunction nextItem(){advanceSku();document.getElementById('homeSku').textContent=nextSku;startItem();}\n</script>\n</body>\n</html>";




const GEMINI_KEY = process.env.GEMINI_API_KEY || '';
const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY || '';
console.log('[STARTUP] Gemini key found:', GEMINI_KEY.length > 0);
console.log('[STARTUP] OpenRouter key found:', OPENROUTER_KEY.length > 0);

// ── eBay configuration (v4) ──
const EBAY_APP_ID = process.env.EBAY_APP_ID || '';
const EBAY_DEV_ID = process.env.EBAY_DEV_ID || '';
const EBAY_CERT_ID = process.env.EBAY_CERT_ID || '';
const EBAY_USER_TOKEN = process.env.EBAY_USER_TOKEN || '';
const EBAY_ENVIRONMENT = process.env.EBAY_ENVIRONMENT || 'production';
const EBAY_BASE = EBAY_ENVIRONMENT === 'sandbox' ? 'https://api.sandbox.ebay.com' : 'https://api.ebay.com';
const EBAY_AUTH_BASE = EBAY_ENVIRONMENT === 'sandbox' ? 'https://auth.sandbox.ebay.com' : 'https://auth.ebay.com';
const EBAY_REDIRECT_URI = process.env.EBAY_REDIRECT_URI || 'https://xrt-scanner.onrender.com/ebay-auth-callback';
const EBAY_PUBLIC_BASE = process.env.PUBLIC_BASE_URL || 'https://xrt-scanner.onrender.com';
const EBAY_TOKENS_FILE = path.join(DATA_DIR, 'ebay-tokens.json');
const EBAY_POLICIES_FILE = path.join(DATA_DIR, 'ebay-policies.json');
const EBAY_SCOPES = [
  'https://api.ebay.com/oauth/api_scope',
  'https://api.ebay.com/oauth/api_scope/sell.inventory',
  'https://api.ebay.com/oauth/api_scope/sell.inventory.readonly',
  'https://api.ebay.com/oauth/api_scope/sell.account',
  'https://api.ebay.com/oauth/api_scope/sell.account.readonly',
  'https://api.ebay.com/oauth/api_scope/sell.fulfillment'
];
// Public base URL eBay uses to fetch our hosted photos for UploadSiteHostedPictures
const EBAY_PHOTO_BASE = process.env.PUBLIC_BASE_URL || 'https://xrt-scanner.onrender.com';
console.log('[STARTUP] eBay App ID found:', EBAY_APP_ID.length > 0, '| env:', EBAY_ENVIRONMENT);
console.log('[STARTUP] EBAY_APP_ID raw value:', JSON.stringify(EBAY_APP_ID));

// ── SHIPPING & DIMENSIONS CALCULATOR (Feature 3) ──
const STANDARD_GA_BOXES   = [[12,8,6],[12,10,8],[15,12,10],[22,13,8]];
const STANDARD_FEDEX_BOXES= [[15,12,10],[22,13,15],[24,18,12]];

function parseWeightOz(w){
  if(w === null || w === undefined || w === '') return null;
  if(typeof w === 'number') return w > 0 ? w : null; // already oz
  var s = String(w).toLowerCase().trim();
  var num = parseFloat(s);
  if(isNaN(num)) return null;
  if(s.indexOf('oz') >= 0 && s.indexOf('lb') < 0) return num;
  if(s.indexOf('lb') >= 0 || s.indexOf('pound') >= 0) return num * 16;
  if(s.indexOf('kg') >= 0) return num * 35.274;
  if(s.indexOf('g') >= 0 && s.indexOf('kg') < 0) return num * 0.035274;
  return num; // bare number assumed oz
}
function _sorted3(a){ return a.slice().sort(function(x,y){return x-y;}); }
function _fitsBox(paddedDims, box){
  var p = _sorted3(paddedDims), b = _sorted3(box);
  return p[0] <= b[0] && p[1] <= b[1] && p[2] <= b[2];
}
function _pickBox(dims, padIn, boxes){
  if(!dims || !dims.l || !dims.w || !dims.h) return null;
  var padded = [dims.l + padIn, dims.w + padIn, dims.h + padIn];
  var fitting = boxes.filter(function(b){ return _fitsBox(padded, b); });
  if(fitting.length === 0) return null;
  fitting.sort(function(a,b){ return (a[0]*a[1]*a[2]) - (b[0]*b[1]*b[2]); });
  return fitting[0];
}
function _boxStr(b){ return b[0] + 'x' + b[1] + 'x' + b[2]; }

// Returns: {shipping_policy, shipping_profile_id, listed_weight, listed_weight_unit, box_dimensions, polymailer, review?}
function calcShipping(itemWeightOz, dims, opts){
  opts = opts || {};
  if(opts.freight){
    return {shipping_policy:'Freight/Local', shipping_profile_id:'', listed_weight:null, listed_weight_unit:'lbs', box_dimensions:'', polymailer:false, review:true};
  }
  var w = (typeof itemWeightOz === 'number' && itemWeightOz > 0) ? itemWeightOz : null;
  if(w === null){
    // Unknown weight — default GA, flag for manual confirmation
    var gaBox = _pickBox(dims, 2, STANDARD_GA_BOXES);
    return {shipping_policy:'GA 6lbs or less', shipping_profile_id:'272423749015', listed_weight:null, listed_weight_unit:'oz',
      box_dimensions: gaBox ? _boxStr(gaBox) : (dims ? _boxStr([dims.l+2,dims.w+2,dims.h+2]) : ''), polymailer:false, review:true};
  }
  var special = opts.specialHandling || w > 480;
  // POLICY 3 — Heavy Calculated: > 15lb (240oz) OR special OR > 30lb
  if(w > 240 || special){
    var listedLb = Math.ceil((w + 32) / 16); // + 1lb item + 1lb box padding
    return {shipping_policy:'Heavy Calculated', shipping_profile_id:'272360974015', listed_weight:listedLb, listed_weight_unit:'lbs',
      box_dimensions: dims ? _boxStr([dims.l+3, dims.w+3, dims.h+3]) : '', polymailer:false};
  }
  // POLICY 2 — FedEx 6lbs or more: 96oz < w <= 240oz
  if(w > 96){
    var box2 = _pickBox(dims, 2, STANDARD_FEDEX_BOXES);
    return {shipping_policy:'FedEx 6lbs or more', shipping_profile_id:'272434338015', listed_weight: w + 20, listed_weight_unit:'oz',
      box_dimensions: box2 ? _boxStr(box2) : (dims ? _boxStr([dims.l+2,dims.w+2,dims.h+2]) : ''), polymailer:false};
  }
  // POLICY 1 — GA 6lbs or less: w <= 96oz
  var fitsPoly = (w <= 10) && dims && dims.l && (function(){ var s = _sorted3([dims.l,dims.w,dims.h]); return s[2] <= 13 && s[1] <= 10 && s[0] <= 1.5; })();
  if(w <= 10 && fitsPoly){
    return {shipping_policy:'GA 6lbs or less', shipping_profile_id:'272423749015', listed_weight:15, listed_weight_unit:'oz', box_dimensions:'12x8x4', polymailer:true};
  }
  var box1 = _pickBox(dims, 2, STANDARD_GA_BOXES);
  return {shipping_policy:'GA 6lbs or less', shipping_profile_id:'272423749015', listed_weight: w + 8, listed_weight_unit:'oz',
    box_dimensions: box1 ? _boxStr(box1) : (dims ? _boxStr([dims.l+2,dims.w+2,dims.h+2]) : '12x8x6'), polymailer:false};
}

// FIX 2B: tier-based shipping from a RAW scale reading (lbs + oz). Packing is added per tier;
// totalOz is used ONLY internally for tier comparison and is never stored or displayed.
// Returns native lbs/oz (raw + packed) plus box size and the eBay fulfillment policy id.
function calculateShippingTier(lbs, oz, sku){
  lbs = parseInt(lbs, 10) || 0; if(lbs < 0) lbs = 0;
  oz = parseFloat(oz) || 0; if(oz < 0) oz = 0;
  var totalOz = (lbs * 16) + oz; // internal tier comparison ONLY
  function packRound(combinedOz){ var cl = Math.floor(combinedOz / 16); var rem = combinedOz % 16; return rem > 0 ? { l: cl + 1, o: 0 } : { l: cl, o: 0 }; }
  var finalLbs, finalOz, boxSize, policyId, tier;
  if(totalOz <= 10){
    tier = 1; finalLbs = 0; finalOz = 15; boxSize = '12x8x4'; policyId = 272423749015;
  } else if(totalOz <= 15){
    tier = 2; finalLbs = 1; finalOz = 15; boxSize = '12x8x6'; policyId = 272423749015;
  } else if(totalOz <= 96){
    tier = 3; var r3 = packRound(totalOz + 8);  finalLbs = r3.l; finalOz = r3.o; boxSize = '15x12x10'; policyId = 272423749015;
  } else if(totalOz <= 240){
    tier = 4; var r4 = packRound(totalOz + 20); finalLbs = r4.l; finalOz = r4.o; boxSize = '22x13x15'; policyId = 272434338015;
  } else {
    tier = 5; var combinedLbs = lbs + 2; if(oz > 0){ finalLbs = combinedLbs + 1; } else { finalLbs = combinedLbs; } finalOz = 0; boxSize = '24x18x14'; policyId = 272360974015;
  }
  var result = { rawLbs: lbs, rawOz: oz, finalLbs: finalLbs, finalOz: finalOz, boxSize: boxSize, shippingPolicyId: policyId, tier: tier };
  console.log('[WEIGHT] SKU ' + (sku == null ? '?' : sku) + ' raw: ' + lbs + 'lb ' + oz + 'oz | tier ' + tier + ' | packed: ' + finalLbs + 'lb ' + finalOz + 'oz | box: ' + boxSize + ' | policy: ' + policyId);
  return result;
}
// Map a shipping policy id back to its human label (for legacy display fields)
function shippingPolicyName(id){
  id = String(id);
  if(id === '272434338015') return 'FedEx 6lbs or more';
  if(id === '272360974015') return 'Heavy Calculated';
  return 'GA 6lbs or less';
}

// ── eBay TOKEN HELPERS (Feature 9) ──
function readEbayTokens(){
  // OAuth tokens in ebay-tokens.json are the single source of truth. The
  // EBAY_USER_TOKEN env var is an Auth'n'Auth token with limited scopes that
  // returns 403 on the Sell/Inventory APIs, so it is NEVER used here.
  try { if(fs.existsSync(EBAY_TOKENS_FILE)) return JSON.parse(fs.readFileSync(EBAY_TOKENS_FILE,'utf8')); } catch(e){}
  return null;
}
function writeEbayTokens(t){
  try { fs.writeFileSync(EBAY_TOKENS_FILE, JSON.stringify(t, null, 2)); }
  catch(e){ console.log('[EBAY] token write error:', e.message); }
}
function ebayStatus(){
  var t = readEbayTokens();
  if(!t || !t.access_token) return {connected:false, account:'xtremeco-recytech'};
  var expired = t.expires_at && Date.now() > t.expires_at;
  return {connected: !expired, expired: !!expired, expires_at: t.expires_at || null, account:'xtremeco-recytech'};
}
function refreshEbayToken(callback){
  var t = readEbayTokens();
  if(!t || !t.refresh_token){ callback(new Error('No refresh token')); return; }
  var basic = Buffer.from(EBAY_APP_ID + ':' + EBAY_CERT_ID).toString('base64');
  var body = 'grant_type=refresh_token&refresh_token=' + encodeURIComponent(t.refresh_token) + '&scope=' + encodeURIComponent(EBAY_SCOPES.join(' '));
  var options = {hostname: EBAY_BASE.replace('https://',''), path:'/identity/v1/oauth2/token', method:'POST',
    headers:{'Content-Type':'application/x-www-form-urlencoded','Authorization':'Basic '+basic,'Content-Length':Buffer.byteLength(body)}};
  var req = https.request(options, function(res){
    var data=''; res.on('data',function(c){data+=c;});
    res.on('end',function(){
      try { var j = JSON.parse(data);
        if(j.access_token){ t.access_token=j.access_token; t.expires_at=Date.now()+((j.expires_in||7200)*1000); writeEbayTokens(t); callback(null, t.access_token); }
        else { callback(new Error('refresh failed: '+data.slice(0,200))); }
      } catch(e){ callback(e); }
    });
  });
  req.on('error', function(e){ callback(e); });
  req.write(body); req.end();
}
function getEbayToken(callback){
  // Inventory/Sell API calls MUST use the OAuth token from ebay-tokens.json,
  // never the EBAY_USER_TOKEN env var (Auth'n'Auth token → 403 Access Denied).
  var t = null;
  try { if(fs.existsSync(EBAY_TOKENS_FILE)) t = JSON.parse(fs.readFileSync(EBAY_TOKENS_FILE,'utf8')); } catch(e){}
  if(!t || !t.access_token){ callback(new Error('eBay not connected — no OAuth token in ebay-tokens.json. Connect via /ebay-auth.')); return; }
  if(t.expires_at && Date.now() > (t.expires_at - 60000) && t.refresh_token){ refreshEbayToken(callback); return; }
  callback(null, t.access_token);
}
// Generic JSON request to eBay REST APIs
function ebayApi(method, urlPath, token, bodyObj, callback){
  var body = bodyObj ? JSON.stringify(bodyObj) : '';
  var options = {hostname: EBAY_BASE.replace('https://',''), path: urlPath, method: method,
    headers:{'Content-Type':'application/json','Accept':'application/json','Authorization':'Bearer '+token,
      'Content-Language':'en-US','Content-Length':Buffer.byteLength(body)}};
  var req = https.request(options, function(res){
    var data=''; res.on('data',function(c){data+=c;});
    res.on('end',function(){
      var parsed=null; try{ parsed = data ? JSON.parse(data) : {}; }catch(e){ parsed={raw:data}; }
      callback(null, res.statusCode, parsed);
    });
  });
  req.on('error', function(e){ callback(e); });
  if(body) req.write(body);
  req.end();
}
// Authenticated eBay call: gets the OAuth token, and on a 401 it force-refreshes
// the token and retries the request exactly once. callback(err, statusCode, body).
function ebayCall(method, urlPath, bodyObj, callback){
  getEbayToken(function(tErr, token){
    if(tErr){ callback(tErr); return; }
    ebayApi(method, urlPath, token, bodyObj, function(e, sc, r){
      if(e){ callback(e); return; }
      if(sc === 401){
        console.log('[EBAY] 401 on', method, urlPath, '- refreshing token and retrying once');
        refreshEbayToken(function(rErr, newTok){
          if(rErr || !newTok){ callback(null, sc, r); return; }
          ebayApi(method, urlPath, newTok, bodyObj, function(e2, sc2, r2){
            if(e2){ callback(e2); return; }
            callback(null, sc2, r2);
          });
        });
        return;
      }
      callback(null, sc, r);
    });
  });
}
// Does an eBay error response contain a given errorId?
function ebayHasError(r, id){
  return !!(r && Array.isArray(r.errors) && r.errors.some(function(e){ return e.errorId === id; }));
}

// ── eBay BUSINESS POLICIES (Account API) ──
function readEbayPolicies(){
  try { if(fs.existsSync(EBAY_POLICIES_FILE)) return JSON.parse(fs.readFileSync(EBAY_POLICIES_FILE,'utf8')); } catch(e){}
  return null;
}
function writeEbayPolicies(p){
  try { fs.writeFileSync(EBAY_POLICIES_FILE, JSON.stringify(p, null, 2)); } catch(e){ console.log('[EBAY] policies write error:', e.message); }
}
// Map our shipping policy name (GA / FedEx / Heavy) to the best-matching fulfillment policy id
function pickShippingPolicyId(fulfillment, shippingPolicyName){
  if(!fulfillment || !fulfillment.length) return null;
  var name = String(shippingPolicyName || '').toLowerCase();
  var key = name.indexOf('fedex') >= 0 ? 'fedex'
          : (name.indexOf('heavy') >= 0 || name.indexOf('calculated') >= 0) ? 'heav'
          : 'ga';
  var match = fulfillment.filter(function(p){ return String(p.name || '').toLowerCase().indexOf(key) >= 0; })[0];
  return (match || fulfillment[0]).id;
}
// Fetch all three business policy types, assemble + store ebay-policies.json
function fetchEbayPolicies(callback){
  var mk = '?marketplace_id=EBAY_US';
  ebayCall('GET', '/sell/account/v1/fulfillment_policy' + mk, null, function(e1, s1, r1){
    if(e1){ callback(e1); return; }
    ebayCall('GET', '/sell/account/v1/payment_policy' + mk, null, function(e2, s2, r2){
      if(e2){ callback(e2); return; }
      ebayCall('GET', '/sell/account/v1/return_policy' + mk, null, function(e3, s3, r3){
        if(e3){ callback(e3); return; }
        var fulfillment = ((r1 && r1.fulfillmentPolicies) || []).map(function(p){ return {id: p.fulfillmentPolicyId, name: p.name}; });
        var payment     = ((r2 && r2.paymentPolicies)     || []).map(function(p){ return {id: p.paymentPolicyId,     name: p.name}; });
        var ret         = ((r3 && r3.returnPolicies)      || []).map(function(p){ return {id: p.returnPolicyId,      name: p.name}; });
        var policies = {
          fulfillment: fulfillment, payment: payment, return: ret,
          fulfillment_id: fulfillment[0] ? fulfillment[0].id : null,
          payment_id: payment[0] ? payment[0].id : null,
          return_id: ret[0] ? ret[0].id : null,
          shipping_map: {
            'GA 6lbs or less':    pickShippingPolicyId(fulfillment, 'GA 6lbs or less'),
            'FedEx 6lbs or more': pickShippingPolicyId(fulfillment, 'FedEx 6lbs or more'),
            'Heavy Calculated':   pickShippingPolicyId(fulfillment, 'Heavy Calculated')
          },
          fetched_at: new Date().toISOString()
        };
        writeEbayPolicies(policies);
        console.log('[EBAY] policies fetched - fulfillment:', fulfillment.length, 'payment:', payment.length, 'return:', ret.length);
        callback(null, policies);
      });
    });
  });
}
// Create the Clovis CA merchant location (idempotent; 25803 = already exists)
function createMerchantLocation(callback){
  var locBody = {
    location:{address:{addressLine1:"Clovis CA",city:"Clovis",stateOrProvince:"CA",postalCode:"93612",country:"US"}},
    locationTypes:["WAREHOUSE"],
    name:"XRT Electronics Clovis",
    merchantLocationStatus:"ENABLED"
  };
  ebayCall('POST', '/sell/inventory/v1/location/xrt-clovis', locBody, function(e, sc, r){
    if(e){ callback(e); return; }
    var exists = ebayHasError(r, 25803);
    if(sc < 400 || exists){ callback(null, {location_key:'xrt-clovis', already_existed: exists}); }
    else { callback(new Error('location create failed (' + sc + ')')); }
  });
}
// Split a string into pieces each <= limit chars, breaking at natural points
// (commas first, then spaces; a single over-long token is hard-sliced as a last resort).
function splitToLimit(str, limit){
  str = String(str == null ? '' : str).trim();
  if(!str) return [];
  if(str.length <= limit) return [str];
  var out = [];
  var commaParts = str.split(',').map(function(s){ return s.trim(); }).filter(Boolean);
  if(commaParts.length > 1){
    commaParts.forEach(function(p){ out = out.concat(splitToLimit(p, limit)); });
    return out;
  }
  // No usable commas — pack words up to the limit
  var words = str.split(/\s+/);
  var cur = '';
  words.forEach(function(w){
    if(w.length > limit){ // single word longer than the limit
      if(cur){ out.push(cur); cur = ''; }
      for(var i = 0; i < w.length; i += limit) out.push(w.slice(i, i + limit));
      return;
    }
    if((cur ? cur.length + 1 : 0) + w.length <= limit){ cur = cur ? cur + ' ' + w : w; }
    else { if(cur) out.push(cur); cur = w; }
  });
  if(cur) out.push(cur);
  return out;
}

// eBay enforces a 65-character maximum per item-specific (aspect) value.
// Splits over-long values at natural break points, always splits Features on
// commas into separate entries, and removes empty/duplicate values.
function trimAspects(aspects){
  var LIMIT = 65;
  var out = {};
  Object.keys(aspects || {}).forEach(function(k){
    var raw = aspects[k];
    if(!Array.isArray(raw)) raw = [raw];
    var vals = [];
    raw.forEach(function(v){
      if(v === null || v === undefined) return;
      var s = String(v).trim();
      if(!s) return;
      // Features (or any comma-separated value) -> split on commas into separate entries
      if(k === 'Features' || s.indexOf(',') >= 0){
        s.split(',').forEach(function(part){
          part = part.trim();
          if(part) vals = vals.concat(splitToLimit(part, LIMIT));
        });
      } else {
        vals = vals.concat(splitToLimit(s, LIMIT));
      }
    });
    // remove empties + dedupe (preserve order)
    var seen = {}, cleaned = [];
    vals.forEach(function(v){ v = String(v).trim(); if(v && !seen[v]){ seen[v] = 1; cleaned.push(v); } });
    if(cleaned.length) out[k] = cleaned;
  });
  return out;
}

// Pre-flight validation before publishing an offer. Returns an array of
// human-readable problems, or null if everything is OK.
function validateForPublish(record){
  var listing = (record && record.listing) || {};
  var problems = [];
  var title = listing.title || '';
  if(!title){ problems.push('Title is missing.'); }
  else if(title.length > 80){ problems.push('Title is ' + title.length + ' characters (max 80) — shorten it.'); }
  var price = parseFloat(listing.suggested_price || listing.avg_sold_price || 0);
  if(!(price > 0)){ problems.push('Price must be greater than 0 (set suggested_price or avg_sold_price).'); }
  // Aspects: after trimAspects every value must be <= 65 chars
  var aspects = {};
  var spec = listing.item_specifics || {};
  Object.keys(spec).forEach(function(k){ var v = spec[k]; if(v === null || v === undefined || v === '') return; aspects[k] = Array.isArray(v) ? v.map(String) : [String(v)]; });
  aspects = trimAspects(aspects);
  Object.keys(aspects).forEach(function(k){
    aspects[k].forEach(function(v){
      if(String(v).length > 65){ problems.push('Item specific "' + k + '" has a value over 65 characters: "' + String(v).slice(0, 40) + '...".'); }
    });
  });
  return problems.length ? problems : null;
}

// Map processor grade letter → eBay Inventory API condition enum + Trading condition ID
function gradeToEbayCondition(grade, partsRepair){
  if(partsRepair || grade === 'D') return {enum:'FOR_PARTS_OR_NOT_WORKING', id:7000};
  if(grade === 'A') return {enum:'NEW', id:1000};
  if(grade === 'B') return {enum:'USED_VERY_GOOD', id:3000};
  if(grade === 'C') return {enum:'USED_GOOD', id:5000};
  return {enum:'USED_GOOD', id:5000};
}
// Map our grade -> the correct eBay condition ID for the item's category.
// Most electronics and Audio/Musical instruments share the same mapping.
function conditionIdForCategory(grade, categoryId, partsRepair){
  var idMap = { A:1000, B:3000, C:5000, D:7000 };
  if(partsRepair) return 7000;
  return idMap[grade] || 5000;
}
// eBay Inventory API uses condition enums; map an ID back to its enum.
function conditionIdToEnum(id){
  if(id === 1000) return 'NEW';
  if(id === 3000) return 'USED_VERY_GOOD';
  if(id === 5000) return 'USED_GOOD';
  if(id === 7000) return 'FOR_PARTS_OR_NOT_WORKING';
  return 'USED_GOOD';
}

function callGemini(options, body, callback) {
  // Route through OpenRouter to bypass Google IP restrictions
  var geminiBody = JSON.parse(body);
  var messages = [];

  // Convert Gemini format to OpenRouter/OpenAI format
  var parts = geminiBody.contents[0].parts;
  var content = [];
  parts.forEach(function(part) {
    if(part.text) {
      content.push({type:'text', text:part.text});
    } else if(part.inline_data) {
      content.push({type:'image_url', image_url:{url:'data:'+part.inline_data.mime_type+';base64,'+part.inline_data.data}});
    }
  });
  messages.push({role:'user', content:content});

  // Determine if this is a search-enabled request
  var useSearch = geminiBody.tools && geminiBody.tools.some(function(t){ return t.google_search !== undefined; });

  var orBody = JSON.stringify({
    model: useSearch ? 'google/gemini-2.5-flash:online' : 'google/gemini-2.5-flash',
    messages: messages,
    max_tokens: geminiBody.generationConfig ? geminiBody.generationConfig.maxOutputTokens : 300,
    temperature: geminiBody.generationConfig ? geminiBody.generationConfig.temperature : 0.1
  });

  var orOptions = {
    hostname: 'openrouter.ai',
    path: '/api/v1/chat/completions',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + OPENROUTER_KEY,
      'HTTP-Referer': 'https://xrt-scanner.onrender.com',
      'X-Title': 'XRT Scanner',
      'Content-Length': Buffer.byteLength(orBody)
    }
  };

  var req = https.request(orOptions, function(res) {
    var data = '';
    res.on('data', function(c) { data += c; });
    res.on('end', function() {
      console.log('[GEMINI] Status:', res.statusCode);
      if(res.statusCode !== 200) console.log('[GEMINI] Error:', data.slice(0,300));
      try {
        var parsed = JSON.parse(data);
        // Convert OpenRouter response back to Gemini format
        var geminiResponse = {
          candidates: [{
            content: {
              parts: [{
                text: parsed.choices && parsed.choices[0] ? parsed.choices[0].message.content : ''
              }]
            }
          }]
        };
        callback(null, geminiResponse);
      }
      catch(e) { callback(new Error('Parse failed: ' + e.message)); }
    });
  });
  req.on('error', function(e) { console.log('[GEMINI] Network error:', e.message); callback(e); });
  req.write(orBody);
  req.end();
}

function callOpenRouter(payload, callback) {
  var body = JSON.stringify({
    model: payload.model,
    max_tokens: payload.max_tokens || 1000,
    messages: payload.messages,
    temperature: 0.1
  });

  var options = {
    hostname: 'openrouter.ai',
    path: '/api/v1/chat/completions',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + OPENROUTER_KEY,
      'HTTP-Referer': 'https://xrt-scanner.onrender.com',
      'X-Title': 'XRT Scanner',
      'Content-Length': Buffer.byteLength(body)
    }
  };

  var req = https.request(options, function(res) {
    var data = '';
    res.on('data', function(c) { data += c; });
    res.on('end', function() {
      console.log('[OPENROUTER] Status:', res.statusCode);
      if(res.statusCode !== 200) console.log('[OPENROUTER] Error:', data.slice(0,300));
      try {
        var parsed = JSON.parse(data);
        var text = parsed.choices && parsed.choices[0] ? parsed.choices[0].message.content : '';
        callback(null, text);
      }
      catch(e) { callback(new Error('Parse failed')); }
    });
  });
  req.on('error', function(e) { console.log('[OPENROUTER] Network error:', e.message); callback(e); });
  req.write(body);
  req.end();
}

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
      try { var parsed = JSON.parse(data); parsed._httpStatus = res.statusCode; callback(null, parsed); }
      catch(e) { callback(null, {content:[], type:'error', error:{message:'parse_failed'}, _httpStatus: res.statusCode}); }
    });
  });
  req.on('error', function(e) { console.log('[API] Network error:', e.message); callback(e); });
  req.write(body);
  req.end();
}
// True when Anthropic signals a rate limit / overload (429 or rate_limit_error)
function isClaudeRateLimited(resp){
  if(!resp) return false;
  if(resp._httpStatus === 429) return true;
  if(resp.error && (resp.error.type === 'rate_limit_error' || resp.error.type === 'overloaded_error')) return true;
  return false;
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

// Extract the first balanced top-level JSON object from a string (handles
// model output that wraps JSON in prose or markdown fences).
function extractFirstJson(text){
  if(!text) return null;
  var depth=0,start=-1;
  for(var i=0;i<text.length;i++){
    if(text[i]==='{'){if(depth===0)start=i;depth++;}
    else if(text[i]==='}' && depth>0){depth--;if(depth===0&&start!==-1){try{return JSON.parse(text.slice(start,i+1));}catch(e){start=-1;}}}
  }
  return null;
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

  // Health check (UptimeRobot). Tolerate HEAD (UptimeRobot's default probe
  // method) plus query strings / trailing slash so it never falls through to 404.
  if((req.method==='GET' || req.method==='HEAD') && /^\/ping\/?(\?|$)/.test(req.url)){
    if(req.method==='HEAD'){
      res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});
      res.end();
      return;
    }
    res.writeHead(200,{'Content-Type':'application/json'});
    res.end(JSON.stringify({status:'ok'}));
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

      var thresh = parsed.threshold || 30;
      var lotThresh = parsed.lotThreshold || 8;
      var image = parsed.image || '';
      console.log('[SCAN] Image:', image.length, '| Sell: $'+thresh+' | Lot: $'+lotThresh);

      if(!image || image.length < 100){
        sendJSON(res,200,{verdict:'KEEP',item_name:'Image capture failed - try again',avg_sold_price:0,reason:'Camera did not send a valid image.'});
        return;
      }

      // Step 1: Gemini Flash vision - identify item
      var step1Body = JSON.stringify({
        contents: [{
          parts: [
            {inline_data: {mime_type: 'image/jpeg', data: image}},
            {text: 'You are an electronics identification expert. Examine this image carefully. Identify the exact brand, model number, and item type. CRITICAL: Always include the item type category even if only a label is visible - use context clues like label format, visible housing, or your knowledge of the brand/model to determine device type. Never return just a model number alone. Reply with ONLY one line: brand model-number item-type-category. Examples: Cisco WS-C2960-24TT-L Network Switch | Apple A1466 MacBook Air Laptop | Tandy TRS-80 Model III Personal Computer | HP LaserJet 4250 Laser Printer'}
          ]
        }],
        generationConfig: {maxOutputTokens: 100, temperature: 0.1}
      });

      var step1Opts = {
        hostname: 'generativelanguage.googleapis.com',
        path: '/v1beta/models/gemini-2.5-flash:generateContent?key=' + GEMINI_KEY,
        method: 'POST',
        headers: {'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(step1Body)}
      };

      callGemini(step1Opts, step1Body, function(err1, r1) {
        if(err1 || !r1) {
          sendJSON(res,200,{verdict:'KEEP',item_name:'Scan error - set aside',avg_sold_price:0,reason:'Could not identify item. Set aside for processor review.'});
          return;
        }

        var itemName = '';
        try {
          itemName = r1.candidates[0].content.parts[0].text.trim().replace(/[\r\n]+/g,' ').slice(0,150);
        } catch(e) { itemName = ''; }

        if(!itemName || itemName.length < 3) itemName = 'Unknown electronic item';
        console.log('[SCAN] Identified:', itemName);

        // Step 2: Gemini Flash with Google Search grounding - pricing research
        var step2Body = JSON.stringify({
          contents: [{
            parts: [{text: [
              'You are an eBay resale pricing expert for an e-waste resale business.',
              'Search for eBay completed/sold listings for: ' + itemName,
              '',
              'SEARCH STRATEGY:',
              '1. Search eBay completed sold listings for the single unit price.',
              '2. If single unit price is below $'+thresh+': search specifically for completed LOT listings (search "lot of [item] sold eBay").',
              '3. Only assign LOT if you find real evidence of 3+ lot sales in last 90 days.',
              '',
              'VERDICT RULES:',
              '- KEEP: single unit avg sold price >= $'+thresh,
              '- LOT: ALL must be true from actual search results:',
              '    * Single unit price between $'+lotThresh+' and $'+(thresh-1),
              '    * 3 or more completed lot sales in last 90 days on eBay',
              '    * Lot total sale price at least $30',
              '    * Per-unit value within lots at least $10 per item',
              '    * Pricing consistent - not one outlier',
              '    * Common genuine lot items: office phones, VoIP phones, network switches, keyboards, RAM, power supplies',
              '- RECYCLE: single unit avg sold < $'+lotThresh+', OR no meaningful eBay market, OR fewer than 3 lot sales found, OR lot per-unit under $10',
              '- When price uncertain return KEEP',
              '- Vintage electronics (Apple, Tandy, Commodore, Atari, IBM, HP vintage) almost always have eBay markets - search carefully before RECYCLE',
              '- Medical or regulated equipment: always RECYCLE',
              '',
              'CRITICAL: Only assign LOT when search results prove it. Never assume lot demand.',
              'CRITICAL: Return eBay SOLD/COMPLETED prices only - not current listings or retail prices.',
              '',
              'Return ONLY this JSON, no markdown:',
              '{"verdict":"KEEP","item_name":"name","avg_sold_price":45,"reason":"One plain English sentence for a warehouse employee. If LOT cite evidence: how many lot sales found and typical lot price."}'
            ].join('\n')}]
          }],
          tools: [{google_search: {}}],
          generationConfig: {maxOutputTokens: 300, temperature: 0.1}
        });

        var step2Opts = {
          hostname: 'generativelanguage.googleapis.com',
          path: '/v1beta/models/gemini-2.5-flash:generateContent?key=' + GEMINI_KEY,
          method: 'POST',
          headers: {'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(step2Body)}
        };

        callGemini(step2Opts, step2Body, function(err2, r2) {
          if(err2 || !r2) {
            sendJSON(res,200,{verdict:'KEEP',item_name:itemName,avg_sold_price:0,reason:'Could not retrieve pricing. Set aside for review.'});
            return;
          }

          var text2 = '';
          try { text2 = r2.candidates[0].content.parts[0].text; } catch(e) {}

          var result = extractResult(text2, itemName);
          if(!result.item_name || result.item_name.length < 3) result.item_name = itemName;

          // SERVER-SIDE VERDICT ENFORCEMENT - same rules as before
          var price = result.avg_sold_price || 0;
          if(price > 0) {
            if(price >= thresh) {
              result.verdict = 'KEEP';
            } else if(price < lotThresh) {
              result.verdict = 'RECYCLE';
            }
            // Between lotThresh and thresh - trust AI verdict (LOT or RECYCLE)
          } else {
            // No price found - default KEEP
            result.verdict = 'KEEP';
          }

          console.log('[SCAN] Final:', JSON.stringify(result));
          sendJSON(res, 200, result);
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

      callOpenRouter({
        model: 'google/gemini-2.5-flash',
        max_tokens: 20,
        messages:[{role:'user',content:[
          {type:'image_url',image_url:{url:'data:image/jpeg;base64,'+image}},
          {type:'text',text:'You are reading a shelf location sticker in a warehouse. The sticker contains a short alphanumeric code like F4, E5, A12, B3. Read the code and return ONLY the code itself, nothing else. If you cannot read a clear code, return the word UNCLEAR.'}
        ]}]
      }, function(err, r) {
        if(err || !r){sendJSON(res,200,{code:null});return;}
        var code = r.trim().toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,8);
        sendJSON(res,200,{code: code.length > 0 && code !== 'UNCLEAR' ? code : null});
      });
    });
    return;
  }

  // ── PROCESSOR IDENTIFIER (FEATURE 1) — Anthropic Sonnet vision ──
  if(req.method==='POST' && req.url==='/api/identify-item'){
    parseBody(req, function(err, parsed){
      if(err){ sendJSON(res,400,{error:'Bad request'}); return; }
      var image = parsed.image || '';
      if(!image || image.length < 100){ sendJSON(res,200,{error:'no_image'}); return; }
      var idPrompt = [
        'You are an electronics identification expert for an eBay resale warehouse.',
        '1. Read ALL visible text in the image exactly as printed. Do not interpret, infer, or substitute characters. If you see A1 printed, return A1 not A7 or M1.',
        '2. Use the exact text you read to identify the brand and model.',
        '3. Use visual context only to fill in category and details that are not visible as text.',
        'Character accuracy is critical — never substitute similar-looking characters (1 vs 7, 1 vs I, 0 vs O, A vs M, etc).',
        'Return ONLY this JSON, no markdown:',
        '{',
        '  "item_name": "full descriptive name with brand and model",',
        '  "brand": "brand name",',
        '  "model": "model number or name",',
        '  "category": "item category",',
        '  "estimated_low": estimated low eBay sold price (working) as integer,',
        '  "estimated_high": estimated high eBay sold price (working) as integer,',
        '  "quantity": number of identical items visible in frame,',
        '  "testing_instructions": ["MAXIMUM 3 strings, each under 15 words — only the 2-3 checks that most affect resale value"],',
        '  "cannot_test": true if item cannot be meaningfully tested,',
        '  "sealed": true if item appears sealed/new in original packaging,',
        '  "parts_repair_demand": true if this item still sells AS-IS for parts/repair on eBay even when non-working,',
        '  "parts_repair_price": estimated AS-IS parts/repair sold price as integer (0 if no parts demand)',
        '}'
      ].join('\n');
      callClaude({
        model: 'claude-sonnet-4-5',
        max_tokens: 1024,
        messages: [{role:'user', content:[
          {type:'image', source:{type:'base64', media_type:'image/jpeg', data:image}},
          {type:'text', text: idPrompt}
        ]}]
      }, function(err2, resp){
        if(err2 || !resp){ sendJSON(res,200,{error:'vision_error'}); return; }
        var text = extractText(resp.content);
        var data = extractFirstJson(text) || {};
        data.item_name = data.item_name || 'Unknown item';
        data.brand = data.brand || '';
        data.model = data.model || '';
        data.category = data.category || '';
        data.estimated_low = parseInt(data.estimated_low, 10) || 0;
        data.estimated_high = parseInt(data.estimated_high, 10) || 0;
        data.quantity = parseInt(data.quantity, 10) || 1;
        if(data.quantity < 1) data.quantity = 1;
        if(!Array.isArray(data.testing_instructions) || data.testing_instructions.length === 0){
          data.testing_instructions = ['Visual inspect only — note any damage or missing parts'];
        }
        // 5-Minute Test — cap at 3 critical checks (Feature 4)
        data.testing_instructions = data.testing_instructions.slice(0, 3);
        data.cannot_test = !!data.cannot_test;
        data.sealed = !!data.sealed;
        data.parts_repair_demand = !!data.parts_repair_demand;
        data.parts_repair_price = parseInt(data.parts_repair_price, 10) || 0;
        data.working_price = data.estimated_high || data.estimated_low || 0;
        console.log('[IDENTIFY]', data.item_name, '| $'+data.estimated_low+'-$'+data.estimated_high, '| qty', data.quantity, '| parts:', data.parts_repair_demand);

        // ── Step 1.5: confirm category + pricing from real eBay completed sold listings ──
        // Additive: on ANY failure we fall through to the existing AI estimate (Change rule 5).
        function finishIdentify(){
          data.working_price = data.estimated_high || data.estimated_low || 0;
          sendJSON(res, 200, data);
        }
        findCompletedItemsCategory(data.item_name, EBAY_APP_ID, function(_fcErr, result){
          if(result && result.category_id){
            data.ebay_category_id = result.category_id;
            data.ebay_category_name = result.category_name;
            data.category_source = 'ebay_browse';
            data.category_search_level = result.search_level;
            if(result.price_reliable){
              data.estimated_low = result.price_low;
              data.estimated_high = result.price_high;
              data.pricing_source = 'ebay_completed';
            } else {
              data.pricing_source = 'web_search'; // keep the existing AI/web-search estimate
            }
            // eBay's Browse API already designates leafCategoryIds as leaf categories —
            // trust it and skip GetCategoryFeatures validation entirely.
            if(result.ebay_confirmed_leaf === true){
              data.category_confirmed = true;
              data.category_needs_review = false;
              console.log('[IDENTIFY] Category ' + result.category_id + ' (' + result.category_name + ') confirmed leaf by Browse API — skipping validation');
              finishIdentify();
            } else {
              validateLeafCategory(result.category_id, function(_vErr, isLeaf){
                data.category_confirmed = !!isLeaf;
                data.category_needs_review = !isLeaf;
                if(isLeaf) console.log('[IDENTIFY] Category', result.category_id, '(' + result.category_name + ') confirmed leaf — Level', result.search_level, 'match');
                else console.log('[IDENTIFY] Category', result.category_id, 'is not a leaf — flagged for review');
                finishIdentify();
              });
            }
          } else {
            data.ebay_category_id = null;
            data.category_source = 'web_search';
            data.category_confirmed = false;
            data.category_needs_review = true;
            data.pricing_source = 'web_search';
            console.log('[IDENTIFY] Using web search fallback for category and pricing');
            finishIdentify();
          }
        });
      });
    });
    return;
  }

  // FIX 1: manual identifier override — run the Browse cascade on a typed item name.
  // Returns the same shape as /api/identify-item so the processor can show + confirm it.
  // Never blocks: if Browse finds nothing, returns the typed name with category_confirmed:false.
  if(req.method==='POST' && req.url==='/api/identify-manual'){
    parseBody(req, function(err, parsed){
      if(err || !parsed || !parsed.item_name || !String(parsed.item_name).trim()){ sendJSON(res,400,{error:'Bad request'}); return; }
      var typed = String(parsed.item_name).trim();
      findCompletedItemsCategory(typed, EBAY_APP_ID, function(_fcErr, result){
        var data = {
          item_name: typed,
          brand: '', model: '', category: '',
          estimated_low: 0, estimated_high: 0,
          quantity: 1,
          testing_instructions: ['Visual inspect only — note any damage or missing parts'],
          cannot_test: false, sealed: false,
          parts_repair_demand: false, parts_repair_price: 0,
          manual_override: true
        };
        if(result && result.category_id){
          data.ebay_category_id = result.category_id;
          data.ebay_category_name = result.category_name;
          data.category_source = 'ebay_browse';
          data.category_search_level = result.search_level;
          data.category_confirmed = result.ebay_confirmed_leaf === true;
          data.category_needs_review = !(result.ebay_confirmed_leaf === true);
          if(result.price_reliable){
            data.estimated_low = result.price_low; data.estimated_high = result.price_high;
            data.pricing_source = 'ebay_browse';
          } else {
            data.pricing_source = 'web_search';
          }
          console.log('[IDENTIFY-MANUAL] "' + typed + '" → category ' + result.category_id + ' (' + (result.category_name || '') + ')');
        } else {
          data.ebay_category_id = null;
          data.category_source = 'ebay_browse';
          data.category_confirmed = false;
          data.category_needs_review = true;
          data.pricing_source = 'web_search';
          console.log('[IDENTIFY-MANUAL] "' + typed + '" → no category found (proceed anyway)');
        }
        data.working_price = data.estimated_high || data.estimated_low || 0;
        sendJSON(res, 200, data);
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

      // Save testing-phase photos (Feature 1) as test_photo_N.jpg
      var testPhotos = parsed.testPhotos || [];
      var testingPhotoFiles = [];
      testPhotos.forEach(function(b64, i){
        try {
          fs.writeFileSync(path.join(itemDir, 'test_photo_'+(i+1)+'.jpg'), Buffer.from(b64, 'base64'));
          testingPhotoFiles.push('test_photo_'+(i+1)+'.jpg');
        } catch(e){}
      });

      // Save metadata
      var meta = {
        sku: parsed.sku,
        grade: parsed.grade,
        powerTest: parsed.powerTest,
        notes: parsed.notes,
        shelf: parsed.shelf,
        weight: parsed.weight || null,
        quantity: parsed.quantity && parsed.quantity > 1 ? parsed.quantity : 1,
        identified_item: parsed.identified_item || null,
        test_notes: parsed.test_notes || '',
        testingPhotos: testingPhotoFiles,
        camFormat: parsed.camFormat || '1:1',
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

      console.log('[SUBMIT] SKU', sku, 'saved with', photos.length, 'photos +', testingPhotoFiles.length, 'testing photos');
      sendJSON(res,200,{success:true, sku:sku});

      // Queue listing generation instead of generating immediately. The queue
      // processes one item at a time with an 8s gap to avoid rate-limit errors.
      enqueueListing(sku);
    });
    return;
  }

  // List pending items (not yet processed into listings)
  // Serve individual photos for XRT items
  if(req.method==='GET' && req.url.startsWith('/api/photo/')){
    var photoParts = req.url.split('?')[0].split('/');
    var photoSku = photoParts[3];
    var photoRef = decodeURIComponent(photoParts[4] || '1');
    if(!photoSku){res.writeHead(404);res.end('Not found');return;}
    // Accept a plain number (→ photo_N.jpg) or a filename stem (photo_2, test_photo_1)
    var stem;
    if(/^\d+$/.test(photoRef)) stem = 'photo_' + parseInt(photoRef, 10);
    else if(/^[a-z0-9_]+$/i.test(photoRef)) stem = photoRef.replace(/\.jpg$/i, '');
    else { res.writeHead(404); res.end('Bad photo ref'); return; }
    var photoPath = path.join(DATA_DIR,'items',String(photoSku), stem + '.jpg');
    if(fs.existsSync(photoPath)){
      res.writeHead(200,{'Content-Type':'image/jpeg','Cache-Control':'public,max-age=3600'});
      res.end(fs.readFileSync(photoPath));
    } else {
      res.writeHead(404);res.end('Photo not found');
    }
    return;
  }

  // FIX 4: delete a single photo from a listing record + disk (listings page X button)
  if(req.method==='DELETE' && req.url.startsWith('/api/listings/')){
    var dParts = req.url.split('?')[0].split('/'); // ['','api','listings',sku,'photo',name]
    if(dParts.length >= 6 && dParts[4] === 'photo'){
      var dSku = dParts[3];
      var dName = decodeURIComponent(dParts[5] || '').replace(/\.jpg$/i,'');
      if(!dSku || !dName || !/^[a-z0-9_]+$/i.test(dName)){ sendJSON(res,400,{success:false, error:'Bad request'}); return; }
      var dDir = path.join(DATA_DIR, 'items', String(dSku));
      var dLp = path.join(dDir, 'listing.json');
      if(!fs.existsSync(dLp)){ sendJSON(res,404,{success:false, error:'Listing not found for SKU ' + dSku}); return; }
      var dRec; try { dRec = JSON.parse(fs.readFileSync(dLp, 'utf8')); }
      catch(e){ sendJSON(res,500,{success:false, error:'Bad listing.json'}); return; }
      if(Array.isArray(dRec.outputPhotos)){
        dRec.outputPhotos = dRec.outputPhotos.filter(function(s){ return String(s).replace(/\.jpg$/i,'') !== dName; });
      }
      try { var dFile = path.join(dDir, dName + '.jpg'); if(fs.existsSync(dFile)) fs.unlinkSync(dFile); } catch(e){}
      try { fs.writeFileSync(dLp, JSON.stringify(dRec, null, 2)); }
      catch(e){ sendJSON(res,500,{success:false, error:'Write failed'}); return; }
      console.log('[PHOTO] SKU', dSku, '- deleted photo', dName);
      sendJSON(res,200,{success:true});
      return;
    }
    // FIX 3: DELETE /api/listings/:sku -> remove the listing JSON + all photo files for that SKU
    if(dParts.length === 4 && dParts[3]){
      var wSku = dParts[3];
      if(!/^\d+$/.test(wSku)){ sendJSON(res,400,{success:false, error:'Bad SKU'}); return; }
      var wDir = path.join(DATA_DIR, 'items', String(wSku));
      if(!fs.existsSync(wDir)){ sendJSON(res,404,{success:false, error:'Listing not found for SKU ' + wSku}); return; }
      try { fs.rmSync(wDir, {recursive:true, force:true}); }
      catch(e){ sendJSON(res,500,{success:false, error:'Delete failed: ' + e.message}); return; }
      try { loadListings(); } catch(e){} // refresh the listings.json cache
      console.log('[LISTING] SKU', wSku, '- deleted listing and all photos');
      sendJSON(res,200,{success:true});
      return;
    }
    sendJSON(res,404,{success:false, error:'Not found'});
    return;
  }

  // FIX 4: PATCH /api/listings/:sku -> update editable fields (quantity) on the listing record
  if(req.method==='PATCH' && req.url.startsWith('/api/listings/')){
    var pParts = req.url.split('?')[0].split('/');
    if(pParts.length !== 4 || !/^\d+$/.test(pParts[3] || '')){ sendJSON(res,400,{success:false, error:'Bad request'}); return; }
    var pSku = pParts[3];
    parseBody(req, function(perr, parsed){
      if(perr || !parsed){ sendJSON(res,400,{success:false, error:'Bad request'}); return; }
      var pDir = path.join(DATA_DIR, 'items', String(pSku));
      var pLp = path.join(pDir, 'listing.json');
      if(!fs.existsSync(pLp)){ sendJSON(res,404,{success:false, error:'Listing not found for SKU ' + pSku}); return; }
      var pRec; try { pRec = JSON.parse(fs.readFileSync(pLp, 'utf8')); }
      catch(e){ sendJSON(res,500,{success:false, error:'Bad listing.json'}); return; }
      if(parsed.quantity !== undefined){
        var q = parseInt(parsed.quantity, 10);
        if(isNaN(q) || q < 1 || q > 99){ sendJSON(res,400,{success:false, error:'Quantity must be 1-99'}); return; }
        pRec.quantity = q;
        pRec.meta = pRec.meta || {};
        pRec.meta.quantity = q;
      }
      // FIX 3: editable Suggest price — this is the actual eBay listing price
      if(parsed.suggest_price !== undefined){
        var np = parseFloat(parsed.suggest_price);
        if(isNaN(np) || np <= 0){ sendJSON(res,400,{success:false, error:'Price must be greater than 0'}); return; }
        pRec.listing = pRec.listing || {};
        var oldp = pRec.listing.suggested_price;
        pRec.listing.suggested_price = np;
        console.log('[LISTING] SKU ' + pSku + ' price override: $' + (oldp == null ? '?' : oldp) + ' → $' + np);
      }
      // FIX 2: new photo order from listings-page drag-and-drop (used when uploading to eBay).
      // Validate against files on disk; keep at least 1 photo; append any existing not listed.
      if(parsed.photo_order !== undefined){
        if(!Array.isArray(parsed.photo_order) || parsed.photo_order.length < 1){ sendJSON(res,400,{success:false, error:'photo_order must be a non-empty array'}); return; }
        var pdir = path.join(DATA_DIR, 'items', String(pSku));
        var clean = parsed.photo_order.map(function(s){ return String(s).replace(/\.jpg$/i,''); })
          .filter(function(s){ return /^[a-z0-9_]+$/i.test(s) && fs.existsSync(path.join(pdir, s + '.jpg')); });
        if(clean.length){
          var cur = Array.isArray(pRec.outputPhotos) ? pRec.outputPhotos.map(function(s){ return String(s).replace(/\.jpg$/i,''); }) : [];
          cur.forEach(function(s){ if(clean.indexOf(s) < 0 && fs.existsSync(path.join(pdir, s + '.jpg'))) clean.push(s); });
          pRec.outputPhotos = clean;
          console.log('[LISTING] SKU ' + pSku + ' photo order updated: ' + clean.join(', '));
        }
      }
      try { fs.writeFileSync(pLp, JSON.stringify(pRec, null, 2)); }
      catch(e){ sendJSON(res,500,{success:false, error:'Write failed'}); return; }
      if(parsed.quantity !== undefined) console.log('[LISTING] SKU', pSku, '- updated quantity to', pRec.quantity);
      sendJSON(res,200,{success:true, quantity: pRec.quantity, suggested_price: (pRec.listing && pRec.listing.suggested_price), photo_order: pRec.outputPhotos});
    });
    return;
  }

  // Log a recycle / hold decision from the value-check screen (Feature 1, Step C)
  if(req.method==='POST' && req.url==='/api/log-action'){
    parseBody(req, function(err, parsed){
      if(err){ sendJSON(res,400,{error:'Bad request'}); return; }
      var line = JSON.stringify({
        action: parsed.action || 'unknown',
        item: (parsed.item && parsed.item.item_name) ? parsed.item.item_name : 'Unknown',
        estimated_low: parsed.item ? parsed.item.estimated_low : null,
        estimated_high: parsed.item ? parsed.item.estimated_high : null,
        at: new Date().toISOString()
      }) + '\n';
      try { fs.appendFileSync(path.join(DATA_DIR, 'actions.log'), line); } catch(e){}
      console.log('[ACTION]', parsed.action, '-', (parsed.item&&parsed.item.item_name)||'Unknown');
      sendJSON(res,200,{success:true});
    });
    return;
  }

  // ── eBay OAuth (Feature 9) ──
  if(req.method==='GET' && req.url.split('?')[0]==='/ebay-auth'){
    var authUrl = EBAY_AUTH_BASE + '/oauth2/authorize?client_id=' + encodeURIComponent(EBAY_APP_ID) +
      '&redirect_uri=' + encodeURIComponent(EBAY_REDIRECT_URI) + '&response_type=code&scope=' + encodeURIComponent(EBAY_SCOPES.join(' '));
    res.writeHead(302, {Location: authUrl}); res.end(); return;
  }
  if(req.method==='GET' && req.url.split('?')[0]==='/ebay-auth-callback'){
    var cbQuery = require('url').parse(req.url, true).query;
    var code = cbQuery.code;
    if(!code){ res.writeHead(400,{'Content-Type':'text/html'}); res.end('<h2>Missing authorization code</h2>'); return; }
    var basicCb = Buffer.from(EBAY_APP_ID + ':' + EBAY_CERT_ID).toString('base64');
    var cbBody = 'grant_type=authorization_code&code=' + encodeURIComponent(code) + '&redirect_uri=' + encodeURIComponent(EBAY_REDIRECT_URI);
    var cbOpts = {hostname: EBAY_BASE.replace('https://',''), path:'/identity/v1/oauth2/token', method:'POST',
      headers:{'Content-Type':'application/x-www-form-urlencoded','Authorization':'Basic '+basicCb,'Content-Length':Buffer.byteLength(cbBody)}};
    var cbReq = https.request(cbOpts, function(cbRes){
      var data=''; cbRes.on('data',function(c){data+=c;});
      cbRes.on('end', function(){
        try { var j = JSON.parse(data);
          if(j.access_token){
            writeEbayTokens({access_token:j.access_token, refresh_token:j.refresh_token||'', expires_at: Date.now()+((j.expires_in||7200)*1000), token_type:j.token_type||'Bearer'});
            res.writeHead(200,{'Content-Type':'text/html'});
            res.end('<html><body style="font-family:sans-serif;padding:40px;"><h2>eBay account connected successfully.</h2><p>You can close this tab.</p></body></html>');
          } else { res.writeHead(400,{'Content-Type':'text/html'}); res.end('<h2>Token exchange failed</h2><pre>'+String(data).slice(0,400)+'</pre>'); }
        } catch(e){ res.writeHead(500,{'Content-Type':'text/html'}); res.end('<h2>Error parsing token response</h2>'); }
      });
    });
    cbReq.on('error', function(e){ res.writeHead(502,{'Content-Type':'text/html'}); res.end('<h2>Network error contacting eBay</h2>'); });
    cbReq.write(cbBody); cbReq.end();
    return;
  }
  if(req.method==='GET' && req.url.split('?')[0]==='/ebay-status'){
    sendJSON(res, 200, ebayStatus());
    return;
  }
  // ── eBay business policies: fetch + store IDs and names ──
  if(req.method==='GET' && (req.url.split('?')[0]==='/ebay-policies' || req.url.split('?')[0]==='/ebay-setup-policies')){
    fetchEbayPolicies(function(err, policies){
      if(err){ sendJSON(res,200,{success:false, error:err.message}); return; }
      sendJSON(res,200,{success:true, fulfillment:policies.fulfillment, payment:policies.payment, return:policies.return,
        fulfillment_id:policies.fulfillment_id, payment_id:policies.payment_id, return_id:policies.return_id,
        shipping_map:policies.shipping_map, stored: EBAY_POLICIES_FILE});
    });
    return;
  }
  // ── eBay one-time setup: policies + merchant location ──
  if(req.method==='GET' && req.url.split('?')[0]==='/ebay-setup-all'){
    var summary = {};
    fetchEbayPolicies(function(pErr, policies){
      summary.policies = pErr ? {error:pErr.message} :
        {fulfillment: policies.fulfillment.length, payment: policies.payment.length, return: policies.return.length,
         fulfillment_id: policies.fulfillment_id, payment_id: policies.payment_id, return_id: policies.return_id};
      createMerchantLocation(function(lErr, locInfo){
        summary.location = lErr ? {error:lErr.message} : locInfo;
        console.log('[EBAY] setup-all complete:', JSON.stringify(summary));
        sendJSON(res,200,{success:true, summary: summary});
      });
    });
    return;
  }
  // ── eBay diagnostics (token never exposed) ──
  if(req.method==='GET' && req.url.split('?')[0]==='/ebay-debug'){
    var tokensExist = fs.existsSync(EBAY_TOKENS_FILE);
    var tokensRedacted = null;
    if(tokensExist){
      try {
        var raw = JSON.parse(fs.readFileSync(EBAY_TOKENS_FILE,'utf8'));
        tokensRedacted = {
          has_access_token: !!raw.access_token,
          access_token_length: raw.access_token ? String(raw.access_token).length : 0,
          has_refresh_token: !!raw.refresh_token,
          refresh_token_length: raw.refresh_token ? String(raw.refresh_token).length : 0,
          token_type: raw.token_type || null,
          expires_at: raw.expires_at || null,
          expires_at_iso: raw.expires_at ? new Date(raw.expires_at).toISOString() : null,
          expired: raw.expires_at ? (Date.now() > raw.expires_at) : null
        };
      } catch(e){ tokensRedacted = {error:'could not parse ebay-tokens.json'}; }
    }
    sendJSON(res, 200, {
      env_user_token_present: EBAY_USER_TOKEN.length > 0,
      env_user_token_length: EBAY_USER_TOKEN.length,
      tokens_file_path: EBAY_TOKENS_FILE,
      tokens_file_exists: tokensExist,
      tokens_file_contents_redacted: tokensRedacted,
      ebay_auth_scopes: EBAY_SCOPES,
      ebay_environment: EBAY_ENVIRONMENT,
      inventory_api_base: EBAY_BASE,
      authorization_header_format: 'Bearer <access_token>',
      authorization_header_example: 'Authorization: Bearer ' + (tokensRedacted && tokensRedacted.has_access_token ? '<'+tokensRedacted.access_token_length+'-char token present>' : '<no token>')
    });
    return;
  }
  if(req.method==='POST' && req.url==='/api/ebay-refresh-token'){
    refreshEbayToken(function(err, tok){
      if(err){ sendJSON(res,200,{success:false, error:err.message}); }
      else { sendJSON(res,200,{success:true}); }
    });
    return;
  }
  if(req.url.split('?')[0]==='/api/ebay-deletion-notification'){
    // eBay compliance endpoint: GET = verification challenge handshake, POST = log notification
    var delQuery = require('url').parse(req.url, true).query;
    if(req.method==='GET' && delQuery.challenge_code){
      sendJSON(res, 200, {challengeResponse: delQuery.challenge_code});
      return;
    }
    if(req.method==='POST'){
      parseBody(req, function(){ console.log('[EBAY] deletion notification received'); res.writeHead(200); res.end('OK'); });
      return;
    }
    res.writeHead(200); res.end('OK');
    return;
  }
  // ── eBay listing creation via Trading API AddItem (creates a live listing) ──
  if(req.method==='POST' && req.url==='/api/send-to-ebay'){
    parseBody(req, function(err, parsed){
      if(err || !parsed || !parsed.sku){ sendJSON(res,400,{success:false, error:'Bad request'}); return; }
      if(!ebayStatus().connected){ sendJSON(res,200,{success:false, error:'Connect eBay first'}); return; }
      createEbayListing(parsed.sku, function(lErr, info){
        if(lErr){ sendJSON(res,200,{success:false, error:lErr.message}); return; }
        if(info && info.blocked){ sendJSON(res,200,{success:false, error:info.error, needs_category_review:true, category_id:info.category_id}); return; }
        sendJSON(res,200,{success:true, item_id:info.item_id, listing_url:info.listing_url});
      });
    });
    return;
  }

  // BUG 2: manual weight entry from the listings page. Saves the typed weight (lbs)
  // to the listing record and recomputes the shipping policy/box so publishing is unblocked.
  if(req.method==='POST' && req.url==='/api/set-weight'){
    parseBody(req, function(err, parsed){
      if(err || !parsed || !parsed.sku){ sendJSON(res,400,{success:false, error:'Bad request'}); return; }
      // FIX 2: accept a RAW scale reading as separate lbs + oz (never total ounces)
      var lbs = parseInt(parsed.lbs, 10); if(isNaN(lbs)) lbs = 0;
      var oz = parseFloat(parsed.oz); if(isNaN(oz)) oz = 0;
      if(lbs < 0 || oz < 0 || (lbs === 0 && oz === 0)){ sendJSON(res,400,{success:false, error:'Enter a valid weight (lb and/or oz)'}); return; }
      var itemDir = path.join(DATA_DIR, 'items', String(parsed.sku));
      var lp = path.join(itemDir, 'listing.json');
      if(!fs.existsSync(lp)){ sendJSON(res,404,{success:false, error:'Listing not found for SKU ' + parsed.sku}); return; }
      var record; try { record = JSON.parse(fs.readFileSync(lp, 'utf8')); }
      catch(e){ sendJSON(res,500,{success:false, error:'Bad listing.json'}); return; }
      record.meta = record.meta || {};
      record.listing = record.listing || {};
      // Run the SAME tier calculator used for OCR readings (never bypass it)
      var tier = calculateShippingTier(lbs, oz, parsed.sku);
      var disp = tier.rawLbs + 'lb ' + tier.rawOz + 'oz';
      record.weight = disp;
      record.weightManual = true;
      record.noWeightFlag = false;
      record.shipping_tier = tier;
      record.meta.weight = disp;
      record.meta.weightLbs = tier.rawLbs;
      record.meta.weightOzPart = tier.rawOz;
      record.meta.noWeightFlag = false;
      record.meta.shipping_tier = tier;
      // Mirror to legacy listing fields for display consistency
      record.listing.shipping_policy = shippingPolicyName(tier.shippingPolicyId);
      record.listing.shipping_profile_id = String(tier.shippingPolicyId);
      record.listing.listed_weight = tier.finalLbs;
      record.listing.listed_weight_unit = 'lbs';
      record.listing.box_dimensions = tier.boxSize;
      record.listing.polymailer = false;
      try { fs.writeFileSync(lp, JSON.stringify(record, null, 2)); }
      catch(e){ sendJSON(res,500,{success:false, error:'Write failed'}); return; }
      // Keep the separate meta.json in sync so a rebuild reflects the manual weight
      try { var mp = path.join(itemDir, 'meta.json'); if(fs.existsSync(mp)){ var m = JSON.parse(fs.readFileSync(mp,'utf8')); m.weight = disp; m.weightLbs = tier.rawLbs; m.weightOzPart = tier.rawOz; m.noWeightFlag = false; m.shipping_tier = tier; fs.writeFileSync(mp, JSON.stringify(m, null, 2)); } } catch(e){}
      console.log('[WEIGHT] SKU', parsed.sku, '- manual weight set:', disp, '| packed', tier.finalLbs + 'lb ' + tier.finalOz + 'oz | box', tier.boxSize);
      sendJSON(res,200,{success:true, weight:disp, raw_lbs:tier.rawLbs, raw_oz:tier.rawOz, final_lbs:tier.finalLbs, final_oz:tier.finalOz, box_size:tier.boxSize, tier:tier.tier});
    });
    return;
  }

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

  // Clear all listings AND photos (removes item folders). SKU counter is kept
  // in memory + file, so SKUs never repeat after a clear.
  if(req.method==='POST' && req.url==='/api/clear-listings'){
    var clearDir = path.join(DATA_DIR, 'items');
    try {
      fs.readdirSync(clearDir).forEach(function(f){
        try { fs.rmSync(path.join(clearDir, f), {recursive:true, force:true}); } catch(e){}
      });
    } catch(e){}
    saveListings([]);
    sendJSON(res,200,{success:true});
    return;
  }

  // Force rebuild of listings.json from individual item folders (FIX 3)
  if(req.method==='GET' && req.url==='/api/rebuild-listings'){
    var rebuilt = rebuildListings();
    sendJSON(res,200,{success:true, count:rebuilt.length});
    return;
  }

  // ── Listing generation queue status ──
  if(req.method==='GET' && req.url==='/api/queue-status'){
    sendJSON(res, 200, {
      pending: listingQueue.length,
      processing: queueProcessing,
      last_completed_sku: lastCompletedSku,
      failed: Object.keys(failedItems).map(function(k){ return failedItems[k]; })
    });
    return;
  }
  // Retry a failed (or any) item's listing generation
  if(req.method==='POST' && req.url==='/api/retry-listing'){
    parseBody(req, function(err, parsed){
      if(err || !parsed || !parsed.sku){ sendJSON(res,400,{success:false, error:'Bad request'}); return; }
      enqueueListing(parsed.sku); // clears the failed flag and re-queues
      sendJSON(res,200,{success:true, sku: Number(parsed.sku)});
    });
    return;
  }

  if(req.method==='GET' && req.url==='/api/listings'){
    var listings = loadListings();
    if(listings.length === 0){
      res.writeHead(200,{'Content-Type':'text/html'});
      res.end('<html><body><p style="font-family:sans-serif;padding:40px;color:#666;">No listings yet. Submit items via the processor app and they will appear here automatically.</p></body></html>');
    } else {
      res.writeHead(200,{'Content-Type':'text/html'});
      res.end(generateListingsPage(listings, ebayStatus()));
    }
    return;
  }

  res.writeHead(404);res.end('Not found');
});

// NOTE: listings storage + page rendering are defined once, lower in this file
// (folder-scanning loadListings/saveListings/rebuildListings + generateListingsPage).

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

// ── LISTING GENERATION (Anthropic Sonnet) — FIX 1 ──
// Step 1: vision ID via claude-sonnet-4-5 (skipped if identifier screen already ran)
// Step 2: listing write via claude-sonnet-4-5 with web_search tool enabled
// ── LISTING GENERATION QUEUE ──
// Handles 50+ items/shift without rate-limit errors: one item at a time, an
// 8s gap between API calls, 60s pause on a 429, max 3 retries before failed.
var listingQueue = [];          // [{sku, attempts}]
var queueProcessing = false;
var lastCompletedSku = null;
var failedItems = {};           // sku -> {sku, attempts, error, at}
var QUEUE_GAP_MS = 8000;
var QUEUE_RATELIMIT_PAUSE_MS = 60000;
var QUEUE_MAX_RETRIES = 3;

function enqueueListing(sku){
  sku = Number(sku);
  if(!sku) return;
  if(listingQueue.some(function(q){ return q.sku === sku; })) return; // already queued
  delete failedItems[sku];
  listingQueue.push({sku: sku, attempts: 0});
  console.log('[QUEUE] Enqueued SKU', sku, '| pending', listingQueue.length);
  if(!queueProcessing) processQueue();
}

function processQueue(){
  if(queueProcessing) return;
  if(listingQueue.length === 0) return;
  queueProcessing = true;
  var job = listingQueue[0];
  var sku = job.sku;
  var itemDir = path.join(DATA_DIR, 'items', String(sku));
  var metaPath = path.join(itemDir, 'meta.json');
  var itemMeta = null;
  try { if(fs.existsSync(metaPath)) itemMeta = JSON.parse(fs.readFileSync(metaPath, 'utf8')); } catch(e){}
  if(!itemMeta){ // nothing to do — drop and continue
    listingQueue.shift(); queueProcessing = false; setTimeout(processQueue, 50); return;
  }
  if(itemMeta.processed){ // already generated — drop and continue
    listingQueue.shift(); lastCompletedSku = sku; queueProcessing = false; setTimeout(processQueue, 50); return;
  }
  job.attempts++;
  console.log('[QUEUE] Processing SKU', sku, '| attempt', job.attempts, 'of', QUEUE_MAX_RETRIES);
  processItem({meta: itemMeta, dir: itemDir}, function(result){
    if(result && result.rateLimited){
      // 429 — pause the whole queue 60s, keep this job at the head, do NOT count the attempt
      job.attempts = Math.max(0, job.attempts - 1);
      console.log('[QUEUE] Rate limited on SKU', sku, '- pausing queue 60s then retrying');
      queueProcessing = false;
      setTimeout(processQueue, QUEUE_RATELIMIT_PAUSE_MS);
      return;
    }
    if(result && result.error){
      if(job.attempts >= QUEUE_MAX_RETRIES){
        listingQueue.shift();
        failedItems[sku] = {sku: sku, attempts: job.attempts, error: result.error, at: new Date().toISOString()};
        console.log('[QUEUE] SKU', sku, 'FAILED after', job.attempts, 'attempts:', result.error);
      } else {
        console.log('[QUEUE] SKU', sku, 'attempt', job.attempts, 'failed:', result.error, '- will retry');
      }
      queueProcessing = false;
      setTimeout(processQueue, QUEUE_GAP_MS);
      return;
    }
    // Success
    loadListings();
    lastCompletedSku = sku;
    listingQueue.shift();
    delete failedItems[sku];
    console.log('[QUEUE] Completed SKU', sku, '| pending', listingQueue.length);
    queueProcessing = false;
    setTimeout(processQueue, QUEUE_GAP_MS); // 8s gap between API calls
  });
}

// Feature 3: scan ALL submitted photos for a scale reading + reference-object dimensions
function detectWeightAndDims(photoB64Array, callback){
  if(!photoB64Array || photoB64Array.length === 0){ callback(null); return; }
  var content = [];
  photoB64Array.slice(0,8).forEach(function(b64, i){
    content.push({type:'text', text:'Photo '+(i+1)+':'});
    content.push({type:'image', source:{type:'base64', media_type:'image/jpeg', data:b64}});
  });
  // FIX 2A: format-based scale prompt — read the two large numbers (LB | OZ) directly.
  // The dimensions request is preserved so the processor flow is unaffected.
  content.push({type:'text', text:[
    'Look at all photos and find any photo showing a postal or shipping scale display. The display will show two large bold numbers side by side with unit labels:',
    '- Left large number = POUNDS (may have small "LB" or "lb" label)',
    '- Right large number = OUNCES (may have small "OZ" or "oz" label)',
    'The numbers will be significantly larger than any other text on the display. Ignore brand names, small text, buttons, and background.',
    'Examples of what you might see:',
    '- "2" on left with "LB", "3.8" on right with "OZ" = 2 lb 3.8 oz',
    '- "0" on left with "LB", "12.4" on right with "OZ" = 0 lb 12.4 oz',
    '- "8" on left with "LB", "5.0" on right with "OZ" = 8 lb 5.0 oz',
    'A bright reference object (a tape measure / ruler affixed to the table) may also be visible for size estimation.',
    'Return ONLY a JSON object with no other text:',
    '{',
    '  "lbs": left number as integer, or null,',
    '  "oz": right number as decimal, or null,',
    '  "display_reading": exactly what display shows e.g. "2lb 3.8oz", or null,',
    '  "confidence": "high" | "medium" | "low",',
    '  "weight_photo_index": 1-based index of the photo showing the scale (0 if none),',
    '  "has_reference": true if a tape measure / ruler reference object is visible,',
    '  "dimensions": {"l": length_inches, "w": width_inches, "h": height_inches} estimated via the reference object (0 if cannot determine)',
    '}',
    'If you cannot clearly see a scale display with two numbers and unit labels return: { "lbs": null, "oz": null, "display_reading": null, "confidence": "low" }',
    'Do not guess. Only return values you can clearly read.'
  ].join('\n')});
  callClaude({ model:'claude-sonnet-4-5', max_tokens:512, messages:[{role:'user', content:content}] }, function(err, resp){
    if(err || !resp){ callback(null); return; }
    var data = extractFirstJson(extractText(resp.content));
    if(!data){ callback(null); return; }
    var dims = null;
    if(data.dimensions){
      var dl = parseFloat(data.dimensions.l || data.dimensions.length) || 0;
      var dw = parseFloat(data.dimensions.w || data.dimensions.width) || 0;
      var dh = parseFloat(data.dimensions.h || data.dimensions.height) || 0;
      if(dl && dw && dh) dims = {l:dl, w:dw, h:dh};
    }
    // Confidence gate: only trust the reading at medium/high confidence with a real value.
    // Weight is kept as native lbs/oz — never converted to total ounces.
    var conf = String(data.confidence || '').toLowerCase();
    var rawLbs = (data.lbs === null || data.lbs === undefined) ? null : (parseInt(data.lbs, 10));
    var rawOz  = (data.oz  === null || data.oz  === undefined) ? null : (parseFloat(data.oz));
    var trusted = (conf === 'medium' || conf === 'high') && rawLbs !== null && !isNaN(rawLbs) && rawOz !== null && !isNaN(rawOz) && (rawLbs > 0 || rawOz > 0);
    callback({
      lbs: trusted ? rawLbs : null,
      oz: trusted ? rawOz : null,
      display_reading: (data.display_reading === undefined ? null : data.display_reading),
      confidence: conf || 'low',
      weight_photo_index: parseInt(data.weight_photo_index, 10) || 0,
      has_reference: !!data.has_reference,
      dimensions: dims
    });
  });
}

function processItem(item, callback) {
  var meta = item.meta;
  var itemDir = item.dir;
  var sku = meta.sku;
  var quantity = (meta.quantity && meta.quantity > 1) ? meta.quantity : 1;

  // Load first photo for identification
  var photo1Path = path.join(itemDir, 'photo_1.jpg');
  if(!fs.existsSync(photo1Path)) {
    callback({sku:sku, meta:meta, error:'No photos found'});
    return;
  }

  var photo1B64 = fs.readFileSync(photo1Path).toString('base64');

  // Count photos on disk
  var photoCount = 0;
  while(fs.existsSync(path.join(itemDir, 'photo_'+(photoCount+1)+'.jpg'))) photoCount++;

  console.log('[BATCH] Processing SKU', sku, 'with', photoCount, 'photos (Sonnet)');

  var extractedWeight = meta.weight || null;

  // ── Step 1: identification ──
  function withVision(visionData){
    var itemName = visionData.item_name || 'Unknown item';
    var claudeGrade = visionData.claude_grade || null;

    // Grade conflict only when Claude proposes a different letter grade
    var gradeConflict = null;
    if(claudeGrade && meta.grade && String(claudeGrade).toUpperCase() !== String(meta.grade).toUpperCase()) {
      gradeConflict = {processor: meta.grade, claude: String(claudeGrade).toUpperCase()};
    }

    var customSku = String(meta.sku) + (meta.shelf ? '-' + meta.shelf : '');
    var weightNote = extractedWeight ? extractedWeight : (meta.weight || 'Not recorded');
    var gradeLabel = gradeConflict ? gradeConflict.claude+' (processor said '+gradeConflict.processor+')' : (meta.grade||'B');
    var isBroken = (meta.grade==='D' || meta.powerTest==='Fail');

    // Parts/repair (Feature 4)
    var idItem = meta.identified_item || {};
    var partsRepairDemand = !!idItem.parts_repair_demand;
    var partsRepairPrice = parseInt(idItem.parts_repair_price, 10) || 0;
    var isPartsRepair = (meta.grade==='D' || meta.powerTest==='Fail') && partsRepairDemand;

    // Change 4: prefer the eBay-confirmed category from the identifier step (findCompletedItems)
    var confirmedCategoryId = null;
    if (meta.identified_item && meta.identified_item.ebay_category_id && meta.identified_item.category_confirmed === true) {
      confirmedCategoryId = meta.identified_item.ebay_category_id;
      console.log('[LISTING] SKU', sku, '— using confirmed category', confirmedCategoryId, '(', meta.identified_item.ebay_category_name, ')');
    }

    // Shipping (Feature 3) — derived from the tier result when a weight was read,
    // otherwise the legacy estimator (unknown weight -> GA, flagged for manual entry).
    var shipInfo;
    if(meta.shipping_tier){
      var _t = meta.shipping_tier;
      shipInfo = { shipping_policy: shippingPolicyName(_t.shippingPolicyId), shipping_profile_id: String(_t.shippingPolicyId),
        listed_weight: _t.finalLbs, listed_weight_unit: 'lbs', box_dimensions: _t.boxSize, polymailer: false };
    } else {
      shipInfo = calcShipping(meta.weightOz, meta.dimensions, {});
    }

    // Output photo ordering (Features 1 & 3): main first, testing photo at position 2,
    // remaining details after, weight photo excluded entirely.
    var weightIdx = meta.weightPhotoIndex || null;
    var mains = [];
    for(var mp=1; mp<=photoCount; mp++){ if(mp !== weightIdx) mains.push('photo_'+mp); }
    // FIX 1: testing photos (working proof) are merged into the listing photo set after the
    // first overview photo and before the remaining detail photos. They upload to eBay like
    // any listing photo; only the scale/weight photo is excluded.
    var outputPhotos = [];
    if(mains.length) outputPhotos.push(mains[0]);
    var _testStems = (meta.testingPhotos||[]).map(function(f){ return String(f).replace(/\.jpg$/i,''); });
    _testStems.forEach(function(s){ outputPhotos.push(s); });
    for(var mk=1; mk<mains.length; mk++) outputPhotos.push(mains[mk]);
    if(_testStems.length) console.log('[LISTING] SKU ' + sku + ' merged ' + _testStems.length + ' testing photos into listing photos');

    // Power test phrasing (FEATURE 2 — N/A handling)
    var powerLabel;
    if(meta.powerTest === 'N/A' || meta.powerTest === 'NA') {
      powerLabel = (meta.identified_item && meta.identified_item.sealed) ?
        'Sealed in original packaging — untested' : 'Not applicable';
    } else {
      powerLabel = meta.powerTest || 'Pass';
    }

    // Combine test notes + additional notes
    var combinedNotes = [meta.test_notes||'', meta.notes||''].filter(function(s){return s && s.trim();}).join(' | ') || 'None';

    var promptLines = [
      'You are an experienced eBay seller writing listings for an e-waste resale business based in Clovis, CA.',
      'Use the web_search tool to look up eBay completed/sold listings for accurate pricing on this item before you answer.',
      'Write in an honest, specific tone. Do not include pricing in the buyer-facing description.',
      'Grade guide: A=like new, B=good normal wear, C=heavy cosmetic wear, D=parts only does not work.',
      '',
      'Item: '+itemName,
      'Brand: '+(visionData.brand||'See label'),
      'Model: '+(visionData.model||'See label'),
      'Grade: '+gradeLabel,
      'Power Test: '+powerLabel,
      'Weight: '+weightNote,
      'Notes from processor: '+combinedNotes,
      'Condition notes from photo: '+(visionData.condition_notes||'See photos'),
      'Custom SKU for eBay: '+customSku
    ];

    // FIX 5: force the model to enumerate every visible accessory/cable/adapter/included item
    promptLines.push('Carefully examine ALL photos to identify every accessory, cable, adapter, power supply, remote, manual, or included item visible. List ALL included accessories explicitly in both the title (if space allows) and the description. If a power supply or adapter is visible in any photo, it MUST be mentioned as included. Do not miss accessories — buyers make purchase decisions based on what is included.');

    // FIX 1: if the processor notes imply a specific condition, tell the AI so the
    // condition_box / description match what will actually be listed on eBay.
    var notesCond = notesToConditionId(combinedNotes);
    if(notesCond){
      promptLines.push('Condition hint from processor notes: this item should be described as "' + notesCond.name + '" (eBay condition ' + notesCond.id + '). Write the condition_box and description to match this exact condition — do not contradict it.');
    }

    if(quantity > 1){
      promptLines.push('');
      promptLines.push('This is a multi-quantity listing of '+quantity+' identical items.');
      promptLines.push('Title MUST start with: Lot of '+quantity);
      promptLines.push('Price is PER UNIT — multiply by quantity for total value.');
      promptLines.push('Description must clearly state: Listing is for '+quantity+' identical units.');
      promptLines.push('Photos show a representative unit — buyer receives same quality or better.');
      // FIX 4: surface available quantity to the description
      promptLines.push('This listing has '+quantity+' units available. Mention the quantity naturally in the description.');
    }

    if((meta.identified_item && (meta.identified_item.estimated_low||meta.identified_item.estimated_high))){
      promptLines.push('');
      promptLines.push('Pre-scan estimate (reference only): $'+(meta.identified_item.estimated_low||'?')+' - $'+(meta.identified_item.estimated_high||'?')+'. Verify with real eBay sold data.');
    }

    // Feature 7 — weight/shipping, category, new/unused language, parts/repair
    promptLines.push('');
    promptLines.push('Weight: ' + (meta.weight || 'not recorded'));
    promptLines.push('Shipping policy: ' + shipInfo.shipping_policy);
    promptLines.push('Listed weight: ' + (shipInfo.listed_weight != null ? shipInfo.listed_weight + ' ' + shipInfo.listed_weight_unit : 'to be confirmed'));
    promptLines.push('Box dimensions: ' + (shipInfo.box_dimensions || 'to be confirmed'));
    promptLines.push('Return the most specific eBay LEAF category ID for this item. Do not return parent/broad categories. Examples of correct leaf categories: 177 (PC Laptops), 9355 (Cell Phones), 182091 (Enterprise Network Switches), 80258 (IP/VoIP Business Phones), 14969 (Home Audio Equipment). Always use the most specific subcategory available. Include category_id in the JSON.');
    if(confirmedCategoryId){
      promptLines.push('Confirmed eBay category from completed sold listings: ' + (meta.identified_item.ebay_category_name || '') + ' (ID: ' + confirmedCategoryId + '). Use this exact category_id in your JSON response. Generate item_specifics appropriate for this category.');
    }
    promptLines.push('Title: include brand, model number, key descriptive terms, and a condition hint. Format: [Brand] [Model] [Type] [Key Feature] [Condition]. Example: "Cisco WS-C2960-24TT-L 24-Port Network Switch Used Working". Max 80 characters; front-load the most important search terms.');
    if(meta.powerTest === 'N/A' && (idItem.sealed || meta.grade === 'A')){
      promptLines.push('This item is NEW/UNUSED — NEVER use the word "untested". Use new/unused language such as "New, unused — original sealed packaging", "New, unused — opened for inspection only", or "New old stock — unused, may show storage wear on packaging".');
    }
    if(isPartsRepair){
      promptLines.push('This item FAILED testing but has parts/repair demand. Title MUST include "For Parts or Repair" or "As-Is". Use parts/repair pricing around $'+partsRepairPrice+'. Include a clear AS-IS banner in the description.');
    }
    promptLines.push('Return an item_specifics object with key-value pairs for common eBay item specifics for this item type. Include: Brand, Model, MPN (model number), Type, Compatible Brand (if applicable), Features, Color, Connectivity, Form Factor, and any other specifics relevant to this item category. Use exact values eBay accepts — no vague descriptions.');
    promptLines.push('Populate the REQUIRED item specifics for this item\'s category (use the best-matching list below):');
    promptLines.push('- Business phones (VoIP / desk phones): Brand, Model, MPN, Type, Compatible Brand, Number of Lines, Connectivity, Color, Condition');
    promptLines.push('- Network switches / routers: Brand, Model, MPN, Type, Number of Ports, Connectivity, Transfer Rate, Compatible Brand, Form Factor');
    promptLines.push('- Audio equipment: Brand, Model, MPN, Type, Connectivity, Color, Features, Compatible Brand');
    promptLines.push('- Video equipment: Brand, Model, MPN, Type, Resolution, Connectivity, Color, Compatible Brand');
    promptLines.push('- Business / Industrial electronics: Brand, Model, MPN, Type, Compatible Brand, Features, Color, Form Factor');
    promptLines.push('Every value must be SPECIFIC and ACCURATE for this exact item — never vague (e.g. use "8 Ports" not "Multiple", "Gigabit Ethernet" not "Fast"). Omit a field only if it genuinely does not apply.');
    promptLines.push('Each item specific VALUE must be 65 characters or less. Features MUST be returned as an array of individual short strings — NEVER a comma-separated string — with each feature a short phrase of at most 10 words. Example: "Features":["Noise Cancellation","Wireless","Magnetic Clip","App Control"]. Never exceed 65 characters in any single value.');
    promptLines.push('Include these fields in the JSON: shipping_policy, listed_weight, listed_weight_unit, box_dimensions, shipping_profile_id, polymailer, category_id, parts_repair, item_specifics.');

    promptLines = promptLines.concat([
      '',
      'For description_html use this exact HTML structure:',
      '<div style="font-family:Arial,sans-serif;max-width:700px;margin:0 auto;color:#222;font-size:14px;line-height:1.6;">',
      (isBroken ? '<div style="background:#c62828;color:#fff;font-weight:bold;text-align:center;padding:10px;font-size:15px;border-radius:4px;margin-bottom:16px;">&#9888; SOLD AS-IS - FOR PARTS OR REPAIR ONLY - NO RETURNS &#9888;</div>' : ''),
      '<p><strong>You are purchasing a [ITEM NAME AND MODEL].</strong> [1-2 sentence honest condition summary'+(quantity>1?', and clearly state this is a lot of '+quantity+' identical units':'')+'].</p>',
      '<br>',
      '<table width="100%" cellpadding="6" cellspacing="0" style="border-collapse:collapse;font-size:13px;">',
      '  [Table rows for: Brand, Model, Condition (1-3 words only like "Good - Normal Wear" or "Parts/Not Working"), Power Test, '+(quantity>1?'Quantity ('+quantity+' units), ':'')+'Includes (brief like "Unit only" or "Complete set with accessories"), Ships From: Clovis CA]',
      '  [Each row format: <tr><td width="30%" style="border:1px solid #ddd;padding:6px;font-weight:bold;vertical-align:top;">Label</td><td style="border:1px solid #ddd;padding:6px;vertical-align:top;">Value</td></tr>]',
      '  [Keep table cell values short — no wrapping text. Alternate rows with background #f5f5f5]',
      '</table>',
      '<br>',
      '<div style="background:#fff8e1;border-left:4px solid #f9a825;padding:10px 14px;font-size:13px;color:#5d4037;border-radius:2px;">',
      '<strong>&#9888; Important:</strong> [Honest 1-2 sentence buyer note about condition and returns policy]',
      '</div>',
      '</div>',
      '',
      'Search eBay sold listings then return ONLY this JSON, no markdown'+(quantity>1?' (avg_sold_price and prices are PER UNIT)':'')+':',
      '{"title":"eBay title under 80 chars'+(quantity>1?', starts with Lot of '+quantity:'')+' with brand model key terms","condition_box":"2-3 honest sentences for eBay condition field","description_html":"completed HTML using structure above","avg_sold_price":45,"price_low":30,"price_high":65,"suggested_price":48,"accept_price":38,"decline_price":28,"shipping":"FedEx Ground","item_specifics":{"Brand":"value","Model":"value","MPN":"value","Type":"value","Features":["short value under 65 chars","another short value"]},"custom_sku":"'+customSku+'"}'
    ]);

    // FIX 2: required-aspects fetch gates the listing-generation AI (see below)
    function runListingClaude(){
    var listingPrompt = promptLines.join('\n');

    // ── Step 2: listing write with web_search ──
    callClaude({
      model: 'claude-sonnet-4-5',
      max_tokens: 2500,
      tools: [{type:'web_search_20250305', name:'web_search', max_uses:5}],
      messages:[{role:'user', content: listingPrompt}]
    }, function(err2, resp2) {
      // Rate limited — do not save a fallback listing; signal the queue to pause + retry
      if(isClaudeRateLimited(resp2)){ callback({sku:sku, meta:meta, rateLimited:true}); return; }
      var listing = {};
      var listingText = resp2 ? extractText(resp2.content) : '';
      var parsedListing = extractFirstJson(listingText);
      if(parsedListing){
        listing = parsedListing;
      } else {
        listing = {title: itemName, condition_box: 'See photos', description_html: '<p>'+itemName+'</p>', avg_sold_price:0, custom_sku:customSku};
      }
      if(!listing.custom_sku) listing.custom_sku = customSku;

      // Attach authoritative shipping fields (server-computed — Features 3 & 7)
      listing.shipping_policy = shipInfo.shipping_policy;
      listing.shipping_profile_id = shipInfo.shipping_profile_id;
      listing.listed_weight = shipInfo.listed_weight;
      listing.listed_weight_unit = shipInfo.listed_weight_unit;
      listing.box_dimensions = shipInfo.box_dimensions;
      listing.polymailer = !!shipInfo.polymailer;
      listing.category_id = parseInt(listing.category_id, 10) || 0;
      if(confirmedCategoryId){ listing.category_id = confirmedCategoryId; } // confirmed eBay category wins
      // eBay item specifics (Feature: auto-population) — ensure a plain object
      if(!listing.item_specifics || typeof listing.item_specifics !== 'object' || Array.isArray(listing.item_specifics)) listing.item_specifics = {};
      // FIX 3: serial number removed from listings entirely — strip any serial key the AI returned
      Object.keys(listing.item_specifics).forEach(function(k){ if(/^serial(\s|_)?(number|no\.?|#)?$/i.test(String(k).trim()) || /^s\/?n$/i.test(String(k).trim())){ delete listing.item_specifics[k]; } });
      // Seed Brand/Model/MPN from vision data when the model left them blank
      if(!listing.item_specifics.Brand && visionData.brand) listing.item_specifics.Brand = visionData.brand;
      if(!listing.item_specifics.Model && visionData.model) listing.item_specifics.Model = visionData.model;
      if(!listing.item_specifics.MPN && visionData.model) listing.item_specifics.MPN = visionData.model;
      listing.parts_repair = isPartsRepair || !!listing.parts_repair;
      if(isPartsRepair && partsRepairPrice > 0){
        listing.suggested_price = listing.suggested_price || partsRepairPrice;
        if(!/parts|as-?is|repair/i.test(listing.title || '')){
          listing.title = ((listing.title ? listing.title + ' ' : '') + '- For Parts or Repair').slice(0, 80);
        }
      }

      // Mark processed
      meta.processed = true;
      meta.processedAt = new Date().toISOString();
      fs.writeFileSync(path.join(itemDir, 'meta.json'), JSON.stringify(meta, null, 2));

      var avg = listing.avg_sold_price || 0;
      var result = {
        sku: sku,
        meta: meta,
        visionData: visionData,
        listing: listing,
        gradeConflict: gradeConflict,
        weight: extractedWeight,
        quantity: quantity,
        photoCount: photoCount,
        outputPhotos: outputPhotos,
        dimensions: meta.dimensions || null,
        testingPhotos: meta.testingPhotos || [],
        weightPhotoIndex: weightIdx,
        noWeightFlag: !!meta.noWeightFlag,
        partsRepair: listing.parts_repair,
        partsRepairDemand: partsRepairDemand,
        shippingInfo: shipInfo,
        shipping_tier: meta.shipping_tier || null,
        belowThreshold: avg > 0 && avg < MIN_THRESHOLD,
        threshold: MIN_THRESHOLD,
        generatedAt: meta.processedAt
      };

      // FIX 3: persist listing.json per item so listings survive /tmp wipes
      try { fs.writeFileSync(path.join(itemDir, 'listing.json'), JSON.stringify(result, null, 2)); }
      catch(e){ console.log('[LISTING] write error:', e.message); }

      callback(result);
    });
    }
    // FIX 2: when a category is confirmed, fetch its REQUIRED item aspects and inject them
    // into the listing-generation prompt before calling the AI. Any failure -> proceed normally.
    if(confirmedCategoryId){
      getEbayToken(function(tErr, token){
        if(tErr || !token){ runListingClaude(); return; }
        getItemAspectsForCategory(confirmedCategoryId, token, function(_aErr, requiredAspects){
          if(requiredAspects && requiredAspects.length){
            promptLines.push('Required eBay item specifics for this category that MUST be included in item_specifics: ' + requiredAspects.join(', ') + '. These are mandatory — do not omit them.');
          }
          runListingClaude();
        });
      });
    } else {
      runListingClaude();
    }
  }

  // Runs identification (pre-identified shortcut OR Sonnet vision), then withVision
  function runIdentify(){
    if(meta.identified_item && meta.identified_item.item_name){
      var idi = meta.identified_item;
      console.log('[BATCH] SKU', sku, 'using pre-identified item:', idi.item_name);
      withVision({
        item_name: idi.item_name,
        brand: idi.brand || '',
        model: idi.model || '',
        category: idi.category || '',
        serial_number: 'Not visible',
        condition_notes: 'See photos',
        claude_grade: null
      });
      return;
    }
    callClaude({
      model: 'claude-sonnet-4-5',
      max_tokens: 1024,
      messages:[{role:'user',content:[
        {type:'image', source:{type:'base64', media_type:'image/jpeg', data:photo1B64}},
        {type:'text',text:'You are an expert electronics appraiser creating eBay listings for an e-waste resale business. Examine this image and identify the item with precision. Return ONLY a JSON object, no markdown, with: item_name (full descriptive name with brand and model), brand, model, serial_number (if visible), category (eBay category path), claude_grade (your own assessment: A=like new, B=normal used, C=heavy wear, D=parts/untested), condition_notes (honest description of what you observe).'}
      ]}]
    }, function(err1, resp1) {
      var visionData = {};
      if(!err1 && resp1){
        var vt = extractText(resp1.content);
        visionData = extractFirstJson(vt) || {item_name: (vt||'').trim().slice(0,100) || 'Unknown item SKU '+sku};
      } else {
        visionData = {item_name: 'Unknown item SKU '+sku};
      }
      withVision(visionData);
    });
  }

  // FIX 1: the scale photo is always captured LAST. Sending all 12+ photos caused the scale
  // to be missed, so send ONLY the last photo for scale OCR. The last photo is always excluded
  // from eBay upload (weight photo) whether or not a reading was found.
  var lastIdx = photoCount;
  var scalePhotoB64 = [];
  if(lastIdx > 0){
    try { scalePhotoB64.push(fs.readFileSync(path.join(itemDir,'photo_'+lastIdx+'.jpg')).toString('base64')); } catch(e){}
    console.log('[WEIGHT] SKU ' + sku + ' reading scale from last photo (photo ' + lastIdx + ')');
  }

  // Step 0: detect weight + dimensions from the last photo, then identify + write listing
  detectWeightAndDims(scalePhotoB64, function(winfo){
    // store weight natively as lbs/oz and run calculateShippingTier (never total oz)
    if(winfo && winfo.lbs !== null && winfo.lbs !== undefined && (winfo.lbs > 0 || winfo.oz > 0)){
      meta.dimensions = winfo.dimensions || null;
      var tier = calculateShippingTier(winfo.lbs, winfo.oz, sku);
      meta.weightLbs = tier.rawLbs;
      meta.weightOzPart = tier.rawOz;
      meta.weight = tier.rawLbs + 'lb ' + tier.rawOz + 'oz';
      extractedWeight = meta.weight;
      meta.shipping_tier = tier;
      meta.noWeightFlag = false;
      console.log('[WEIGHT] SKU ' + sku + ' scale reading: ' + tier.rawLbs + 'lb ' + tier.rawOz + 'oz (confidence: ' + (winfo.confidence || '?') + ')');
    } else {
      meta.dimensions = (winfo && winfo.dimensions) ? winfo.dimensions : null;
      meta.shipping_tier = null;
      meta.noWeightFlag = true;
      console.log('[WEIGHT] SKU ' + sku + ' no scale reading — flagged for manual entry');
    }
    // the last captured photo is always the scale/weight photo — excluded from eBay upload
    meta.weightPhotoIndex = lastIdx > 0 ? lastIdx : null;
    if(!meta.dimensions) meta.dimsFlag = true;
    runIdentify();
  });
}

// ── eBay TRADING API (AddItem) — creates a live FixedPriceItem listing ──
function xmlEscape(s){
  return String(s == null ? '' : s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&apos;');
}
// Make a string safe to embed inside a CDATA section by breaking any "]]>" sequence
function cdataSafe(s){ return String(s == null ? '' : s).replace(/]]>/g, ']]]]><![CDATA[>'); }
function parseXmlTag(xml, tag){
  if(!xml) return null;
  var m = xml.match(new RegExp('<' + tag + '(?:\\s[^>]*)?>([\\s\\S]*?)<\\/' + tag + '>'));
  return m ? m[1] : null;
}
function parseXmlAll(xml, tag){
  if(!xml) return [];
  var re = new RegExp('<' + tag + '(?:\\s[^>]*)?>([\\s\\S]*?)<\\/' + tag + '>', 'g');
  var out = [], m;
  while((m = re.exec(xml)) !== null) out.push(m[1]);
  return out;
}
// Parse eBay XML <Errors> blocks into human-readable messages
function parseEbayErrors(xml){
  return parseXmlAll(xml || '', 'Errors').map(function(e){
    var msg = parseXmlTag(e, 'LongMessage') || parseXmlTag(e, 'ShortMessage') || 'Unknown error';
    var code = parseXmlTag(e, 'ErrorCode') || '';
    return (code ? ('[' + code + '] ') : '') + msg;
  });
}
function ebayErrorCodes(xml){ return parseXmlAll(xml || '', 'ErrorCode'); }

// POST an XML body to the Trading API (api.dll).
// The Trading API requires the auth token INSIDE the XML body (RequesterCredentials),
// not just in the Authorization header — otherwise it returns error 930. We inject it
// right after the opening <...Request> element for every Trading call.
function ebayTradingCall(callName, xmlBody, token, callback){
  var creds = '<RequesterCredentials><eBayAuthToken>' + xmlEscape(token) + '</eBayAuthToken></RequesterCredentials>';
  if(xmlBody.indexOf('<RequesterCredentials>') === -1){
    xmlBody = xmlBody.replace(/(<[A-Za-z]+Request\b[^>]*>)/, '$1' + creds);
  }
  var options = {
    hostname: EBAY_BASE.replace('https://', ''),
    path: '/ws/api.dll',
    method: 'POST',
    headers: {
      'X-EBAY-API-CALL-NAME': callName,
      'X-EBAY-API-SITEID': '0',
      'X-EBAY-API-APP-NAME': EBAY_APP_ID,
      'X-EBAY-API-DEV-NAME': EBAY_DEV_ID,
      'X-EBAY-API-CERT-NAME': EBAY_CERT_ID,
      'X-EBAY-API-COMPATIBILITY-LEVEL': '967',
      'Content-Type': 'text/xml',
      'Authorization': 'Bearer ' + token,
      'Content-Length': Buffer.byteLength(xmlBody)
    }
  };
  var req = https.request(options, function(res){
    var data = ''; res.on('data', function(c){ data += c; });
    res.on('end', function(){ callback(null, res.statusCode, data); });
  });
  req.on('error', function(e){ callback(e); });
  req.write(xmlBody); req.end();
}

// Flat shipping cost estimated from the listing's calculated listed weight
function estimateShipCost(listing){
  var w = parseFloat(listing.listed_weight) || 0;
  var unit = String(listing.listed_weight_unit || 'oz').toLowerCase();
  var lbs = unit === 'lbs' ? w : (w / 16);
  var cost = 8 + Math.max(0, lbs) * 0.8; // $8 base + $0.80/lb
  return (Math.round(cost * 100) / 100).toFixed(2);
}

// ItemSpecifics XML — name <=65, each value <=65, long values split on commas
function buildItemSpecificsXml(spec){
  spec = spec || {};
  var aspects = {};
  Object.keys(spec).forEach(function(k){
    var v = spec[k];
    if(v === null || v === undefined || v === '') return;
    // FIX 3: never send serial number as an item specific (handles older records too)
    var kt = String(k).trim();
    if(/^serial(\s|_)?(number|no\.?|#)?$/i.test(kt) || /^s\/?n$/i.test(kt)) return;
    aspects[k] = Array.isArray(v) ? v.map(String) : [String(v)];
  });
  aspects = trimAspects(aspects); // splits on commas + spaces, 65-char cap, dedupes
  var keys = Object.keys(aspects);
  if(!keys.length) return '';
  var xml = '<ItemSpecifics>';
  keys.forEach(function(k){
    xml += '<NameValueList><Name>' + xmlEscape(String(k).slice(0,65)) + '</Name>';
    aspects[k].forEach(function(v){ xml += '<Value>' + xmlEscape(String(v).slice(0,65)) + '</Value>'; });
    xml += '</NameValueList>';
  });
  return xml + '</ItemSpecifics>';
}

// Build the AddItem XML. opts: {categoryId, conditionId, pictureUrls}
function buildAddItemXml(record, opts){
  opts = opts || {};
  var listing = record.listing || {};
  var meta = record.meta || {};
  var sku = record.sku;
  var title = String(listing.title || ('SKU ' + sku)).slice(0, 80); // truncate title to 80
  var desc = cdataSafe(listing.description_html || listing.condition_box || ('<p>' + xmlEscape(title) + '</p>'));
  var categoryId = opts.categoryId || listing.category_id || 293;
  var price = listing.suggested_price || listing.avg_sold_price || 0;
  var condId = opts.conditionId || conditionIdForCategory(meta.grade, categoryId, listing.parts_repair);
  var condDesc = (listing.condition_box && listing.condition_box.trim()) ? listing.condition_box : ('Grade ' + (meta.grade || 'B') + ' - used, tested. See photos.');
  // FIX 4: quantity may be set on the listing record (PATCH /api/listings/:sku) or meta
  var qty = parseInt(listing.quantity || record.quantity || meta.quantity || 1, 10) || 1;
  if(qty < 1) qty = 1;
  var customSku = listing.custom_sku || String(sku);
  var shipCost = estimateShipCost(listing);
  // FIX 2: weight + box come from the stored shipping tier (native lbs/oz) when available.
  // eBay requires WeightMajor (lbs) + WeightMinor (oz); never send total ounces (error 717).
  var tier = record.shipping_tier || null;
  var wLbs, wOz, dimXml = '';
  if(tier && typeof tier.finalLbs === 'number'){
    wLbs = tier.finalLbs; wOz = tier.finalOz;
    console.log('[EBAY] SKU ' + sku + ' weight (tier ' + tier.tier + '): ' + wLbs + 'lb ' + wOz + 'oz');
    if(tier.boxSize){
      var bp = String(tier.boxSize).split('x');
      if(bp.length === 3){
        dimXml = '<PackageDepth unit="inches">' + xmlEscape(bp[2]) + '</PackageDepth>'
               + '<PackageLength unit="inches">' + xmlEscape(bp[0]) + '</PackageLength>'
               + '<PackageWidth unit="inches">' + xmlEscape(bp[1]) + '</PackageWidth>';
        console.log('[EBAY] SKU ' + sku + ' box: ' + tier.boxSize + 'in');
      }
    }
  } else {
    // Legacy fallback: derive lbs/oz from listed_weight, round up over 1 lb; dims from record
    var lwUnit = String(listing.listed_weight_unit || 'oz').toLowerCase();
    var lwVal = parseFloat(listing.listed_weight) || 0;
    var totalOz = Math.round(lwUnit.indexOf('lb') >= 0 ? lwVal * 16 : lwVal);
    wLbs = Math.floor(totalOz / 16);
    wOz = totalOz % 16;
    if(wLbs >= 1 && wOz > 0){ wLbs = wLbs + 1; wOz = 0; }
    console.log('[EBAY] SKU ' + sku + ' weight: ' + totalOz + 'oz → ' + wLbs + 'lb ' + wOz + 'oz');
    var dims = record.dimensions || meta.dimensions || (listing && listing.dimensions) || null;
    var dimL = dims && (dims.l || dims.length), dimW = dims && (dims.w || dims.width), dimH = dims && (dims.h || dims.height);
    if(dimL || dimW || dimH){
      if(dimH) dimXml += '<PackageDepth unit="inches">' + xmlEscape(dimH) + '</PackageDepth>';
      if(dimL) dimXml += '<PackageLength unit="inches">' + xmlEscape(dimL) + '</PackageLength>';
      if(dimW) dimXml += '<PackageWidth unit="inches">' + xmlEscape(dimW) + '</PackageWidth>';
      console.log('[EBAY] SKU ' + sku + ' dimensions: ' + (dimL || '?') + 'x' + (dimW || '?') + 'x' + (dimH || '?') + 'in');
    }
  }
  var packageXml = '<ShippingPackageDetails>'
    + '<WeightMajor unit="lbs">' + wLbs + '</WeightMajor>'
    + '<WeightMinor unit="oz">' + wOz + '</WeightMinor>'
    + dimXml
    + '<ShippingIrregular>false</ShippingIrregular>'
    + '</ShippingPackageDetails>';
  var picXml = (opts.pictureUrls && opts.pictureUrls.length)
    ? '<PictureDetails>' + opts.pictureUrls.map(function(u){ return '<PictureURL>' + xmlEscape(u) + '</PictureURL>'; }).join('') + '</PictureDetails>'
    : '';
  // Business policies (SellerProfiles) when available — required when the seller has
  // opted into business policies (error 21919456). Otherwise use legacy shipping/return.
  // FIX 2: return policy by grade — Grade D = AS IS No Returns, all others = Free 30 Day Returns
  var gradeVal = String(record.grade || listing.grade || meta.grade || '').toUpperCase();
  var returnId = (gradeVal === 'D') ? '272360861015' : '272360797015';
  console.log('[EBAY] SKU ' + sku + ' grade ' + (gradeVal || '?') + ' → return policy ' + returnId);
  var policies = opts.policies;
  var shippingBlock;
  if(policies && policies.fulfillment_id && policies.payment_id && policies.return_id){
    var shipId = (tier && tier.shippingPolicyId) ? String(tier.shippingPolicyId)
      : ((policies.shipping_map && policies.shipping_map[listing.shipping_policy]) || policies.fulfillment_id);
    shippingBlock = '<SellerProfiles>'
      + '<SellerShippingProfile><ShippingProfileID>' + xmlEscape(shipId) + '</ShippingProfileID></SellerShippingProfile>'
      + '<SellerReturnProfile><ReturnProfileID>' + xmlEscape(returnId) + '</ReturnProfileID></SellerReturnProfile>'
      + '<SellerPaymentProfile><PaymentProfileID>' + xmlEscape(policies.payment_id) + '</PaymentProfileID></SellerPaymentProfile>'
      + '</SellerProfiles>';
  } else {
    shippingBlock = '<ShippingDetails>'
      + '<ShippingType>Flat</ShippingType>'
      + '<ShippingServiceOptions>'
      + '<ShippingServicePriority>1</ShippingServicePriority>'
      + '<ShippingService>USPSPriority</ShippingService>'
      + '<ShippingServiceCost currencyID="USD">' + shipCost + '</ShippingServiceCost>'
      + '</ShippingServiceOptions>'
      + '</ShippingDetails>'
      + '<ShipToLocations>US</ShipToLocations>'
      + '<ReturnPolicy><ReturnsAcceptedOption>ReturnsNotAccepted</ReturnsAcceptedOption></ReturnPolicy>';
  }
  // Revise an existing listing (duplicate-SKU recovery) vs. create a new one
  var rootTag = opts.reviseItemId ? 'ReviseFixedPriceItemRequest' : 'AddItemRequest';
  var itemIdXml = opts.reviseItemId ? ('<ItemID>' + xmlEscape(opts.reviseItemId) + '</ItemID>') : '';
  return '<?xml version="1.0" encoding="utf-8"?>'
    + '<' + rootTag + ' xmlns="urn:ebay:apis:eBLBaseComponents">'
    + '<Item>'
    + itemIdXml
    + '<Title>' + xmlEscape(title) + '</Title>'
    + '<Description><![CDATA[' + desc + ']]></Description>'
    + '<PrimaryCategory><CategoryID>' + xmlEscape(categoryId) + '</CategoryID></PrimaryCategory>'
    + '<StartPrice currencyID="USD">' + xmlEscape(price) + '</StartPrice>'
    + '<BestOfferDetails><BestOfferEnabled>true</BestOfferEnabled></BestOfferDetails>'
    + '<ConditionID>' + condId + '</ConditionID>'
    + '<ConditionDescription>' + xmlEscape(condDesc) + '</ConditionDescription>'
    + '<Country>US</Country>'
    + '<Currency>USD</Currency>'
    + '<DispatchTimeMax>1</DispatchTimeMax>'
    + '<ListingDuration>GTC</ListingDuration>'
    + '<ListingType>FixedPriceItem</ListingType>'
    + '<Location>Clovis, CA</Location>'
    + '<PostalCode>93612</PostalCode>'
    + '<Quantity>' + qty + '</Quantity>'
    + '<SKU>' + xmlEscape(customSku) + '</SKU>'
    + buildItemSpecificsXml(listing.item_specifics)
    + picXml
    + packageXml
    + shippingBlock
    + '</Item>'
    + '</' + rootTag + '>';
}

// POST a multipart Trading API call (XML payload + base64 image) to api.dll
function ebayTradingMultipart(callName, xmlPayload, imageBuffer, token, callback){
  var creds = '<RequesterCredentials><eBayAuthToken>' + xmlEscape(token) + '</eBayAuthToken></RequesterCredentials>';
  if(xmlPayload.indexOf('<RequesterCredentials>') === -1){
    xmlPayload = xmlPayload.replace(/(<[A-Za-z]+Request\b[^>]*>)/, '$1' + creds);
  }
  var boundary = 'XRTMIMEBOUNDARY' + imageBuffer.length;
  // multipart/form-data with the RAW image binary (not base64): XML part, then image part
  var pre = '--' + boundary + '\r\n'
    + 'Content-Disposition: form-data; name="XML Payload"\r\n'
    + 'Content-Type: text/xml;charset=utf-8\r\n\r\n'
    + xmlPayload + '\r\n'
    + '--' + boundary + '\r\n'
    + 'Content-Disposition: form-data; name="image"; filename="image.jpg"\r\n'
    + 'Content-Type: application/octet-stream\r\n\r\n';
  var post = '\r\n--' + boundary + '--\r\n';
  var body = Buffer.concat([ Buffer.from(pre, 'utf8'), imageBuffer, Buffer.from(post, 'utf8') ]);
  var options = {
    hostname: EBAY_BASE.replace('https://', ''),
    path: '/ws/api.dll',
    method: 'POST',
    headers: {
      'X-EBAY-API-CALL-NAME': callName,
      'X-EBAY-API-SITEID': '0',
      'X-EBAY-API-APP-NAME': EBAY_APP_ID,
      'X-EBAY-API-DEV-NAME': EBAY_DEV_ID,
      'X-EBAY-API-CERT-NAME': EBAY_CERT_ID,
      'X-EBAY-API-COMPATIBILITY-LEVEL': '967',
      'Content-Type': 'multipart/form-data;boundary=' + boundary,
      'Authorization': 'Bearer ' + token,
      'Content-Length': body.length
    }
  };
  var req = https.request(options, function(res){
    var data = ''; res.on('data', function(c){ data += c; });
    res.on('end', function(){ callback(null, res.statusCode, data); });
  });
  req.on('error', function(e){ callback(e); });
  req.write(body); req.end();
}

// Upload one photo to eBay via the Media API — TWO-STEP flow. eBay's create_image_from_url
// only returns an API resource URI in the Location header; using that URI directly as a
// PictureURL causes AddItem error 10124. We must then call getImage to obtain the real EPS
// (i.ebayimg.com) URL. Uses the OAuth Bearer token; never reads the local file.
//   STEP 1: POST create_image_from_url -> image_id (last segment of the Location header)
//   STEP 2: GET image/{image_id}       -> response.imageUrl (the EPS URL to use as PictureURL)
function uploadPhotoToEbay(sku, stem, token, callback){
  var photoUrl = EBAY_PHOTO_BASE + '/api/photo/' + sku + '/' + stem;
  var bodyStr = JSON.stringify({ imageUrl: photoUrl });
  var options = {
    hostname: 'apim.ebay.com',
    path: '/commerce/media/v1_beta/image/create_image_from_url',
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + token,
      'Content-Type': 'application/json',
      'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
      'Content-Length': Buffer.byteLength(bodyStr)
    }
  };
  var req = https.request(options, function(resp){
    var d = ''; resp.on('data', function(c){ d += c; });
    resp.on('end', function(){
      // STEP 1 result: the image resource id is the last path segment of the Location header
      // (https://apim.ebay.com/commerce/media/v1_beta/image/{image_id}).
      var loc = (resp.headers && resp.headers.location) ? String(resp.headers.location) : '';
      var imageId = loc ? loc.split('?')[0].split('/').filter(Boolean).pop() : '';
      if(!imageId){ try { var cj = d ? JSON.parse(d) : {}; imageId = cj.imageId || (cj.image && cj.image.imageId) || ''; } catch(e){} }
      if(!(resp.statusCode >= 200 && resp.statusCode < 300) || !imageId){
        callback(new Error('createImageFromUrl HTTP ' + resp.statusCode + (d ? (': ' + String(d).slice(0, 300)) : '')));
        return;
      }
      // STEP 2: resolve the image id to its EPS (i.ebayimg.com) URL via getImage
      getEbayImageEps(imageId, token, callback);
    });
  });
  req.on('error', function(e){ callback(e); });
  req.write(bodyStr); req.end();
}

// STEP 2 helper: GET the image resource and return its EPS imageUrl (https://i.ebayimg.com/...).
function getEbayImageEps(imageId, token, callback){
  var options = {
    hostname: 'apim.ebay.com',
    path: '/commerce/media/v1_beta/image/' + encodeURIComponent(imageId),
    method: 'GET',
    headers: {
      'Authorization': 'Bearer ' + token,
      'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US'
    }
  };
  var req = https.request(options, function(resp){
    var d = ''; resp.on('data', function(c){ d += c; });
    resp.on('end', function(){
      var imageUrl = '';
      try { var j = d ? JSON.parse(d) : {}; imageUrl = j.imageUrl || (j.image && j.image.imageUrl) || ''; } catch(e){}
      if(resp.statusCode >= 200 && resp.statusCode < 300 && imageUrl){
        console.log('[EBAY] photo EPS URL: ' + imageUrl);
        callback(null, imageUrl);
        return;
      }
      callback(new Error('getImage HTTP ' + resp.statusCode + (d ? (': ' + String(d).slice(0, 300)) : '')));
    });
  });
  req.on('error', function(e){ callback(e); });
  req.end();
}

// Upload all output photos as base64 (weight photo already excluded from outputPhotos).
// Skips photos missing on disk; falls back to our served photo URL if an upload fails.
function uploadAllPhotos(record, sku, token, callback){
  var dir = path.join(DATA_DIR, 'items', String(sku));
  var stems = (record.outputPhotos && record.outputPhotos.length) ? record.outputPhotos.slice() : [];
  if(!stems.length && fs.existsSync(path.join(dir, 'photo_1.jpg'))) stems = ['photo_1'];
  // keep only stems that actually exist on disk (handles 0-photo case gracefully)
  stems = stems.filter(function(s){ return fs.existsSync(path.join(dir, String(s).replace(/\.jpg$/i,'') + '.jpg')); });
  var urls = [], i = 0;
  function next(){
    if(i >= stems.length){ callback(null, urls); return; }
    var stem = stems[i];
    var serverUrl = EBAY_PHOTO_BASE + '/api/photo/' + sku + '/' + stem;
    uploadPhotoToEbay(sku, stem, token, function(err, cdnUrl){
      if(!err && cdnUrl){
        urls.push(cdnUrl);
        console.log('[EBAY] photo uploaded to CDN:', cdnUrl);
      } else {
        urls.push(serverUrl); // fall back to our server URL so a failed upload never blocks AddItem
        console.log('[EBAY] Media API failed for ' + serverUrl + ': ' + (err ? err.message : 'no imageUrl returned'));
      }
      // FIX 1 rate limit: 150ms between Media API calls (eBay allows 50 per 5s)
      setTimeout(function(){ i++; next(); }, 150);
    });
  }
  next();
}

// Ask eBay for the best LEAF category for an item title (GetSuggestedCategories).
// Returns the highest PercentItemFound match -> {id, name, percent}. Guarantees a leaf.
function getSuggestedCategory(title, token, callback){
  var xml = '<?xml version="1.0" encoding="utf-8"?>'
    + '<GetSuggestedCategoriesRequest xmlns="urn:ebay:apis:eBLBaseComponents">'
    + '<Query>' + xmlEscape(String(title || '').slice(0, 350)) + '</Query>'
    + '</GetSuggestedCategoriesRequest>';
  ebayTradingCall('GetSuggestedCategories', xml, token, function(err, sc, body){
    if(err){ callback(err); return; }
    var ack = parseXmlTag(body, 'Ack') || '';
    var cats = parseXmlAll(body, 'SuggestedCategory').map(function(s){
      return { id: parseXmlTag(s, 'CategoryID'), name: parseXmlTag(s, 'CategoryName'), pct: parseFloat(parseXmlTag(s, 'PercentItemFound')) || 0 };
    }).filter(function(c){ return c.id; });
    cats.sort(function(a, b){ return b.pct - a.pct; }); // highest percentage match first
    if((ack === 'Success' || ack === 'Warning') && cats.length){
      callback(null, cats); // full ranked list — caller validates each is a leaf
      return;
    }
    callback(new Error('GetSuggestedCategories Ack=' + (ack || '?') + ': ' + (parseEbayErrors(body).join('; ') || ('HTTP ' + sc))));
  });
}

// GetCategoryFeatures -> { leaf: bool, conditions: ['1000','3000',...] } for a category
function getCategoryFeatures(categoryId, token, callback){
  var xml = '<?xml version="1.0" encoding="utf-8"?>'
    + '<GetCategoryFeaturesRequest xmlns="urn:ebay:apis:eBLBaseComponents">'
    + '<CategoryID>' + xmlEscape(categoryId) + '</CategoryID>'
    + '<DetailLevel>ReturnAll</DetailLevel>'
    + '<FeatureID>ConditionValues</FeatureID>'
    + '</GetCategoryFeaturesRequest>';
  ebayTradingCall('GetCategoryFeatures', xml, token, function(err, sc, body){
    if(err){ callback(err); return; }
    var ack = parseXmlTag(body, 'Ack') || '';
    var leaf = String(parseXmlTag(body, 'LeafCategory') || '').toLowerCase() === 'true';
    var cvBlock = parseXmlTag(body, 'ConditionValues') || '';
    var ids = parseXmlAll(cvBlock, 'Condition').map(function(c){ return (parseXmlTag(c, 'ID') || '').trim(); }).filter(Boolean);
    if(ack === 'Success' || ack === 'Warning'){ callback(null, {leaf: leaf, conditions: ids}); return; }
    callback(new Error('GetCategoryFeatures Ack=' + (ack || '?')));
  });
}
// Choose a valid condition ID for the grade, constrained to the category's allowed set
function pickValidCondition(grade, partsRepair, validIds){
  var prefByGrade = { A:[1000,1500,2000,2500,3000], B:[3000,2500,2000,4000,5000,1000], C:[5000,6000,3000,4000,7000], D:[7000,6000,5000] };
  var pref = partsRepair ? [7000,6000,5000] : (prefByGrade[grade] || [3000,5000,1000]);
  if(validIds && validIds.length){
    for(var i = 0; i < pref.length; i++){ if(validIds.indexOf(String(pref[i])) >= 0) return parseInt(pref[i], 10); }
    return parseInt(validIds[0], 10); // any valid condition the category accepts
  }
  return conditionIdForCategory(grade, null, partsRepair);
}
// FIX 1: map keywords in the processor notes field to an eBay condition ID. Returns
// {id, name} or null. Never throws — caller only uses the result if it is valid for the category.
function notesToConditionId(notes){
  var s = String(notes || '').toLowerCase();
  if(!s.trim()) return null;
  try {
    if(/for parts|parts only|not working/.test(s)) return { id: 7000, name: 'For parts or not working' };
    if(/open box/.test(s)) return { id: 1500, name: 'New: Open Box' };            // covers "new open box"
    if(/like new/.test(s)) return { id: 1500, name: 'New: Open Box' };            // closest match
    if(/refurbished|seller refurbished/.test(s)) return { id: 2500, name: 'Seller Refurbished' };
    if(/new sealed|factory sealed|sealed/.test(s)) return { id: 1000, name: 'New' };
    if(/\bnew\b/.test(s)) return { id: 1000, name: 'New' };                       // "new" alone
  } catch(e){}
  return null;
}
// Required + recommended item-specific names for a category (GetCategorySpecifics)
function getCategorySpecifics(categoryId, token, callback){
  var xml = '<?xml version="1.0" encoding="utf-8"?>'
    + '<GetCategorySpecificsRequest xmlns="urn:ebay:apis:eBLBaseComponents">'
    + '<CategoryID>' + xmlEscape(categoryId) + '</CategoryID>'
    + '</GetCategorySpecificsRequest>';
  ebayTradingCall('GetCategorySpecifics', xml, token, function(err, sc, body){
    if(err){ callback(err); return; }
    var ack = parseXmlTag(body, 'Ack') || '';
    var required = [], recommended = [];
    parseXmlAll(body, 'NameRecommendation').forEach(function(rc){
      var name = parseXmlTag(rc, 'Name'); if(!name) return;
      var minv = parseInt(parseXmlTag(rc, 'MinValues') || '0', 10);
      if(minv >= 1) required.push(name); else recommended.push(name);
    });
    if(ack === 'Success' || ack === 'Warning'){ callback(null, {required: required, recommended: recommended}); return; }
    callback(new Error('GetCategorySpecifics Ack=' + (ack || '?')));
  });
}

// FIX 2: REQUIRED item aspects for a category via the modern Taxonomy API (OAuth Bearer,
// same token as the Browse API). Returns an array of required aspect names. Never throws —
// callback(null, []) on any error so the listing/posting flow always continues.
function getItemAspectsForCategory(categoryId, token, callback){
  var done = false;
  function finish(arr){ if(done) return; done = true; callback(null, arr || []); }
  if(!categoryId || !token){ finish([]); return; }
  var pathUrl = '/commerce/taxonomy/v1/category_tree/0/get_item_aspects_for_category?category_id=' + encodeURIComponent(categoryId);
  var options = {
    hostname: EBAY_BASE.replace('https://', ''),
    path: pathUrl,
    method: 'GET',
    headers: {
      'Authorization': 'Bearer ' + token,
      'Content-Type': 'application/json',
      'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US'
    }
  };
  var req = https.request(options, function(resp){
    var d = ''; resp.on('data', function(c){ d += c; });
    resp.on('end', function(){
      try {
        var j = JSON.parse(d);
        var aspects = Array.isArray(j.aspects) ? j.aspects : [];
        var required = aspects.filter(function(a){
          return a && a.aspectConstraint && a.aspectConstraint.aspectRequired === true;
        }).map(function(a){ return a.localizedAspectName || a.name; }).filter(Boolean);
        console.log('[ASPECTS] Category ' + categoryId + ' requires: ' + required.join(', '));
        finish(required);
      } catch(e){ console.log('[ASPECTS] Category ' + categoryId + ' parse error:', e.message); finish([]); }
    });
  });
  req.on('error', function(e){ console.log('[ASPECTS] Category ' + categoryId + ' request error:', e.message); finish([]); });
  req.end();
}

// ── eBay Browse API (OAuth) — confirm category from real eBay listings via a 3-level
// cascade (exact model -> brand+type -> type only) with majority-vote category selection.
// The legacy Finding API (svcs.ebay.com) was decommissioned by eBay; Browse is the modern
// equivalent. Pricing stays with the existing Gemini web-search fallback for now.
// Never throws: callback(null, null) on any failure so the caller can fall back.
function findCompletedItemsCategory(itemName, appId, callback){
  getEbayToken(function(tErr, token){
    if(tErr || !token){ console.log('[BROWSE API] no eBay token — cannot query Browse API:', tErr ? tErr.message : 'none'); callback(null, null); return; }

    function search(keywords, done){
      if(!keywords || !String(keywords).trim()){ done(null); return; }
      var path = '/buy/browse/v1/item_summary/search?q=' + encodeURIComponent(keywords) + '&limit=20&fieldgroups=EXTENDED';
      var options = {
        hostname: EBAY_BASE.replace('https://', ''),
        path: path,
        method: 'GET',
        headers: {
          'Authorization': 'Bearer ' + token,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US'
        }
      };
      var fullUrl = 'https://' + options.hostname + options.path;
      console.log('[BROWSE API] Request URL:', fullUrl);
      var req = https.request(options, function(resp){
        var d = ''; resp.on('data', function(c){ d += c; });
        resp.on('end', function(){
          try {
            var j = JSON.parse(d);
            var itemSummaries = Array.isArray(j.itemSummaries) ? j.itemSummaries : [];
            done(itemSummaries);
          } catch(e){
            console.log('[BROWSE API] Parse error — HTTP', resp.statusCode, '— Content-Type:', (resp.headers && resp.headers['content-type']) || 'n/a');
            console.log('[BROWSE API] Raw response body (first 1500 chars):', String(d).slice(0, 1500));
            done(null);
          }
        });
      });
      req.on('error', function(e){ console.log('[BROWSE API] Request error:', e.message); done(null); });
      req.end();
    }
    // Majority-vote the leaf category across the returned item summaries
    function majorityCategory(items){
      var counts = {}, names = {}, fromLeaf = {};
      items.forEach(function(it){
        try {
          var cats = (it.categories && it.categories.length) ? it.categories : [];
          var lastCat = cats.length ? cats[cats.length - 1] : null;
          // Prefer the dedicated leafCategoryIds[0]; fall back to the last (leaf-most) categories entry
          var leafId = (it.leafCategoryIds && it.leafCategoryIds[0]) ? it.leafCategoryIds[0] : null;
          var id = leafId || (lastCat ? lastCat.categoryId : null);
          var nm = '';
          for(var ci = 0; ci < cats.length; ci++){ if(cats[ci].categoryId === id){ nm = cats[ci].categoryName; break; } }
          if(!nm && lastCat){ nm = lastCat.categoryName; }
          if(id){ counts[id] = (counts[id]||0) + 1; names[id] = nm || names[id] || ''; if(leafId){ fromLeaf[id] = true; } }
        } catch(e){}
      });
      var best = null, bestN = 0;
      Object.keys(counts).forEach(function(id){ if(counts[id] > bestN){ bestN = counts[id]; best = id; } });
      return best ? { id: best, name: names[best] || '', ebay_confirmed_leaf: fromLeaf[best] === true } : null;
    }
    function stripModel(name){ return String(name||'').split(/\s+/).filter(function(t){ return !/^[A-Za-z]{0,3}[\d][\w\-]{1,}$/.test(t); }).join(' ').trim(); }
    function typeOnly(name){ var t = String(name||'').split(/\s+/).filter(Boolean); return t.slice(Math.max(0, t.length - 3)).join(' ').trim(); }

    var q1 = String(itemName || '').trim();
    search(q1, function(items1){
      console.log('[IDENTIFY] Level 1 search "' + q1 + '" returned ' + (items1 ? items1.length : 0) + ' results');
      var cat1 = items1 && items1.length ? majorityCategory(items1) : null;
      if(cat1){ callback(null, { category_id: cat1.id, category_name: cat1.name, search_level: 1, price_reliable: false, sold_count: items1.length, source: 'ebay_browse', ebay_confirmed_leaf: cat1.ebay_confirmed_leaf === true }); return; }
      var q2 = stripModel(q1);
      search(q2, function(items2){
        console.log('[IDENTIFY] Level 2 search "' + q2 + '" returned ' + (items2 ? items2.length : 0) + ' results');
        var cat2 = items2 && items2.length ? majorityCategory(items2) : null;
        if(cat2){ callback(null, { category_id: cat2.id, category_name: cat2.name, search_level: 2, price_reliable: false, sold_count: items2.length, source: 'ebay_browse', ebay_confirmed_leaf: cat2.ebay_confirmed_leaf === true }); return; }
        var q3 = typeOnly(q2);
        search(q3, function(items3){
          console.log('[IDENTIFY] Level 3 search "' + q3 + '" returned ' + (items3 ? items3.length : 0) + ' results');
          var cat3 = items3 && items3.length ? majorityCategory(items3) : null;
          if(cat3){ callback(null, { category_id: cat3.id, category_name: cat3.name, search_level: 3, price_reliable: false, sold_count: items3.length, source: 'ebay_browse', ebay_confirmed_leaf: cat3.ebay_confirmed_leaf === true }); return; }
          console.log('[IDENTIFY] All levels exhausted for "' + itemName + '" — no eBay Browse listings found');
          callback(null, null);
        });
      });
    });
  });
}

// Confirm an eBay category is a LEAF (listable) before posting. Never throws.
function validateLeafCategory(categoryId, callback){
  getEbayToken(function(tErr, token){
    if(tErr || !token){ console.log('[VALIDATE] Category', categoryId, 'leaf check: false (no token)'); callback(null, false); return; }
    getCategoryFeatures(categoryId, token, function(fErr, feat){
      var isLeaf = !!(feat && feat.leaf === true);
      console.log('[VALIDATE] Category', categoryId, 'leaf check:', isLeaf);
      callback(null, isLeaf);
    });
  });
}

// Create a live eBay listing via Trading API AddItem (with error-recovery retries)
function createEbayListing(sku, callback){
  var itemDir = path.join(DATA_DIR, 'items', String(sku));
  var listingPath = path.join(itemDir, 'listing.json');
  if(!fs.existsSync(listingPath)){ callback(new Error('Listing not found for SKU ' + sku)); return; }
  var record; try { record = JSON.parse(fs.readFileSync(listingPath, 'utf8')); } catch(e){ callback(new Error('Bad listing.json')); return; }
  record.sku = record.sku || Number(sku);

  // Auto-truncate an over-long title to 80 chars up front (eBay hard limit) so it
  // never blocks listing — the spec calls for auto-truncate, not rejection.
  if(record.listing && record.listing.title && String(record.listing.title).length > 80){
    record.listing.title = String(record.listing.title).slice(0, 80);
    console.log('[EBAY] title over 80 chars — auto-truncated before listing');
  }

  // Pre-flight validation (price >0, aspect values <=65; title already truncated)
  var problems = validateForPublish(record);
  if(problems){ callback(new Error('Cannot list — fix these first: ' + problems.join(' '))); return; }

  getEbayToken(function(tErr, token){
    if(tErr){ callback(tErr); return; }
    // Upload photos to eBay CDN first (weight photo already excluded from outputPhotos)
    uploadAllPhotos(record, sku, token, function(upErr, cdnUrls){
      var pictureUrls = cdnUrls || []; // photo failures fell back to server URLs
      var listing = record.listing || {};
      if(!pictureUrls.length){
        record.photo_warning = 'No photos available — listing submitted without images (eBay requires at least 1).';
        console.log('[EBAY] WARNING: SKU', sku, 'has 0 photos — submitting without images');
      }
      var policies = readEbayPolicies();
      var condFallbacks = [ 3000, 1000 ];                            // invalid condition -> 3000, then 1000
      var condIdx = -1, titleTrunc = false, refreshed = false, triedPolicies = false, reviseId = null, triedLeafFallback = false;
      // Category + condition resolved via eBay APIs below (guarantees valid leaf + condition).
      var categoryId = listing.category_id || 183446;
      var forcedCondition = null; // from GetCategoryFeatures
      var meta = record.meta || {};

      function attempt(){
        var opts = {
          pictureUrls: pictureUrls,
          categoryId: categoryId,
          conditionId: condIdx >= 0 ? condFallbacks[condIdx] : (forcedCondition || null),
          policies: policies,
          reviseItemId: reviseId
        };
        var xml = buildAddItemXml(record, opts);
        var callName = reviseId ? 'ReviseFixedPriceItem' : 'AddItem';
        ebayTradingCall(callName, xml, token, function(e, sc, body){
          if(e){ callback(e); return; }
          // 401 -> refresh OAuth token once and retry
          if(sc === 401 && !refreshed){
            refreshed = true;
            console.log('[EBAY] AddItem 401 — refreshing token and retrying');
            refreshEbayToken(function(rErr, nt){ if(!rErr && nt) token = nt; attempt(); });
            return;
          }
          var ack = parseXmlTag(body, 'Ack') || '';
          var itemId = parseXmlTag(body, 'ItemID') || reviseId;
          console.log('[EBAY]', callName, 'SKU', sku, '| http', sc, '| Ack', ack, '| ItemID', itemId);
          // ISSUE 1: when eBay rejects, log every error it returned (code + short + long message)
          if(ack !== 'Success'){
            parseXmlAll(body, 'Errors').forEach(function(er){
              var ec = parseXmlTag(er, 'ErrorCode') || '?';
              var sm = parseXmlTag(er, 'ShortMessage') || '';
              var lm = parseXmlTag(er, 'LongMessage') || '';
              console.log('[EBAY] AddItem error ' + ec + ': ' + sm + ' — ' + lm);
            });
          }
          if((ack === 'Success' || ack === 'Warning') && itemId){
            record.ebay_item_id = itemId;
            record.ebay_listing_url = 'https://www.ebay.com/itm/' + itemId;
            record.ebay_offer_status = 'ACTIVE';
            record.listed_at = new Date().toISOString();
            try { fs.writeFileSync(listingPath, JSON.stringify(record, null, 2)); } catch(_e){}
            callback(null, {item_id: itemId, listing_url: record.ebay_listing_url});
            return;
          }
          var msgs = parseEbayErrors(body);
          var blob = (msgs.join(' ') + ' ' + ebayErrorCodes(body).join(' ')).toLowerCase();
          // Seller opted into business policies -> fetch policies and retry with SellerProfiles
          if((/business polic|opted in|seller profile|21919456/.test(blob)) && !triedPolicies){
            triedPolicies = true;
            console.log('[EBAY] seller uses business policies — fetching policy IDs and retrying with SellerProfiles');
            fetchEbayPolicies(function(pe, pol){ if(!pe && pol) policies = pol; attempt(); });
            return;
          }
          // Category not a leaf (error 87) — rare since GetSuggestedCategories returns leaves.
          // Single fallback to 183446 (confirmed leaf, accepts all condition IDs).
          if((/category|not a leaf|\b87\b/.test(blob)) && String(categoryId) !== '183446' && !triedLeafFallback){
            triedLeafFallback = true;
            console.log('[EBAY] CATEGORY ERROR for SKU', sku, '- category', categoryId,
              'rejected (' + (msgs.join('; ') || ('code ' + ebayErrorCodes(body).join(','))) + ') — falling back to 183446');
            categoryId = 183446;
            attempt(); return;
          }
          // Condition invalid for category -> retry 3000, then 1000
          if(/condition/.test(blob) && condIdx < condFallbacks.length - 1){
            condIdx++;
            console.log('[EBAY] condition invalid — retrying with condition ID', condFallbacks[condIdx]);
            attempt(); return;
          }
          // Title too long -> truncate to 80 and retry
          if(/title/.test(blob) && !titleTrunc){
            titleTrunc = true;
            record.listing.title = String(record.listing.title || '').slice(0, 80);
            console.log('[EBAY] title too long — truncating to 80 and retrying');
            attempt(); return;
          }
          // Duplicate SKU / existing listing -> revise the existing ItemID instead of creating new
          if((/duplicate|already have|already a listing|21919067|37|already exist/.test(blob)) && !reviseId && record.ebay_item_id){
            reviseId = record.ebay_item_id;
            console.log('[EBAY] duplicate SKU — switching to ReviseFixedPriceItem for ItemID', reviseId);
            attempt(); return;
          }
          callback(new Error('eBay ' + callName + ' failed: ' + (msgs.join(' | ') || ('HTTP ' + sc))));
        });
      }

      // ── Resolve a LEAF category with valid conditions ──
      // GetSuggestedCategories returns a ranked list. For each (max 5), call
      // GetCategoryFeatures to confirm it's a LEAF (LeafCategory=true) and read its
      // valid ConditionIDs. Use the first leaf found; if none in 5, fall back to 183446.
      function finalizeCategory(catId, catName, conditions){
        categoryId = catId;
        record.ebay_category_id = catId;
        record.ebay_category_name = catName;
        if(conditions && conditions.length){
          record.ebay_valid_conditions = conditions;
          forcedCondition = pickValidCondition(meta.grade, listing.parts_repair, conditions);
        }
        // FIX 1: prefer a condition matched from the processor notes keywords, but only when it
        // is valid for this category; otherwise keep the grade-derived default. Never blocks.
        try {
          var noteText = [listing.notes, record.notes, meta.notes, meta.test_notes].filter(Boolean).join(' ');
          var km = notesToConditionId(noteText);
          if(km){
            if(conditions && conditions.length && conditions.indexOf(String(km.id)) >= 0){
              forcedCondition = km.id;
              console.log('[EBAY] SKU ' + sku + ' notes keyword matched condition ' + km.id + ' (' + km.name + ')');
            } else {
              console.log('[EBAY] SKU ' + sku + ' keyword condition ' + km.id + ' not valid for category — using default');
            }
          }
        } catch(e){}
        console.log('[EBAY] category resolved for SKU', sku, '->', catId, '(' + catName + ') | leaf | conditions', (conditions||[]).join(',') || 'n/a', '| using condition', forcedCondition);
        // Required item specifics for this category -> add any missing with "Not Specified"
        getCategorySpecifics(catId, token, function(spErr, specs){
          if(!spErr && specs){
            record.ebay_required_specifics = specs.required;
            var is = record.listing.item_specifics = record.listing.item_specifics || {};
            var have = Object.keys(is).map(function(k){ return k.toLowerCase(); });
            specs.required.forEach(function(name){
              if(have.indexOf(String(name).toLowerCase()) < 0){ is[name] = 'Not Specified'; }
            });
            if(specs.required.length) console.log('[EBAY] category', catId, 'required specifics:', specs.required.join(', '));
          }
          try { fs.writeFileSync(listingPath, JSON.stringify(record, null, 2)); } catch(_e){}
          // FIX 2: verify the category's required aspects (Taxonomy API) are present in
          // item_specifics. Warn only — never block; eBay returns a specific error if truly required.
          getItemAspectsForCategory(catId, token, function(_aErr, requiredAspects){
            if(requiredAspects && requiredAspects.length){
              var isObj = record.listing.item_specifics || {};
              var haveKeys = Object.keys(isObj).map(function(k){ return String(k).toLowerCase(); });
              var missing = requiredAspects.filter(function(name){ return haveKeys.indexOf(String(name).toLowerCase()) < 0; });
              if(missing.length){ console.log('[EBAY] SKU', sku, 'missing aspects:', missing.join(', ')); }
            }
            attempt();
          });
        });
      }
      function fallbackCategory(reason){
        console.log('[EBAY] SKU', sku, '- ' + reason + ' — falling back to 183446 (Other Consumer Electronics)');
        getCategoryFeatures(183446, token, function(fe, feat){
          finalizeCategory(183446, 'Other Consumer Electronics (fallback)', (feat && feat.conditions) || []);
        });
      }
      // Change 5: prefer a confirmed/known category (prior attempt -> identifier -> AI),
      // leaf-validate it, and BLOCK with a structured error if it is not a leaf.
      var knownCat = record.ebay_category_id
        || (meta.identified_item && meta.identified_item.ebay_category_id)
        || (listing && listing.category_id)
        || null;
      var catSource = record.category_source
        || (meta.identified_item && meta.identified_item.category_source)
        || null;
      if(knownCat && catSource === 'ebay_browse'){
        // eBay's Browse API leafCategoryIds are leaf categories by definition — trust, skip validation.
        console.log('[EBAY] SKU', sku, 'using known category', knownCat, '(leaf confirmed by Browse API — skipping validation)');
        getCategoryFeatures(knownCat, token, function(fe, feat){
          var nm = record.ebay_category_name || (meta.identified_item && meta.identified_item.ebay_category_name) || '';
          finalizeCategory(knownCat, nm, (feat && feat.conditions) || []);
        });
        return;
      }
      if(knownCat){
        validateLeafCategory(knownCat, function(_kErr, isLeaf){
          if(isLeaf){
            console.log('[EBAY] SKU', sku, 'using known category', knownCat, '(leaf confirmed)');
            getCategoryFeatures(knownCat, token, function(fe, feat){
              var nm = record.ebay_category_name || (meta.identified_item && meta.identified_item.ebay_category_name) || '';
              finalizeCategory(knownCat, nm, (feat && feat.conditions) || []);
            });
          } else {
            console.log('[EBAY] SKU', sku, 'blocked — category', knownCat, 'is not a leaf');
            callback(null, { blocked: true, category_id: knownCat, needs_category_review: true,
              error: 'Category ' + knownCat + ' is not a leaf category and cannot be listed in. The item needs a more specific category. Open this listing to select the correct subcategory before posting.' });
          }
        });
        return;
      }
      getSuggestedCategory(record.listing.title, token, function(scErr, cats){
        if(scErr || !cats || !cats.length){ fallbackCategory(scErr ? ('GetSuggestedCategories failed: ' + scErr.message) : 'no suggestions'); return; }
        var i = 0, max = Math.min(5, cats.length); // max 5 attempts to find a leaf
        (function tryNext(){
          if(i >= max){ fallbackCategory('no leaf category in top ' + max + ' suggestions'); return; }
          var c = cats[i]; i++;
          getCategoryFeatures(c.id, token, function(fErr, feat){
            if(!fErr && feat && feat.leaf){
              console.log('[EBAY] suggested category', c.id, '(' + c.name + ', ' + c.pct + '%) confirmed LEAF');
              finalizeCategory(c.id, c.name, feat.conditions || []);
            } else {
              console.log('[EBAY] suggested category', c.id, '(' + c.name + ')', fErr ? ('error ' + fErr.message) : 'NOT a leaf', '— trying next suggestion');
              tryNext();
            }
          });
        })();
      });
    });
  });
}

// ── LISTINGS STORAGE (FIX 3) ──
// loadListings always scans item folders and assembles fresh from each
// items/[sku]/listing.json, then writes the listings.json cache. This means
// listings survive partial /tmp wipes as long as item folders exist.
function loadListings(){
  var itemsDir = path.join(DATA_DIR, 'items');
  var out = [];
  try {
    fs.readdirSync(itemsDir).forEach(function(f){
      var lp = path.join(itemsDir, f, 'listing.json');
      if(fs.existsSync(lp)){
        try { out.push(JSON.parse(fs.readFileSync(lp, 'utf8'))); } catch(e){}
      }
    });
  } catch(e){}
  out.sort(function(a,b){ return (b.sku||0) - (a.sku||0); });
  saveListings(out);
  return out;
}
function saveListings(listings){
  var lp = path.join(DATA_DIR, 'listings.json');
  try{ fs.writeFileSync(lp, JSON.stringify(listings)); }catch(e){ console.log('[SAVE] Error:',e.message); }
}
function rebuildListings(){
  var l = loadListings();
  console.log('[REBUILD] Assembled', l.length, 'listings from item folders');
  return l;
}

function sanitizeForFilename(s){
  return String(s||'').replace(/[^a-z0-9]+/gi,'-').replace(/^-+|-+$/g,'').slice(0,40) || 'item';
}

function generateListingsPage(listings, ebayStat){
  ebayStat = ebayStat || {connected:false};
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
    var skuStr = String(sku);
    var quantity = (r.quantity && r.quantity > 1) ? r.quantity : ((meta.quantity&&meta.quantity>1)?meta.quantity:1);
    var threshold = r.threshold || 30;
    var below = (r.belowThreshold) || (price > 0 && price < threshold);
    var partsRepair = r.partsRepair || listing.parts_repair;
    // BUG 2: detect listings with no recorded weight so we can offer manual entry
    // FIX 2: weight comes from the stored shipping tier (raw lbs/oz). Offer manual entry when missing.
    var wtier = r.shipping_tier || meta.shipping_tier || null;
    var hasWeight = !!(wtier && ((wtier.rawLbs||0) > 0 || (wtier.rawOz||0) > 0));
    var weightEntry = !hasWeight ?
      '<div style="background:#fff8e1;border-bottom:1px solid #f9a825;padding:8px 16px;font-size:12.5px;color:#8d6e00;display:flex;align-items:center;gap:8px;flex-wrap:wrap;">'
      +'<div style="width:100%;font-weight:bold;">&#9888; Scale reading (raw — packing added automatically):</div>'
      +'<input id="wtlb_'+skuStr+'" type="number" min="0" step="1" placeholder="lb" style="width:64px;padding:4px 6px;border:1px solid #f9a825;border-radius:4px;font-size:13px;"><span>lb</span>'
      +'<input id="wtoz_'+skuStr+'" type="number" min="0" step="0.1" placeholder="oz" style="width:64px;padding:4px 6px;border:1px solid #f9a825;border-radius:4px;font-size:13px;"><span>oz</span>'
      +'<button onclick="saveWeight(\''+skuStr+'\')" style="padding:5px 12px;border:none;border-radius:4px;cursor:pointer;font-size:12px;font-weight:bold;background:#f9a825;color:#fff;">Save Weight</button>'
      +'<span id="wtmsg_'+skuStr+'" style="font-weight:bold;"></span>'
      +'</div>' : '';

    // Output photos: weight photo excluded, testing photo at position 2 (Features 1 & 3)
    var stems = (r.outputPhotos && r.outputPhotos.length) ? r.outputPhotos.slice() : [];
    if(stems.length === 0){
      var pc = r.photoCount || meta.photoCount || 0;
      for(var sp=1; sp<=pc; sp++) stems.push('photo_'+sp);
    }
    // FIX 1: defensively merge any testing photos missing from older records — insert after the
    // first overview photo, before detail photos (dedupe so we never add one twice).
    var _tp = (r.testingPhotos || (meta && meta.testingPhotos) || []).map(function(f){ return String(f).replace(/\.jpg$/i,''); });
    if(_tp.length){
      var _have = {}; stems.forEach(function(s){ _have[String(s).replace(/\.jpg$/i,'')] = true; });
      var _missing = _tp.filter(function(s){ return !_have[s]; });
      if(_missing.length){ stems = stems.slice(0,1).concat(_missing, stems.slice(1)); }
    }
    var photoCount = stems.length;

    var conflictFlag = r.gradeConflict ?
      '<div style="background:#fff8e1;border-left:4px solid #f9a825;padding:8px 14px;font-size:13px;color:#5d4037;"><strong>&#9888; GRADE CONFLICT</strong> Processor: '+r.gradeConflict.processor+' | Claude: '+r.gradeConflict.claude+'. Claude grade applied.</div>' : '';

    var belowFlag = below ?
      '<div style="background:#fff8e1;border-bottom:1px solid #f9a825;padding:6px 16px;font-size:12.5px;color:#8d6e00;font-weight:bold;">&#9888; Below minimum threshold &mdash; $'+price+' estimated</div>' : '';

    var rawTitle = (listing.title) || (r.visionData&&r.visionData.item_name) || ('SKU '+sku);
    var displayTitle = (quantity > 1 ? 'LOT OF '+quantity+': ' : '') + rawTitle;
    var condBox = listing.condition_box || 'See photos.';
    var descHtml = listing.description_html || '<p>'+rawTitle+'</p>';
    var safeTitle = sanitizeForFilename(rawTitle);

    var qtyBadge = quantity > 1 ?
      '<span style="background:#2e7d32;color:#fff;padding:2px 8px;border-radius:4px;font-size:12px;font-weight:bold;">QTY: '+quantity+'</span>' : '';
    var partsBadge = partsRepair ?
      '<span style="background:#c62828;color:#fff;padding:2px 8px;border-radius:4px;font-size:12px;font-weight:bold;">PARTS/REPAIR</span>' : '';

    // Photo thumbnails + per-photo download buttons (weight photo excluded — Feature 8)
    var photoStrip = '';
    if(photoCount > 0){
      var thumbs = '';
      var dlBtns = '';
      for(var p=0;p<Math.min(photoCount,24);p++){
        var st = stems[p];
        var posLabel = (p===1 && st.indexOf('test_photo')===0) ? 'Test' : ('Photo '+(p+1));
        thumbs += '<div class="lp-thumb" data-sku="'+skuStr+'" data-stem="'+st+'" style="position:relative;flex:0 0 auto;cursor:grab;">'
          +'<div class="lp-grip" title="Drag to reorder" style="position:absolute;top:2px;left:2px;z-index:2;background:rgba(0,0,0,0.55);color:#fff;border-radius:3px;font-size:12px;line-height:1;padding:3px 5px;cursor:grab;">&#9776;</div>'
          +'<img src="/api/photo/'+skuStr+'/'+st+'" style="width:90px;height:90px;object-fit:cover;border-radius:6px;border:2px solid '+(st.indexOf("test_photo")===0?"#2e7d32":"#e0e0e0")+';cursor:pointer;" onclick="window.open(this.src)" title="Click to view full size">'
          +'<button class="thumb-del-btn" onclick="deletePhoto(\''+skuStr+'\',\''+st+'\',this)" title="Delete photo" style="position:absolute;top:-7px;right:-7px;width:22px;height:22px;border-radius:50%;border:none;background:#c62828;color:#fff;font-size:14px;font-weight:bold;line-height:1;cursor:pointer;box-shadow:0 1px 3px rgba(0,0,0,0.4);">&times;</button>'
          +'</div>';
        dlBtns += '<a href="/api/photo/'+skuStr+'/'+st+'" download="'+skuStr+'-'+safeTitle+'-photo'+(p+1)+'.jpg" style="padding:6px 12px;border:1px solid #1565c0;border-radius:4px;font-size:12px;font-weight:bold;background:#fff;color:#1565c0;text-decoration:none;">'+posLabel+'</a>';
      }
      var stemArr = '['+stems.map(function(s){return "'"+s+"'";}).join(',')+']';
      photoStrip = '<div style="font-size:11px;font-weight:bold;color:#888;letter-spacing:0.08em;text-transform:uppercase;margin-top:14px;margin-bottom:6px;">Photos ('+photoCount+') &middot; weight photo excluded &middot; drag &#9776; to reorder <span class="lp-order-msg" style="font-weight:bold;margin-left:8px;"></span></div>'
        +'<div class="lp-photostrip" style="display:flex;gap:10px;overflow-x:auto;padding:6px 2px 12px;margin-bottom:10px;">'+thumbs+'</div>'
        +'<div style="font-size:11px;font-weight:bold;color:#888;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:6px;">Download</div>'
        +'<div style="display:flex;gap:8px;flex-wrap:wrap;">'+dlBtns
        +'<button onclick="dlAll(\''+skuStr+'\','+stemArr+',\''+safeTitle+'\')" style="padding:6px 14px;border:none;border-radius:4px;font-size:12px;font-weight:bold;background:#1565c0;color:#fff;cursor:pointer;">Download All Photos</button>'
        +'</div>';
    }

    var perUnitTotal = quantity > 1 ?
      '<span><b>Per Unit:</b> $'+price+'</span><span><b>Total:</b> $'+(price*quantity)+'</span><span><b>Qty:</b> '+quantity+'</span>' : '';

    // Collapsible eBay details: category (name + ID) + item specifics (required marked)
    var spec = (listing.item_specifics && typeof listing.item_specifics === 'object') ? listing.item_specifics : {};
    // FIX 3: serial number is removed from output — never display it (handles older records too)
    var specKeys = Object.keys(spec).filter(function(k){ var t = String(k).trim(); return !(/^serial(\s|_)?(number|no\.?|#)?$/i.test(t) || /^s\/?n$/i.test(t)); });
    var catId = r.ebay_category_id || listing.category_id || '';
    var catName = r.ebay_category_name || '';
    var reqList = Array.isArray(r.ebay_required_specifics) ? r.ebay_required_specifics.map(function(n){ return String(n).toLowerCase(); }) : [];
    var detailRows = '';
    if(catId){
      detailRows += '<tr><td style="border:1px solid #e0e0e0;padding:5px 8px;font-weight:bold;width:35%;background:#eef5ff;">eBay Category</td><td style="border:1px solid #e0e0e0;padding:5px 8px;background:#eef5ff;">'+(catName?catName+' ':'')+'('+catId+')</td></tr>';
    }
    specKeys.forEach(function(k){
      var v = spec[k]; v = Array.isArray(v) ? v.join(', ') : v;
      var reqTag = reqList.indexOf(k.toLowerCase()) >= 0 ? ' <span style="color:#c62828;font-size:11px;">(required)</span>' : '';
      detailRows += '<tr><td style="border:1px solid #e0e0e0;padding:5px 8px;font-weight:bold;width:35%;background:#fafafa;">'+k+reqTag+'</td><td style="border:1px solid #e0e0e0;padding:5px 8px;">'+v+'</td></tr>';
    });
    var specHtml = '';
    if(detailRows){
      specHtml = '<details style="margin-top:12px;"><summary style="cursor:pointer;font-size:12px;font-weight:bold;color:#1565c0;letter-spacing:0.04em;">eBay Details &mdash; Category &amp; Item Specifics ('+specKeys.length+')</summary>'
        +'<table style="border-collapse:collapse;width:100%;font-size:12.5px;color:#444;margin-top:8px;">'+detailRows+'</table></details>';
    }

    // eBay publish button — always visible on every card (FIX 1). When already listed,
    // show the live-listing link; otherwise show "List on eBay" (posting logic unchanged —
    // /api/send-to-ebay reports "Connect eBay first" if not connected).
    var ebayBtn = '';
    if(r.ebay_item_id){
      ebayBtn = '<a href="'+(r.ebay_listing_url||('https://www.ebay.com/itm/'+r.ebay_item_id))+'" target="_blank" id="ebaybtn_'+skuStr+'" style="padding:8px 16px;border-radius:4px;font-size:13px;font-weight:bold;background:#2e7d32;color:#fff;text-decoration:none;">Listed &#10003;</a>';
    } else {
      ebayBtn = '<button id="ebaybtn_'+skuStr+'" onclick="listEbay(\''+skuStr+'\')" style="padding:8px 16px;border:none;border-radius:4px;cursor:pointer;font-size:13px;font-weight:bold;background:#0064d2;color:#fff;">List on eBay</button>';
    }

    // FIX 3: bulk-select checkbox — only on listings not yet posted to eBay
    var selectBox = !r.ebay_item_id ?
      '<input type="checkbox" class="bulkSel" value="'+skuStr+'" onchange="updateBulkCount()" style="width:18px;height:18px;cursor:pointer;flex:0 0 auto;" title="Select for bulk listing">' : '';

    return '<div id="card_'+skuStr+'" style="background:#fff;border-radius:6px;box-shadow:0 1px 4px rgba(0,0,0,0.15);margin-bottom:28px;overflow:hidden;">'
      +'<div style="background:'+headerColor+';color:#fff;padding:12px 16px;display:flex;align-items:center;gap:12px;flex-wrap:wrap;">'
      +selectBox
      +'<span style="background:rgba(255,255,255,0.25);border-radius:4px;padding:2px 8px;font-size:13px;font-weight:bold;">SKU '+skuStr+'</span>'
      +'<span style="font-size:15px;font-weight:bold;flex:1;">'+displayTitle+'</span>'
      +qtyBadge
      +partsBadge
      +'<span style="background:rgba(255,255,255,0.2);padding:2px 8px;border-radius:4px;font-size:12px;">Grade '+grade+'</span>'
      +'</div>'
      +belowFlag
      +conflictFlag
      +'<div style="background:#f5f5f5;border-bottom:1px solid #ddd;padding:8px 16px;font-size:12.5px;color:#444;display:flex;flex-wrap:wrap;gap:6px 18px;">'
      +'<span><b>Suggest:</b> $<span id="sug_'+skuStr+'" onclick="editSuggest(\''+skuStr+'\')" style="cursor:pointer;border-bottom:1px dashed #1565c0;color:#1565c0;" title="Click to edit listing price">'+suggest+'</span> <span id="sugmsg_'+skuStr+'" style="font-weight:bold;"></span></span>'
      +'<span><b>Accept:</b> $'+accept+'</span>'
      +'<span><b>Decline:</b> $'+decline+'</span>'
      +'<span><b>Shelf:</b> '+(meta.shelf||'&mdash;')+'</span>'
      +(wtier?('<span><b>Scale:</b> '+wtier.rawLbs+'lb '+wtier.rawOz+'oz &rarr; <b>Packed:</b> '+wtier.finalLbs+'lb '+wtier.finalOz+'oz</span>'):((r.weight||meta.weight)?'<span><b>Weight:</b> '+(r.weight||meta.weight)+'</span>':''))
      +'<span><b>Custom SKU:</b> '+(listing.custom_sku||(skuStr+(meta.shelf?'-'+meta.shelf:'')))+'</span>'
      +((r.ebay_category_id||listing.category_id)?'<span><b>eBay Category:</b> '+(r.ebay_category_name?r.ebay_category_name+' ':'')+'('+(r.ebay_category_id||listing.category_id)+')</span>':'')
      +(listing.shipping_policy?'<span><b>Ship:</b> '+listing.shipping_policy+'</span>':'')
      +(!wtier&&listing.listed_weight!=null?'<span><b>Listed Wt:</b> '+listing.listed_weight+' '+(listing.listed_weight_unit||'oz')+'</span>':'')
      +((wtier&&wtier.boxSize)?'<span><b>Box:</b> '+wtier.boxSize+'</span>':(listing.box_dimensions?'<span><b>Box:</b> '+listing.box_dimensions+'</span>':''))
      +perUnitTotal
      +(photoCount>0?'<span><b>Photos:</b> '+photoCount+'</span>':'')
      +'</div>'
      +weightEntry
      +'<div style="padding:14px 16px;">'
      +'<div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px;">'
      +'<button id="btn_t_'+skuStr+'" onclick="cp(this.id.slice(4))" style="padding:8px 16px;border:none;border-radius:4px;cursor:pointer;font-size:13px;font-weight:bold;background:#1565c0;color:#fff;">Copy Title</button>'
      +'<button id="btn_c_'+skuStr+'" onclick="cp(this.id.slice(4))" style="padding:8px 16px;border:none;border-radius:4px;cursor:pointer;font-size:13px;font-weight:bold;background:#37474f;color:#fff;">Copy Condition Box</button>'
      +'<button id="btn_h_'+skuStr+'" onclick="cp(this.id.slice(4))" style="padding:8px 16px;border:none;border-radius:4px;cursor:pointer;font-size:13px;font-weight:bold;background:#2e7d32;color:#fff;">Copy HTML Description</button>'
      +ebayBtn
      +'<span style="display:inline-flex;align-items:center;gap:6px;font-size:13px;font-weight:bold;color:#444;"><label for="qty_'+skuStr+'">Qty:</label><input id="qty_'+skuStr+'" type="number" min="1" max="99" value="'+quantity+'" style="width:62px;padding:7px 8px;border:1px solid #bbb;border-radius:4px;font-size:13px;"><button onclick="saveQty(\''+skuStr+'\')" style="padding:8px 12px;border:none;border-radius:4px;cursor:pointer;font-size:13px;font-weight:bold;background:#455a64;color:#fff;">Save Qty</button><span id="qtymsg_'+skuStr+'" style="font-size:12px;"></span></span>'
      +'<button onclick="deleteListing(\''+skuStr+'\')" style="padding:8px 16px;border:none;border-radius:4px;cursor:pointer;font-size:13px;font-weight:bold;background:#c62828;color:#fff;">Remove from List</button>'
      +'</div>'
      +'<textarea id="t_'+skuStr+'" style="display:none;">'+rawTitle+'</textarea>'
      +'<textarea id="c_'+skuStr+'" style="display:none;">'+condBox+'</textarea>'
      +'<textarea id="h_'+skuStr+'" style="display:none;">'+descHtml+'</textarea>'
      +specHtml
      +photoStrip
      +'</div></div>';
  }).join('');

  // eBay connection status bar (Feature 8)
  var ebayBar;
  if(ebayStat.connected){
    ebayBar = '<div style="background:#e8f5e9;border:1px solid #2e7d32;color:#1b5e20;padding:10px 16px;border-radius:6px;margin-bottom:18px;font-size:13px;font-weight:bold;">&#10003; eBay connected &mdash; Xtreme Electronic Recycling</div>';
  } else if(ebayStat.expired){
    ebayBar = '<div style="background:#fff8e1;border:1px solid #f9a825;color:#8d6e00;padding:10px 16px;border-radius:6px;margin-bottom:18px;font-size:13px;font-weight:bold;">eBay token expired &mdash; <a href="/ebay-auth" style="color:#0064d2;">Reconnect</a></div>';
  } else {
    ebayBar = '<div style="background:#fff3e0;border:1px solid #e65100;color:#e65100;padding:10px 16px;border-radius:6px;margin-bottom:18px;font-size:13px;font-weight:bold;">eBay not connected &mdash; <a href="/ebay-auth" style="color:#0064d2;">Connect eBay Account</a></div>';
  }

  return '<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>XRT eBay Listing Descriptions</title>'
    +'<style>*{box-sizing:border-box;margin:0;padding:0;}body{font-family:Arial,sans-serif;background:#f0f0f0;padding:20px;}.topbar{display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;}h1{font-size:18px;color:#333;}.meta{font-size:12px;color:#777;margin-top:2px;}.actions{display:flex;gap:10px;}</style>'
    +'<script>'
    +'function cp(id){var el=document.getElementById(id);if(!el)return;var btn=document.querySelector("[id=btn_"+id+"]");navigator.clipboard.writeText(el.value.trim()).then(function(){if(btn){var o=btn.textContent;btn.textContent="Copied!";setTimeout(function(){btn.textContent=o;},1500);}});}'
    +'function clearAll(){if(!confirm("Clear all listings? This cannot be undone."))return;fetch("/api/clear-listings",{method:"POST"}).then(function(){location.reload();});}'
    +'function dlAll(sku,stems,safe){for(var i=0;i<stems.length;i++){(function(n){setTimeout(function(){var a=document.createElement("a");a.href="/api/photo/"+sku+"/"+stems[n];a.download=sku+"-"+safe+"-photo"+(n+1)+".jpg";document.body.appendChild(a);a.click();document.body.removeChild(a);},n*500);})(i);}}'
    +'function listEbay(sku){var b=document.getElementById("ebaybtn_"+sku);if(b){b.textContent="Listing...";b.disabled=true;}fetch("/api/send-to-ebay",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({sku:parseInt(sku,10)})}).then(function(r){return r.json();}).then(function(d){if(d.success){if(b){var a=document.createElement("a");a.id="ebaybtn_"+sku;a.href=d.listing_url||"#";a.target="_blank";a.textContent="Listed \\u2713";a.style.cssText="padding:8px 16px;border-radius:4px;font-size:13px;font-weight:bold;background:#2e7d32;color:#fff;text-decoration:none;";if(b.parentNode)b.parentNode.replaceChild(a,b);}}else{if(b){b.textContent="Retry";b.disabled=false;}alert("eBay: "+(d.error||"failed"));}}).catch(function(){if(b){b.textContent="Retry";b.disabled=false;}alert("Network error contacting server.");});}'
    +'function loadQueue(){fetch("/api/queue-status").then(function(r){return r.json();}).then(function(d){var banner=document.getElementById("queueBanner");if(d.pending>0||d.processing){banner.style.display="block";banner.textContent=d.pending+" listing"+(d.pending===1?"":"s")+" generating...";}else{banner.style.display="none";}var fc=document.getElementById("failedItems");fc.innerHTML="";(d.failed||[]).forEach(function(f){var row=document.createElement("div");row.style.cssText="background:#ffebee;border:1px solid #c62828;color:#b71c1c;padding:8px 14px;border-radius:6px;margin-bottom:8px;font-size:13px;display:flex;align-items:center;gap:12px;";var span=document.createElement("span");span.style.flex="1";span.textContent="SKU "+f.sku+" failed: "+(f.error||"error")+" (after "+f.attempts+" attempts)";var btn=document.createElement("button");btn.textContent="Retry";btn.style.cssText="padding:6px 14px;border:none;border-radius:4px;background:#c62828;color:#fff;font-weight:bold;cursor:pointer;";btn.onclick=function(){retryListing(f.sku);};row.appendChild(span);row.appendChild(btn);fc.appendChild(row);});}).catch(function(){});}'
    +'function retryListing(sku){fetch("/api/retry-listing",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({sku:sku})}).then(function(){loadQueue();});}'
    +'function saveWeight(sku){var lb=document.getElementById("wtlb_"+sku);var oz=document.getElementById("wtoz_"+sku);var msg=document.getElementById("wtmsg_"+sku);var L=lb?parseInt(lb.value,10):0;if(isNaN(L))L=0;var O=oz?parseFloat(oz.value):0;if(isNaN(O))O=0;if(L<0||O<0||(L===0&&O===0)){if(msg){msg.style.color="#c62828";msg.textContent="Enter lb and/or oz";}return;}if(msg){msg.style.color="#8d6e00";msg.textContent="Saving...";}fetch("/api/set-weight",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({sku:parseInt(sku,10),lbs:L,oz:O})}).then(function(r){return r.json();}).then(function(d){if(d.success){if(msg){msg.style.color="#2e7d32";msg.textContent="Saved \\u2713 Packed: "+d.final_lbs+"lb "+d.final_oz+"oz | Box: "+d.box_size;}setTimeout(function(){location.reload();},1200);}else{if(msg){msg.style.color="#c62828";msg.textContent=d.error||"Save failed";}}}).catch(function(){if(msg){msg.style.color="#c62828";msg.textContent="Network error";}});}'
    +'function editSuggest(sku){var span=document.getElementById("sug_"+sku);if(!span||span.dataset.editing)return;span.dataset.editing="1";var cur=parseFloat(span.textContent)||0;var inp=document.createElement("input");inp.type="number";inp.min="0";inp.step="0.01";inp.value=cur;inp.style.cssText="width:80px;padding:2px 4px;border:1px solid #1565c0;border-radius:3px;font-size:12.5px;";span.textContent="";span.appendChild(inp);inp.focus();inp.select();var done=false;function save(){if(done)return;done=true;var nv=parseFloat(inp.value);var msg=document.getElementById("sugmsg_"+sku);if(isNaN(nv)||nv<=0){span.textContent=cur;span.removeAttribute("data-editing");if(msg){msg.style.color="#c62828";msg.textContent="invalid";}return;}fetch("/api/listings/"+sku,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({suggest_price:nv})}).then(function(r){return r.json();}).then(function(d){if(d.success){span.textContent=(d.suggested_price!=null?d.suggested_price:nv);if(msg){msg.style.color="#2e7d32";msg.textContent="\\u2713";setTimeout(function(){msg.textContent="";},1500);}}else{span.textContent=cur;if(msg){msg.style.color="#c62828";msg.textContent=d.error||"failed";}}span.removeAttribute("data-editing");}).catch(function(){span.textContent=cur;span.removeAttribute("data-editing");if(msg){msg.style.color="#c62828";msg.textContent="error";}});}inp.addEventListener("blur",save);inp.addEventListener("keydown",function(e){if(e.key==="Enter"){e.preventDefault();inp.blur();}else if(e.key==="Escape"){done=true;span.textContent=cur;span.removeAttribute("data-editing");}});}'
    +'function deletePhoto(sku,name,btn){if(!confirm("Delete this photo from the listing?"))return;fetch("/api/listings/"+sku+"/photo/"+encodeURIComponent(name),{method:"DELETE"}).then(function(r){return r.json();}).then(function(d){if(d.success){var t=btn.parentNode;if(t&&t.parentNode){t.parentNode.removeChild(t);}}else{alert("Delete failed: "+(d.error||"unknown"));}}).catch(function(){alert("Network error deleting photo.");});}'
    +'function saveQty(sku){var inp=document.getElementById("qty_"+sku);var msg=document.getElementById("qtymsg_"+sku);var v=inp?parseInt(inp.value,10):NaN;if(isNaN(v)||v<1||v>99){if(msg){msg.style.color="#c62828";msg.textContent="1-99 only";}return;}if(msg){msg.style.color="#8d6e00";msg.textContent="Saving...";}fetch("/api/listings/"+sku,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({quantity:v})}).then(function(r){return r.json();}).then(function(d){if(d.success){if(msg){msg.style.color="#2e7d32";msg.textContent="Saved \\u2713";}}else{if(msg){msg.style.color="#c62828";msg.textContent=d.error||"Failed";}}}).catch(function(){if(msg){msg.style.color="#c62828";msg.textContent="Network error";}});}'
    +'function deleteListing(sku){if(!confirm("Delete this listing permanently? This cannot be undone."))return;fetch("/api/listings/"+sku,{method:"DELETE"}).then(function(r){return r.json();}).then(function(d){if(d.success){var c=document.getElementById("card_"+sku);if(c&&c.parentNode){c.parentNode.removeChild(c);}}else{alert("Delete failed: "+(d.error||"unknown"));}}).catch(function(){alert("Network error deleting listing.");});}'
    +'function updateBulkCount(){var all=Array.prototype.slice.call(document.querySelectorAll(".bulkSel"));var sel=all.filter(function(b){return b.checked;});var btn=document.getElementById("listSelectedBtn");if(btn){btn.textContent="List Selected ("+sel.length+")";btn.disabled=sel.length===0;btn.style.opacity=sel.length===0?"0.5":"1";btn.style.cursor=sel.length===0?"not-allowed":"pointer";}var sa=document.getElementById("selectAll");if(sa){sa.checked=all.length>0&&sel.length===all.length;}}'
    +'function toggleSelectAll(cb){var all=Array.prototype.slice.call(document.querySelectorAll(".bulkSel"));all.forEach(function(b){b.checked=cb.checked;});updateBulkCount();}'
    +'function markListed(sku,url){var cb=document.querySelector(".bulkSel[value=\\""+sku+"\\"]");if(cb&&cb.parentNode){cb.parentNode.removeChild(cb);}var b=document.getElementById("ebaybtn_"+sku);if(b){var a=document.createElement("a");a.id="ebaybtn_"+sku;a.href=url||"#";a.target="_blank";a.textContent="Listed \\u2713";a.style.cssText="padding:8px 16px;border-radius:4px;font-size:13px;font-weight:bold;background:#2e7d32;color:#fff;text-decoration:none;";if(b.parentNode)b.parentNode.replaceChild(a,b);}}'
    +'function listSelected(){var skus=Array.prototype.slice.call(document.querySelectorAll(".bulkSel:checked")).map(function(b){return b.value;});if(!skus.length)return;if(!confirm("List "+skus.length+" items on eBay?"))return;var prog=document.getElementById("bulkProgress");var btn=document.getElementById("listSelectedBtn");if(btn){btn.disabled=true;btn.style.opacity="0.5";btn.style.cursor="not-allowed";}var ok=0,fails=[],idx=0;function postNext(){if(idx>=skus.length){if(prog){prog.textContent="Listed "+ok+" items successfully, "+fails.length+" failed"+(fails.length?(" ("+fails.map(function(f){return f.sku+": "+f.error;}).join("; ")+")"):"");}updateBulkCount();return;}var sku=skus[idx];idx++;if(prog){prog.textContent="Listing item "+idx+" of "+skus.length+"...";}fetch("/api/send-to-ebay",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({sku:parseInt(sku,10)})}).then(function(r){return r.json();}).then(function(d){if(d.success){ok++;markListed(sku,d.listing_url);}else{fails.push({sku:sku,error:(d.error||"failed")});}}).catch(function(){fails.push({sku:sku,error:"network error"});}).then(function(){setTimeout(postNext,2000);});}postNext();}'
    +'function savePhotoOrder(sku,order,strip){var msg=strip.parentNode.querySelector(".lp-order-msg");fetch("/api/listings/"+sku,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({photo_order:order})}).then(function(r){return r.json();}).then(function(d){if(d.success){if(msg){msg.style.color="#2e7d32";msg.textContent="Order saved";setTimeout(function(){msg.textContent="";},1500);}}else{if(msg){msg.style.color="#c62828";msg.textContent=d.error||"Save failed";}}}).catch(function(){if(msg){msg.style.color="#c62828";msg.textContent="Network error";}});}'
    +'function setupStrip(strip){var dragEl=null,sku=null,longTimer=null,dragging=false,sx=0,sy=0;function thumbs(){return Array.prototype.slice.call(strip.querySelectorAll(".lp-thumb"));}function begin(el){dragEl=el;dragging=true;sku=el.getAttribute("data-sku");el.style.opacity="0.5";el.style.cursor="grabbing";}function moveTo(x,y){if(!dragEl)return;var over=document.elementFromPoint(x,y);if(!over)return;var t=over.closest?over.closest(".lp-thumb"):null;if(t&&t!==dragEl&&t.parentNode===strip){var rect=t.getBoundingClientRect();var before=(x<rect.left+rect.width/2);strip.insertBefore(dragEl,before?t:t.nextSibling);}}function finish(){if(!dragEl)return;dragEl.style.opacity="";dragEl.style.cursor="grab";var order=thumbs().map(function(x){return x.getAttribute("data-stem");});savePhotoOrder(sku,order,strip);dragEl=null;dragging=false;}strip.addEventListener("mousedown",function(e){var grip=e.target.closest?e.target.closest(".lp-grip"):null;if(!grip)return;var th=grip.closest(".lp-thumb");if(!th)return;e.preventDefault();begin(th);function mm(ev){moveTo(ev.clientX,ev.clientY);}function mu(){document.removeEventListener("mousemove",mm);document.removeEventListener("mouseup",mu);finish();}document.addEventListener("mousemove",mm);document.addEventListener("mouseup",mu);});strip.addEventListener("touchstart",function(e){if(e.target.closest&&e.target.closest(".thumb-del-btn"))return;var th=e.target.closest?e.target.closest(".lp-thumb"):null;if(!th)return;var t0=e.touches[0];sx=t0.clientX;sy=t0.clientY;longTimer=setTimeout(function(){begin(th);},300);},{passive:true});strip.addEventListener("touchmove",function(e){if(!dragging){if(longTimer){var t=e.touches[0];if(Math.abs(t.clientX-sx)>10||Math.abs(t.clientY-sy)>10){clearTimeout(longTimer);longTimer=null;}}return;}e.preventDefault();var tt=e.touches[0];moveTo(tt.clientX,tt.clientY);},{passive:false});strip.addEventListener("touchend",function(){if(longTimer){clearTimeout(longTimer);longTimer=null;}if(dragging)finish();});strip.addEventListener("touchcancel",function(){if(longTimer){clearTimeout(longTimer);longTimer=null;}if(dragging){dragEl.style.opacity="";dragEl=null;dragging=false;}});}'
    +'function initPhotoReorder(){Array.prototype.slice.call(document.querySelectorAll(".lp-photostrip")).forEach(function(s){setupStrip(s);});}'
    +'setInterval(loadQueue,10000);loadQueue();updateBulkCount();initPhotoReorder();'
    +'<\/script>'
    +'</head><body>'
    +'<div class="topbar">'
    +'<div><h1>XRT eBay Listing Descriptions</h1><p class="meta">'+listings.length+' items &nbsp;&middot;&nbsp; Clovis, CA</p></div>'
    +'<div class="actions">'
    +'<a href="/api/listings" style="padding:8px 16px;background:#455a64;color:#fff;border-radius:4px;text-decoration:none;font-size:13px;font-weight:bold;">Refresh</a>'
    +'<button onclick="clearAll()" style="padding:8px 16px;background:#ff1744;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:13px;font-weight:bold;">Clear All</button>'
    +'</div>'
    +'</div>'
    +ebayBar
    +(listings.some(function(x){ return !x.ebay_item_id; }) ?
       '<div id="bulkBar" style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;background:#fff;border:1px solid #ddd;border-radius:6px;padding:10px 16px;margin-bottom:14px;">'
       +'<label style="display:inline-flex;align-items:center;gap:6px;font-size:13px;font-weight:bold;color:#333;cursor:pointer;"><input type="checkbox" id="selectAll" onclick="toggleSelectAll(this)" style="width:18px;height:18px;cursor:pointer;">Select All</label>'
       +'<button id="listSelectedBtn" onclick="listSelected()" disabled style="padding:8px 16px;border:none;border-radius:4px;cursor:not-allowed;font-size:13px;font-weight:bold;background:#0064d2;color:#fff;opacity:0.5;">List Selected (0)</button>'
       +'<span id="bulkProgress" style="font-size:13px;font-weight:bold;color:#444;"></span>'
       +'</div>' : '')
    +'<div id="queueBanner" style="display:none;background:#e3f2fd;border:1px solid #1565c0;color:#0d47a1;padding:10px 16px;border-radius:6px;margin-bottom:14px;font-size:13px;font-weight:bold;"></div>'
    +'<div id="failedItems"></div>'
    +cards
    +'</body></html>';
}

function generateHTML(results) {
  var listings = results.filter(function(r){ return r && r.sku; });
  saveListings(listings);
  console.log('[BATCH] Saved', listings.length, 'listings');
}

// FIX 3: on startup, rebuild listings.json from item folders if missing/empty
(function(){
  var lp = path.join(DATA_DIR, 'listings.json');
  var needRebuild = true;
  try { if(fs.existsSync(lp)){ var cur = JSON.parse(fs.readFileSync(lp,'utf8')); if(Array.isArray(cur) && cur.length > 0) needRebuild = false; } } catch(e){}
  if(needRebuild){ rebuildListings(); }
})();

// On startup, re-queue any unprocessed items so the queue resumes after a restart
(function(){
  var itemsDir = path.join(DATA_DIR, 'items');
  try {
    fs.readdirSync(itemsDir).forEach(function(f){
      var mp = path.join(itemsDir, f, 'meta.json');
      if(fs.existsSync(mp)){
        try { var m = JSON.parse(fs.readFileSync(mp,'utf8')); if(!m.processed) enqueueListing(m.sku || parseInt(f,10)); } catch(e){}
      }
    });
  } catch(e){}
})();

server.listen(PORT, function(){console.log('XRT Server running on port '+PORT);});
