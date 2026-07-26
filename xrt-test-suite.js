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
test('Queue listing on submit',      has('enqueueListing(sku)'));
test('Queue 8s gap between calls',   has('QUEUE_GAP_MS = 8000'));
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
test('Tap to focus ring indicator',       has('function attachTapToFocus(') && has('focus-ring'));
test('Manual focus override removed',      !has('applyConstraints') && !has('pointsOfInterest') && !has("focusMode:'manual'"));
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
test('Identify reads text verbatim',      has('Read ALL visible text in the image exactly as printed'));
test('Identify char accuracy rule',       has('never substitute similar-looking characters'));
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
test('Item specifics in prompt',       has('Return an item_specifics object') && has('Compatible Brand'));
test('Item specifics in JSON shape',   has('"item_specifics"'));
test('Item specifics stored/normalized', has('listing.item_specifics'));
test('Aspects from item specifics',    has('aspects[k] = Array.isArray(v)') && has('function buildItemSpecificsXml('));
test('Item specifics collapsible UI',  has('Item Specifics (') && has('<details'));
test('Aspect rule in prompt',         has('65 characters or less') && has('array of individual short strings') && has('at most 10 words'));
test('Category specifics: phones',     has('Business phones (VoIP') && has('Number of Lines'));
test('Category specifics: switches',   has('Network switches / routers') && has('Number of Ports') && has('Transfer Rate'));
test('Category specifics: audio',      has('Audio equipment: Brand, Model, MPN, Type, Connectivity, Color, Features'));
test('Category specifics: video',      has('Video equipment') && has('Resolution'));
test('Category specifics: industrial', has('Business / Industrial electronics'));
test('Specifics must be specific',     has('SPECIFIC and ACCURATE for this exact item'));
test('trimAspects helper exists',      has('function trimAspects('));
test('splitToLimit helper',            has('function splitToLimit(') && has('LIMIT = 65'));
test('trimAspects splits Features',    has("k === 'Features'"));
test('trimAspects dedupes values',     has('remove empties + dedupe'));
test('trimAspects applied to offer',   has('aspects = trimAspects(aspects)'));
test('Pre-flight validate helper',     has('function validateForPublish('));
test('Validate title under 80',        has('max 80) — shorten'));
test('Validate price greater than 0',  has('Price must be greater than 0'));
test('Validate aspect under 65',       has('over 65 characters'));
test('Listing blocks on validation',   has('Cannot list — fix these first'));
test('Parts/repair demand field',     has('parts_repair_demand'));
test('Parts/repair price field',      has('parts_repair_price'));
test('Parts/repair flag',             has('parts_repair'));
test('Parts/repair banner UI',        has('parts-banner') || has('partsBanner'));
test('Parts/repair badge (listings)', has('PARTS/REPAIR'));
test('5-Minute Test label',           has('5-Minute Test'));

section('NEW FEATURES v4.0 — Shelf & Flow');
test('Shelf A1/A1A format',           has('A1 or A1A'));
test('SKU claimed after identify',    has('claimSkuAndContinue') && has("showScreen('identifyScreen')"));

section('NEW FEATURES v4.0 — eBay (OAuth + status)');
test('eBay auth route',               has('/ebay-auth'));
test('eBay auth callback route',      has('/ebay-auth-callback'));
test('eBay status route',             has('/ebay-status'));
test('eBay refresh token route',      has('/api/ebay-refresh-token'));
test('eBay deletion notification',    has('/api/ebay-deletion-notification'));
test('Send to eBay route',            has('/api/send-to-ebay'));
test('OAuth stores tokens',           has('writeEbayTokens') && has('grant_type=authorization_code'));
test('getEbayToken helper',           has('function getEbayToken('));
test('ebayStatus helper',             has('function ebayStatus('));
test('eBay status bar (page)',        has('eBay connected') && has('Connect eBay Account'));
test('DATA_DIR default /data',        has("'/data/xrt-data'"));
test('ebay-tokens.json in DATA_DIR',  has("path.join(DATA_DIR, 'ebay-tokens.json')"));
test('Inventory token from file only',has('Inventory/Sell API calls MUST use the OAuth token'));
test('No env-token API fallback',     !has('access_token: EBAY_USER_TOKEN'));
test('eBay scopes configured',        has('sell.inventory') && has('sell.fulfillment'));
test('eBay readonly scopes',          has('sell.inventory.readonly') && has('sell.account.readonly'));
test('eBay debug route',              has('/ebay-debug'));
test('Debug redacts token value',     has('tokens_file_contents_redacted') && has('access_token_length'));

