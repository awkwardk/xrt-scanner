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
test('Photo upload to eBay CDN',      has('/sell/media/v1/image') && has('function uploadAllPhotos('));
test('Photo multipart form-data',     has('function ebayTradingMultipart(') && has('multipart/form-data'));
test('Photo sent as raw binary',      has('Buffer.concat([ Buffer.from(pre') && has(', imageBuffer, Buffer.from(post') && !has('Content-Transfer-Encoding: base64') && !has("imageBuffer.toString('base64')"));
test('Photo Media API success',       has('photo uploaded to CDN:') && has('imageUrl'));
test('Photo read from file',          has('fs.readFile(photoPath'));
test('Photo fallback to server URL',  has('Media API photo upload failed') && has('/api/photo/'));
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
