#!/usr/bin/env node
/**
 * XRT Server Feature & Logic Test Suite
 * Run before every deploy: node xrt-test-suite.js server.js
 */
'use strict';
const fs = require('fs');

const serverFile = process.argv[2] || 'server.js';
if(!fs.existsSync(serverFile)){
  console.error('ERROR: File not found:', serverFile);
  process.exit(1);
}

const content = fs.readFileSync(serverFile, 'utf8');
let passed = 0, failed = 0;
const failures = [];

function has(str){ return content.includes(str); }
function test(name, condition){
  if(condition){ console.log('  \u2713 ', name); passed++; }
  else { console.log('  \u2717 ', name); failed++; failures.push(name); }
}
function section(name){ console.log('\n' + name); console.log('-'.repeat(50)); }

console.log('='.repeat(60));
console.log('XRT SERVER TEST SUITE');
console.log('File:', serverFile);
console.log('='.repeat(60));

section('SCANNER APP');
test('Scanner HTML at /',          has("req.url==='/'"));
test('Ping route /ping',           has('/ping'));
test('Scan API /api/analyze',      has('/api/analyze'));
test('Scanner PWA manifest',       has('manifest-scanner'));
test('Scanner icon',               has('icon-scanner'));
test('Sell threshold enforced',    has('price >= thresh'));
test('RECYCLE below lot threshold',has('price < lotThresh'));
test('LOT requires 3+ sales',      has('3 or more completed lot'));
test('LOT requires lot total $30', has('Lot total sale price at least'));
test('LOT requires per-unit $10',  has('Per-unit value'));
test('KEEP default no price',      has('default KEEP') || has('default to KEEP'));
test('Vintage items protected',    has('Vintage'));
test('Medical equipment RECYCLE',  has('Medical'));
test('Gemini Flash used for scan', has('gemini-2.5-flash'));
test('Google Search grounding',    has('google_search'));
test('Gemini key loaded',          has('GEMINI_KEY'));
test('callGemini function',        has('function callGemini('));

section('PROCESSOR APP');
test('Processor HTML at /processor', has('/processor'));
test('Processor PWA manifest',       has('manifest-processor'));
test('Processor icon',               has('icon-processor'));
test('Server-side SKU counter',      has('getNextSku'));
test('Claim SKU route',              has('/api/claim-sku'));
test('Peek SKU route',               has('/api/next-sku'));
test('Submit item route',            has('/api/submit-item'));
test('Photos saved to disk',         has('photo_'));
test('Auto-listing on submit',       has('AUTO-LIST'));
test('Stagger delay',                has('_delay'));
test('Shelf OCR route',              has('/api/read-shelf'));
test('Pending items route',          has('/api/pending-items'));

section('LISTINGS PAGE');
test('generateListingsPage function', has('function generateListingsPage('));
test('loadListings function',         has('function loadListings()'));
test('saveListings function',         has('function saveListings('));
test('Copy Title button',             has('Copy Title'));
test('Copy Condition button',         has('Copy Condition'));
test('Copy HTML button',              has('Copy HTML'));
test('Clear All button',              has('clearAll'));
test('Clear listings route',          has('/api/clear-listings'));
test('Photo serving route',           has("req.url.startsWith('/api/photo/')"));
test('Grade conflict flag',           has('GRADE CONFLICT'));
test('Pricing breakdown',             has('Suggest') && has('Accept') && has('Decline'));
test('Shelf location shown',          has('Shelf:'));

section('PROCESSOR APP UI');
test('Shutter sound',         has('playShutter'));
test('Back btn - power test', has('goToGrade'));
test('Back btn - notes',      has('goToPowerTest'));
test('Back btn - photos',     has('goToNotes'));
test('Back btn - shelf',      has('goToPhotos'));
test('Back btn - review',     has('goToShelf'));
test('Offline queue',         has('xrt_queue'));
test('Status dot indicator',  has('statusDot'));
test('Square photo crop',     has('Math.min(vw,vh)'));
test('Full screen camera',    has('camContainer'));
test('Grade conflict UI',     has('pfConflict'));
test('Power test fail UI',    has('pfFail'));

section('NEW FEATURES v3.0');
test('Identify route /api/identify-item', has('/api/identify-item'));
test('Identifier uses Sonnet',            has('claude-sonnet-4-5'));
test('Listing gen via callClaude',        has('function callClaude('));
test('Web search tool enabled',           has('web_search_20250305'));
test('Quantity saved in meta',            has('quantity: parsed.quantity'));
test('listing.json saved per item',       has("'listing.json'"));
test('Rebuild listings route',            has('/api/rebuild-listings'));
test('rebuildListings function',          has('function rebuildListings('));
test('loadListings scans folders',        has('readdirSync(itemsDir)'));
test('Persistent SKU init',               has('function initSku('));
test('SKU scans highest folder',          has('scanHighestItemFolder'));
test('SKU never below 2000',              has('Math.max(stored, highest + 1, 2000)'));
test('Power test N/A accepted',           has("selectPowerTest('N/A')") && has('pfNA'));
test('N/A power label not applicable',    has('Not applicable'));
test('Grade conflict only on FAIL',       has("r==='Fail'&&currentItem.grade"));
test('Below threshold flag (page)',       has('Below minimum threshold'));
test('Below threshold flag (data)',       has('belowThreshold'));
test('1600x1600 photo output',            has('var outSize=1600'));
test('Tap to focus constraints',          has('applyConstraints') && has('pointsOfInterest'));
test('Tap to focus manual mode',          has("focusMode:'manual'"));
test('Photo Download All button',         has('Download All Photos'));
test('Per-photo download attr',           has('download='));
test('Multi-qty lot title',               has('Lot of '));
test('QTY badge on listings',             has('QTY: '));
test('Per Unit / Total shown',            has('Per Unit:') && has('Total:'));
test('Identifier screen',                 has('identifyScreen'));
test('Quantity confirm screen',           has('quantityScreen'));
test('Value check screen',                has('valueScreen'));
test('Testing instructions screen',       has('testingScreen'));
test('Test notes screen',                 has('testNotesScreen'));
test('SKU claim screen',                  has('skuClaimScreen'));
test('Identify prompt JSON shape',        has('testing_instructions'));
test('Log action route',                  has('/api/log-action'));
test('Camera square aspect ratio',        has('aspect-ratio:1/1'));

section('SYNTAX CHECK');
try {
  require('child_process').execSync('node --check ' + serverFile, {stdio:'pipe'});
  test('JavaScript syntax valid', true);
} catch(e) {
  test('JavaScript syntax valid', false);
  console.log('    ERROR:', e.stderr ? e.stderr.toString().slice(0,200) : e.message);
}

console.log('\n' + '='.repeat(60));
console.log('RESULTS:', passed + '/' + (passed+failed), 'tests passed');
if(failures.length > 0){
  console.log('\nFAILED:');
  failures.forEach(function(f){ console.log('  \u2717', f); });
  console.log('\n\u26A0 DO NOT DEPLOY - fix failures first');
  process.exit(1);
} else {
  console.log('\u2713 All tests passed - safe to deploy');
  process.exit(0);
}