section('eBay TRADING API — AddItem');
test('Inventory item/offer removed',  !has('inventory_item') && !has('/sell/inventory/v1/offer') && !has('/api/publish-ebay') && !has('/ebay-offers'));
test('createEbayListing helper',      has('function createEbayListing('));
test('Trading endpoint api.dll',      has('/ws/api.dll'));
test('AddItem call name',             has('X-EBAY-API-CALL-NAME') && has("'AddItem'"));
test('Trading API headers',           has('X-EBAY-API-DEV-NAME') && has('X-EBAY-API-CERT-NAME') && has('X-EBAY-API-COMPATIBILITY-LEVEL'));
test('Compatibility level 967',       has("'967'"));
test('Bearer auth on trading call',   has("'Authorization': 'Bearer ' + token"));
test('RequesterCredentials in XML',   has('<RequesterCredentials><eBayAuthToken>') && has('xmlEscape(token)'));
test('Token injected into request',   has('xmlBody.replace(') && has("'$1' + creds"));
test('AddItem XML builder',           has('AddItemRequest') && has('function buildAddItemXml('));
test('FixedPriceItem + GTC',          has('FixedPriceItem') && has('<ListingDuration>GTC'));
test('Dispatch time max 1',           has('<DispatchTimeMax>1'));
test('CDATA description',             has('<![CDATA['));
test('Condition ID in XML',           has('<ConditionID>'));
test('Condition desc non-empty default', has('used, tested. See photos'));
test('Location Clovis + postal 93612',has('Clovis, CA') && has('93612'));
test('Country US + Currency USD',     has('<Country>US') && has('<Currency>USD'));
test('Returns not accepted',          has('ReturnsNotAccepted'));
test('Ship to US only',               has('<ShipToLocations>US'));
test('Flat shipping from weight',     has('function estimateShipCost(') && has('listed_weight'));
test('ItemSpecifics XML',             has('<ItemSpecifics>') && has('NameValueList'));
test('ItemSpecific value 65 cap',     has('String(v).slice(0,65)'));
test('Photo upload to eBay CDN',      has('/commerce/media/v1_beta/image/create_image_from_url') && has('function uploadAllPhotos('));
test('Photo multipart form-data',     has('function ebayTradingMultipart(') && has('multipart/form-data'));
test('Photo sent as raw binary',      has('Buffer.concat([ Buffer.from(pre') && has(', imageBuffer, Buffer.from(post') && !has('Content-Transfer-Encoding: base64') && !has("imageBuffer.toString('base64')"));
test('Photo Media API success',       has('photo uploaded to CDN:') && has('imageUrl'));
test('Photo upload uses server URL',  has('create_image_from_url') && has('imageUrl: photoUrl'));
test('Photo fallback to server URL',  has('Media API failed for') && has('/api/photo/'));
test('PictureDetails from CDN URLs',  has('<PictureDetails>') && has('<PictureURL>'));
test('Business policies routes',      has('/ebay-policies') && has('/ebay-setup-policies') && has('/ebay-setup-all'));
test('fetchEbayPolicies helper',      has('function fetchEbayPolicies('));
test('Account policy endpoints',      has('/sell/account/v1/fulfillment_policy') && has('/sell/account/v1/payment_policy') && has('/sell/account/v1/return_policy'));
test('Policies stored to disk',       has('ebay-policies.json'));
test('SellerProfiles in XML',         has('<SellerProfiles>') && has('ShippingProfileID') && has('ReturnProfileID') && has('PaymentProfileID'));
test('Shipping policy mapping',       has('function pickShippingPolicyId(') && has('shipping_map'));
test('Merchant location helper',      has('function createMerchantLocation(') && has('/sell/inventory/v1/location/xrt-clovis'));
test('setup-all summary',             has('/ebay-setup-all') && has('summary'));
test('Business policy retry',         has('21919456') && has('seller uses business policies'));
test('Photo source URL base',         has('/api/photo/'));
test('Parse eBay XML errors',         has('function parseEbayErrors('));
test('GetSuggestedCategories helper',  has('function getSuggestedCategory(') && has('GetSuggestedCategories') && has('<Query>'));
test('Top category by percent',        has('PercentItemFound') && has('highest percentage match'));
test('Suggested category stored',      has('ebay_category_id') && has('ebay_category_name'));
test('183446 fallback path',           has('function fallbackCategory(') && has('falling back to 183446'));
test('Leaf validation via Features',   has('confirmed LEAF') && has('NOT a leaf') && has('leaf: leaf'));
test('GetCategoryFeatures leaf parse', has("parseXmlTag(body, 'LeafCategory')"));
test('Iterate suggestions for leaf',   has('function tryNext(') && has('trying next suggestion'));
test('Max 5 leaf attempts',            has('Math.min(5, cats.length)') && has('max 5 attempts'));
test('Suggested returns ranked list',  has('callback(null, cats)'));
test('No hardcoded category chain',    !has('categoryFallbacks') && !has('9394') && !has('58058') && !has('175672'));
test('Listings page shows category',   has('eBay Category:'));
test('Prompt asks for leaf category',  has('most specific eBay LEAF category') && has('177 (PC Laptops)'));
test('Error 87 single 183446 fallback',has('not a leaf') && has('CATEGORY ERROR for SKU') && has('183446'));
test('Condition fallback 3000/1000',  has('condFallbacks = [ 3000, 1000 ]'));
test('Title truncate to 80',          has('truncating to 80'));
test('ItemID stored + itm url',       has('ebay_item_id') && has('ebay_listing_url') && has('ebay.com/itm/'));
test('List on eBay button',           has('List on eBay') && has('function listEbay('));
test('Listed link after success',     has('Listed &#10003;'));
test('No Publish button',             !has('Publish to eBay') && !has('function publishEbay'));
test('conditionIdForCategory helper', has('function conditionIdForCategory('));
test('Condition grade->ID map',       has('idMap = { A:1000, B:3000, C:5000, D:7000 }'));
test('eBay debug full fields',        has('env_user_token_present') && has('ebay_auth_scopes') && has('authorization_header_format'));

section('eBay AddItem PRODUCTION HARDENING');
test('CDATA-safe helper',             has('function cdataSafe(') && has(']]]]><![CDATA[>'));
test('Description uses cdataSafe',     has('cdataSafe(listing.description_html'));
test('Title truncated to 80',         has(".slice(0, 80); // truncate title to 80"));
test('Duplicate SKU -> Revise',       has('ReviseFixedPriceItem') && has('reviseItemId') && has('switching to ReviseFixedPriceItem'));
test('Revise XML root + ItemID',      has('ReviseFixedPriceItemRequest') && has("'<ItemID>' + xmlEscape(opts.reviseItemId)"));
test('0-photo graceful + warning',    has('photo_warning') && has('has 0 photos'));
test('Photos filtered by existence',  has('stems.filter(function(s){ return fs.existsSync('));
test('Token refresh + retry',         has('refreshEbayToken(function(rErr, nt){ if(!rErr && nt) token = nt; attempt(); })'));
test('Category 87 -> 183446 fallback', has('CATEGORY ERROR for SKU') && has('falling back to 183446'));
test('GetCategoryFeatures helper',     has('function getCategoryFeatures(') && has('GetCategoryFeatures') && has('ConditionValues'));
test('Valid conditions stored',        has('ebay_valid_conditions') && has('function pickValidCondition('));
test('Condition constrained to valid', has('forcedCondition = pickValidCondition('));
test('GetCategorySpecifics helper',    has('function getCategorySpecifics(') && has('GetCategorySpecifics') && has('NameRecommendation'));
test('Required specifics added',       has('ebay_required_specifics') && has("'Not Specified'"));
test('Required by MinValues',          has("parseInt(parseXmlTag(rc, 'MinValues')"));
test('No PaymentMethods (managed pay)',!has('<PaymentMethods>') && !has('PayPal'));
test('Title format instruction',       has('[Brand] [Model] [Type] [Key Feature] [Condition]') && has('front-load'));
test('Listings page category+specifics', has('eBay Category') && has('Category &amp; Item Specifics') && has('(required)'));
test('Condition fallback retry',      has('condition invalid — retrying with condition ID'));
test('Title truncate retry',          has('title too long — truncating to 80 and retrying'));

