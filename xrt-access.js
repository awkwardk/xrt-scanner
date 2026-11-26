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
function priceDeltaPct(ai, finalP){
  var a = parseFloat(ai), f = parseFloat(finalP);
  if(!(a > 0) || !(f > 0) || isNaN(a) || isNaN(f)) return null;
  return Math.round((f - a) / a * 1000) / 10;
}
function answerBucket(record){
  var listing = (record && record.listing) || {};
  var meta = (record && record.meta) || {};
  var snap = listing.ai_snapshot || {};
  var lot = (listing.is_lot && parseInt(listing.lot_quantity, 10) > 1) ? String(parseInt(listing.lot_quantity, 10)) : '1';
  return {
    category: String(record && (record.ebay_category_name || snap.category_name || meta.category_name) || 'uncategorized').trim() || 'uncategorized',
    grade: String(meta.grade || snap.grade || '?').toUpperCase(),
    lot_size: lot,
    qty: parseInt((record && (record.quantity || meta.quantity)) || listing.quantity || snap.quantity, 10) || 1
  };
}
function compsSummary(record){
  var listing = (record && record.listing) || {};
  var snap = listing.ai_snapshot || {};
  function n(v){ var x = parseFloat(v); return (x > 0 && !isNaN(x)) ? Math.round(x * 100) / 100 : null; }
  return {
    avg_sold_price: n(snap.avg_sold_price != null ? snap.avg_sold_price : listing.avg_sold_price),
    price_low: n(snap.price_low != null ? snap.price_low : listing.price_low),
    price_high: n(snap.price_high != null ? snap.price_high : listing.price_high),
    unit_median_price: n(snap.unit_median_price != null ? snap.unit_median_price : listing.unit_median_price),
    lot_comp_median: n(snap.lot_comp_median != null ? snap.lot_comp_median : listing.lot_comp_median)
  };
}
function answerKeyRow(record, opts){
  opts = opts || {};
  record = record || {};
  var listing = record.listing || {};
  var bucket = answerBucket(record);
  var ai = parseFloat(opts.ai_price != null ? opts.ai_price : listing.ai_suggested_price);
  var finalP = parseFloat(opts.final_price);
  if(!(ai > 0) || !(finalP > 0)) return null;
  return {
    sku: record.sku,
    category: bucket.category,
    grade: bucket.grade,
    lot_size: bucket.lot_size,
    qty: bucket.qty,
    comps: compsSummary(record),
    ai_price: Math.round(ai * 100) / 100,
    final_price: Math.round(finalP * 100) / 100,
    delta_pct: priceDeltaPct(ai, finalP),
    who: opts.who || 'operator',
    when: opts.when || new Date().toISOString(),
    reason: String(opts.reason || '').trim().slice(0, 200)
  };
}
function rowsFromRecord(record){
  var listing = (record && record.listing) || {};
  var ai = parseFloat(listing.ai_suggested_price);
  if(!(ai > 0)) return [];
  var rows = [];
  (listing.price_history || []).forEach(function(h){
    if(!h || h.by === 'rule') return;
    var to = parseFloat(h.to);
    if(!(to > 0)) return;
    var row = answerKeyRow(record, { ai_price: ai, final_price: to, who: h.by || 'operator', when: h.at, reason: h.reason || '' });
    if(row) rows.push(row);
  });
  var pub = parseFloat(record.published_price);
  if(pub > 0){
    var rounded = Math.round(pub * 100) / 100;
    var already = rows.some(function(r){ return r.final_price === rounded; });
    if(!already && rounded !== Math.round(ai * 100) / 100){
      var published = answerKeyRow(record, { ai_price: ai, final_price: pub, who: 'publish', when: record.published_at || record.listed_at || '' });
      if(published) rows.push(published);
    }
  }
  return rows;
}
function answerRowKey(row){
  return [row.sku, row.when, row.final_price, row.ai_price].join('|');
}
function mergeAnswerKey(existing, records){
  var seen = {};
  var out = (existing || []).slice();
  out.forEach(function(row){ if(row) seen[answerRowKey(row)] = true; });
  (records || []).forEach(function(rec){
    rowsFromRecord(rec).forEach(function(row){
      var key = answerRowKey(row);
      if(seen[key]) return;
      seen[key] = true;
      out.push(row);
    });
  });
  return out;
}
function medianOf(nums){
  var xs = (nums || []).filter(function(n){ return typeof n === 'number' && isFinite(n); }).sort(function(a, b){ return a - b; });
  if(!xs.length) return null;
  var mid = Math.floor(xs.length / 2);
  if(xs.length % 2) return xs[mid];
  return (xs[mid - 1] + xs[mid]) / 2;
}
function closestAnswerRows(record, rows){
  var bucket = answerBucket(record);
  function take(pred){ return (rows || []).filter(pred); }
  var exact = take(function(row){
    return String(row.category).toLowerCase() === bucket.category.toLowerCase() && String(row.grade).toUpperCase() === bucket.grade && String(row.lot_size) === bucket.lot_size;
  });
  if(exact.length) return exact;
  return take(function(row){
    return String(row.category).toLowerCase() === bucket.category.toLowerCase() && String(row.grade).toUpperCase() === bucket.grade;
  });
}
function gradeAiPrice(record, rows){
  var listing = (record && record.listing) || {};
  var ai = parseFloat(listing.ai_suggested_price || listing.suggested_price);
  var examples = closestAnswerRows(record, rows);
  if(!(ai > 0) || !examples.length) return { verdict: 'none', text: '', n: 0, usual: null };
  var usual = medianOf(examples.map(function(row){ return row.final_price; }));
  if(usual == null || !(usual > 0)) return { verdict: 'none', text: '', n: 0, usual: null };
  var pass = Math.abs(ai - usual) / usual <= 0.10;
  var usualR = Math.round(usual);
  var text = 'Kendall usually prices similar items at $' + usualR + ' (based on ' + examples.length + ' examples).';
  return { verdict: pass ? 'pass' : 'warn', text: text, n: examples.length, usual: usualR };
}
function graderBadgeHtml(grade){
  if(!grade || grade.verdict === 'none' || !grade.text) return '';
  var bg = grade.verdict === 'pass' ? '#2e7d32' : '#e65100';
  var label = grade.verdict === 'pass' ? 'GRADER PASS' : 'GRADER WARN';
  var text = String(grade.text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return '<div style="flex:1 0 100%;font-size:12.5px;"><span style="background:' + bg + ';color:#fff;padding:2px 8px;border-radius:4px;font-weight:bold;margin-right:6px;">' + label + '</span>' + text + '</div>';
}
function replayCoach(candidate, rows){
  var closer = 0, worse = 0, unchanged = 0;
  (rows || []).forEach(function(row){
    if(!candidate) return;
    if(candidate.category && String(row.category).toLowerCase() !== String(candidate.category).toLowerCase()) return;
    if(candidate.grade && String(row.grade).toUpperCase() !== String(candidate.grade).toUpperCase()) return;
    if(candidate.lot_size && String(row.lot_size) !== String(candidate.lot_size)) return;
    var ai = parseFloat(row.ai_price), finalP = parseFloat(row.final_price);
    if(!(ai > 0) || !(finalP > 0)) return;
    var oldErr = Math.abs(ai - finalP);
    var newErr = Math.abs(ai * candidate.ratio - finalP);
    if(newErr < oldErr - 0.5) closer++;
    else if(newErr > oldErr + 0.5) worse++;
    else unchanged++;
  });
  return { closer: closer, worse: worse, unchanged: unchanged };
}
function proposeCoachRule(rows){
  var groups = {};
  (rows || []).forEach(function(row){
    if(!(row.ai_price > 0) || !(row.final_price > 0)) return;
    var id = String(row.grade).toUpperCase() + '|' + String(row.category).toLowerCase() + '|' + row.lot_size;
    if(!groups[id]) groups[id] = { category: row.category, grade: String(row.grade).toUpperCase(), lot_size: String(row.lot_size), ratios: [] };
    groups[id].ratios.push(row.final_price / row.ai_price);
  });
  var best = null;
  Object.keys(groups).forEach(function(id){
    var group = groups[id];
    if(group.ratios.length < 5) return;
    var ratio = Math.round(medianOf(group.ratios) * 1000) / 1000;
    if(!(ratio > 0) || Math.abs(1 - ratio) < 0.03) return;
    var trial = { category: group.category, grade: group.grade, lot_size: group.lot_size, ratio: ratio };
    var replay = replayCoach(trial, rows);
    if(!(replay.closer > replay.worse)) return;
    var score = replay.closer - replay.worse;
    if(best && score <= best.score) return;
    var pct = Math.round((1 - ratio) * 100);
    best = {
      score: score,
      id: suggestionId(group.category + '|' + group.grade + '|' + group.lot_size + '|' + ratio),
      category: group.category,
      grade: group.grade,
      lot_size: group.lot_size,
      ratio: ratio,
      n: group.ratios.length,
      closer: replay.closer,
      worse: replay.worse,
      label: pct > 0 ? ('rule applied: -' + pct + '%') : ('rule applied: +' + Math.abs(pct) + '%'),
      text: 'Grade ' + group.grade + ' ' + group.category + (group.lot_size !== '1' ? ' lot of ' + group.lot_size : '') + ': price about ' + Math.abs(pct) + '% ' + (pct >= 0 ? 'under' : 'over') + ' the AI price. Replay on past answers: ' + replay.closer + ' closer, ' + replay.worse + ' worse.'
    };
  });
  if(!best) return null;
  delete best.score;
  return best;
}
function promoteCandidate(rules, candidate){
  rules = rules || {};
  rules.overrides = rules.overrides || [];
  rules.buckets = rules.buckets || [];
  rules.skipped = rules.skipped || [];
  rules.overrides.push({
    id: candidate.id,
    category: candidate.category,
    grade: candidate.grade,
    lot_size: candidate.lot_size,
    ratio: candidate.ratio,
    label: candidate.label,
    n: candidate.n || 0,
    accepted_at: new Date().toISOString(),
    source: 'coach'
  });
  return rules;
}
function graderReport(rows){
  var sorted = (rows || []).slice().sort(function(a, b){ return String(a.when || '').localeCompare(String(b.when || '')); });
  var hits = 0, judged = 0, misses = [];
  var byMonth = {};
  sorted.forEach(function(row, index){
    var prior = sorted.slice(0, index);
    var fake = {
      sku: row.sku,
      ebay_category_name: row.category,
      meta: { grade: row.grade },
      listing: { ai_suggested_price: row.ai_price, is_lot: String(row.lot_size) !== '1', lot_quantity: String(row.lot_size) === '1' ? 1 : parseInt(row.lot_size, 10) }
    };
    var grade = gradeAiPrice(fake, prior);
    if(grade.verdict === 'none') return;
    judged++;
    var month = String(row.when || '').slice(0, 7) || 'unknown';
    if(!byMonth[month]) byMonth[month] = { month: month, hits: 0, total: 0 };
    byMonth[month].total++;
    if(grade.verdict === 'pass'){ hits++; byMonth[month].hits++; }
    else misses.push(row);
  });
  return {
    count: sorted.length,
    judged: judged,
    hits: hits,
    rate: judged ? Math.round(hits / judged * 100) : null,
    byMonth: Object.keys(byMonth).sort().map(function(key){ return byMonth[key]; }),
    misses: misses.slice(-8).reverse()
  };
}
function answerKeyPageHtml(report){
  report = report || { count: 0, judged: 0, hits: 0, rate: null, byMonth: [], misses: [] };
  function esc(s){ return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  var months = (report.byMonth || []).map(function(month){
    var rate = month.total ? Math.round(month.hits / month.total * 100) : 0;
    return '<li>' + esc(month.month) + ': ' + rate + '% already close (' + month.hits + ' of ' + month.total + ')</li>';
  }).join('');
  var misses = (report.misses || []).map(function(row){
    return '<li>SKU ' + esc(row.sku) + ' ' + esc(row.grade) + ' ' + esc(row.category) + ': AI $' + esc(row.ai_price) + ', kept $' + esc(row.final_price) + ' (' + esc(row.delta_pct) + '%)</li>';
  }).join('');
  return '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Answer key</title></head><body style="font-family:Arial,sans-serif;max-width:760px;margin:32px auto;padding:0 16px;color:#222;">'
    + '<p><a href="/api/listings">Back to listings</a></p><h1>Answer key</h1>'
    + '<p>' + report.count + ' saved answers. Where earlier examples existed, the grader was already close ' + (report.rate == null ? 'not yet' : report.rate + '% of the time') + ' (' + report.hits + ' of ' + report.judged + ').</p>'
    + '<h2>Is the AI getting closer?</h2><ul>' + (months || '<li>Not enough history yet.</li>') + '</ul>'
    + '<h2>Recent misses</h2><ul>' + (misses || '<li>None yet.</li>') + '</ul></body></html>';
}

// eBay OAuth. redirect_uri is the RuName when EBAY_RUNAME is set. The portal
// "Auth accepted URL" stays the real callback, not the RuName.
var EBAY_EXTRA_SCOPE_URLS = [
  'https://api.ebay.com/oauth/api_scope/sell.marketing',
  'https://api.ebay.com/oauth/api_scope/sell.analytics.readonly',
  'https://api.ebay.com/oauth/api_scope/sell.finances',
  'https://api.ebay.com/oauth/api_scope/commerce.notification.subscription'
];
function ebayExtraScopesOn(env){
  var v = String((env || {}).EBAY_EXTRA_SCOPES || '').trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes' || v === 'on';
}
function ebayScopes(env, base){
  var scopes = (base || []).slice();
  if(!ebayExtraScopesOn(env)) return scopes;
  EBAY_EXTRA_SCOPE_URLS.forEach(function(scope){
    if(scopes.indexOf(scope) < 0) scopes.push(scope);
  });
  return scopes;
}
function ebayOAuthRedirectUri(env){
  env = env || {};
  var ru = String(env.EBAY_RUNAME || '').trim();
  if(ru) return ru;
  return String(env.EBAY_REDIRECT_URI || 'https://xrt-scanner.onrender.com/ebay-auth-callback').trim();
}
function ebayAuthAcceptedUrl(env){
  var base = String((env || {}).PUBLIC_BASE_URL || 'https://xrt-scanner.onrender.com').replace(/\/+$/, '');
  return base + '/ebay-auth-callback';
}
function safeReturnPath(raw, fallback){
  var fb = fallback || '/api/listings';
  var s = String(raw == null ? '' : raw).trim();
  if(!s) return fb;
  for(var n = 0; n < 2; n++){
    if(s.indexOf('%') < 0) break;
    try {
      var next = decodeURIComponent(s);
      if(next === s) break;
      s = next;
    } catch(e){ return fb; }
  }
  if(s.charAt(0) !== '/') return fb;
  if(s.charAt(1) === '/' || s.charAt(1) === '\\') return fb;
  if(/[\u0000-\u0020\\]/.test(s)) return fb;
  if(s.indexOf('://') >= 0 || s.indexOf('..') >= 0) return fb;
  if(s.indexOf('/ebay-auth') === 0) return fb;
  if(s.length > 240) return fb;
  return s;
}
function ebayReconnectedLocation(raw){
  var path = safeReturnPath(raw, '/api/listings');
  if(/[?&]ebay=reconnected(?:&|$)/.test(path)) return path;
  return path + (path.indexOf('?') >= 0 ? '&' : '?') + 'ebay=reconnected';
}
function ebayAuthorizeUrl(opts){
  opts = opts || {};
  var url = String(opts.authBase || 'https://auth.ebay.com').replace(/\/+$/, '')
    + '/oauth2/authorize?client_id=' + encodeURIComponent(opts.clientId || '')
    + '&redirect_uri=' + encodeURIComponent(opts.redirectUri || '')
    + '&response_type=code&scope=' + encodeURIComponent((opts.scopes || []).join(' '));
  if(opts.state) url += '&state=' + encodeURIComponent(opts.state);
  return url;
}
function ebayReconnectToastHtml(on){
  if(!on) return '';
  return '<div id="ebayToast" style="position:fixed;top:16px;left:50%;transform:translateX(-50%);background:#1b5e20;color:#fff;padding:12px 18px;border-radius:8px;font-size:14px;font-weight:bold;z-index:80;box-shadow:0 4px 16px rgba(0,0,0,.25);">eBay reconnected</div>'
    + '<script>setTimeout(function(){var t=document.getElementById("ebayToast");if(t&&t.parentNode)t.parentNode.removeChild(t);},4000);</script>';
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
  setupMessage: setupMessage,
  priceDeltaPct: priceDeltaPct,
  answerKeyRow: answerKeyRow,
  rowsFromRecord: rowsFromRecord,
  mergeAnswerKey: mergeAnswerKey,
  gradeAiPrice: gradeAiPrice,
  graderBadgeHtml: graderBadgeHtml,
  replayCoach: replayCoach,
  proposeCoachRule: proposeCoachRule,
  promoteCandidate: promoteCandidate,
  graderReport: graderReport,
  answerKeyPageHtml: answerKeyPageHtml,
  ebayExtraScopesOn: ebayExtraScopesOn,
  ebayScopes: ebayScopes,
  ebayOAuthRedirectUri: ebayOAuthRedirectUri,
  ebayAuthAcceptedUrl: ebayAuthAcceptedUrl,
  safeReturnPath: safeReturnPath,
  ebayReconnectedLocation: ebayReconnectedLocation,
  ebayAuthorizeUrl: ebayAuthorizeUrl,
  ebayReconnectToastHtml: ebayReconnectToastHtml
};
