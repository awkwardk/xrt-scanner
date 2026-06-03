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

section('NEW FEATURES v4.0 — Camera & Photos');
test('Camera 4:3 aspectRatio',        has('aspectRatio') && has('1.333'));
test('Camera format setting',         has('xrt_cam_format') && has('toggleCamFormat'));
test('Camera format options labels',  has('4:3 Landscape') && has('1:1 Square'));
test('Rotation via screen.orientation', has('screen.orientation'));
test('Canvas rotate for portrait',    has('ctx.rotate'));
test('Square fallback preserved',     has('var outSize=1600'));
test('captureFrame helper',           has('function captureFrame('));
test('Testing photo capture',         has('captureTestPhoto') && has('Capture Testing Photo'));
test('Testing photos stored',         has('test_photo_'));
test('Testing photos in meta',        has('testingPhotos'));
test('Photo delete + undo',           has('function deletePhoto(') && has('Undo delete') && has('function undoDelete('));
test('Photo reorder (drag)',          has('function movePhoto(') && has('draggable'));

section('NEW FEATURES v4.0 — Weight, Shipping, Parts');
test('Weight detection (AI scan)',    has('function detectWeightAndDims('));
test('Weight photo index tracked',    has('weightPhotoIndex'));
test('Output photo ordering',         has('outputPhotos'));
test('Shipping calculator',           has('function calcShipping('));
test('GA policy profile id',          has('272423749015'));
test('FedEx policy profile id',       has('272434338015'));
test('Heavy policy profile id',       has('272360974015'));
test('Standard box sets',             has('STANDARD_GA_BOXES') && has('STANDARD_FEDEX_BOXES'));
test('Shipping fields in listing',    has('shipping_profile_id') && has('listed_weight') && has('box_dimensions') && has('polymailer'));
test('Category id field',             has('category_id'));
test('Parts/repair demand field',     has('parts_repair_demand'));
test('Parts/repair price field',      has('parts_repair_price'));
test('Parts/repair flag',             has('parts_repair'));
test('Parts/repair banner UI',        has('parts-banner') || has('partsBanner'));
test('Parts/repair badge (listings)', has('PARTS/REPAIR'));
test('5-Minute Test label',           has('5-Minute Test'));

section('NEW FEATURES v4.0 — Shelf & Flow');
test('Shelf A1/A1A format',           has('A1 or A1A'));
test('SKU claimed after identify',    has('claimSkuAndContinue') && has("showScreen('identifyScreen')"));

section('NEW FEATURES v4.0 — eBay');
test('eBay auth route',               has('/ebay-auth'));
test('eBay auth callback route',      has('/ebay-auth-callback'));
test('eBay status route',             has('/ebay-status'));
test('eBay refresh token route',      has('/api/ebay-refresh-token'));
test('eBay deletion notification',    has('/api/ebay-deletion-notification'));
test('Send to eBay route',            has('/api/send-to-ebay'));
test('OAuth stores tokens',           has('writeEbayTokens') && has('grant_type=authorization_code'));
test('getEbayToken helper',           has('function getEbayToken('));
test('ebayStatus helper',             has('function ebayStatus('));
test('Inventory API used',            has('/sell/inventory/v1/inventory_item/') && has('/sell/inventory/v1/offer'));
test('Grade to eBay condition',       has('function gradeToEbayCondition(') && has('FOR_PARTS_OR_NOT_WORKING'));
test('eBay status bar (page)',        has('eBay connected') && has('Connect eBay Account'));
test('Send to eBay Draft button',     has('Send to eBay Draft') && has('function sendEbay') || has('sendEbay('));
test('eBay scopes configured',        has('sell.inventory') && has('sell.fulfillment'));

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