section('LISTING GENERATION QUEUE');
test('Queue array exists',            has('var listingQueue'));
test('enqueueListing function',       has('function enqueueListing('));
test('processQueue function',         has('function processQueue('));
test('One-at-a-time processing flag', has('queueProcessing'));
test('8 second gap between calls',    has('QUEUE_GAP_MS = 8000'));
test('429 pause 60 seconds',          has('QUEUE_RATELIMIT_PAUSE_MS = 60000'));
test('Rate limit detection',          has('function isClaudeRateLimited(') && has('rateLimited'));
test('Max 3 retries per item',        has('QUEUE_MAX_RETRIES = 3'));
test('Failed items tracked',          has('failedItems'));
test('Queue status route',            has('/api/queue-status') && has('last_completed_sku'));
test('Queue status fields',           has('pending:') && has('processing:'));
test('Retry listing route',           has('/api/retry-listing'));
test('Listings page queue banner',    has('queueBanner') && has('generating...'));
test('Queue auto-refresh 10s',        has('setInterval(loadQueue,10000)'));
test('Failed items + retry button',   has('failedItems') && has('function retryListing('));

section('eBay AddItem 10-SCENARIO BUILDER (functional)');
(function(){
  function extractFn(name){
    var s = content.indexOf('function ' + name + '(');
    if(s < 0) return '';
    var d = 0, seen = false, e = -1;
    for(var i = s; i < content.length; i++){ var c = content[i]; if(c === '{'){ d++; seen = true; } else if(c === '}'){ d--; if(seen && d === 0){ e = i + 1; break; } } }
    return content.slice(s, e);
  }
  try {
    var code = '';
    ['xmlEscape','cdataSafe','splitToLimit','trimAspects','conditionIdForCategory','estimateShipCost','buildItemSpecificsXml','buildAddItemXml'].forEach(function(n){ code += extractFn(n) + '\n'; });
    // strict-mode eval keeps declarations local — capture the entry point (it closes over the rest)
    var fns = {};
    eval(code + '\nfns.buildAddItemXml = buildAddItemXml;');
    var buildAddItemXml = fns.buildAddItemXml;
    var pol = {fulfillment_id:'F1', payment_id:'P1', return_id:'R1', shipping_map:{}};
    function rec(sku, grade, cat, o){ o = o || {}; return {sku:sku, meta:{grade:grade, quantity:o.qty||1}, listing:{title:o.title||('Item '+sku), description_html:'<p>x & y ]]> z</p>', suggested_price:o.price||45, category_id:cat, shipping_policy:'GA 6lbs or less', custom_sku:sku+'-A1', listed_weight:32, listed_weight_unit:'oz', parts_repair:o.parts||false, item_specifics:o.spec||{Brand:'Acme', Features:'A, B, C'}}}; }
    var scen = [
      ['Scenario 1 — B/Pass VoIP 80258',        rec('t1','B',80258),                  ['p1']],
      ['Scenario 2 — D/Fail Parts Switch 182091',rec('t2','D',182091,{parts:true}),   ['p1']],
      ['Scenario 3 — A New Sealed Laptop 177',   rec('t3','A',177),                   ['p1']],
      ['Scenario 4 — C/Pass Audio 14969',        rec('t4','C',14969),                 ['p1']],
      ['Scenario 5 — B qty5 VoIP lot 80258',     rec('t5','B',80258,{qty:5}),         ['p1']],
      ['Scenario 6 — D/Fail Vintage 162989',     rec('t6','D',162989),                ['p1']],
      ['Scenario 7 — B Monitor NO PHOTOS 80053', rec('t7','B',80053),                 []],
      ['Scenario 8 — A Tablet title>80 171485',  rec('t8','A',171485,{title:'Z'.repeat(120)}), ['p1']],
      ['Scenario 9 — C Printer spec>65 1245',    rec('t9','C',1245,{spec:{Brand:'Acme',Type:'Y'.repeat(90),Features:'a, b, c, d'}}), ['p1']],
      ['Scenario 10 — B General cat 293',        rec('t10','B',293),                  ['p1']]
    ];
    scen.forEach(function(sc){
      var r = sc[1], pics = sc[2];
      var xml = buildAddItemXml(r, {pictureUrls:pics, policies:pol, categoryId:r.listing.category_id});
      var t = (xml.match(/<Title>([\s\S]*?)<\/Title>/) || [])[1] || '';
      var cid = (xml.match(/<ConditionID>(\d+)<\/ConditionID>/) || [])[1];
      var want = r.listing.parts_repair ? '7000' : ({A:'1000',B:'3000',C:'5000',D:'7000'}[r.meta.grade]);
      var vals = (xml.match(/<Value>([\s\S]*?)<\/Value>/g) || []).map(function(v){ return v.replace(/<\/?Value>/g,''); });
      var good = /<AddItemRequest[\s\S]*<\/AddItemRequest>$/.test(xml)
        && t.length <= 80
        && cid === want
        && xml.indexOf('<CategoryID>' + r.listing.category_id) >= 0
        && (pics.length ? xml.indexOf('<PictureDetails>') >= 0 : xml.indexOf('<PictureDetails>') < 0)
        && vals.every(function(v){ return v.length <= 65; })
        && xml.indexOf('<![CDATA[') >= 0
        && xml.indexOf('<SellerProfiles>') >= 0
        && xml.indexOf('<Quantity>' + r.meta.quantity + '</Quantity>') >= 0;
      test(sc[0], good);
    });
  } catch(e){
    test('AddItem 10-scenario builder eval', false);
    console.log('    ERROR:', e.message);
  }
})();

