'use strict';
const http = require('http');
const https = require('https');

const PORT = process.env.PORT || 3000;
const API_KEY = process.env.ANTHROPIC_API_KEY || '';

const HTML_PAGE = "<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n<meta charset=\"UTF-8\">\n<meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0, user-scalable=no\">\n<meta name=\"mobile-web-app-capable\" content=\"yes\">\n<meta name=\"apple-mobile-web-app-capable\" content=\"yes\">\n<meta name=\"theme-color\" content=\"#000000\">\n<title>XRT Floor Scanner</title>\n<link rel=\"preconnect\" href=\"https://fonts.googleapis.com\">\n<link href=\"https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Mono:wght@400;500&family=Barlow:wght@400;600;700;900&display=swap\" rel=\"stylesheet\">\n<style>\n:root{--bg:#111;--surface:#1a1a1a;--border:#2c2c2c;--text:#f2f2f2;--muted:#555;--accent:#e8ff00;--keep:#00e676;--recycle:#ff1744;--keep-dark:#003d1a;--recycle-dark:#4a000e;--display:'Bebas Neue',sans-serif;--body:'Barlow',sans-serif;--mono:'DM Mono',monospace;}\n*{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent;}\nhtml,body{height:100%;overflow:hidden;background:#000;font-family:var(--body);color:var(--text);user-select:none;touch-action:manipulation;}\n.screen{position:fixed;inset:0;display:none;flex-direction:column;}.screen.active{display:flex;}\n#scannerScreen{background:#000;}\n#videoEl{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;}\n.vf-overlay{position:absolute;inset:0;pointer-events:none;}\n.vf-corner{position:absolute;width:32px;height:32px;border-color:var(--accent);border-style:solid;opacity:0.85;}\n.vf-corner.tl{top:22%;left:10%;border-width:3px 0 0 3px;}.vf-corner.tr{top:22%;right:10%;border-width:3px 3px 0 0;}\n.vf-corner.bl{bottom:30%;left:10%;border-width:0 0 3px 3px;}.vf-corner.br{bottom:30%;right:10%;border-width:0 3px 3px 0;}\n.scan-line{position:absolute;left:10%;right:10%;height:2px;background:linear-gradient(90deg,transparent,var(--accent),transparent);top:22%;opacity:0;animation:scanAnim 2.4s ease-in-out infinite;}\n.scan-line.active{opacity:1;}@keyframes scanAnim{0%{top:22%;}50%{top:70%;}100%{top:22%;}}\n.scanner-topbar{position:absolute;top:0;left:0;right:0;padding:16px 18px 12px;display:flex;align-items:center;justify-content:space-between;background:linear-gradient(to bottom,rgba(0,0,0,0.88),transparent);z-index:10;}\n.topbar-brand{font-family:var(--display);font-size:1.6rem;letter-spacing:0.06em;color:#fff;line-height:1;}.topbar-brand span{color:var(--accent);}\n.topbar-right{display:flex;gap:10px;align-items:center;}\n.icon-btn{width:40px;height:40px;border-radius:50%;background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.15);display:flex;align-items:center;justify-content:center;cursor:pointer;backdrop-filter:blur(8px);}\n.mode-badge{font-family:var(--mono);font-size:0.58rem;letter-spacing:0.1em;text-transform:uppercase;padding:5px 10px;border-radius:100px;border:1px solid rgba(255,255,255,0.2);color:#ccc;background:rgba(0,0,0,0.4);}\n.mode-badge.auto{color:var(--accent);border-color:rgba(232,255,0,0.4);}\n.status-pill{position:absolute;bottom:28%;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.72);border:1px solid rgba(255,255,255,0.1);backdrop-filter:blur(12px);border-radius:100px;padding:8px 20px;font-family:var(--mono);font-size:0.65rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--muted);white-space:nowrap;transition:all 0.2s;z-index:10;}\n.status-pill.scanning{color:var(--accent);border-color:rgba(232,255,0,0.35);}.status-pill.ready{color:#fff;}\n.scanner-bottombar{position:absolute;bottom:0;left:0;right:0;padding:16px 24px calc(env(safe-area-inset-bottom) + 18px);background:linear-gradient(to top,rgba(0,0,0,0.92),transparent);z-index:10;display:flex;align-items:center;justify-content:space-between;}\n.threshold-display{display:flex;flex-direction:column;}\n.threshold-display .label{font-family:var(--mono);font-size:0.55rem;color:var(--muted);letter-spacing:0.1em;text-transform:uppercase;}\n.threshold-display .value{font-family:var(--display);font-size:1.8rem;color:var(--accent);line-height:1;}\n.scan-btn{width:72px;height:72px;border-radius:50%;background:#fff;border:3px solid rgba(255,255,255,0.25);display:flex;align-items:center;justify-content:center;cursor:pointer;transition:transform 0.1s,background 0.1s;position:relative;}\n.scan-btn::after{content:'';position:absolute;inset:-7px;border-radius:50%;border:2px solid rgba(255,255,255,0.18);}\n.scan-btn:active{transform:scale(0.91);background:#ddd;}\n.sound-toggle{display:flex;flex-direction:column;align-items:flex-end;}\n.sound-toggle .label{font-family:var(--mono);font-size:0.55rem;color:var(--muted);letter-spacing:0.1em;text-transform:uppercase;margin-bottom:4px;}\n.pack-btn{background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.14);border-radius:5px;padding:5px 12px;font-family:var(--mono);font-size:0.62rem;color:#ccc;cursor:pointer;letter-spacing:0.06em;}\n#resultScreen{z-index:50;justify-content:center;align-items:center;}\n#resultScreen.keep{background:var(--keep-dark);}#resultScreen.recycle{background:var(--recycle-dark);}\n.result-glow{position:absolute;inset:0;pointer-events:none;opacity:0;}\n#resultScreen.keep .result-glow{background:radial-gradient(ellipse at center,rgba(0,230,118,0.2) 0%,transparent 70%);opacity:1;}\n#resultScreen.recycle .result-glow{background:radial-gradient(ellipse at center,rgba(255,23,68,0.2) 0%,transparent 70%);opacity:1;}\n.result-inner{position:relative;z-index:2;display:flex;flex-direction:column;align-items:center;padding:0 28px;text-align:center;width:100%;}\n.result-verdict-word{font-family:var(--display);font-size:clamp(5.5rem,24vw,10rem);line-height:0.88;letter-spacing:0.03em;animation:verdictPop 0.32s cubic-bezier(0.34,1.56,0.64,1) both;}\n#resultScreen.keep .result-verdict-word{color:var(--keep);}#resultScreen.recycle .result-verdict-word{color:var(--recycle);}\n@keyframes verdictPop{from{transform:scale(0.65);opacity:0;}to{transform:scale(1);opacity:1;}}\n.result-divider{width:48px;height:2px;margin:14px auto;opacity:0.35;}\n#resultScreen.keep .result-divider{background:var(--keep);}#resultScreen.recycle .result-divider{background:var(--recycle);}\n.result-item-name{font-size:1.1rem;font-weight:700;line-height:1.3;color:rgba(255,255,255,0.88);max-width:300px;animation:fadeUp 0.36s 0.12s both;}\n.result-price{font-family:var(--display);font-size:2.8rem;margin-top:10px;animation:fadeUp 0.36s 0.2s both;}\n#resultScreen.keep .result-price{color:var(--keep);}#resultScreen.recycle .result-price{color:var(--recycle);}\n.result-price-label{font-family:var(--mono);font-size:0.58rem;letter-spacing:0.14em;color:rgba(255,255,255,0.38);text-transform:uppercase;margin-top:-2px;animation:fadeUp 0.36s 0.24s both;}\n.result-reason{margin-top:16px;font-size:0.88rem;color:rgba(255,255,255,0.5);max-width:280px;line-height:1.55;animation:fadeUp 0.36s 0.28s both;}\n@keyframes fadeUp{from{opacity:0;transform:translateY(12px);}to{opacity:1;transform:translateY(0);}}\n.result-countdown{position:absolute;bottom:44px;left:50%;transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;gap:8px;}\n.countdown-bar-track{width:130px;height:3px;background:rgba(255,255,255,0.1);border-radius:2px;overflow:hidden;}\n.countdown-bar{height:100%;border-radius:2px;}\n#resultScreen.keep .countdown-bar{background:var(--keep);}#resultScreen.recycle .countdown-bar{background:var(--recycle);}\n.countdown-label{font-family:var(--mono);font-size:0.58rem;letter-spacing:0.1em;color:rgba(255,255,255,0.28);text-transform:uppercase;}\n#loadingScreen{background:#080808;z-index:40;justify-content:center;align-items:center;gap:22px;}\n.loading-ring{width:60px;height:60px;border-radius:50%;border:2px solid var(--border);border-top-color:var(--accent);animation:spin 0.72s linear infinite;}\n@keyframes spin{to{transform:rotate(360deg);}}\n.loading-info{text-align:center;}\n.loading-step{font-family:var(--display);font-size:1.5rem;letter-spacing:0.05em;color:#fff;margin-bottom:5px;}\n.loading-sub{font-family:var(--mono);font-size:0.6rem;color:var(--muted);letter-spacing:0.1em;text-transform:uppercase;}\n#settingsPanel{position:fixed;bottom:0;left:0;right:0;background:var(--surface);border-top:1px solid var(--border);border-radius:20px 20px 0 0;padding:18px 24px calc(env(safe-area-inset-bottom) + 28px);z-index:100;transform:translateY(100%);transition:transform 0.3s cubic-bezier(0.32,0.72,0,1);}\n#settingsPanel.open{transform:translateY(0);}\n.settings-handle{width:40px;height:4px;background:var(--border);border-radius:2px;margin:0 auto 22px;}\n.settings-title{font-family:var(--display);font-size:1.6rem;letter-spacing:0.04em;margin-bottom:26px;}\n.setting-row{margin-bottom:28px;}\n.setting-label{font-family:var(--mono);font-size:0.6rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--muted);margin-bottom:12px;display:flex;justify-content:space-between;align-items:center;}\n.setting-label span{font-size:0.8rem;color:var(--accent);font-family:var(--display);letter-spacing:0.06em;}\n.threshold-slider{width:100%;-webkit-appearance:none;appearance:none;height:4px;background:var(--border);border-radius:2px;outline:none;}\n.threshold-slider::-webkit-slider-thumb{-webkit-appearance:none;width:24px;height:24px;border-radius:50%;background:var(--accent);cursor:pointer;border:3px solid #000;box-shadow:0 0 0 2px var(--accent);}\n.toggle-row{display:grid;grid-template-columns:1fr 1fr;gap:10px;}\n.toggle-opt{border:1.5px solid var(--border);border-radius:10px;padding:14px 16px;cursor:pointer;transition:all 0.15s;text-align:center;}\n.toggle-opt.selected{border-color:var(--accent);background:rgba(232,255,0,0.06);}\n.toggle-opt-name{font-weight:700;font-size:0.95rem;margin-bottom:4px;}\n.toggle-opt-desc{font-family:var(--mono);font-size:0.58rem;color:var(--muted);line-height:1.4;}\n.toggle-opt.selected .toggle-opt-name{color:var(--accent);}\n.settings-close{width:100%;margin-top:6px;padding:15px;background:var(--border);border:none;border-radius:10px;font-family:var(--display);font-size:1.15rem;letter-spacing:0.06em;color:var(--text);cursor:pointer;}\n.settings-backdrop{position:fixed;inset:0;background:rgba(0,0,0,0.65);z-index:99;display:none;backdrop-filter:blur(3px);}\n.settings-backdrop.open{display:block;}\n</style>\n</head>\n<body>\n<div class=\"screen active\" id=\"scannerScreen\">\n  <video id=\"videoEl\" autoplay playsinline muted></video>\n  <canvas id=\"captureCanvas\" style=\"display:none\"></canvas>\n  <div class=\"vf-overlay\">\n    <div class=\"vf-corner tl\"></div><div class=\"vf-corner tr\"></div>\n    <div class=\"vf-corner bl\"></div><div class=\"vf-corner br\"></div>\n    <div class=\"scan-line\" id=\"scanLine\"></div>\n  </div>\n  <div class=\"scanner-topbar\">\n    <div class=\"topbar-brand\">XRT<span>&#183;</span>SCAN</div>\n    <div class=\"topbar-right\">\n      <div class=\"mode-badge\" id=\"modeBadge\">MANUAL</div>\n      <div class=\"icon-btn\" onclick=\"openSettings()\">\n        <svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"white\" stroke-width=\"1.8\" width=\"18\" height=\"18\">\n          <circle cx=\"12\" cy=\"12\" r=\"3\"/>\n          <path d=\"M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z\"/>\n        </svg>\n      </div>\n    </div>\n  </div>\n  <div class=\"status-pill\" id=\"statusPill\">Starting camera...</div>\n  <div class=\"scanner-bottombar\">\n    <div class=\"threshold-display\">\n      <div class=\"label\">Min Value</div>\n      <div class=\"value\" id=\"thresholdDisplay\">$30</div>\n    </div>\n    <div class=\"scan-btn\" id=\"scanBtn\" onclick=\"triggerManualScan()\">\n      <svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"black\" stroke-width=\"2.2\" width=\"30\" height=\"30\">\n        <circle cx=\"11\" cy=\"11\" r=\"8\"/><path d=\"m21 21-4.35-4.35\"/>\n      </svg>\n    </div>\n    <div class=\"sound-toggle\">\n      <div class=\"label\">Sound Pack</div>\n      <div class=\"pack-btn\" id=\"packToggleBtn\" onclick=\"cycleSoundPack()\">PACK 1</div>\n    </div>\n  </div>\n</div>\n<div class=\"screen\" id=\"loadingScreen\">\n  <div class=\"loading-ring\"></div>\n  <div class=\"loading-info\">\n    <div class=\"loading-step\" id=\"loadingStep\">Identifying item...</div>\n    <div class=\"loading-sub\" id=\"loadingSub\">Checking eBay sold listings</div>\n  </div>\n</div>\n<div class=\"screen\" id=\"resultScreen\" onclick=\"dismissResult()\">\n  <div class=\"result-glow\"></div>\n  <div class=\"result-inner\">\n    <div class=\"result-verdict-word\" id=\"resultVerdict\">KEEP</div>\n    <div class=\"result-divider\"></div>\n    <div class=\"result-item-name\" id=\"resultItemName\">--</div>\n    <div class=\"result-price\" id=\"resultPrice\">--</div>\n    <div class=\"result-price-label\">avg sold on eBay</div>\n    <div class=\"result-reason\" id=\"resultReason\">--</div>\n  </div>\n  <div class=\"result-countdown\">\n    <div class=\"countdown-bar-track\">\n      <div class=\"countdown-bar\" id=\"countdownBar\" style=\"width:100%\"></div>\n    </div>\n    <div class=\"countdown-label\">Tap to scan next item</div>\n  </div>\n</div>\n<div class=\"settings-backdrop\" id=\"settingsBackdrop\" onclick=\"closeSettings()\"></div>\n<div id=\"settingsPanel\">\n  <div class=\"settings-handle\"></div>\n  <div class=\"settings-title\">Settings</div>\n  <div class=\"setting-row\">\n    <div class=\"setting-label\">Minimum Sell Threshold <span id=\"sliderValueLabel\">$30</span></div>\n    <input type=\"range\" class=\"threshold-slider\" id=\"thresholdSlider\" min=\"20\" max=\"80\" value=\"30\" step=\"5\" oninput=\"updateThreshold(this.value)\">\n  </div>\n  <div class=\"setting-row\">\n    <div class=\"setting-label\">Scan Mode</div>\n    <div class=\"toggle-row\">\n      <div class=\"toggle-opt selected\" id=\"modeManualOpt\" onclick=\"setScanMode('manual')\">\n        <div class=\"toggle-opt-name\">Manual</div>\n        <div class=\"toggle-opt-desc\">Tap button to scan only.</div>\n      </div>\n      <div class=\"toggle-opt\" id=\"modeAutoOpt\" onclick=\"setScanMode('auto')\">\n        <div class=\"toggle-opt-name\">Auto</div>\n        <div class=\"toggle-opt-desc\">Fires when camera is steady.</div>\n      </div>\n    </div>\n  </div>\n  <div class=\"setting-row\">\n    <div class=\"setting-label\">Sound Pack</div>\n    <div class=\"toggle-row\">\n      <div class=\"toggle-opt selected\" id=\"pack1Opt\" onclick=\"selectPack(1)\">\n        <div class=\"toggle-opt-name\">Pack 1</div>\n        <div class=\"toggle-opt-desc\">Cash register / Buzzer</div>\n      </div>\n      <div class=\"toggle-opt\" id=\"pack2Opt\" onclick=\"selectPack(2)\">\n        <div class=\"toggle-opt-name\">Pack 2</div>\n        <div class=\"toggle-opt-desc\">Rising chime / Low thud</div>\n      </div>\n    </div>\n  </div>\n  <button class=\"settings-close\" onclick=\"closeSettings()\">Done</button>\n</div>\n<script>\nvar threshold=30,soundPack=1,isAnalyzing=false,countdownTimer=null;\nvar lastFrameData=null,stableFrames=0,motionInterval=null,scanMode='manual';\nvar STABLE_NEEDED=8,MOTION_MS=220,RESULT_MS=4500;\nvar audioCtx=new(window.AudioContext||window.webkitAudioContext)();\nfunction playCashRegister(){var ctx=audioCtx,now=ctx.currentTime;var c=ctx.createOscillator(),cg=ctx.createGain();c.connect(cg);cg.connect(ctx.destination);c.frequency.setValueAtTime(1200,now);c.frequency.exponentialRampToValueAtTime(800,now+0.05);cg.gain.setValueAtTime(0.28,now);cg.gain.exponentialRampToValueAtTime(0.001,now+0.07);c.start(now);c.stop(now+0.08);[[0.1,1046],[0.18,1318],[0.27,1568]].forEach(function(x){var o=ctx.createOscillator(),g=ctx.createGain();o.connect(g);g.connect(ctx.destination);o.type='sine';o.frequency.value=x[1];g.gain.setValueAtTime(0.26,now+x[0]);g.gain.exponentialRampToValueAtTime(0.001,now+x[0]+0.38);o.start(now+x[0]);o.stop(now+x[0]+0.39);});}\nfunction playBuzzer(){var ctx=audioCtx,now=ctx.currentTime;[0,0.2].forEach(function(t){var o=ctx.createOscillator(),g=ctx.createGain();o.type='sawtooth';o.connect(g);g.connect(ctx.destination);o.frequency.setValueAtTime(145,now+t);o.frequency.exponentialRampToValueAtTime(88,now+t+0.15);g.gain.setValueAtTime(0.32,now+t);g.gain.exponentialRampToValueAtTime(0.001,now+t+0.16);o.start(now+t);o.stop(now+t+0.17);});}\nfunction playRisingChime(){var ctx=audioCtx,now=ctx.currentTime;[523,659,784,1047].forEach(function(f,i){var o=ctx.createOscillator(),g=ctx.createGain();o.type='sine';o.connect(g);g.connect(ctx.destination);o.frequency.value=f;var t=now+i*0.11;g.gain.setValueAtTime(0.24,t);g.gain.exponentialRampToValueAtTime(0.001,t+0.55);o.start(t);o.stop(t+0.56);});}\nfunction playLowThud(){var ctx=audioCtx,now=ctx.currentTime;var o=ctx.createOscillator(),g=ctx.createGain();o.type='sine';o.connect(g);g.connect(ctx.destination);o.frequency.setValueAtTime(185,now);o.frequency.exponentialRampToValueAtTime(50,now+0.24);g.gain.setValueAtTime(0.5,now);g.gain.exponentialRampToValueAtTime(0.001,now+0.28);o.start(now);o.stop(now+0.29);setTimeout(function(){var o2=ctx.createOscillator(),g2=ctx.createGain();o2.type='sine';o2.connect(g2);g2.connect(ctx.destination);o2.frequency.setValueAtTime(120,ctx.currentTime);o2.frequency.exponentialRampToValueAtTime(38,ctx.currentTime+0.2);g2.gain.setValueAtTime(0.3,ctx.currentTime);g2.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+0.22);o2.start(ctx.currentTime);o2.stop(ctx.currentTime+0.23);},170);}\nfunction playSound(type){audioCtx.resume();if(soundPack===1){type==='keep'?playCashRegister():playBuzzer();}else{type==='keep'?playRisingChime():playLowThud();}}\nfunction startCamera(){navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:1280},height:{ideal:720}},audio:false}).then(function(stream){var v=document.getElementById('videoEl');v.srcObject=stream;v.play();setStatus('Ready','ready');startMotionDetection();}).catch(function(e){setStatus('Camera error: '+e.message,'');});}\nfunction startMotionDetection(){var video=document.getElementById('videoEl');var canvas=document.getElementById('captureCanvas');if(motionInterval)clearInterval(motionInterval);motionInterval=setInterval(function(){if(isAnalyzing||scanMode!=='auto'||!video.videoWidth)return;canvas.width=80;canvas.height=45;var ctx=canvas.getContext('2d');ctx.drawImage(video,0,0,80,45);var frame=ctx.getImageData(0,0,80,45).data;if(lastFrameData){var diff=0;for(var i=0;i<frame.length;i+=4)diff+=Math.abs(frame[i]-lastFrameData[i]);var avg=diff/(frame.length/4);if(avg<6){stableFrames++;if(stableFrames===3)setStatus('Hold still...','scanning');if(stableFrames>=STABLE_NEEDED){stableFrames=0;lastFrameData=null;captureAndAnalyze();}}else{stableFrames=0;if(!isAnalyzing)setStatus('Point at item','');}}lastFrameData=new Uint8ClampedArray(frame);},MOTION_MS);}\nfunction captureAndAnalyze(){var video=document.getElementById('videoEl');var canvas=document.getElementById('captureCanvas');var maxW=800;var scale=Math.min(1,maxW/video.videoWidth);canvas.width=Math.round(video.videoWidth*scale);canvas.height=Math.round(video.videoHeight*scale);canvas.getContext('2d').drawImage(video,0,0,canvas.width,canvas.height);var b64=canvas.toDataURL('image/jpeg',0.75).split(',')[1];analyze(b64);}\nfunction triggerManualScan(){if(isAnalyzing)return;stableFrames=0;captureAndAnalyze();}\nvar steps=[['Identifying item...','Vision scan in progress'],['Searching eBay...','Checking sold listings'],['Calculating value...','Averaging recent sales'],['Almost done...','Generating verdict']];\nfunction analyze(imageBase64){if(isAnalyzing)return;isAnalyzing=true;showScreen('loadingScreen');var si=0;updateStep(0);var iv=setInterval(function(){si=Math.min(si+1,steps.length-1);updateStep(si);},2500);fetch('/api/analyze',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({image:imageBase64,threshold:threshold})}).then(function(r){if(!r.ok)throw new Error('HTTP '+r.status);return r.json();}).then(function(data){clearInterval(iv);showResult(data);}).catch(function(e){clearInterval(iv);showResult({verdict:'KEEP',item_name:'Network error - set aside',avg_sold_price:0,reason:'Could not reach server ('+e.message+'). Set aside for manual review.'});});}\nfunction updateStep(i){document.getElementById('loadingStep').textContent=steps[i][0];document.getElementById('loadingSub').textContent=steps[i][1];}\nfunction showResult(r){var isKeep=(r.verdict||'KEEP').toUpperCase()==='KEEP';var rs=document.getElementById('resultScreen');rs.className='screen active '+(isKeep?'keep':'recycle');document.getElementById('resultVerdict').textContent=isKeep?'KEEP':'RECYCLE';document.getElementById('resultItemName').textContent=r.item_name||'Set aside for review';document.getElementById('resultPrice').textContent=r.avg_sold_price&&r.avg_sold_price>0?'$'+Number(r.avg_sold_price).toFixed(0):'--';document.getElementById('resultReason').textContent=r.reason||'';showScreen('resultScreen');playSound(isKeep?'keep':'recycle');var bar=document.getElementById('countdownBar');bar.style.transition='none';bar.style.width='100%';setTimeout(function(){bar.style.transition='width '+RESULT_MS+'ms linear';bar.style.width='0%';},30);clearTimeout(countdownTimer);countdownTimer=setTimeout(function(){dismissResult();},RESULT_MS);}\nfunction dismissResult(){clearTimeout(countdownTimer);isAnalyzing=false;stableFrames=0;lastFrameData=null;showScreen('scannerScreen');setStatus(scanMode==='auto'?'Point at item':'Ready','ready');}\nfunction showScreen(id){document.querySelectorAll('.screen').forEach(function(s){s.classList.remove('active');});document.getElementById(id).classList.add('active');}\nfunction setStatus(t,c){var p=document.getElementById('statusPill');p.textContent=t;p.className='status-pill'+(c?' '+c:'');}\nfunction setScanMode(mode){scanMode=mode;document.getElementById('modeManualOpt').classList.toggle('selected',mode==='manual');document.getElementById('modeAutoOpt').classList.toggle('selected',mode==='auto');var badge=document.getElementById('modeBadge');badge.textContent=mode.toUpperCase();badge.className='mode-badge'+(mode==='auto'?' auto':'');document.getElementById('scanLine').classList.toggle('active',mode==='auto');setStatus(mode==='auto'?'Point at item':'Ready','ready');stableFrames=0;lastFrameData=null;}\nfunction openSettings(){document.getElementById('settingsPanel').classList.add('open');document.getElementById('settingsBackdrop').classList.add('open');}\nfunction closeSettings(){document.getElementById('settingsPanel').classList.remove('open');document.getElementById('settingsBackdrop').classList.remove('open');}\nfunction updateThreshold(v){threshold=parseInt(v);document.getElementById('sliderValueLabel').textContent='$'+threshold;document.getElementById('thresholdDisplay').textContent='$'+threshold;}\nfunction selectPack(n){soundPack=n;document.getElementById('pack1Opt').classList.toggle('selected',n===1);document.getElementById('pack2Opt').classList.toggle('selected',n===2);document.getElementById('packToggleBtn').textContent='PACK '+n;playSound('keep');}\nfunction cycleSoundPack(){selectPack(soundPack===1?2:1);}\nwindow.addEventListener('load',function(){audioCtx.resume();startCamera();});\ndocument.addEventListener('touchstart',function(){audioCtx.resume();},{once:true});\ndocument.addEventListener('click',function(){audioCtx.resume();},{once:true});\n</script>\n</body>\n</html>";

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
      console.log('[API] Status:', res.statusCode, '| Response length:', data.length);
      console.log('[API] Raw response:', data.slice(0, 500));
      try { callback(null, JSON.parse(data)); }
      catch(e) { callback(null, {content:[], _raw: data, _parseErr: e.message}); }
    });
  });
  req.on('error', function(e) {
    console.log('[API] Request error:', e.message);
    callback(e);
  });
  req.write(body);
  req.end();
}

