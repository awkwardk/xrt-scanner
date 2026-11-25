'use strict';
// Login, backup rules, learning suggestions, and review gates.
// No eBay calls and no disk access here — server.js does the I/O.
const crypto = require('crypto');

var SESSION_MS = 30 * 24 * 60 * 60 * 1000;
var PHOTO_CHECKS = ['front', 'back', 'label', 'ports', 'powered', 'accessories', 'damage'];

function pinsFromEnv(env){
  env = env || {};
  return {
    admin: String(env.XRT_ADMIN_PIN || ''),
    staff: String(env.XRT_STAFF_PIN || '')
  };
}
function pinsConfigured(env){
  var p = pinsFromEnv(env);
  return !!(p.admin && p.staff);
}
function pinEquals(a, b){
  var ha = crypto.createHash('sha256').update(String(a)).digest();
  var hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}
function roleForPin(pin, env){
  var p = pinsFromEnv(env);
  var s = String(pin || '');
  if(!s || !p.admin || !p.staff) return null;
  if(pinEquals(s, p.admin)) return 'admin';
  if(pinEquals(s, p.staff)) return 'staff';
  return null;
}
function sessionSecret(env){
  var p = pinsFromEnv(env);
  return crypto.createHash('sha256').update('xrt-session|' + p.admin + '|' + p.staff).digest();
}
function signSession(role, env, now){
  var exp = (now || Date.now()) + SESSION_MS;
  var body = role + '.' + exp;
  var sig = crypto.createHmac('sha256', sessionSecret(env)).update(body).digest('hex');
  return body + '.' + sig;
}
function readSessionToken(token, env, now){
  var raw = String(token || '');
  var parts = raw.split('.');
  if(parts.length !== 3) return null;
  if(parts[0] !== 'admin' && parts[0] !== 'staff') return null;
  var body = parts[0] + '.' + parts[1];
  var expect = crypto.createHmac('sha256', sessionSecret(env)).update(body).digest('hex');
  if(expect.length !== parts[2].length) return null;
  if(!crypto.timingSafeEqual(Buffer.from(expect), Buffer.from(parts[2]))) return null;
  var exp = parseInt(parts[1], 10);
  if(!(exp > (now || Date.now()))) return null;
  return { role: parts[0], exp: exp };
}
function readCookie(header, name){
  var parts = String(header || '').split(';');
  for(var i = 0; i < parts.length; i++){
    var bit = parts[i].trim();
    if(bit.indexOf(name + '=') === 0) return decodeURIComponent(bit.slice(name.length + 1));
  }
  return '';
}
function sessionCookie(token, secure){
  var bits = ['xrt_session=' + encodeURIComponent(token), 'HttpOnly', 'SameSite=Lax', 'Path=/', 'Max-Age=' + Math.floor(SESSION_MS / 1000)];
  if(secure) bits.push('Secure');
  return bits.join('; ');
}
function clearCookie(secure){
  var bits = ['xrt_session=', 'HttpOnly', 'SameSite=Lax', 'Path=/', 'Max-Age=0'];
  if(secure) bits.push('Secure');
  return bits.join('; ');
}
function pathOnly(url){ return String(url || '/').split('?')[0]; }
function isPublicPath(method, url){
  var p = pathOnly(url);
  if(p === '/ping' || p === '/ping/') return true;
  if(p === '/login' || p === '/api/login' || p === '/api/logout') return true;
  if(p === '/api/backup') return true;
  if(/^\/(manifest-.*\.json|icon-.*\.png|pick-icon\.svg|pick-manifest\.json|favicon\.ico)$/.test(p)) return true;
  return false;
}
function isAdminOnly(method, url){
  var p = pathOnly(url);
  var m = String(method || '').toUpperCase();
  if(p === '/api/clear-listings') return true;
  if(m === 'DELETE' && /^\/api\/listings\/\d+$/.test(p)) return true;
  if(m === 'DELETE' && /^\/api\/buyers\//.test(p)) return true;
  if(p === '/api/learning/accept' || p === '/api/learning/skip' || p === '/api/learning/sync-sales') return true;
  return false;
}
function corsAllowOrigin(origin, host, proto){
  if(!origin || !host) return '';
  var http = 'http://' + host;
  var https = 'https://' + host;
  if(origin === http || origin === https) return origin;
  if(proto && origin === proto + '://' + host) return origin;
  return '';
}
function backupTokenOk(header, env){
  var expected = String((env || {}).XRT_BACKUP_TOKEN || '');
  if(!expected) return { ok:false, status:503, error:'Set XRT_BACKUP_TOKEN on Render. Backups are closed until that is set.' };
  var got = String(header || '');
  var m = got.match(/^Bearer\s+(\S+)$/i);
  var token = m ? m[1] : got;
  if(!token || !pinEquals(token, expected)) return { ok:false, status:401, error:'Bad backup token' };
  return { ok:true };
}
function backupExcluded(name){
  var n = String(name || '').toLowerCase();
  if(n === 'ebay-tokens.json') return true;
  if(/token|secret|credential|password/.test(n)) return true;
  return false;
}
function clearConfirmed(body){
  return !!(body && String(body.confirm || '') === 'CLEAR');
}
function appendFieldEdit(listing, field, from, to, by){
  listing = listing || {};
  var a = from == null ? '' : (typeof from === 'string' ? from : JSON.stringify(from));
  var b = to == null ? '' : (typeof to === 'string' ? to : JSON.stringify(to));
  if(a === b) return listing;
  if(!Array.isArray(listing.edit_history)) listing.edit_history = [];
  listing.edit_history.push({ at: new Date().toISOString(), field: field, from: a.slice(0, 500), to: b.slice(0, 500), by: by || 'operator' });
  return listing;
}
function failAuditNeedsAck(record){
  var listing = record && record.listing;
  if(!listing || !listing.audit || listing.audit.verdict !== 'fail') return false;
  var ack = listing.audit_ack;
  if(!ack || ack.fingerprint !== listing.audit.fingerprint) return true;
  return false;
}
function checklistOk(body){
  body = body || {};
  var c = body.photo_checklist || {};
  var skipPower = body.powerTest === 'N/A' || body.powerTest === 'NA';
  var missing = PHOTO_CHECKS.filter(function(k){
    if(k === 'powered' && skipPower) return false;
    return !c[k];
  });
  if(!missing.length) return { ok:true };
  var reason = String(c.override_reason || '').trim();
  if(reason.length >= 3) return { ok:true, override:true };
  return { ok:false, missing: missing };
}
function saleFromItem(item){
  item = item || {};
  var qty = parseInt(item.quantity_sold, 10) || 0;
  var price = parseFloat(item.current_price);
  if(!(price > 0) || isNaN(price)) price = null;
  var sold = qty > 0 && price != null;
  return {
    listing_status: String(item.listing_status || ''),
    quantity_sold: qty,
    current_price: price,
    sold_price: sold ? Math.round(price * 100) / 100 : null,
    sold_at: sold ? (item.end_time || null) : null
  };
}
function suggestionId(text){
  return crypto.createHash('sha256').update(String(text)).digest('hex').slice(0, 16);
}
function weeklySuggestions(records, now){
  now = now || Date.now();
  var week = 7 * 24 * 60 * 60 * 1000;
  var groups = {};
  function bucket(rec){
    var meta = rec.meta || {};
    var snap = (rec.listing && rec.listing.ai_snapshot) || {};
    var cat = String(rec.ebay_category_name || snap.category_name || 'items');
    var grade = String(meta.grade || snap.grade || '?').toUpperCase();
    return { category: cat, grade: grade, lot_size: (rec.listing && rec.listing.is_lot && rec.listing.lot_quantity > 1) ? String(rec.listing.lot_quantity) : '1' };
  }
  function add(key, pct, weight){
    if(!groups[key.id]) groups[key.id] = { category: key.category, grade: key.grade, lot_size: key.lot_size, pcts: [], n: 0 };
    var g = groups[key.id];
    for(var w = 0; w < weight; w++) g.pcts.push(pct);
    g.n += 1;
  }
  (records || []).forEach(function(rec){
    var listing = rec.listing || {};
    var key = bucket(rec);
    key.id = key.grade + '|' + key.category.toLowerCase() + '|' + key.lot_size;
    var hist = [].concat(listing.price_history || []);
    hist.forEach(function(h){
      var at = Date.parse(h.at || '');
      if(!(at >= now - week && at <= now)) return;
      var from = parseFloat(h.from), to = parseFloat(h.to);
      if(!(from > 0) || !(to > 0)) return;
      add(key, Math.round((to - from) / from * 100), h.by === 'sale' ? 2 : 1);
    });
    var sale = rec.sale || {};
    var soldAt = Date.parse(sale.sold_at || '');
    var ai = parseFloat(listing.ai_suggested_price);
    if(soldAt >= now - week && sale.sold_price > 0 && ai > 0){
      add(key, Math.round((sale.sold_price - ai) / ai * 100), 2);
    }
  });
  var out = [];
  Object.keys(groups).forEach(function(id){
    var g = groups[id];
    if(g.n < 3) return;
    g.pcts.sort(function(a, b){ return a - b; });
    var mid = g.pcts[Math.floor(g.pcts.length / 2)];
    if(Math.abs(mid) < 5) return;
    var verb = mid < 0 ? 'lowered' : 'raised';
    var who = 'Grade ' + g.grade + ' ' + g.category;
    var text = 'You ' + verb + ' ' + who + ' by ~' + Math.abs(mid) + '% ' + g.n + ' times; apply ' + (mid < 0 ? '-' : '+') + Math.abs(mid) + '%?';
    out.push({
      id: suggestionId(text),
      text: text,
      category: g.category,
      grade: g.grade,
      lot_size: g.lot_size,
      ratio: Math.round((1 + mid / 100) * 1000) / 1000,
      label: 'rule applied: ' + (mid < 0 ? '-' : '+') + Math.abs(mid) + '%'
    });
  });
  return out;
}
function loginPageHtml(message){
  var msg = message ? '<p class="err">' + String(message).replace(/[<>&]/g, '') + '</p>' : '';
  return '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
    + '<title>XRT login</title><style>body{font-family:Arial,sans-serif;background:#111;color:#fff;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0}'
    + 'form{background:#1c1c1c;padding:28px;border-radius:12px;width:min(360px,92vw)}h1{font-size:22px;margin:0 0 8px}p{color:#aaa;font-size:14px}'
    + 'input{width:100%;padding:14px;font-size:18px;border-radius:8px;border:1px solid #444;background:#000;color:#fff;margin:12px 0}'
    + 'button{width:100%;padding:14px;font-size:16px;font-weight:bold;border:0;border-radius:8px;background:#e8ff00;color:#111}'
    + '.err{color:#ff8a80}</style></head><body><form method="POST" action="/api/login"><h1>XRT</h1>'
    + '<p>Enter the PIN for this phone. It stays signed in for 30 days.</p>' + msg
    + '<input id="pin" name="pin" type="password" inputmode="numeric" autocomplete="current-password" placeholder="PIN" autofocus>'
    + '<button type="submit">Continue</button></form>'
    + '<script>document.querySelector("form").addEventListener("submit",function(e){e.preventDefault();var pin=document.getElementById("pin").value;'
    + 'fetch("/api/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({pin:pin})}).then(function(r){return r.json().then(function(d){return {ok:r.ok,d:d};});}).then(function(x){if(x.ok&&x.d&&x.d.success){location.href="/processor";}else{location.href="/login?e=1";}}).catch(function(){location.href="/login?e=1";});});</script>'
    + '</body></html>';
}
function setupMessage(){
  return 'Set XRT_ADMIN_PIN and XRT_STAFF_PIN on Render. Login is closed until both are set.';
}

module.exports = {
  SESSION_MS: SESSION_MS,
  PHOTO_CHECKS: PHOTO_CHECKS,
  pinsConfigured: pinsConfigured,
  roleForPin: roleForPin,
  signSession: signSession,
  readSessionToken: readSessionToken,
  readCookie: readCookie,
  sessionCookie: sessionCookie,
  clearCookie: clearCookie,
  isPublicPath: isPublicPath,
  isAdminOnly: isAdminOnly,
  corsAllowOrigin: corsAllowOrigin,
  backupTokenOk: backupTokenOk,
  backupExcluded: backupExcluded,
  clearConfirmed: clearConfirmed,
  appendFieldEdit: appendFieldEdit,
  failAuditNeedsAck: failAuditNeedsAck,
  checklistOk: checklistOk,
  saleFromItem: saleFromItem,
  weeklySuggestions: weeklySuggestions,
  loginPageHtml: loginPageHtml,
  setupMessage: setupMessage
};