section('findCompletedItems CATEGORY PIPELINE (functional)');
(function(){
  function extractFn(name){
    var s = content.indexOf('function ' + name + '(');
    if(s < 0) return '';
    var d = 0, seen = false, e = -1;
    for(var i = s; i < content.length; i++){ var c = content[i]; if(c === '{'){ d++; seen = true; } else if(c === '}'){ d--; if(seen && d === 0){ e = i + 1; break; } } }
    return content.slice(s, e);
  }
  // ── findCompletedItemsCategory with a synchronous mocked Finding API ──
  var realHttps = require('https');
  var https = realHttps; // the extracted function references the bare name `https`
  var origRequest = realHttps.request;
  try {
    var EE = require('events').EventEmitter;
    var fixtureFn = null;
    realHttps.request = function(options, cb){
      var pth = options.path || '';
      var m = pth.match(/[?&]q=([^&]*)/); // Browse API uses ?q=<keywords>
      var kw = m ? decodeURIComponent(m[1]) : '';
      var bodyStr = fixtureFn ? fixtureFn(kw) : '{}';
      var res = new EE(); res.statusCode = 200;
      var req = { on: function(){ return req; }, write: function(){ return true; }, end: function(){ cb(res); res.emit('data', Buffer.from(bodyStr)); res.emit('end'); } };
      return req;
    };
    var fns = {};
    // The extracted function references getEbayToken, EBAY_BASE, https — stub the first two
    eval('function getEbayToken(cb){ cb(null, "tok"); }\nvar EBAY_BASE = "https://api.ebay.com";\n' + extractFn('findCompletedItemsCategory') + '\nfns.f = findCompletedItemsCategory;');
    function item(id, name){ return { categories:[{categoryId:id, categoryName:name}] }; } // Browse item_summary shape
    function resp(items){ return JSON.stringify({ itemSummaries: items }); }

    fixtureFn = function(){ return resp([item('182091','Enterprise Network Switches'), item('182091','Enterprise Network Switches')]); };
    var r1 = null; fns.f('Cisco SG300-28 Network Switch', 'APP', function(e, r){ r1 = r; });
    test('Browse valid -> category shape', !!(r1 && r1.category_id === '182091' && r1.category_name && r1.search_level === 1 && r1.price_reliable === false && r1.source === 'ebay_browse'));

    fixtureFn = function(kw){ return /SG300-28/.test(kw) ? resp([]) : resp([item('182091','Enterprise Network Switches'), item('182091','Enterprise Network Switches')]); };
    var r2 = null; fns.f('Cisco SG300-28 Network Switch', 'APP', function(e, r){ r2 = r; });
    test('Browse L1 fail -> L2 success', !!(r2 && r2.search_level === 2 && r2.price_reliable === false && r2.source === 'ebay_browse'));

    fixtureFn = function(){ return resp([]); };
    var got3 = false, r3 = 'x'; fns.f('Cisco SG300-28 Network Switch', 'APP', function(e, r){ got3 = true; r3 = r; });
    test('Browse all fail -> null', got3 && r3 === null);
  } catch(e){ test('findCompletedItems functional eval', false); console.log('    ERROR:', e.message); }
  realHttps.request = origRequest; // restore

  // ── validateLeafCategory with stubbed getEbayToken + getCategoryFeatures ──
  try {
    var leaf = { val: true };
    var fns2 = {};
    eval('function getEbayToken(cb){ cb(null, "tok"); }\nfunction getCategoryFeatures(id, t, cb){ cb(null, { leaf: leaf.val }); }\n' + extractFn('validateLeafCategory') + '\nfns2.v = validateLeafCategory;');
    leaf.val = true;  var v1 = null; fns2.v(177,   function(e, v){ v1 = v; });
    test('validateLeafCategory true for leaf',  v1 === true);
    leaf.val = false; var v2 = null; fns2.v(58058, function(e, v){ v2 = v; });
    test('validateLeafCategory false for parent', v2 === false);
  } catch(e){ test('validateLeafCategory functional eval', false); console.log('    ERROR:', e.message); }
})();

section('Confirmed category WIRING');
test('identify calls findCompletedItems', has('findCompletedItemsCategory(data.item_name, EBAY_APP_ID'));
test('identify sets new fields',          has('data.ebay_category_id = result.category_id') && has('data.category_source') && has('data.category_confirmed') && has('data.category_needs_review') && has('data.pricing_source'));
test('Level 1 price overrides estimate',  has('data.estimated_low = result.price_low') && has("data.pricing_source = 'ebay_completed'"));
test('Listing uses confirmed category',   has('var confirmedCategoryId = null') && has('using confirmed category') && has('listing.category_id = confirmedCategoryId;'));
test('Listing prompt has confirmed cat',  has('Confirmed eBay category from completed sold listings'));
test('send-to-ebay category priority',    has('var knownCat = record.ebay_category_id'));
test('send-to-ebay leaf-validates known', has('validateLeafCategory(knownCat'));
test('Non-leaf structured error',         has('needs_category_review: true') && has('is not a leaf category and cannot be listed in'));
test('Route returns needs_category_review', has('info.blocked') && has('needs_category_review:true'));

section('HUMAN GROUND TRUTH — presence');
test('human_facts captured on record',      has('human_facts: buildHumanFacts(meta, visionData)'));
test('buildHumanFacts single source',       has('function buildHumanFacts('));
test('shared human-facts prompt block',     has('function humanFactsPromptBlock('));
test('spec allowlist helper',               has('function isAllowlistedSpecField('));
test('protected-fact helper',               has('function isProtectedFactField('));
test('human-note conflict helper',          has('function claimStatedByHuman('));
test('description-rewrite blocker',         has('function isDescriptionRewrite('));
test('surgical patch enforcer',             has('function applySurgicalCorrections('));
test('deterministic quantity guard',        has('function enforceQuantityGuard('));
test('guard revert log line',               has('[GUARD] SKU'));
test('verifier takes humanFacts',           has('function verifySpecs(sku, listing, pipeline, humanFacts, callback)'));
test('checker takes humanFacts',            has('function checkListing(sku, listing, photos, pipeline, humanFacts, callback)'));
test('checker conflict array',              has('"conflicts": [') && has('human-fact conflict'));
test('verifier surgical contract',          has('NEVER return a rewritten description'));
test('web search stays openrouter:web_search', has("'openrouter:web_search'"));
test('scale is_scale_photo OCR field',      has('is_scale_photo'));
test('resolveScalePhoto helper',            has('function resolveScalePhoto('));
test('no_scale_detected flag',              has('no_scale_detected'));
test('scale manual toggle route',           has('/scale-toggle') && has('function toggleScalePhoto('));
test('no-scale warning on page',            has('No scale photo detected'));
test('conflict flag on badge',              has('Conflict') && has('&#128681;'));
test('discrete lot qty field (processor)',  has('identLotQty'));