function extractText(content) {
  return (content || []).filter(function(b){return b.type==='text';}).map(function(b){return b.text;}).join('');
}

function extractResult(text, fallbackName) {
  var depth=0, start=-1;
  for(var i=0;i<text.length;i++){
    if(text[i]==='{'){if(depth===0)start=i;depth++;}
    else if(text[i]==='}' && depth>0){
      depth--;
      if(depth===0 && start!==-1){
        try{return JSON.parse(text.slice(start,i+1));}catch(e){start=-1;}
      }
    }
  }
  var vm=text.match(/"verdict"\s*:\s*"(KEEP|RECYCLE)"/i);
  var nm=text.match(/"item_name"\s*:\s*"([^"]{3,})"/);
  var pm=text.match(/"avg_sold_price"\s*:\s*(\d+(?:\.\d+)?)/);
  var rm=text.match(/"reason"\s*:\s*"([^"]{5,})"/);
  return {
    verdict: vm?vm[1].toUpperCase():'KEEP',
    item_name: nm?nm[1]:(fallbackName||'Set aside for review'),
    avg_sold_price: pm?parseFloat(pm[1]):0,
    reason: rm?rm[1]:'Could not retrieve pricing. Set aside for processor review.'
  };
}

const server = http.createServer(function(req, res) {
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Access-Control-Allow-Methods','GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type');
  if(req.method==='OPTIONS'){res.writeHead(204);res.end();return;}

  if(req.method==='GET' && req.url==='/'){
    res.writeHead(200,{'Content-Type':'text/html'});
    res.end(HTML_PAGE);
    return;
  }

  if(req.method==='POST' && req.url==='/api/analyze'){
    var body='';
    req.on('data',function(chunk){body+=chunk;});
    req.on('end',function(){
      var parsed;
      try{parsed=JSON.parse(body);}
      catch(e){
        res.writeHead(400,{'Content-Type':'application/json'});
        res.end(JSON.stringify({verdict:'KEEP',item_name:'Bad request',avg_sold_price:0,reason:'Request parse error.'}));
        return;
      }

      var thresh=parsed.threshold||30;
      var image=parsed.image||'';

      console.log('[SCAN] Image length:', image.length, '| Threshold:', thresh);
      console.log('[SCAN] API key length:', API_KEY.length, '| Prefix:', API_KEY.slice(0,12));

      if(!image || image.length < 100){
        res.writeHead(200,{'Content-Type':'application/json'});
        res.end(JSON.stringify({verdict:'KEEP',item_name:'Image capture failed - try again',avg_sold_price:0,reason:'Camera did not send a valid image.'}));
        return;
      }

      // STEP 1: Vision only - identify the item
      var step1={
        model:'claude-sonnet-4-20250514',
        max_tokens:200,
        system:'You are an electronics identification expert. Look at this image and identify the item. Give ONLY the brand name, model name/number, and item type on a single line. Nothing else. Example: Cisco Catalyst 2960 24-Port Network Switch',
        messages:[{
          role:'user',
          content:[
            {type:'image',source:{type:'base64',media_type:'image/jpeg',data:image}},
            {type:'text',text:'Identify this item. Brand, model, type only. One line.'}
          ]
        }]
      };

      console.log('[SCAN] Calling Step 1 vision...');
      callClaude(step1,function(err,r1){
        if(err){
          console.log('[SCAN] Step1 network error:', err.message);
          res.writeHead(200,{'Content-Type':'application/json'});
          res.end(JSON.stringify({verdict:'KEEP',item_name:'API error - set aside',avg_sold_price:0,reason:'Could not reach AI. Set aside for review.'}));
          return;
        }

        console.log('[SCAN] Step1 response keys:', Object.keys(r1).join(','));

        if(r1.error || r1.type === 'error'){
          console.log('[SCAN] Step1 API error:', JSON.stringify(r1).slice(0,300));
          res.writeHead(200,{'Content-Type':'application/json'});
          res.end(JSON.stringify({verdict:'KEEP',item_name:'AI error - set aside',avg_sold_price:0,reason:'AI returned an error: '+( r1.error && r1.error.message ? r1.error.message : JSON.stringify(r1).slice(0,80))}));
          return;
        }

        var itemName=extractText(r1.content).trim().replace(/[\r\n]+/g,' ').slice(0,150);
        console.log('[SCAN] Step1 identified:', itemName);

        if(!itemName||itemName.length<3) itemName='Electronic item';

        // STEP 2: Web search pricing
        var step2={
          model:'claude-sonnet-4-20250514',
          max_tokens:500,
          tools:[{type:'web_search_20250305',name:'web_search'}],
          system:'You are an eBay pricing expert. Search eBay completed sold listings for the given item. Return ONLY a JSON object, no markdown. Threshold: $'+thresh+'. KEEP if avg sold >= $'+thresh+', RECYCLE if below. When uncertain return KEEP. Format exactly: {"verdict":"KEEP","item_name":"name","avg_sold_price":45,"reason":"One sentence."}',
          messages:[{role:'user',content:'Search eBay sold listings for: '+itemName+'. Return JSON verdict only.'}]
        };

        console.log('[SCAN] Calling Step 2 pricing for:', itemName);
        callClaude(step2,function(err2,r2){
          if(err2){
            console.log('[SCAN] Step2 network error:', err2.message);
            res.writeHead(200,{'Content-Type':'application/json'});
            res.end(JSON.stringify({verdict:'KEEP',item_name:itemName,avg_sold_price:0,reason:'Could not retrieve eBay pricing. Set aside for review.'}));
            return;
          }

          if(r2.error || r2.type === 'error'){
            console.log('[SCAN] Step2 API error:', JSON.stringify(r2).slice(0,300));
            res.writeHead(200,{'Content-Type':'application/json'});
            res.end(JSON.stringify({verdict:'KEEP',item_name:itemName,avg_sold_price:0,reason:'Pricing lookup failed. Set aside for review.'}));
            return;
          }

          var text=extractText(r2.content);
          console.log('[SCAN] Step2 text:', text.slice(0,300));
          var result=extractResult(text, itemName);
          if(!result.item_name||result.item_name.length<3) result.item_name=itemName;
          console.log('[SCAN] Final:', JSON.stringify(result));
          res.writeHead(200,{'Content-Type':'application/json'});
          res.end(JSON.stringify(result));
        });
      });
    });
    return;
  }

  res.writeHead(404);res.end('Not found');
});

server.listen(PORT,function(){console.log('XRT Scanner running on port '+PORT);});