section('HUMAN GROUND TRUTH — enforcement (functional)');
(function(){
  function extractFn(name){
    var s = content.indexOf('function ' + name + '(');
    if(s < 0) return '';
    var d = 0, seen = false, e = -1;
    for(var i = s; i < content.length; i++){ var c = content[i]; if(c === '{'){ d++; seen = true; } else if(c === '}'){ d--; if(seen && d === 0){ e = i + 1; break; } } }
    return content.slice(s, e);
  }
  function withLogs(fn){ var logs = []; var o = console.log; console.log = function(){ logs.push(Array.prototype.slice.call(arguments).join(' ')); }; try { fn(); } finally { console.log = o; } return logs; }
  try {
    var code = '';
    ['_normText','splitNoteClauses','isNegationClause','isAllowlistedSpecField','isProtectedFactField','claimStatedByHuman','isDescriptionRewrite','applySurgicalCorrections','enforceQuantityGuard','resolveScalePhoto','buildHumanFacts'].forEach(function(n){ code += extractFn(n) + '\n'; });
    var fns = {};
    eval(code + '\nfns.apply=applySurgicalCorrections;fns.guard=enforceQuantityGuard;fns.scale=resolveScalePhoto;fns.hf=buildHumanFacts;');

    // single source: brand/model/qty/notes all land on ONE object
    var hf = fns.hf({ quantity:5, notes:'no power cord included', test_notes:'powers on', identified_item:{ brand:'Cisco', model:'SG300-28' } }, {});
    test('buildHumanFacts captures qty+notes+identity', hf.lot_quantity === 5 && /no power cord/.test(hf.additional_notes) && hf.brand === 'Cisco');

    // GUARD — wrong quantity reverted in field + title + item specifics, with a proof log line
    var lst1 = { title:'Lot of 1 Cisco SG300-28 Switch', lot_quantity:1, item_specifics:{ 'Number of Items':'1' } };
    var glogs = withLogs(function(){ fns.guard('9001', lst1, { lot_quantity:5 }); });
    test('GUARD reverts qty in field+title+specifics', lst1.lot_quantity === 5 && /Lot of 5/.test(lst1.title) && lst1.item_specifics['Number of Items'] === '5');
    test('GUARD emits [GUARD] revert log', glogs.some(function(l){ return /\[GUARD\] SKU 9001 reverted quantity 1 /.test(l); }));
    console.log('    ↳ GUARD logs: ' + glogs.filter(function(l){ return /\[GUARD\]/.test(l); }).join('  |  '));

    // ALLOWLIST — a full description rewrite is rejected in code (not applied), with proof log
    var lst2 = { title:'Printer', description_html:'<p>orig</p>', item_specifics:{} };
    var rlogs = withLogs(function(){ fns.apply('9002', lst2, [{ field:'description_html', old:'<p>orig</p>', new:'<p>a brand new description that also claims a power cord is included plus lots of extra prose text</p>' }], {}, 'SPEC'); });
    test('ALLOWLIST rejects full description rewrite (no mutation)', lst2.description_html === '<p>orig</p>' && rlogs.some(function(l){ return /REJECTED.*description/i.test(l); }));
    console.log('    ↳ REJECT logs: ' + rlogs.filter(function(l){ return /REJECTED/.test(l); }).join('  |  '));

    // PROTECTED — quantity + includes patches refused, listing untouched
    var lst3 = { title:'Lot of 5 Widgets', item_specifics:{ 'Lot Quantity':'5', 'Includes':'unit only' } };
    var plogs = withLogs(function(){ fns.apply('9003', lst3, [{ field:'Lot Quantity', old:'5', new:'3' }, { field:'Includes', old:'unit only', new:'unit + power cord' }], {}, 'CHECKER'); });
    test('PROTECTED fields (quantity, includes) not patched', lst3.item_specifics['Lot Quantity'] === '5' && lst3.item_specifics['Includes'] === 'unit only');
    test('PROTECTED patches both logged as rejected', plogs.filter(function(l){ return /REJECTED/.test(l); }).length === 2);
    console.log('    ↳ PROTECTED logs: ' + plogs.filter(function(l){ return /REJECTED/.test(l); }).join('  |  '));

    // HUMAN NOTE — "no power cord included" note blocks a contradicting cord claim (conflict path)
    var lst4 = { title:'Widget', description_html:'no power cord included', item_specifics:{} };
    var hlogs = withLogs(function(){ fns.apply('9004', lst4, [{ field:'Connectivity', old:'no power cord included', new:'includes power cord' }], { additional_notes:'no power cord included' }, 'CHECKER'); });
    test('Human-stated note blocks contradicting patch', /no power cord included/.test(lst4.description_html) && hlogs.some(function(l){ return /REJECTED.*human-stated/i.test(l); }));

    // NOTE-DERIVED protection (rule 38): a NON-electronics note protects its OWN claim with no
    // vocabulary — the words come from the note, not from a hardcoded list. "roller"/"worn" appear
    // nowhere in server.js yet a patch touching that claim is still rejected.
    var lstR = { title:'Zebra ZM400 label printer', description_html:'<p>Thermal transfer printer.</p>', item_specifics:{ 'Print Technology':'thermal' } };
    var rlogsR = withLogs(function(){ fns.apply('9007', lstR, [{ field:'Print Technology', old:'roller worn', new:'roller replaced' }], { additional_notes:'roller worn, needs replacement' }, 'CHECKER'); });
    test('Note-derived protection blocks a non-electronics note (roller worn)', rlogsR.some(function(l){ return /REJECTED.*human-stated/i.test(l); }) && lstR.item_specifics['Print Technology'] === 'thermal');
    console.log('    ↳ ROLLER-note reject: ' + rlogsR.filter(function(l){ return /REJECTED/.test(l); }).join('  |  ') + '  [\"roller\" in server.js? ' + (content.indexOf('roller') >= 0) + ']');

    // ALLOWLISTED spec DOES get corrected surgically (positive control)
    var lst5 = { title:'Laptop 4GB RAM', item_specifics:{ 'RAM':'4GB' } };
    fns.apply('9005', lst5, [{ field:'RAM', old:'4GB', new:'8GB' }], {}, 'SPEC');
    test('Allowlisted spec (RAM) corrected surgically', lst5.item_specifics['RAM'] === '8GB' && /8GB/.test(lst5.title));

    // SCALE — is_scale_photo false keeps the photo; default/undefined keeps rule 21 behavior
    var sT = fns.scale(6, true), sF = fns.scale(6, false), sU = fns.scale(6, undefined);
    test('scale detected -> last photo excluded', sT.weightPhotoIndex === 6 && sT.no_scale_detected === false);
    test('is_scale_photo=false -> photo KEPT + flagged', sF.weightPhotoIndex === null && sF.no_scale_detected === true);
    test('is_scale_photo undefined -> rule 21 default', sU.weightPhotoIndex === 6 && sU.no_scale_detected === false);

    // GRACEFUL — malformed input never throws, listing survives (both layers never block)
    var lst6 = { title:'X', item_specifics:{} }, survived = true;
    try { fns.apply('9006', lst6, null, {}, 'SPEC'); fns.apply('9006', lst6, [null, {}, { field:'RAM' }], {}, 'SPEC'); fns.guard('9006', lst6, {}); } catch(e){ survived = false; }
    test('Enforcement never throws on malformed input', survived && lst6.title === 'X');
  } catch(e){ test('human-facts enforcement functional eval', false); console.log('    ERROR:', e.message); }
})();

section('OMISSION DEFENSE — presence');
test('omission guard (restore missing notes)', has('function enforceNoteOmissionGuard('));
test('note-text conflict detector',            has('function detectNoteTextConflicts('));
test('negated-object extractor',               has('function extractNegatedObjects('));
test('negation clause detector',               has('function isNegationClause('));
test('shared deterministic guard entry',       has('function applyHumanFactGuards('));
test('claimStatedByHuman is note-derived (no vocab)', !has('keyPhrases') && !has('roller worn'));
test('positive omission flagged not appended', has('flagged omitted positive note'));
test('omission restore log line',              has('restored omitted human note'));
test('guards run in pipeline',                 has('chk = applyHumanFactGuards(sku, record.listing, hf, chk)'));
test('lot qty field empty default (dirty/null)', has("placeholder='1'") && !has("step='1' value='1'"));

section('OMISSION DEFENSE — presence check (functional)');
(function(){
  function extractFn(name){
    var s = content.indexOf('function ' + name + '(');
    if(s < 0) return '';
    var d = 0, seen = false, e = -1;
    for(var i = s; i < content.length; i++){ var c = content[i]; if(c === '{'){ d++; seen = true; } else if(c === '}'){ d--; if(seen && d === 0){ e = i + 1; break; } } }
    return content.slice(s, e);
  }
  function withLogs(fn){ var logs = []; var o = console.log; console.log = function(){ logs.push(Array.prototype.slice.call(arguments).join(' ')); }; try { fn(); } finally { console.log = o; } return logs; }
  try {
    var code = '';
    ['isAllowlistedSpecField','isProtectedFactField','claimStatedByHuman','isDescriptionRewrite','applySurgicalCorrections','enforceQuantityGuard','_normText','splitNoteClauses','isNegationClause','clauseRepresented','collectNoteClauses','enforceNoteOmissionGuard','extractNegatedObjects','detectNoteTextConflicts','applyHumanFactGuards'].forEach(function(n){ code += extractFn(n) + '\n'; });
    var fns = {};
    eval(code + '\nfns.apply=applySurgicalCorrections;fns.omit=enforceNoteOmissionGuard;fns.textConf=detectNoteTextConflicts;fns.guards=applyHumanFactGuards;fns.guard=enforceQuantityGuard;fns.collect=collectNoteClauses;');
    var HF = { testing_notes:'', additional_notes:'no power cord included' };

    // (i) a layer patch that DELETES the human note is rejected (all three shapes)
    var d1 = { title:'X', description_html:'Unit powers on. No power cord included.', item_specifics:{} };
    var r1a = withLogs(function(){ fns.apply('i1', d1, [{ field:'description_html', old:'No power cord included.', new:'Unit powers on.' }], HF, 'CHECKER'); });
    var r1b = withLogs(function(){ fns.apply('i1', d1, [{ field:'Notes', old:'No power cord included.', new:'' }], HF, 'CHECKER'); });
    var r1c = withLogs(function(){ fns.apply('i1', d1, [{ field:'Connectivity', old:'no power cord included', new:'includes power cord' }], HF, 'CHECKER'); });
    test('(i) deletion via description-rewrite rejected', /No power cord included\./.test(d1.description_html) && r1a.some(function(l){ return /REJECTED/.test(l); }));
    test('(i) deletion via empty value rejected', r1b.some(function(l){ return /REJECTED.*empty/.test(l); }));
    test('(i) note inversion via allowlisted field rejected', r1c.some(function(l){ return /REJECTED.*human-stated/.test(l); }) && /No power cord included\./.test(d1.description_html));
    console.log('    ↳ DELETION-attempt logs: ' + [].concat(r1a, r1b, r1c).filter(function(l){ return /REJECTED/.test(l); }).join('  |  '));

    // (ii) if a stripped note somehow lands, the omission guard restores it + logs
    var d2 = { description_html:'<p>Cisco switch, powers on and boots.</p>', item_specifics:{} };
    var r2 = withLogs(function(){ fns.omit('i2', d2, HF); });
    test('(ii) omission guard restores stripped note', /no power cord included/i.test(d2.description_html));
    test('(ii) omission guard logs the restore', r2.some(function(l){ return /\[GUARD\] SKU i2 restored omitted human note: "no power cord included"/.test(l); }));
    console.log('    ↳ OMISSION log: ' + r2.filter(function(l){ return /restored omitted/.test(l); }).join('  |  '));
    var d2b = { description_html:'<p>Powers on. No power cord included.</p>', item_specifics:{} };
    var r2b = withLogs(function(){ fns.omit('i2b', d2b, HF); });
    test('(ii) already-present negation not re-restored', r2b.filter(function(l){ return /restored/.test(l); }).length === 0);

    // (2 split) POSITIVE omission -> FLAGGED (conflict), NOT appended (kills the noise)
    var d7 = { description_html:'<p>Cisco switch, clean cosmetics.</p>', item_specifics:{} };
    var om7, r7 = withLogs(function(){ om7 = fns.omit('i7', d7, { testing_notes:'powers on and passes self test', additional_notes:'' }); });
    test('(2) positive omission flagged, not appended', om7.conflicts.length >= 1 && om7.restored.length === 0 && !/Seller notes/.test(d7.description_html) && r7.some(function(l){ return /flagged omitted positive note/.test(l); }));
    console.log('    ↳ POSITIVE-FLAG: ' + (om7.conflicts[0] ? om7.conflicts[0].note : '(none)'));
    // (2 split) NEGATION still hard-restored + appended, in the same guard
    var d8 = { description_html:'<p>Powers fine.</p>', item_specifics:{} };
    var om8 = fns.omit('i8', d8, { testing_notes:'', additional_notes:'no rack ears included' });
    test('(2) negation still hard-restored (appended)', om8.restored.length === 1 && /no rack ears included/i.test(d8.description_html) && om8.conflicts.length === 0 && /Seller notes/.test(d8.description_html));

    // (iii) negation survives the full pipeline: checker tries to invert (rejected), guards keep it
    var d3 = { title:'Cisco switch', description_html:'<p>Powers on. No power cord included.</p>', item_specifics:{}, lot_quantity:1 };
    withLogs(function(){ fns.apply('i3', d3, [{ field:'Connectivity', old:'no power cord included', new:'power cord included' }], HF, 'CHECKER'); });
    fns.guards('i3', d3, HF, { verdict:'PASS' });
    test('(iii) negation survives pipeline (present + not inverted)', /no power cord included/i.test(d3.description_html) && fns.textConf(d3, HF).length === 0);

    // (2c) generator hallucination: text asserts the cord, note says none, NO photo conflict -> flagged
    var d4 = { title:'Cisco switch with power cord', description_html:'<p>Includes power cord and rack ears.</p>', item_specifics:{ 'Connectivity':'RJ45' } };
    var conf = fns.textConf(d4, HF);
    test('(2c) listing-text conflict detected without any photo', conf.length >= 1 && /power cord/.test(conf[0].human_fact));
    console.log('    ↳ TEXT-CONFLICT: ' + (conf[0] ? conf[0].note : '(none)'));
    var d5 = { title:'Cisco switch', description_html:'<p>No power cord included.</p>', item_specifics:{} };
    test('(2c) honored negation not falsely flagged', fns.textConf(d5, HF).length === 0);

    // (follow-up 1) explicit lot quantity of 1 is enforced against a layer that set 5
    var d6 = { title:'Lot of 5 Widgets', lot_quantity:5, item_specifics:{ 'Number of Items':'5' } };
    var r6 = withLogs(function(){ fns.guard('i6', d6, { lot_quantity:1 }); });
    test('(1) explicit qty 1 survives a layer changing it to 5', d6.lot_quantity === 1 && /Lot of 1/.test(d6.title) && d6.item_specifics['Number of Items'] === '1' && r6.some(function(l){ return /reverted quantity 5 /.test(l); }));

    // ── NOTE DUPLICATION REGRESSION (production bug, SKUs 2363-2367) ──
    // The operator typed the same sentence into BOTH testing_notes and additional_notes, and every
    // clause was restored/flagged once per source field. These lock the deduped behaviour in.
    var DUP = { testing_notes:'Powers on. No further testing done.', additional_notes:'Powers on. No further testing done.' };
    test('(dup) collectNoteClauses dedupes across both note fields',
      fns.collect(DUP).filter(function(c){ return /no further testing done/i.test(c); }).length === 1);
    var d9 = { description_html:'<p>Adtran Atlas 830 rackmount unit.</p>', item_specifics:{} };
    var om9 = fns.omit('dup1', d9, DUP);
    test('(dup) identical negation in both fields restored ONCE',
      om9.restored.filter(function(c){ return /no further testing done/i.test(c); }).length === 1);
    test('(dup) restored note appears once in the description',
      (String(d9.description_html).match(/no further testing done/gi) || []).length === 1);
    // SKU 2367's real failure: "Works great" typed twice -> two identical conflicts.
    var d10 = { description_html:'<p>Xbox controller, light wear.</p>', item_specifics:{} };
    var om10 = fns.omit('dup2', d10, { testing_notes:'Works great', additional_notes:'Works great' });
    test('(dup) identical positive note in both fields flagged ONCE', om10.conflicts.length === 1);
    var chkDup = fns.guards('dup3', { title:'X', description_html:'<p>Xbox controller.</p>', item_specifics:{}, lot_quantity:1 },
      { testing_notes:'Works great', additional_notes:'Works great', lot_quantity:1 }, { verdict:'PASS' });
    test('(dup) merged conflict list carries no duplicates',
      chkDup.conflicts.length === 1 && /works great/i.test(chkDup.conflicts[0].note));
    // Over-dedup regression: genuinely DIFFERENT clauses in the two fields must both survive.
    var d11 = { description_html:'<p>Switch.</p>', item_specifics:{} };
    var om11 = fns.omit('dup4', d11, { testing_notes:'no power cord included', additional_notes:'no rack ears included' });
    test('(dup) distinct notes in both fields are both still restored', om11.restored.length === 2);
    // Text-conflict detector deduped too (same negation typed twice -> one conflict).
    var d12 = { title:'Cisco switch with power cord', description_html:'<p>Includes power cord.</p>', item_specifics:{} };
    test('(dup) text-conflict detector reports one conflict per distinct note',
      fns.textConf(d12, { testing_notes:'no power cord included', additional_notes:'no power cord included' }).length === 1);
  } catch(e){ test('omission defense functional eval', false); console.log('    ERROR:', e.message); }
})();

section('CHECKER INPUT — no truncated review text');
test('descriptionTextForReview exists',        has('function descriptionTextForReview('));
test('Checker gets full description',          has('var descFull = descriptionTextForReview(listing.description_html)'));
test('Checker no longer excerpts to 500',      !has('stripHtmlExcerpt(listing.description_html, 500)'));
test('Spec Verifier no longer excerpts to 800', !has('stripHtmlExcerpt(listing.description_html, 800)'));
test('Checker labels text as complete',        has('Description (complete plain text): '));
test('Checker told not to report truncation',  has('never report it as truncated or cut off'));
(function(){
  // Functional: the real SKU 2364 failure shape — a ~1100 char description must reach the Checker
  // whole. The old 500-char excerpt cut mid-sentence and the Checker reported the cut as a defect.
  var s = content.indexOf('function descriptionTextForReview(');
  if(s < 0){ test('descriptionTextForReview returns full text for a real-length description', false); return; }
  var d = 0, seen = false, e = -1;
  for(var i = s; i < content.length; i++){ var c = content[i]; if(c === '{'){ d++; seen = true; } else if(c === '}'){ d--; if(seen && d === 0){ e = i + 1; break; } } }
  var box = {};
  try {
    // NB: this file is strict mode, so eval'd declarations do not leak — hand the fn out via `box`.
    eval('var REVIEW_TEXT_MAX = 12000;\n' + content.slice(s, e) + '\nbox.f = descriptionTextForReview;');
    var body = '<h3>Adtran Atlas 830</h3><p>' + new Array(60).join('cosmetic wear consistent with its age and use in an industrial or data center environment. ') + '</p>';
    var outFull = box.f(body);
    var plain = body.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    test('descriptionTextForReview returns full text for a real-length description',
      outFull.length === plain.length && /environment\.$/.test(outFull.trim()));
    test('descriptionTextForReview labels a genuine overflow cut',
      /TRUNCATED HERE FOR REVIEW LENGTH ONLY/.test(box.f('<p>' + new Array(4000).join('long words here ') + '</p>')));
  } catch(err){ test('descriptionTextForReview returns full text for a real-length description', false); console.log('    ERROR:', err.message); }
})();

section('CHECKER SCOPE — photo-inferred claims only');
test('checkerScopeBlock exists',               has('function checkerScopeBlock('));
test('scope block wired into Checker prompt',  has('checkerScopeBlock(humanFacts)'));
test('identity recorded in human facts',       has('identity_confirmed:'));
test('brand/model/MPN out of scope',           has('The brand, model number, MPN, or item identity'));
test('unreadable serial not flagged',          has('A serial number being unreadable'));
test('unverifiable claims not flagged',        has('Silence is the correct response to an'));
test('confirmed identification stated',        has('CONFIRMED BY THE OPERATOR before generation'));
test('old awareness-flag rule removed',        !has('verified by research, not visible in photos'));

section('UNCONFIRMED SLOTS / BAYS / MODULES');
// Generator: never guess at what is inside a slot or bay it cannot see into.
test('generator rule present',                 has('EXPANSION SLOTS, BAYS, PORTS AND MODULAR AREAS — NEVER GUESS AT THE CONTENTS'));
test('no negative characterisation',           has('"empty", "missing", "unpopulated", "vacant", "not included"'));
test('no positive characterisation either',    has('Do NOT call it populated either'));
test('no inferring counts from slot count',    has('Do NOT infer how many modules, interfaces or supplies are present'));
test('seller notes are the only override',     has('The ONLY thing that overrides this is the seller notes'));
test('neutral default wording specified',      has('See photos for full details of included components/modules.'));
test('covers slots/bays/ports generally',      has('drive bays, power-supply bays, and any comparable modular area'));
// Checker: ambiguous bay/slot presence is not a discrepancy.
test('bay/slot population out of Checker scope', has('other modular area is POPULATED or EMPTY'));
test('ambiguous bay is not evidence',            has('evidence of absence and not evidence of presence'));
test('neutral wording marked correct',           has('is the CORRECT treatment, not a defect to fix'));
test('human note is the only exception',         has('a human note above that directly states what is or is not installed'));
test('guessing framed as the failure mode',      has('whether the guess is worded as a spec, as a missing part, or as a completeness/condition problem'));

section('DESCRIPTION TEMPLATE LOCK');
test('template block present',                 has('REQUIRED DESCRIPTION TEMPLATE — MANDATORY, EVERY ITEM, EVERY TIME'));
test('Overview section required',              has('<h3>Overview</h3>'));
test('What\'s Included section required',      has('<h3>What\\\'s Included</h3>'));
test('Condition section required',             has('<h3>Condition</h3>'));
test('Testing Notes section required',         has('<h3>Testing Notes</h3>'));
test('Specifications section required',        has('<h3>Specifications</h3>'));
test('no-repetition rule present',             has('NO-REPETITION RULE'));
test('single-placement rule stated',           has('State each fact EXACTLY ONCE, in its designated section only'));
test('closing paragraph banned',               has('Do NOT append a closing paragraph'));

section('PRE-PUBLISH GATE');
test('checkerGateState exists',                has('function checkerGateState('));
test('gate bar rendered',                      has('Listing blocked &mdash; Checker found '));
test('publish button gated',                   has('data-gated="1"'));
test('bulk checkbox withheld when gated',      has('!r.ebay_item_id && !cardGate.blocked'));
test('dismiss endpoint',                       has('/api/listings/checker-ack/'));
test('apply-fix endpoint',                     has('/api/listings/apply-checker-fix/'));
test('server-side publish enforcement',        has('checker_blocked:true'));
test('apply-fix respects human facts',         has('the suggested wording overlaps a fact you recorded by hand'));
test('Checker asked for old_text',             has('"old_text": "the exact wording currently in the listing'));
test('Checker asked for suggested_fix',        has('"suggested_fix": "the corrected wording'));
test('Apply suggested fix button',             has('Apply suggested fix'));
test('client dismiss fn',                      has('function dismissChecker(sku)'));
test('client apply fn',                        has('function applyCheckerFix(sku,ix)'));
test('client unlock fn',                       has('function unlockGate(sku,action)'));
(function(){
  var s = content.indexOf('function checkerGateState(');
  if(s < 0){ test('checkerGateState blocks/clears correctly', false); return; }
  var d = 0, seen = false, e = -1;
  for(var i = s; i < content.length; i++){ var c = content[i]; if(c === '{'){ d++; seen = true; } else if(c === '}'){ d--; if(seen && d === 0){ e = i + 1; break; } } }
  var gbox = {};
  try {
    // CHECKER_SCHEMA is module-level in server.js; mirror it into the sandbox.
    var schemaMatch = content.match(/var CHECKER_SCHEMA = (\d+);/);
    eval('var CHECKER_SCHEMA = ' + (schemaMatch ? schemaMatch[1] : 2) + ';\n' + content.slice(s, e) + '\ngbox.g = checkerGateState;');
    var G = gbox.g, SCH = schemaMatch ? Number(schemaMatch[1]) : 2;
    var mk = function(o){ o.schema = SCH; return { checker:o }; };
    test('gate: no checker -> not blocked (backward compat)', G({}).blocked === false);
    test('gate: PASS with no findings -> not blocked', G(mk({ verdict:'PASS', issues:[], conflicts:[] })).blocked === false);
    test('gate: WARN with an issue -> blocked', G(mk({ verdict:'WARN', issues:[{description:'x'}] })).blocked === true);
    test('gate: conflicts alone -> blocked', G(mk({ verdict:'PASS', conflicts:[{note:'x'}] })).blocked === true);
    test('gate: FLAG with no itemised issue -> blocked', G(mk({ verdict:'FLAG' })).blocked === true);
    test('gate: acknowledged -> unblocked', G(mk({ verdict:'FLAG', issues:[{description:'x'}], acknowledged:{action:'dismissed'} })).blocked === false);
    test('gate: resolved issues do not block', G(mk({ verdict:'WARN', issues:[{description:'x', resolved:true}] })).blocked === false);
    // ── STALE-RESULT DETECTION (the bug that made obsolete findings survive a regenerate) ──
    var staleChk = { checker:{ verdict:'FLAG', issues:[{description:'obsolete'}], conflicts:[{note:'obsolete'}] } };
    test('gate: unstamped (pre-fix) result flagged stale', G(staleChk).stale === true);
    test('gate: unstamped (pre-fix) result does NOT block', G(staleChk).blocked === false);
    test('gate: older schema flagged stale', G({ checker:{ schema: SCH - 1, verdict:'FLAG', issues:[{description:'x'}] } }).stale === true);
    test('gate: current schema not stale', G(mk({ verdict:'PASS' })).stale === false);
  } catch(err){ test('checkerGateState blocks/clears correctly', false); console.log('    ERROR:', err.message); }
})();

section('REGENERATE — writes review state where the UI reads it');
test('sonnet branch runs Spec Verifier',       has("verifySpecs(sku, rec.listing, 'sonnet', hf,"));
test('sonnet branch checks rec.listing',       has("checkListing(sku, rec.listing, orBlocks, 'sonnet', hf,"));
test('guards mutate the displayed copy',       has('applyHumanFactGuards(sku, rec.listing, hf, chk)'));
test('checker written to listing.checker',     has('r.listing.checker = chk;'));
test('sonnet view still maintained',           has('r.sonnet = view;'));
test('regen returns post-guard copy',          has('result.description_html = rec.listing.description_html;'));
test('regen reloads card to show new verdict', has('(reloading)'));
test('Checker result carries schema stamp',    has('var result = { schema: CHECKER_SCHEMA,'));
test('CHECKER_SCHEMA defined',                 has('var CHECKER_SCHEMA ='));
test('stale results hidden in badges',         has('gateEarly.stale ? null : (listing.checker || null)'));
test('stale badge label',                      has('Stale &mdash; regenerate to re-check'));
test('clear-checker endpoint',                 has('clear-checker') && has('[MAINT] SKU '));
test('clear-checker drops both reports',       has('delete rec.listing.spec_verifier;'));

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
