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
test('Identifier uses Gemini Flash',      has("model: 'google/gemini-2.5-flash'"));
test('Vision via callGeminiVisionParts',  has('function callGeminiVisionParts('));
test('No Anthropic dependency',           !has('api.anthropic.com') && !has('ANTHROPIC_API_KEY') && !has('claude-sonnet-4-5') && !has('function callClaude('));
test('Web search tool enabled',           has('openrouter:web_search'));
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
// getSuggestedCategory: migrated off the retired Trading API GetSuggestedCategories (HTTP 410
// Gone in production) to the Taxonomy REST API's get_category_suggestions.
test('getSuggestedCategory uses Taxonomy REST endpoint', has('function getSuggestedCategory(query, token, callback){') && has("path: '/commerce/taxonomy/v1/category_tree/0/get_category_suggestions?q=' + encodeURIComponent(query),"));
test('Taxonomy request uses correct auth headers', has("'Authorization': 'Bearer ' + token,") && has("'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',") && has("'Accept': 'application/json'"));
test('Taxonomy request hostname respects EBAY_BASE (sandbox-safe)', has("hostname: EBAY_BASE.replace('https://', ''),\n    path: '/commerce/taxonomy/v1/category_tree/0/get_category_suggestions"));
test('parses categorySuggestions[0].category as the top match', has('var suggestions = Array.isArray(body.categorySuggestions) ? body.categorySuggestions : [];') && has('var top = suggestions[0];') && has('var cat = top && top.category;'));
test('returns {category_id, category_name} shape',   has("callback(null, { category_id: cat.categoryId, category_name: cat.categoryName || '' });"));
test('0 suggestions treated as a failed attempt (not a crash)', has("if(!suggestions.length){ callback(new Error('get_category_suggestions returned 0 suggestions for \"' + query + '\"')); return; }"));
test('logs the exact Taxonomy response for diagnosis', has("console.log('[CATEGORY] Taxonomy get_category_suggestions \"' + query + '\" -> HTTP ' + resp.statusCode + ': ' + (d ? d.slice(0, 500) : '(empty body)'));"));
test('Suggested category stored',      has('ebay_category_id') && has('ebay_category_name'));
test('183446 fallback path',           has('function fallbackCategory(') && has('falling back to 183446'));
test('GetCategoryFeatures leaf parse', has("parseXmlTag(scope, 'LeafCategory')") && has("parseXmlTag(scope, 'ConditionValues')") && has('callback(null, {leaf: leaf, conditions: ids});'));
// Taxonomy suggestions are already leaf-guaranteed, so trySuggestedLeaf no longer iterates/rejects
// candidates — it fetches conditions for the one suggestion and trusts it even if that lookup fails.
test('trySuggestedLeaf trusts the Taxonomy suggestion unconditionally', has('if(fErr){ console.log(\'[CATEGORY] GetCategoryFeatures failed for Taxonomy-suggested category \' + cat.category_id + \' (\' + cat.category_name + \') — using it anyway: \' + fErr.message); }'));
test('no more per-candidate leaf-rejection loop', !has('function tryNext(') && !has('trying next suggestion'));
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
test('Condition grade->ID map',       has('idMap = { A:1000, B:3000, C:3000, D:7000 }'));
test('Condition IDs are per-category',  has('function conditionIdForCategory(grade, categoryId, partsRepair, validIds)') && has('validIds && validIds.length'));
test('Condition error != category error',has('21916883|invalid condition') && has('CONDITION ERROR for SKU') && !has('/category|not a leaf'));
test('Category change re-derives cond',  has('function recheckCategory(') && has('restart the condition ladder'));
test('eBay debug full fields',        has('env_user_token_present') && has('ebay_auth_scopes') && has('authorization_header_format'));

section('eBay AddItem PRODUCTION HARDENING');
test('CDATA-safe helper',             has('function cdataSafe(') && has(']]]]><![CDATA[>'));
test('Description uses cdataSafe',     has('cdataSafe(stripExternalLinks(listing.description_html'));
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
test('Rate limit detection',          has('QUEUE_RATELIMIT_PAUSE_MS') && has('rateLimited'));
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
    ['xmlEscape','cdataSafe','splitToLimit','trimAspects','conditionIdForCategory','estimateShipCost','sanitizeSpecificValue','stripExternalLinks','buildItemSpecificsXml','buildAddItemXml'].forEach(function(n){ code += extractFn(n) + '\n'; });
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
      var want = r.listing.parts_repair ? '7000' : ({A:'1000',B:'3000',C:'3000',D:'7000'}[r.meta.grade]);
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
test('send-to-ebay category priority',    has('var rawKnownCat = record.ebay_category_id'));
test('send-to-ebay leaf-validates known', has('validateLeafCategory(knownCat'));
test('Route returns needs_category_review', has('info.blocked') && has('needs_category_review:true'));

// ── LEAF CATEGORY PRE-FLIGHT (Error [87] prevention) ──
// A known category that fails leaf validation now auto-resolves via GetSuggestedCategories
// instead of blocking the listing (previous behavior encoded in "Non-leaf structured error",
// removed above — replaced by the tests in this section).
section('LEAF CATEGORY PRE-FLIGHT (auto-resolve, never block)');
test('resolveLeafCategoryFromTitle exists', has('function resolveLeafCategoryFromTitle(item, token, callback){'));
test('isUsableCategoryId helper exists',    has('function isUsableCategoryId(v){'));
test('isUsableCategoryId rejects (set)',    has('/^\\(?\\s*set\\s*\\)?$/i.test(s)'));
test('missing/0/"(set)" auto-resolves',     has('var knownCat = isUsableCategoryId(rawKnownCat) ? rawKnownCat : null;'));
test('non-leaf known category auto-resolves not blocked', has("autoResolveCategory('known category ' + knownCat + ' is not a leaf');") && !has('needs_category_review: true'));
test('no known category auto-resolves',    has("autoResolveCategory('no known category');"));
test('auto-resolve falls back to 183446 if none found', has('function autoResolveCategory(reason){') && has("fallbackCategory(reason + (rErr ? (': ' + rErr.message) : ': no leaf found'));"));
test('createEbayListing pre-flight reuses shared resolver', has('resolveLeafCategoryFromTitle(catItem, token, function(rErr, cat){'));

// ── CLEAN CATEGORY QUERY (root-cause fix: raw 80-char title -> 183446 fallback) ──
section('CLEAN CATEGORY QUERY (progressive Clean Core / Sanitized Title / Brand+Type)');
test('sanitizeTitleForCategoryQuery exists',  has('function sanitizeTitleForCategoryQuery(title){'));
test('strips w/ and with noise',              has("'w/', 'with', 'bundle', 'tested', 'working', 'for parts', 'as is', 'as-is',"));
test('strips grade a/b/c/d noise',            has("'grade a', 'grade b', 'grade c', 'grade d'"));
test('strips long serial/part tokens > 8 chars', has('return !(clean.length > 8 && /[0-9]/.test(clean) && /[a-z]/i.test(clean));'));
test('trySuggestedLeaf does the actual Taxonomy call', has('function trySuggestedLeaf(query, token, callback){') && has("getSuggestedCategory(query, token, function(scErr, cat){"));
test('trySuggestedLeaf fetches conditions for the resolved category', has("getCategoryFeatures(cat.category_id, token, function(fErr, feat){"));
test('Attempt 1 is Clean Core (brand+model+type)', has("addQuery([brand, model, productType].filter(Boolean).join(' '));   // Attempt 1: Clean Core"));
test('Attempt 2 is Sanitized Title',          has('addQuery(sanitizeTitleForCategoryQuery(item.title));                // Attempt 2: Sanitized Title'));
test('Attempt 3 is Brand + Type',             has("addQuery([brand, productType].filter(Boolean).join(' '));           // Attempt 3: Brand + Type"));
test('never sends raw title as the first query', (function(){
  var s = content.indexOf('function resolveLeafCategoryFromTitle(item, token, callback){');
  var e = content.indexOf('function isUsableCategoryId(v){', s);
  var body = content.slice(s, e);
  var i1 = body.indexOf('Attempt 1'); var i2 = body.indexOf('item.title');
  return s >= 0 && e > s && i1 >= 0 && i2 >= 0 && i1 < i2; // Clean Core (no title) is built before item.title is ever touched
})());
test('bare string still accepted (back-compat)', has("if(typeof item === 'string') item = { title: item };"));
test('voice worker builds clean item from item_specifics', has("model: (record.listing.item_specifics && record.listing.item_specifics.Model) || '',"));
test('createEbayListing pre-flight builds clean item too', has("model: (listing.item_specifics && listing.item_specifics.Model) || '',"));

// ── RE-RESOLVE ON CLICK / GENERIC 183446 (SKU 2644/2645 style stuck cards) ──
section('RE-RESOLVE FOR EXISTING CARDS (click category, or List on eBay)');
test('183446 always attempts a better leaf before trusting it', has("if(knownCat && String(knownCat) === '183446'){") && has("autoResolveCategory('category is the generic 183446 fallback — attempting a more specific leaf');"));
test('PATCH auto_resolve_category endpoint exists', has('if(parsed.auto_resolve_category === true){'));
test('re-resolve endpoint uses the shared clean resolver', has('resolveLeafCategoryFromTitle(rItem, rtTok, function(rErr, cat){'));
test('re-resolve endpoint updates category_id + primary_category_id + category_name', has('pRec.listing.category_id = cat.id; pRec.listing.primary_category_id = cat.id;') && has('pRec.meta.category_name = cat.name;'));
test('click on "(set)" or 183446 auto-resolves instead of manual entry', has('if(!cur||cur==="0"||cur==="183446"){span.dataset.editing="1";') && has('body:JSON.stringify({auto_resolve_category:true})'));
test('click on a real category still allows manual override', has('span.dataset.editing="1";var inp=document.createElement("input");inp.type="text";inp.inputMode="numeric";inp.value=cur;'));

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
test('verifier surgical contract',          has('NEVER return a rewritten description'));
test('web search stays openrouter:web_search', has("'openrouter:web_search'"));
test('scale is_scale_photo OCR field',      has('is_scale_photo'));
test('resolveScalePhoto helper',            has('function resolveScalePhoto('));
test('no_scale_detected flag',              has('no_scale_detected'));
test('scale manual toggle route',           has('/scale-toggle') && has('function toggleScalePhoto('));
test('no-scale warning on page',            has('No scale photo detected'));
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
test('guards run in pipeline',                 has('applyHumanFactGuards(sku, record.listing, hf, null)'));
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
test('Checker no longer excerpts to 500',      !has('stripHtmlExcerpt(listing.description_html, 500)'));
test('Spec Verifier no longer excerpts to 800', !has('stripHtmlExcerpt(listing.description_html, 800)'));
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
test('identity recorded in human facts',       has('identity_confirmed:'));
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

section('COVERS / PANELS SHOWN OPEN OR REMOVED (documentation photos)');
// Generator: an open/removed cover in one frame is a documentation shot, not a missing part.
test('generator rule present',                 has('COVERS, PANELS, DOORS AND COMPARTMENTS SHOWN OPEN OR REMOVED'));
test('framed as a documentation photo',        has('is almost always a DOCUMENTATION photo'));
test('judge across whole photo set',           has('Judge presence across the WHOLE photo set, never from a single frame'));
test('assembled majority means included',      has('that part IS present and') && has('included — describe it as included'));
test('no missing/absent wording',              has('"missing", "not included", "absent" or'));
test('no condition downgrade for it',          has('do NOT downgrade the condition or grade because of it'));
test('two explicit exceptions only',           has('no photo anywhere shows it in place') && has('the seller notes explicitly say it is missing'));
test('describe what the photo documents',      has('describe what it DOCUMENTS'));
test('covers closures generally',              has('battery covers and doors, access and service panels'));
// Checker: same case is out of scope.

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


section('REGENERATE — writes review state where the UI reads it');
test('sonnet branch runs Spec Verifier',       has("verifySpecs(sku, rec.listing, 'sonnet', hf,"));
test('guards mutate the displayed copy',       has('applyHumanFactGuards(sku, rec.listing, hf, null)'));
test('sonnet view still maintained',           has('r.sonnet = view;'));
test('regen returns post-guard copy',          has('result.description_html = rec.listing.description_html;'));
test('regen reloads card to show new verdict', has('(reloading)'));


section('VOICE INTAKE (additive)');
test('mic button on processor',        has("id='vMicBtn'") && has('toggleVoiceMic'));
test('MediaRecorder API used',         has('navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true}})') && has('new MediaRecorder('));
test('voice intake screen',            has("id='voiceScreen'") && has('startVoiceIntake'));
test('home entry point',               has('Voice Intake'));
test('transcript + shelf + photos UI', has("id='vTranscript'") && has("id='vShelf'") && has("id='vPhotoInput'"));
test('unsupported browser handled',    has('Recording not supported on this browser'));
test('fast-submit endpoint',           has("req.url==='/api/fast-submit'"));
test('fast-submit writes listing.json',has("path.join(itemDir, 'listing.json')") && has('buildVoiceListingRecord('));
test('fast-submit saves photos',       has("'photo_' + (i+1) + '.jpg'"));
test('parseVoiceTranscript helper',    has('function parseVoiceTranscript('));
test('buildCassiniTitle helper',       has('function buildCassiniTitle('));
test('voice grade->condition map',     has('var map = { A:1000, B:3000, C:5000, D:7000 };'));
test('voice parts/repair rule',        has("if(out.grade === 'D') out.parts_repair = true;") && has("return 'For Parts or Repair';"));
test('voice reuses shipping tier',     has('tier = calculateShippingTier(p.weight_lbs || 0, p.weight_oz || 0, sku)'));
test('voice never re-implements ship', has('shippingPolicyName(tier.shippingPolicyId)'));

// ── functional: transcript -> listing data ──
(function(){
  function ex(n){
    var st = content.indexOf('function ' + n + '(');
    if(st < 0) return '';
    var d = 0, seen = false, e = -1;
    for(var i = st; i < content.length; i++){ var c = content[i]; if(c === '{'){ d++; seen = true; } else if(c === '}'){ d--; if(seen && d === 0){ e = i + 1; break; } } }
    return content.slice(st, e);
  }
  try {
    var box = {};
    var code = (content.match(/var VOICE_BRANDS = \[[\s\S]*?\];/) || [''])[0] + '\n'
      + (content.match(/var VOICE_TYPES = \[[\s\S]*?\];/) || [''])[0] + '\n'
      + 'var MIN_THRESHOLD = 30;\n'
      + ex('calculateShippingTier') + '\n' + ex('shippingPolicyName') + '\n' + ex('calcShipping') + '\n'
      + ex('parseVoiceTranscript') + '\n' + ex('voiceGradeConditionId') + '\n' + ex('voiceConditionWord') + '\n'
      + ex('buildCassiniTitle') + '\n' + ex('buildVoiceListingRecord') + '\n'
      + 'box.parse = parseVoiceTranscript; box.title = buildCassiniTitle; box.cond = voiceGradeConditionId; box.rec = buildVoiceListingRecord;';
    var _log = console.log; console.log = function(){};
    eval(code);
    console.log = _log;

    var P = box.parse, T = box.title, C = box.cond, R = box.rec;
    var a = P('Dell Latitude E5470 laptop grade B powers on includes charger and dock 4 pounds 8 ounces');
    test('(voice) brand extracted',        a.brand === 'Dell');
    test('(voice) model extracted',        a.model === 'E5470');
    test('(voice) product type extracted', a.product_type === 'Laptop');
    test('(voice) grade extracted',        a.grade === 'B');
    test('(voice) power test extracted',   a.power_test === 'Pass');
    test('(voice) weight extracted',       a.weight_lbs === 4 && a.weight_oz === 8);
    test('(voice) bundle excludes weight', a.includes.indexOf('charger') >= 0 && !/pound|ounce/.test(a.includes.join(' ')));

    var hp = P('HP LaserJet printer grade D no power for parts 12 lbs');
    test('(voice) acronym brand casing',   hp.brand === 'HP');
    test('(voice) grade D -> parts',       hp.parts_repair === true);
    var hpT = T({ brand:hp.brand, model:hp.model, product_type:hp.product_type, features:hp.features, includes:hp.includes, grade:hp.grade, parts_repair:hp.parts_repair, quantity:1 });
    test('(voice) parts title phrase',     /For Parts or Repair/.test(hpT));

    var fail = P('Sony amplifier grade B no power 8 lbs');
    test('(voice) power fail -> parts',    fail.parts_repair === true);

    test('(voice) condition A=1000',       C('A', false) === 1000);
    test('(voice) condition B=3000',       C('B', false) === 3000);
    test('(voice) condition C=5000',       C('C', false) === 5000);
    test('(voice) condition D=7000',       C('D', false) === 7000);
    test('(voice) parts forces 7000',      C('B', true) === 7000);

    var titles = [
      'Dell Latitude E5470 laptop grade B powers on includes charger and docking station and extra battery and power adapter 4 pounds',
      'Cisco Catalyst WS-C2960X-48TS-L network switch 48 ports gigabit poe grade A works includes rack ears and power cable 12 lbs'
    ].map(function(x){ var p = P(x); return T({ brand:p.brand, model:p.model, product_type:p.product_type, features:p.features, includes:p.includes, grade:p.grade, parts_repair:p.parts_repair, quantity:p.quantity }); });
    test('(voice) titles <= 80 chars',     titles.every(function(x){ return x.length <= 80 && x.length > 0; }));

    var lot = P('Lot of 5 Polycom VVX411 phones grade B tested working 6 lbs');
    var lotT = T({ brand:lot.brand, model:lot.model, product_type:lot.product_type, features:lot.features, includes:lot.includes, grade:lot.grade, parts_repair:lot.parts_repair, quantity:lot.quantity });
    test('(voice) lot quantity in title',  /Lot of 5/.test(lotT));

    // shipping tiers preserved: GA <= 6lb, FedEx 6-15lb, Heavy > 15lb
    function pol(lbs){ return R(1, P('Dell server grade B ' + lbs + ' pounds'), 'A1', 0, {}).listing.shipping_policy; }
    test('(voice) GA <= 6lb',              /GA/.test(pol(3)) && /GA/.test(pol(6)));
    test('(voice) FedEx 6-15lb',           /FedEx/.test(pol(10)) && /FedEx/.test(pol(15)));
    test('(voice) Heavy > 15lb',           /Heavy/.test(pol(20)));

    var rec = R(2601, a, 'B3', 3, {});
    test('(voice) record has listing',     !!(rec && rec.listing && rec.listing.title));
    test('(voice) record renders fields',  ['condition_box','description_html','item_specifics','custom_sku','box_dimensions'].every(function(k){ return rec.listing[k] !== undefined; }));
    test('(voice) record carries sku',     rec.sku === 2601 && rec.meta.shelf === 'B3');
    test('(voice) item specifics built',   rec.listing.item_specifics.Brand === 'Dell' && rec.listing.item_specifics.Model === 'E5470');
    test('(voice) source tagged',          rec.source === 'voice_intake' && rec.meta.source === 'voice_intake');
  } catch(e){
    test('voice intake functional eval', false);
    console.log('    ERROR:', e.message);
  }
})();


section('VOICE RECORDING (MediaRecorder + server-side Gemini transcription)');
test('tracks explicit recording intent', has('var voiceIsRecording=false;'));
test('mic + noise-suppression requested', has('echoCancellation:true,noiseSuppression:true'));
test('feature-detect gate before recording', has('if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia||!window.MediaRecorder){voiceStatus(\'Recording not supported on this browser'));
test('prefers audio/webm, falls back to audio/mp4', has("if(MediaRecorder.isTypeSupported('audio/webm'))mimeType='audio/webm';else if(MediaRecorder.isTypeSupported('audio/mp4'))mimeType='audio/mp4';"));
test('recording timer updates status text', has('function voiceSetRecordTimer(){') && has("voiceStatus('Recording... '+m+':'"));
test('audio posted to /api/voice/transcribe', has("fetch('/api/voice/transcribe',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({audio:b64,mime_type:mt})})"));
test('transcript inserted into vTranscript textarea', has('if(d&&d.success&&d.transcript){var ta=document.getElementById(\'vTranscript\');'));
test('transcription failure never blocks manual entry', has("voiceStatus((d&&d.error?d.error:'Transcription failed')+' - type the description instead');") && has("voiceStatus('Network error transcribing - type the description instead');"));
test('microphone tracks always stopped', has('function voiceStopStream(){try{if(voiceMediaStream){voiceMediaStream.getTracks().forEach(function(t){t.stop();});voiceMediaStream=null;}}catch(e){}}'));
test('mic UI has two states',            has('function voiceSetMicUI(rec)') && has("mb.className='vmic-rec'") && has("mb.className='vmic-idle'"));
test('stop label while recording',       has("mb.innerHTML='&#9209; Stop Recording'"));
test('pulsing red recording style',      has('.vmic-rec{') && has('@keyframes vpulse'));
test('getUserMedia permission denial handled', has("voiceStatus('Microphone blocked - allow mic access, then try again');"));
test('submitVoiceIntake stops an in-progress recording', has('if(voiceIsRecording){voiceIsRecording=false;if(voiceRecordTimerId){clearInterval(voiceRecordTimerId);voiceRecordTimerId=null;}try{if(voiceMediaRecorder&&voiceMediaRecorder.state!==\'inactive\')voiceMediaRecorder.stop();}catch(e){}voiceStopStream();voiceSetMicUI(false);}var skuField='));
test('no leftover webkitSpeechRecognition dictation code', !has('function voiceCreateRecognition(') && !has('window.webkitSpeechRecognition'));

// ── functional: drive the real client code through a simulated MediaRecorder lifecycle ──
(function(){
  // Minimal synchronous thenable — the whole suite runs synchronously (no await), so getUserMedia()/
  // fetch() resolve/reject immediately when .then()/.catch() is called, instead of via the real
  // microtask queue. Correctly propagates rejection through a .then() with no onReject, same as a
  // real Promise, so .catch() further down the chain still receives it.
  function fakePromise(state, value){
    return {
      then: function(onFulfill, onReject){
        if(state === 'fulfilled'){
          if(onFulfill){ try { var r = onFulfill(value); return (r && typeof r.then === 'function') ? r : fakePromise('fulfilled', r); } catch(e){ return fakePromise('rejected', e); } }
          return fakePromise('fulfilled', value);
        }
        if(onReject){ try { var r2 = onReject(value); return (r2 && typeof r2.then === 'function') ? r2 : fakePromise('fulfilled', r2); } catch(e2){ return fakePromise('rejected', e2); } }
        return fakePromise('rejected', value);
      },
      catch: function(onReject){ return this.then(undefined, onReject); }
    };
  }
  try {
    var k = 'PROCESSOR_HTML = "';
    var st = content.indexOf(k) + k.length - 1;
    var qc = content[st], j = st + 1, esc = false;
    for(; j < content.length; j++){ var ch = content[j]; if(esc){ esc = false; continue; } if(ch === '\\'){ esc = true; continue; } if(ch === qc) break; }
    var html = eval(content.slice(st, j + 1));
    var script = (html.match(/<script>([\s\S]*?)<\/script>/) || [])[1];

    var els = {};
    function stub(id){ return { id:id, value:'', textContent:'', innerHTML:'', className:'', disabled:false, style:{}, classList:{add:function(){},remove:function(){},toggle:function(){}}, appendChild:function(){}, addEventListener:function(){}, focus:function(){} }; }
    ['vTranscript','vShelf','vThumbs','vErr','vMicStatus','vMicBtn','vSubmitBtn'].forEach(function(id){ els[id] = stub(id); });
    var timers = [];
    var stoppedTracks = 0;
    var gumMode = 'ok'; // 'ok' | 'deny'
    var fetchMode = 'ok'; // 'ok' | 'apifail' | 'network'
    function fakeStream(){ return { getTracks: function(){ return [{ stop: function(){ stoppedTracks++; } }]; } }; }
    function FakeMediaRecorder(stream, opts){ liveRecorder = this; this.state = 'inactive'; this.mimeType = (opts && opts.mimeType) || ''; this.stream = stream; }
    FakeMediaRecorder.prototype.start = function(){ this.state = 'recording'; };
    FakeMediaRecorder.prototype.stop = function(){ this.state = 'inactive'; if(this.onstop) this.onstop(); };
    FakeMediaRecorder.isTypeSupported = function(t){ return t === 'audio/webm'; };
    function FakeFileReader(){}
    FakeFileReader.prototype.readAsDataURL = function(blob){ this.result = 'data:audio/webm;base64,ZmFrZWF1ZGlv'; if(this.onload) this.onload(); };
    var liveRecorder = null;

    var sandbox = {
      document: { getElementById:function(id){ return els[id] || stub(id); }, querySelectorAll:function(){ return []; }, addEventListener:function(){}, createElement:function(){ return stub('x'); }, body:{appendChild:function(){},removeChild:function(){}} },
      window: { addEventListener:function(){}, removeEventListener:function(){}, MediaRecorder: FakeMediaRecorder },
      alert:function(){}, setTimeout:function(fn){ timers.push(fn); return timers.length; }, clearTimeout:function(){}, setInterval:function(){ return 0; },
      FileReader: FakeFileReader, localStorage:{ getItem:function(){ return null; }, setItem:function(){}, removeItem:function(){} },
      navigator:{ mediaDevices:{ getUserMedia:function(){ return gumMode === 'deny' ? fakePromise('rejected', new Error('Permission denied')) : fakePromise('fulfilled', fakeStream()); } } },
      AudioContext:function(){ return { createBuffer:function(){ return {getChannelData:function(){ return []; }}; }, createBufferSource:function(){ return {connect:function(){},start:function(){}}; }, createGain:function(){ return {connect:function(){},gain:{}}; }, destination:{}, sampleRate:44100, close:function(){} }; },
      screen:{ orientation:{angle:0} },
      fetch:function(){
        if(fetchMode === 'network') return fakePromise('rejected', new Error('network down'));
        var body = fetchMode === 'apifail' ? {success:false, error:'Transcription failed'} : {success:true, transcript:'Dell Latitude E5470 grade B powers on'};
        return fakePromise('fulfilled', { json: function(){ return fakePromise('fulfilled', body); } });
      }
    };

    var runner = new Function('document','window','alert','setTimeout','clearTimeout','setInterval','FileReader','localStorage','navigator','AudioContext','screen','fetch','MediaRecorder',
      script + '\nreturn { start:startVoiceIntake, toggle:toggleVoiceMic, rec:function(){ return voiceIsRecording; } };');
    var api = runner(sandbox.document, sandbox.window, sandbox.alert, sandbox.setTimeout, sandbox.clearTimeout, sandbox.setInterval,
      sandbox.FileReader, sandbox.localStorage, sandbox.navigator, sandbox.AudioContext, sandbox.screen, sandbox.fetch, sandbox.window.MediaRecorder);

    var T = function(){ return els.vTranscript.value; };
    // Real MediaRecorder delivers actual audio Blob chunks to ondataavailable while recording;
    // simulate that with Node's real global Blob so the >=800-byte "too short" guard is satisfied.
    function feedFakeAudioChunk(){ if(liveRecorder && liveRecorder.ondataavailable) liveRecorder.ondataavailable({ data: new Blob(['x'.repeat(2000)]) }); }

    // ── start -> getUserMedia resolves -> MediaRecorder created + started ──
    api.start(); api.toggle();
    test('(rec) enters recording state on mic tap', api.rec() === true && els.vMicBtn.className === 'vmic-rec');
    test('(rec) MediaRecorder actually started',     liveRecorder && liveRecorder.state === 'recording');
    test('(rec) prefers audio/webm mimeType',         liveRecorder && liveRecorder.mimeType === 'audio/webm');

    // ── stop -> onstop fires -> Blob built -> FileReader -> POST /api/voice/transcribe -> textarea filled ──
    feedFakeAudioChunk();
    api.toggle();
    test('(rec) explicit stop ends recording state', api.rec() === false);
    test('(rec) button returns to idle',             els.vMicBtn.className === 'vmic-idle');
    test('(rec) mic tracks stopped on stop',          stoppedTracks >= 1);
    test('(rec) transcript inserted after transcription', T() === 'Dell Latitude E5470 grade B powers on');
    test('(rec) status shows transcribed message',    els.vMicStatus.textContent === 'Transcribed - review and edit below');

    // ── second recording appends rather than overwrites ──
    api.toggle(); feedFakeAudioChunk(); api.toggle();
    test('(rec) second recording appends, does not overwrite', T() === 'Dell Latitude E5470 grade B powers on Dell Latitude E5470 grade B powers on');

    // ── transcription API returns success:false -> manual editing never blocked ──
    els.vTranscript.value = 'operator typed this by hand';
    fetchMode = 'apifail';
    api.toggle(); feedFakeAudioChunk(); api.toggle();
    test('(rec) API failure leaves manually-typed text untouched', T() === 'operator typed this by hand');
    test('(rec) API failure message tells operator to type instead', /Transcription failed - type the description instead/.test(els.vMicStatus.textContent));

    // ── network error talking to /api/voice/transcribe -> same graceful fallback ──
    fetchMode = 'network';
    api.toggle(); feedFakeAudioChunk(); api.toggle();
    test('(rec) network error message tells operator to type instead', /Network error transcribing - type the description instead/.test(els.vMicStatus.textContent));
    test('(rec) network error leaves prior text untouched', T() === 'operator typed this by hand');
    fetchMode = 'ok';

    // ── getUserMedia permission denial -> clean recovery, no crash ──
    gumMode = 'deny';
    api.toggle();
    test('(rec) mic denial does not enter recording state', api.rec() === false);
    test('(rec) mic denial message shown',                  els.vMicStatus.textContent === 'Microphone blocked - allow mic access, then try again');
    gumMode = 'ok';

    // ── no MediaRecorder support at all -> graceful message, never throws ──
    var noMR = new Function('document','window','alert','setTimeout','clearTimeout','setInterval','FileReader','localStorage','navigator','AudioContext','screen','fetch','MediaRecorder',
      script + '\nreturn { start:startVoiceIntake, toggle:toggleVoiceMic, rec:function(){ return voiceIsRecording; } };')(
      sandbox.document, { addEventListener:function(){}, removeEventListener:function(){} }, sandbox.alert, sandbox.setTimeout, sandbox.clearTimeout, sandbox.setInterval,
      sandbox.FileReader, sandbox.localStorage, sandbox.navigator, sandbox.AudioContext, sandbox.screen, sandbox.fetch, undefined);
    noMR.start(); noMR.toggle();
    test('(rec) unsupported browser never throws, stays idle', noMR.rec() === false && els.vMicStatus.textContent === 'Recording not supported on this browser - type the description instead');
  } catch(e){
    test('voice recording functional eval', false);
    console.log('    ERROR:', e.message);
  }
})();

section('VOICE AUDIO TRANSCRIPTION (/api/voice/transcribe backend)');
test('route exists',                          has("req.url==='/api/voice/transcribe'"));
test('route requires an audio field',          has("var audioB64 = String(parsed.audio || '').trim();") && has("if(!audioB64){ sendJSON(res,400,{success:false, error:'No audio provided'}); return; }"));
test('route degrades gracefully with no OPENROUTER_KEY', has("if(!OPENROUTER_KEY){ sendJSON(res,200,{success:false, error:'Transcription unavailable — type the description instead'}); return; }"));
test('route never throws — wrapped in try/catch', has("console.log('[VOICE-TRANSCRIBE] error: ' + e.message);") && has("sendJSON(res,200,{success:false, error:'Server error — type the description instead'});"));
test('transcription failure returns 200, not an HTTP error (never blocks submission)', has("sendJSON(res,200,{success:false, error:'Transcription failed — type the description instead'});"));
test('success response matches { success: true, transcript }', has('sendJSON(res,200,{success:true, transcript:transcript});'));
test('transcribeVoiceAudio uses google/gemini-2.5-flash', has('function transcribeVoiceAudio(base64Audio, mimeType, callback){') && has("model: 'google/gemini-2.5-flash',"));
test('system instruction matches spec exactly', has('You are an expert audio transcriber for an electronics and merchandise reselling warehouse. Accurately transcribe the spoken audio verbatim. Pay special attention to quiet speech, alphanumeric model numbers (e.g., P4T, DSi, UTL-001), dimensions (e.g., 14x10x6), testing notes, and cosmetic flaw descriptions. Output ONLY the clean transcribed text without markdown formatting or commentary.'));
test('audio sent as an input_audio content block', has("{ type: 'input_audio', input_audio: { data: base64Audio, format: fmt } }"));

// ── functional: transcribeVoiceAudio's real format-detection + response parsing, stubbed HTTP ──
// Mirrors the "TAXONOMY RESPONSE PARSING" pattern above: stub https.request (not callOpenRouter or
// transcribeVoiceAudio themselves), so this exercises the actual mime-type -> format mapping and
// OpenRouter response parsing code with mock audio buffers.
(function(){
  function ex(n){
    var s2 = content.indexOf('function ' + n + '(');
    if (s2 < 0) return '';
    var d = 0, seen = false, e = -1;
    for (var i = s2; i < content.length; i++) { var c = content[i]; if (c === '{') { d++; seen = true; } else if (c === '}') { d--; if (seen && d === 0) { e = i + 1; break; } } }
    return content.slice(s2, e);
  }
  var https = require('https');
  var realRequest = https.request;
  // The response callback must fire from end() (after write()), matching real Node — callOpenRouter
  // does https.request(opts, cb) THEN req.write(body) THEN req.end(); firing cb synchronously inside
  // https.request() itself would run the whole response chain before write() ever captured the body.
  function mockHttps(statusCode, bodyObj){
    https.request = function(options, cb){
      var body = JSON.stringify(bodyObj);
      return { on: function(){}, write: function(){}, end: function(){
        var res = { statusCode: statusCode, on: function(evt, handler){ if(evt === 'data') handler(body); else if(evt === 'end') handler(); } };
        cb(res);
      } };
    };
  }
  try {
    var box = {};
    var code = "var OPENROUTER_KEY = 'test-key';\n" + ex('callOpenRouter') + '\n' + ex('transcribeVoiceAudio') + '\nbox.transcribe = transcribeVoiceAudio;';
    var _log = console.log; console.log = function(){};
    eval(code);
    console.log = _log;
    var TR = box.transcribe;

    var mockAudioB64 = Buffer.from('fake webm audio bytes for a mock recording').toString('base64');

    // Mock captures the written request body too, so we can verify the mock audio buffer and the
    // detected format token actually landed in the outgoing OpenRouter request.
    var sentBody = null;
    https.request = function(options, cb){
      return { on: function(){}, write: function(w){ sentBody = w; }, end: function(){
        var res = { statusCode: 200, on: function(evt, handler){ if(evt === 'data') handler(JSON.stringify({ choices: [ { message: { content: 'Dell Latitude E5470 laptop grade B powers on' } } ] })); else if(evt === 'end') handler(); } };
        cb(res);
      } };
    };
    TR(mockAudioB64, 'audio/webm;codecs=opus', function(err, transcript){
      test('(transcribe) parses OpenRouter response into transcript text', !err && transcript === 'Dell Latitude E5470 laptop grade B powers on');
      test('(transcribe) mock audio buffer sent as base64 in the request body', !!sentBody && sentBody.indexOf(mockAudioB64) >= 0);
      test('(transcribe) audio/webm;codecs=opus maps to format "webm"', !!sentBody && sentBody.indexOf('"format":"webm"') >= 0);
    });

    mockHttps(200, { choices: [ { message: { content: '```\nZebra P4T label printer\n```' } } ] });
    TR(mockAudioB64, 'audio/wav', function(err, transcript){
      test('(transcribe) strips markdown code fences from the response', !err && transcript === 'Zebra P4T label printer');
    });
    https.request = function(options, cb){ return { on:function(){}, write:function(w){ sentBody = w; }, end:function(){ var res = { statusCode: 200, on: function(evt, handler){ if(evt === 'data') handler(JSON.stringify({ choices: [ { message: { content: 'x' } } ] })); else if(evt === 'end') handler(); } }; cb(res); } }; };
    TR(mockAudioB64, 'audio/mp4', function(){ test('(transcribe) audio/mp4 maps to format "mp4"', !!sentBody && sentBody.indexOf('"format":"mp4"') >= 0); });

    mockHttps(500, { error: 'server error' });
    TR(mockAudioB64, 'audio/webm', function(err, transcript){
      test('(transcribe) OpenRouter failure/empty response surfaces as an error, not a crash', !!err && !transcript);
    });

    mockHttps(200, { choices: [] });
    TR(mockAudioB64, 'audio/webm', function(err, transcript){
      test('(transcribe) empty choices array surfaces as an error, not a crash', !!err && !transcript);
    });
  } catch(e){
    test('transcribeVoiceAudio functional eval', false);
    console.log('    ERROR:', e.message);
  } finally {
    https.request = realRequest;
  }
})();


section('VOICE INTAKE v2 (background submit, photo reorder, custom SKU)');
// ── fix 1: background processing & instant UI release ──
test('response sent before background generation', has("sendJSON(res,200,{ success:true, sku:sku, photos_saved:saved });") && has('setTimeout(function(){'));
test('background block never crashes response', has('} catch(e2){') && has("console.log('[VOICE] SKU ' + sku + ' background generation error: ' + e2.message);"));

// ── fast-submit now runs the OpenRouter Gemini 2.5 Flash pipeline, not the deterministic parser ──
section('VOICE INTAKE AI PIPELINE (fast-submit primary path)');
test('voiceIdentifyFromPhotos helper exists',   has('function voiceIdentifyFromPhotos(transcript, photoB64Array, callback){'));
test('generateVoiceListingAI helper exists',    has('function generateVoiceListingAI(sku, transcript, shelf, pvHints, weightLine, visionInfo, photoBlocks, callback){'));
test('assembleVoiceRecordFromAI helper exists', has('function assembleVoiceRecordFromAI(sku, shelf, saved, transcript, pvHints, winfo, weightPhotoIndex, noScaleDetected, tier, visionInfo, aiData){'));
test('step 1 vision uses plain gemini-2.5-flash', has("'google/gemini-2.5-flash'") && has('function voiceIdentifyFromPhotos'));
test('step 2 pricing uses :online grounding',   has("'google/gemini-2.5-flash:online'"));
test('visual label override corrects phonetics', has('VISUAL LABEL OVERRIDE:') && has('"four team"') && has('"utah zero zero one"'));
test('strict factuality rule present',          has('RULE OF STRICT FACTUALITY:'));
test('no unverified positive assumptions rule', has('NO UNVERIFIED POSITIVE ASSUMPTIONS:') && has('"hinge is sturdy"'));
test('missing parts accuracy rule',             has('MISSING PARTS ACCURACY:') && has('Battery and battery cover not included'));
test('condition box stays 2-3 sentences',       has('Keep the condition box strictly factual and concise (2-3 sentences max'));
test('scale reading stays last-photo-only',     has('detectWeightAndDims(scaleB64, function(winfo){'));
test('scale photo excluded from id photos',     has('if(pi === weightPhotoIndex) continue;'));
test('shipping tier stays server-computed',     has('tier = calculateShippingTier(winfo.lbs, winfo.oz, sku);'));
test('AI failure falls back to deterministic',  has('function fallbackToDeterministic(reason){') && has("if(!OPENROUTER_KEY){ fallbackToDeterministic('OPENROUTER_API_KEY not set'); return; }") && has("if(!aiData){ fallbackToDeterministic('Step 2 returned no data'); return; }"));
test('fallback still writes a real record',    has('var fbRecord = buildVoiceListingRecord(sku, pv2, shelf, saved, {});'));
test('photos saved before responding',   has("photos.forEach(function(b64, i){") && has("sendJSON(res,200,{ success:true, sku:sku"));
test('client shows toast not alert on success', has("voiceToast('") && has('voiceResetFields();'));
test('toast auto-hides itself',          has('voiceToastTimer=setTimeout(') && has("el.classList.remove('show');"));
test('reset re-peeks SKU + clears fields', has('function voiceResetFields(){voicePhotos=[];') && has('voiceLoadNextSku();}'));

// ── fix 2: photo order + reorder controls ──
test('addVoicePhotos reads sequentially', has('function addVoicePhotos(input){') && has('function next(){') && !has('files.forEach(function(file)'));
test('gallery selection auto-reversed on upload', has('for(var i=0;i<files.length;i++)arr.push(files[i]);arr.reverse();var idx=0;'));
test('one FileReader in flight at a time', has('idx>=arr.length'));
test('client-side compression to canvas', has('function voiceCompressImage(dataUrl,cb)') && has("canvas.toDataURL('image/jpeg',0.85)"));
test('compression capped at 1600px',      has('voiceScaleDims(img.width,img.height,1600)'));
test('compression failure falls back',    has('}catch(e){cb(null);}};') && has('if(!b64){var c=v.indexOf'));
test('voiceScaleDims pure helper',        has('function voiceScaleDims(w,h,max){'));
test('reverse button wired',              has("id='vReverseBtn'") && has('voiceReversePhotos()'));
test('reverse function',                  has('function voiceReversePhotos(){voicePhotos.reverse();'));
test('mobile reverse button is a prominent button, not a tiny link', has("id='vReverseBtn' onclick='voiceReversePhotos()' style='display:inline-block;padding:8px 16px;border:2px solid var(--accent);border-radius:8px;") && has('&#8646; REVERSE PHOTO ORDER</span>'));
test('desktop /api/listings card has a prominent Reverse button above the photo strip', has('&#8646; REVERSE PHOTO ORDER</button>') && has('function reverseCardPhotoOrder(sku,btn){'));
test('reverseCardPhotoOrder reverses thumbs then persists via savePhotoOrder', has('thumbs.reverse().forEach(function(t){strip.appendChild(t);});') && has('savePhotoOrder(sku,order,strip);'));
test('per-thumb shift buttons',           has('function voiceShiftPhoto(idx,dir)') && has("lb.onclick=function(){voiceShiftPhoto(idx,-1);};") && has("rb.onclick=function(){voiceShiftPhoto(idx,1);};"));
test('shift buttons disabled at ends',    has('lb.disabled=(idx===0);') && has('rb.disabled=(idx===voicePhotos.length-1);'));
test('thumbnails show position number',   has('num.textContent=String(idx+1);'));

// ── fix 3: explicit Custom SKU field ──
test('Custom SKU field above Shelf',      has("id='vCustomSku'"));
test('prefilled from next-sku peek',      has("function voiceLoadNextSku(){fetch('/api/next-sku')") && has("f.value=String(d.sku);"));
test('peek is non-claiming (GET)',        has("req.method==='GET' && req.url==='/api/next-sku'") && has('peekNextSku()'));
test('manual override sent to server',    has('if(!isNaN(skuVal)&&skuVal>0)body.sku=skuVal;'));
test('reserveSkuAtLeast keeps counter ahead', has('function reserveSkuAtLeast(n){') && has('if(n >= SKU_NEXT){ SKU_NEXT = n + 1; writeSkuFile(); }'));
test('custom sku never overwrites existing item', has("!fs.existsSync(path.join(DATA_DIR, 'items', String(reqSku), 'listing.json'))"));
test('collision falls back to auto-claim',   has("already in use — claiming next available instead"));
test('custom_sku combines as [SKU]-[SHELF]', has("custom_sku: String(sku) + (shelf ? '-' + shelf : '')"));

// ── fix 4: error resilience ──
test('network failure shows alert',       has("alert('Network error - your description and photos were kept. Try submitting again.');"));
test('server failure shows alert too',    has("alert('Could not submit: '+msg+"));
test('failure keeps transcript/photos (no reset call in error paths)', (function(){
  var i = content.indexOf('function submitVoiceIntake(){');
  var body = content.slice(i, content.indexOf('function goToPhotos', i));
  var errBranch = body.slice(body.indexOf('}else{'), body.indexOf('.catch(function(){')); // d.success===false branch
  var catchBranch = body.slice(body.indexOf('.catch(function(){'));
  return errBranch.indexOf('voiceResetFields') < 0 && catchBranch.indexOf('voiceResetFields') < 0;
})());
test('button re-enabled on both failure paths', (function(){
  var i = content.indexOf('function submitVoiceIntake(){');
  var body = content.slice(i, content.indexOf('function goToPhotos', i));
  return (body.match(/b\.disabled=false;b\.textContent='Create Listing';/g) || []).length >= 1;
})());

// ── functional: voiceScaleDims math (pure, DOM-free) ──
(function(){
  function ex(n){
    var s2 = content.indexOf('function ' + n + '(');
    if (s2 < 0) return '';
    var d = 0, seen = false, e = -1;
    for (var i = s2; i < content.length; i++) { var c = content[i]; if (c === '{') { d++; seen = true; } else if (c === '}') { d--; if (seen && d === 0) { e = i + 1; break; } } }
    return content.slice(s2, e);
  }
  try {
    var box = {};
    eval(ex('voiceScaleDims') + '\nbox.dims = voiceScaleDims;');
    var D = box.dims;
    test('(voice) scale dims: cap wide image',   JSON.stringify(D(3000, 2000, 1600)) === JSON.stringify({ w: 1600, h: 1067 }));
    test('(voice) scale dims: cap tall image',   JSON.stringify(D(2000, 3000, 1600)) === JSON.stringify({ w: 1067, h: 1600 }));
    test('(voice) scale dims: under cap unchanged', JSON.stringify(D(800, 600, 1600)) === JSON.stringify({ w: 800, h: 600 }));
    test('(voice) scale dims: zero-size no crash', JSON.stringify(D(0, 0, 1600)) === JSON.stringify({ w: 0, h: 0 }));
  } catch (e) {
    test('voiceScaleDims functional eval', false);
    console.log('    ERROR:', e.message);
  }
})();

section('VOICE DIMENSIONS — stock box catalog & selectBestBox (presence)');
test('POLY_MAILER_SPEC matches spec',   has("var POLY_MAILER_SPEC = { box_name: 'Poly Mailer', length: 12, width: 8, height: 4, added_weight_oz: 3 };"));
test('STOCK_BOXES catalog matches spec', has('{ l: 12, w: 8,  h: 6  },') && has('{ l: 12, w: 10, h: 8  },') && has('{ l: 15, w: 12, h: 10 },') && has('{ l: 16, w: 12, h: 12 },') && has('{ l: 17, w: 11, h: 12 },') && has('{ l: 18, w: 18, h: 16 },') && has('{ l: 20, w: 16, h: 15 },') && has('{ l: 22, w: 13, h: 15 },') && has('{ l: 24, w: 18, h: 18 },') && has('{ l: 24, w: 20, h: 20 },') && has('{ l: 26, w: 16, h: 15 }'));
test('selectBestBox exists',            has('function selectBestBox(rawWeightOz, itemDims){'));
test('under-12oz returns Poly Mailer',  has('if(rawWeightOz > 0 && rawWeightOz < 12) return POLY_MAILER_SPEC;'));
test('2in buffer <= 15lb, 3in above',   has("var bufferIn = rawWeightOz <= 240 ? 2 : 3;"));
test('padded dims sorted so L >= W',    has('if(padded.w > padded.l){ var t = padded.l; padded.l = padded.w; padded.w = t; }'));
test('fit check tests both orientations', has('return (box.l >= padded.l && box.w >= padded.w) || (box.w >= padded.l && box.l >= padded.w);'));
test('smallest fitting box chosen by volume', has('fitting.sort(function(a, b){ return (a.l * a.w * a.h) - (b.l * b.w * b.h); });'));
test('height cut down to Math.ceil(padded.h)', has('var cutH = Math.ceil(padded.h);') && has('var wasCut = chosen.h > cutH;'));
test('tare weight tiers +8/+16/+32oz',  has('var addedOz = rawWeightOz <= 96 ? 8 : (rawWeightOz <= 240 ? 16 : 32);'));

section('VOICE DIMENSIONS — Step 1 prompt parses spoken dimensions');
test('Step 1 prompt asks for spoken dims', has('DIMENSIONS: If the seller spoke the item') && has('function voiceIdentifyFromPhotos'));
test('Step 1 JSON contract includes item_length/width/height', has("'  \"item_length\": 0,'") && has("'  \"item_width\": 0,'") && has("'  \"item_height\": 0'"));
test('unspoken dims default to 0, never guessed from photos', has('return all three as 0 — do not guess dimensions from the photos.'));

section('VOICE DIMENSIONS — wired into assembleVoiceRecordFromAI + Box: badge');
test('boxPick computed from tier + visionInfo',     has('boxPick = selectBestBox(rawTotalOz, v);'));
test('box selection overrides tier weight and box',  has('tier.finalLbs = Math.floor(finalOzTotal / 16);') && has('tier.finalOz = finalOzTotal % 16;') && has("tier.boxSize = boxPick.length + 'x' + boxPick.width + 'x' + boxPick.height;"));
test('package_length/width/height/selected_box saved to listing.json', has('package_length: boxPick ? boxPick.length : null,') && has('package_width: boxPick ? boxPick.width : null,') && has('package_height: boxPick ? boxPick.height : null,') && has('selected_box: boxPick ? boxPick.box_name : null,'));
test('package_length/width/height/selected_box saved to meta.json',    (content.match(/package_length: boxPick \? boxPick\.length : null,/g) || []).length === 2 && (content.match(/selected_box: boxPick \? boxPick\.box_name : null/g) || []).length === 2);
test('shipping_weight and package_dimensions saved to listing.json',   has('shipping_weight: boxPick ? ((tier.rawLbs * 16) + tier.rawOz + boxPick.added_weight_oz) : null,') && has("package_dimensions: boxPick ? (boxPick.length + 'x' + boxPick.width + 'x' + boxPick.height) : null,"));
test('Box: badge prefers selected_box (dual card view)',    has("(listing.selected_box || ((wtier && wtier.boxSize) ? wtier.boxSize : (listing.box_dimensions || '')) || '(set)')"));
test('Box: badge prefers selected_box (/api/listings page)', has("(listing.selected_box||((wtier&&wtier.boxSize)?wtier.boxSize:(listing.box_dimensions||''))||'(set)')"));

// ── functional: selectBestBox itself, pure — no network, no eBay dependency ──
(function(){
  function ex(n){
    var s2 = content.indexOf('function ' + n + '(');
    if (s2 < 0) return '';
    var d = 0, seen = false, e = -1;
    for (var i = s2; i < content.length; i++) { var c = content[i]; if (c === '{') { d++; seen = true; } else if (c === '}') { d--; if (seen && d === 0) { e = i + 1; break; } } }
    return content.slice(s2, e);
  }
  try {
    var box = {};
    var code = (content.match(/var POLY_MAILER_SPEC = \{[\s\S]*?\};/) || [''])[0] + '\n'
      + (content.match(/var STOCK_BOXES = \[[\s\S]*?\];/) || [''])[0] + '\n'
      + ex('selectBestBox') + '\nbox.pick = selectBestBox;';
    var _log = console.log; console.log = function(){};
    eval(code);
    console.log = _log;
    var B = box.pick;

    test('(box) under 12oz -> Poly Mailer regardless of dims', JSON.stringify(B(8, { item_length: 20, item_width: 20, item_height: 20 })) === JSON.stringify({ box_name: 'Poly Mailer', length: 12, width: 8, height: 4, added_weight_oz: 3 }));
    test('(box) exactly 12oz is NOT poly mailer (boundary is exclusive)', B(12, null) === null);
    test('(box) no dims spoken -> null (caller falls back)', B(50, null) === null && B(50, { item_length: 0, item_width: 0, item_height: 0 }) === null);

    // Exact fit, smallest box, no cut-down: item 10x6x4 + 2in buffer (weight 50oz, <=96 -> tare +8) = padded 12x8x6, matches STOCK_BOXES[0] exactly.
    var exact = B(50, { item_length: 10, item_width: 6, item_height: 4 });
    test('(box) exact-fit small box chosen with no cut-down', exact && exact.box_name === '12x8x6' && exact.length === 12 && exact.width === 8 && exact.height === 6);
    test('(box) small-box tare is +8oz',                      exact && exact.added_weight_oz === 8);

    // Worked example from spec: 22x13x15 resized to 22x13x12. Weight 150oz (96<150<=240 -> tare +16, buffer 2in).
    // item 20 x 9 x 9.5 -> padded 22 x 11 x 11.5 -> smallest fitting stock box is 22x13x15 -> cut to 22x13x12.
    var cut = B(150, { item_length: 20, item_width: 9, item_height: 9.5 });
    test('(box) height cut-down matches the spec worked example', cut && cut.box_name === '22x13x12 (from 22x13x15)' && cut.length === 22 && cut.width === 13 && cut.height === 12);
    test('(box) medium-box tare is +16oz',                        cut && cut.added_weight_oz === 16);

    // Heavy item (> 240oz -> 3in buffer, +32oz tare). item 22x16x11 -> padded 25x19x14 -> fits 26x16x15? no
    // (19 > 16 and 19 > 15 too even swapped) -> use a box guaranteed to fit: 24x20x20.
    var heavy = B(300, { item_length: 21, item_width: 17, item_height: 11 });
    test('(box) >15lb uses 3in buffer',   heavy && heavy.length >= 21 + 3);
    test('(box) heavy tare is +32oz',     heavy && heavy.added_weight_oz === 32);

    // Seller spoke length as the SHORTER side (item_length 9 < item_width 13) — selectBestBox must
    // still sort padded L>=W before matching, not just take the spoken order at face value.
    var swapped = B(50, { item_length: 9, item_width: 13, item_height: 4 });
    test('(box) spoken L/W order does not matter — still resolves correctly', swapped && swapped.box_name === '15x12x6 (from 15x12x10)' && swapped.length === 15 && swapped.width === 12);

    // Too large for every stock box -> null, caller falls back to calculateShippingTier's box.
    test('(box) nothing fits -> null, never throws', B(500, { item_length: 40, item_width: 30, item_height: 30 }) === null);
  } catch(e){
    test('selectBestBox functional eval', false);
    console.log('    ERROR:', e.message);
  }
})();

// ── functional: full voice-submitted payload -> AddItem XML builder (pre-flight simulation) ──
// Simulates what createEbayListing actually sends after leaf-category resolution: build a
// voice-intake record with assembleVoiceRecordFromAI (same function the fast-submit background
// worker calls), attach a resolved leaf category ID (as resolveLeafCategoryFromTitle would), and
// run it through buildAddItemXml — the exact function that produces the AddItem request body.
section('VOICE INTAKE -> ADDITEM BUILDER (pre-flight simulation)');
(function(){
  function ex(n){
    var s2 = content.indexOf('function ' + n + '(');
    if (s2 < 0) return '';
    var d = 0, seen = false, e = -1;
    for (var i = s2; i < content.length; i++) { var c = content[i]; if (c === '{') { d++; seen = true; } else if (c === '}') { d--; if (seen && d === 0) { e = i + 1; break; } } }
    return content.slice(s2, e);
  }
  try {
    var box = {};
    var code = 'var MIN_THRESHOLD = 30;\n'
      + (content.match(/var POLY_MAILER_SPEC = \{[\s\S]*?\};/) || [''])[0] + '\n'
      + (content.match(/var STOCK_BOXES = \[[\s\S]*?\];/) || [''])[0] + '\n'
      + (content.match(/var CATEGORY_REQUIRED_ASPECTS = \{[\s\S]*?\};/) || [''])[0] + '\n'
      + (content.match(/var KNOWN_MODEL_SPECS = \{[\s\S]*?\};/) || [''])[0] + '\n'
      + (content.match(/var GENERIC_SPEC_FALLBACKS = \{[\s\S]*?\};/) || [''])[0] + '\n'
      + ex('splitToLimit') + '\n' + ex('trimAspects') + '\n'
      + ex('calculateShippingTier') + '\n' + ex('shippingPolicyName') + '\n' + ex('calcShipping') + '\n'
      + ex('selectBestBox') + '\n'
      + ex('lookupKnownModelSpecs') + '\n' + ex('autoFillRequiredSpecifics') + '\n'
      + ex('sanitizeSpecificValue') + '\n' + ex('stripIllegalXmlChars') + '\n' + ex('stripExternalLinks') + '\n' + ex('sanitizeListingData') + '\n'
      + ex('voiceGradeConditionId') + '\n' + ex('buildCassiniTitle') + '\n' + ex('assembleVoiceRecordFromAI') + '\n'
      + ex('xmlEscape') + '\n' + ex('cdataSafe') + '\n' + ex('conditionIdForCategory') + '\n'
      + ex('estimateShipCost') + '\n' + ex('buildItemSpecificsXml') + '\n' + ex('buildAddItemXml') + '\n'
      + 'box.assemble = assembleVoiceRecordFromAI; box.buildXml = buildAddItemXml; box.tier = calculateShippingTier; box.selectBestBox = selectBestBox; box.autoFill = autoFillRequiredSpecifics; box.sanitizeValue = sanitizeSpecificValue;';
    var _log = console.log; console.log = function(){};
    eval(code);
    console.log = _log;

    // Simulates uploadAllPhotos(): one CDN-style URL per record.outputPhotos stem, in order —
    // outputPhotos already excludes the scale/weight photo (assembleVoiceRecordFromAI rule).
    function simulatePictureUrls(record){
      return (record.outputPhotos || []).map(function(stem){ return 'https://i.ebayimg.com/00/s/' + stem + '.jpg'; });
    }

    // ── Zebra P4T thermal label printer — saved=4 photos, photo_4 is the scale photo ──
    var zTier = box.tier(3, 2, 601);
    var zVision = { item_name: 'Zebra P4T Direct Thermal Label Printer', brand: 'Zebra', model: 'P4T', category: 'Label Printers', includes: 'AC power adapter', condition_notes: 'light scuffing on case' };
    var zPvHints = { grade: 'B', power_test: 'Pass', brand: 'Zebra', model: 'P4T', product_type: 'Label Printer', includes: ['power adapter'], features: [], quantity: 1 };
    var zAiData = { title: 'Zebra P4T Direct Thermal Label Printer - Tested', grade: 'B', parts_repair: false,
      condition_box: 'Light scuffing on case. Powers on and prints test label. AC adapter included.',
      description_html: '<h3>Overview</h3><p>Zebra P4T label printer.</p>',
      avg_sold_price: 62, price_low: 45, price_high: 78, suggested_price: 58, accept_price: 46, decline_price: 35,
      item_specifics: { Brand: 'Zebra', Model: 'P4T', Type: 'Label Printer' }, is_lot: false, lot_quantity: 1 };
    var zRecord = box.assemble('601', 'A3', 4, 'zebra p forty printer grade B powers on prints test label', zPvHints, { lbs: 3, oz: 2 }, 4, false, zTier, zVision, zAiData);
    // Simulate the pre-flight leaf resolution (Error [87] prevention) that runs before this write —
    // 175677 = Label/Thermal Printers, a real eBay leaf category.
    zRecord.listing.category_id = 175677; zRecord.listing.primary_category_id = 175677; zRecord.meta.category_name = 'Label/Thermal Printers';
    var zXml = box.buildXml(zRecord, { categoryId: zRecord.listing.category_id, pictureUrls: simulatePictureUrls(zRecord), conditionId: null, policies: null });

    test('(zebra) leaf category resolved in AddItem XML', zXml.indexOf('<PrimaryCategory><CategoryID>175677</CategoryID></PrimaryCategory>') >= 0);
    test('(zebra) price formatted correctly',              zXml.indexOf('<StartPrice currencyID="USD">58</StartPrice>') >= 0);
    test('(zebra) custom SKU matches [SKU]-[SHELF]',        zXml.indexOf('<SKU>601-A3</SKU>') >= 0 && zRecord.listing.custom_sku === '601-A3');
    test('(zebra) scale photo stripped from listing images', zRecord.outputPhotos.indexOf('photo_4') < 0 && zRecord.outputPhotos.length === 3 && zXml.indexOf('photo_4') < 0);
    test('(zebra) three non-scale photos uploaded',         (zXml.match(/<PictureURL>/g) || []).length === 3);

    // ── Same Zebra printer, but the seller SPOKE dimensions that trigger a height cut-down —
    // proves package_height/box_dimensions/selected_box and the real AddItem XML all use the
    // CUT-DOWN height (12), never the stock box height (15), end to end.
    var zTierCut = box.tier(9, 6, 604); // 150oz total
    var zVisionCut = { item_name: 'Zebra P4T Direct Thermal Label Printer', brand: 'Zebra', model: 'P4T', category: 'Label Printers', includes: 'AC power adapter', condition_notes: 'light scuffing on case', item_length: 20, item_width: 9, item_height: 9.5 };
    var zRecordCut = box.assemble('604', 'A3', 4, 'zebra p forty printer 20 by 9 by 9.5 grade B powers on prints test label', zPvHints, { lbs: 9, oz: 6 }, 4, false, zTierCut, zVisionCut, zAiData);
    zRecordCut.listing.category_id = 175677; zRecordCut.listing.primary_category_id = 175677;
    var zXmlCut = box.buildXml(zRecordCut, { categoryId: zRecordCut.listing.category_id, pictureUrls: simulatePictureUrls(zRecordCut), conditionId: null, policies: null });

    test('(zebra cut-down) package_height is the cut-down height, not stock', zRecordCut.listing.package_height === 12);
    test('(zebra cut-down) package_length/width match the stock box footprint', zRecordCut.listing.package_length === 22 && zRecordCut.listing.package_width === 13);
    test('(zebra cut-down) selected_box leads with cut-down dims',   zRecordCut.listing.selected_box === '22x13x12 (from 22x13x15)');
    test('(zebra cut-down) box_dimensions is the clean cut-down triple', zRecordCut.listing.box_dimensions === '22x13x12');
    test('(zebra cut-down) AddItem XML PackageDepth uses cut-down 12, never stock 15', zXmlCut.indexOf('<PackageDepth unit="inches">12</PackageDepth>') >= 0 && zXmlCut.indexOf('<PackageDepth unit="inches">15</PackageDepth>') < 0);
    test('(zebra cut-down) AddItem XML PackageLength/Width match footprint', zXmlCut.indexOf('<PackageLength unit="inches">22</PackageLength>') >= 0 && zXmlCut.indexOf('<PackageWidth unit="inches">13</PackageWidth>') >= 0);

    // ── Nintendo Switch OLED console — saved=6 photos, photo_6 is the scale photo ──
    var nTier = box.tier(2, 4, 602);
    var nVision = { item_name: 'Nintendo Switch OLED Console', brand: 'Nintendo', model: 'UTL-001', category: 'Video Game Consoles', includes: 'dock, HDMI cable, one Joy-Con', condition_notes: 'screen has minor scratches' };
    var nPvHints = { grade: 'C', power_test: 'Pass', brand: 'Nintendo', model: 'UTL-001', product_type: 'Game Console', includes: ['dock', 'HDMI cable'], features: [], quantity: 1 };
    var nAiData = { title: 'Nintendo Switch OLED Console UTL-001 with Dock - For Parts Missing Joy-Con', grade: 'C', parts_repair: false,
      condition_box: 'Screen has minor scratches. Powers on and boots to home menu. Dock and HDMI cable included; only one Joy-Con included.',
      description_html: '<h3>Overview</h3><p>Nintendo Switch OLED console.</p>',
      avg_sold_price: 145, price_low: 110, price_high: 175, suggested_price: 139.99, accept_price: 120, decline_price: 95,
      item_specifics: { Brand: 'Nintendo', Model: 'UTL-001', Console: 'Nintendo Switch' }, is_lot: false, lot_quantity: 1 };
    var nRecord = box.assemble('602', 'C1', 6, 'nintendo utah zero zero one switch grade C powers on boots to home menu missing one joy con', nPvHints, { lbs: 2, oz: 4 }, 6, false, nTier, nVision, nAiData);
    // 139971 = Video Game Consoles, a real eBay leaf category (per spec example).
    nRecord.listing.category_id = 139971; nRecord.listing.primary_category_id = 139971; nRecord.meta.category_name = 'Video Game Consoles';
    var nXml = box.buildXml(nRecord, { categoryId: nRecord.listing.category_id, pictureUrls: simulatePictureUrls(nRecord), conditionId: null, policies: null });

    test('(nintendo) leaf category resolved in AddItem XML', nXml.indexOf('<PrimaryCategory><CategoryID>139971</CategoryID></PrimaryCategory>') >= 0);
    test('(nintendo) price formatted correctly (decimal preserved)', nXml.indexOf('<StartPrice currencyID="USD">139.99</StartPrice>') >= 0);
    test('(nintendo) custom SKU matches [SKU]-[SHELF]',      nXml.indexOf('<SKU>602-C1</SKU>') >= 0 && nRecord.listing.custom_sku === '602-C1');
    test('(nintendo) scale photo stripped from listing images', nRecord.outputPhotos.indexOf('photo_6') < 0 && nRecord.outputPhotos.length === 5 && nXml.indexOf('photo_6') < 0);
    test('(nintendo) five non-scale photos uploaded',        (nXml.match(/<PictureURL>/g) || []).length === 5);
  } catch(e){
    test('voice -> AddItem builder functional eval', false);
    console.log('    ERROR:', e.message);
  }
})();

// ── functional: Category 177 (PC Laptops & Netbooks) required-specifics auto-fill + Error 240
// sanitizer, real SKU 2649 (Panasonic Toughbook CF-52, single unit) and a synthetic parts lot ──
section('CATEGORY 177 ITEM SPECIFICS AUTO-FILL + ERROR 240 SANITIZER');
(function(){
  function ex(n){
    var s2 = content.indexOf('function ' + n + '(');
    if (s2 < 0) return '';
    var d = 0, seen = false, e = -1;
    for (var i = s2; i < content.length; i++) { var c = content[i]; if (c === '{') { d++; seen = true; } else if (c === '}') { d--; if (seen && d === 0) { e = i + 1; break; } } }
    return content.slice(s2, e);
  }
  try {
    var box = {};
    var code = 'var MIN_THRESHOLD = 30;\n'
      + (content.match(/var CATEGORY_REQUIRED_ASPECTS = \{[\s\S]*?\};/) || [''])[0] + '\n'
      + (content.match(/var KNOWN_MODEL_SPECS = \{[\s\S]*?\};/) || [''])[0] + '\n'
      + (content.match(/var GENERIC_SPEC_FALLBACKS = \{[\s\S]*?\};/) || [''])[0] + '\n'
      + ex('splitToLimit') + '\n' + ex('trimAspects') + '\n'
      + ex('calculateShippingTier') + '\n' + ex('shippingPolicyName') + '\n' + ex('calcShipping') + '\n' + ex('selectBestBox') + '\n'
      + ex('lookupKnownModelSpecs') + '\n' + ex('autoFillRequiredSpecifics') + '\n'
      + ex('sanitizeSpecificValue') + '\n' + ex('stripIllegalXmlChars') + '\n' + ex('stripExternalLinks') + '\n' + ex('sanitizeListingData') + '\n'
      + ex('voiceGradeConditionId') + '\n' + ex('buildCassiniTitle') + '\n' + ex('assembleVoiceRecordFromAI') + '\n'
      + ex('xmlEscape') + '\n' + ex('cdataSafe') + '\n' + ex('conditionIdForCategory') + '\n'
      + ex('estimateShipCost') + '\n' + ex('buildItemSpecificsXml') + '\n' + ex('buildAddItemXml') + '\n'
      + 'box.assemble = assembleVoiceRecordFromAI; box.buildXml = buildAddItemXml; box.tier = calculateShippingTier; box.sanitizeValue = sanitizeSpecificValue; box.stripControl = stripIllegalXmlChars; box.stripLinks = stripExternalLinks;';
    var _log = console.log; console.log = function(){};
    eval(code);
    console.log = _log;

    function simulatePictureUrls(record){ return (record.outputPhotos || []).map(function(stem){ return 'https://i.ebayimg.com/00/s/' + stem + '.jpg'; }); }

    // ── SKU 2649 — single-unit Panasonic Toughbook CF-52, "FOR PARTS", Screen Size/Processor
    // never extracted by the AI (mirrors the real failure) ──
    var cfTier = box.tier(21, 4.6, 2649);
    var cfVision = { item_name: 'Panasonic Toughbook CF-52 Laptop', brand: 'Panasonic', model: 'CF-52', category: 'Notebook/Laptop', includes: 'AC adapter', condition_notes: 'heavy wear, does not power on' };
    var cfPvHints = { grade: 'D', power_test: 'Fail', brand: 'Panasonic', model: 'CF-52', product_type: 'Laptop', includes: [], features: [], quantity: 1 };
    var cfAiData = { title: 'Panasonic Toughbook CF-52 Laptop Intel Core 2 Duo 2.26GHz 2GB RAM FOR PARTS', grade: 'D', parts_repair: true,
      condition_box: 'Heavy cosmetic wear. Does not power on. Sold for parts or repair only.',
      description_html: '<h3>Overview</h3><p>Panasonic Toughbook CF-52, for parts.</p>',
      avg_sold_price: 60, price_low: 40, price_high: 80, suggested_price: 60, accept_price: 55, decline_price: 35,
      item_specifics: { Brand: 'Panasonic', Model: 'CF-52', Type: 'Notebook/Laptop' }, is_lot: false, lot_quantity: 1 }; // no Screen Size / Processor — the real bug
    var cfRecord = box.assemble('2649', 'E3', 25, 'panasonic toughbook cf fifty two for parts does not power on', cfPvHints, { lbs: 21, oz: 4.6 }, 25, false, cfTier, cfVision, cfAiData);
    cfRecord.listing.category_id = 177; cfRecord.listing.primary_category_id = 177; cfRecord.meta.category_name = 'PC Laptops & Netbooks';
    var cfXml = box.buildXml(cfRecord, { categoryId: cfRecord.listing.category_id, pictureUrls: simulatePictureUrls(cfRecord), conditionId: null, policies: null });

    test('(SKU 2649) Screen Size auto-filled from known-model knowledge', cfRecord.listing.item_specifics['Screen Size'] === '15.4 in');
    test('(SKU 2649) Processor auto-filled from known-model knowledge',   cfRecord.listing.item_specifics['Processor'] === 'Intel Core 2 Duo');
    test('(SKU 2649) RAM Size still auto-filled even with no model match', !!cfRecord.listing.item_specifics['RAM Size']);
    test('(SKU 2649) Storage Type OR-group satisfied (no false-missing)', !!cfRecord.listing.item_specifics['Storage Type'] || !!cfRecord.listing.item_specifics['SSD Capacity'] || !!cfRecord.listing.item_specifics['Hard Drive Capacity']);
    test('(SKU 2649) AddItem XML actually carries Screen Size 15.4 in', cfXml.indexOf('<Value>15.4 in</Value>') >= 0);
    test('(SKU 2649) AddItem XML actually carries Processor value',     cfXml.indexOf('<Value>Intel Core 2 Duo</Value>') >= 0);
    test('(SKU 2649) leaf category 177 in AddItem XML',                 cfXml.indexOf('<PrimaryCategory><CategoryID>177</CategoryID></PrimaryCategory>') >= 0);

    // ── synthetic multi-unit PARTS LOT — same model, but a lot must NOT get a single per-unit
    // known-model guess (units may differ); "See Description" is used instead ──
    var lotTier = box.tier(60, 0, 2650);
    var lotVision = { item_name: 'Panasonic Toughbook CF-52 Laptops', brand: 'Panasonic', model: 'CF-52', category: 'Notebook/Laptop', includes: '', condition_notes: 'mixed cosmetic wear across units' };
    var lotPvHints = { grade: 'D', power_test: 'Fail', brand: 'Panasonic', model: 'CF-52', product_type: 'Laptop', includes: [], features: [], quantity: 3 };
    var lotAiData = { title: 'LOT OF 3: Lot of 3 Panasonic Toughbook CF-52 Laptops For Parts or Repair', grade: 'D', parts_repair: true,
      condition_box: 'Lot of 3 units, mixed cosmetic wear, sold for parts or repair only, untested individually.',
      description_html: '<h3>Overview</h3><p>Lot of 3 Panasonic Toughbook CF-52 laptops.</p>',
      avg_sold_price: 90, price_low: 70, price_high: 120, suggested_price: 90, accept_price: 80, decline_price: 55,
      item_specifics: { Brand: 'Panasonic', Model: 'CF-52', Type: 'Notebook/Laptop' }, is_lot: true, lot_quantity: 3 };
    var lotRecord = box.assemble('2651', 'E3', 10, 'lot of three panasonic toughbook cf fifty two for parts', lotPvHints, { lbs: 60, oz: 0 }, 10, false, lotTier, lotVision, lotAiData);
    lotRecord.listing.category_id = 177; lotRecord.listing.primary_category_id = 177;
    var lotXml = box.buildXml(lotRecord, { categoryId: lotRecord.listing.category_id, pictureUrls: simulatePictureUrls(lotRecord), conditionId: null, policies: null });

    test('(parts lot) quantity 3 recognized as a lot', lotRecord.quantity === 3 && lotRecord.listing.is_lot === true);
    test('(parts lot) Screen Size falls back to "See Description", not a single guessed size', lotRecord.listing.item_specifics['Screen Size'] === 'See Description');
    test('(parts lot) Processor falls back to "See Description" for the same reason',          lotRecord.listing.item_specifics['Processor'] === 'See Description');
    test('(parts lot) AddItem XML Quantity reflects the lot size',      lotXml.indexOf('<Quantity>3</Quantity>') >= 0);
    test('(parts lot) AddItem XML never left Screen Size/Processor blank', lotXml.indexOf('<Value>See Description</Value>') >= 0);

    // ── Universal Value Sanitizer — SKU 2647-style "HDD (Not Included)" / "Not Included" values ──
    var errTier = box.tier(8, 10.5, 2647);
    var errVision = { item_name: 'Panasonic Toughbook CF-31 Laptop', brand: 'Panasonic', model: 'CF-31WLEHLM', category: 'Notebook/Laptop', includes: 'AC adapter', condition_notes: 'light scuffing' };
    var errPvHints = { grade: 'B', power_test: 'Pass', brand: 'Panasonic', model: 'CF-31WLEHLM', product_type: 'Laptop', includes: ['AC adapter'], features: [], quantity: 1 };
    var errAiData = { title: 'Panasonic Toughbook CF-31 CF-31WLEHLM i5-3340M 4GB RAM Rugged Laptop w/ Charger', grade: 'B', parts_repair: false,
      condition_box: 'Light scuffing on case. Powers on and boots. AC adapter included; no hard drive installed.',
      description_html: '<h3>Overview</h3><p>Panasonic Toughbook CF-31, rugged laptop.</p>',
      avg_sold_price: 240, price_low: 180, price_high: 300, suggested_price: 240, accept_price: 200, decline_price: 150,
      item_specifics: { Brand: 'Panasonic', Model: 'CF-31WLEHLM', Type: 'Notebook/Laptop', Processor: 'Intel Core i5 3rd Gen', 'RAM Size': '4 GB',
        'Screen Size': '13.1 in', 'Operating System': 'Not Included', 'Storage Type': 'HDD (Not Included)', Color: 'Silver' },
      is_lot: false, lot_quantity: 1 };
    var errRecord = box.assemble('2647', 'G2', 8, 'panasonic toughbook cf thirty one rugged laptop with charger', errPvHints, { lbs: 8, oz: 10.5 }, 8, false, errTier, errVision, errAiData);
    errRecord.listing.category_id = 177; errRecord.listing.primary_category_id = 177;
    var errXml = box.buildXml(errRecord, { categoryId: errRecord.listing.category_id, pictureUrls: simulatePictureUrls(errRecord), conditionId: null, policies: null });

    test('(SKU 2647) "HDD (Not Included)" sanitized to clean "HDD"', errRecord.listing.item_specifics['Storage Type'] === 'HDD');
    test('(SKU 2647) Operating System "Not Included" left as the correct eBay value', errRecord.listing.item_specifics['Operating System'] === 'Not Included');
    test('(SKU 2647) AddItem XML never contains the raw "(Not Included)" phrase', errXml.indexOf('(Not Included)') < 0);
    test('(SKU 2647) AddItem XML carries the clean Storage Type value', errXml.indexOf('<Value>HDD</Value>') >= 0);
    test('(SKU 2647) AddItem XML carries Operating System correctly',  errXml.indexOf('<Value>Not Included</Value>') >= 0);
    test('(SKU 2647) title w/ shorthand survives XML-safe and unmangled', errXml.indexOf('w/ Charger') >= 0);
    test('(SKU 2647) leaf category 177 in AddItem XML', errXml.indexOf('<PrimaryCategory><CategoryID>177</CategoryID></PrimaryCategory>') >= 0);

    // ── sanitizeSpecificValue direct unit checks (a few more patterns than the end-to-end cases above) ──
    test('(sanitize) "SSD (Not Installed)"-style pattern also cleaned', box.sanitizeValue('Storage Type', 'SSD (Not Installed)') === 'SSD');
    test('(sanitize) bare "Not Included" on a non-OS field becomes "None"', box.sanitizeValue('Battery', 'Not Included') === 'None');
    test('(sanitize) ordinary values pass through unchanged', box.sanitizeValue('Color', 'Silver') === 'Silver');

    // ── control-character stripping (illegal XML bytes from a garbled transcript/OCR pass) ──
    var dirty = 'Silver\x07Case';
    test('(sanitize) illegal control characters stripped',        box.stripControl(dirty) === 'SilverCase');
    test('(sanitize) tab/newline/CR are NOT stripped (legal XML whitespace)', box.stripControl('Line1\tLine2\nLine3\r') === 'Line1\tLine2\nLine3\r');

    // ── external links / citations (the ACTUAL confirmed live Error 240 trigger for SKU 2647 — a
    // Google-Search-grounded response cited its sources as markdown links directly in the HTML) ──
    var realCf31Snippet = '<li><strong>Construction:</strong> Rugged, MIL-STD-810G, MIL-STD-461F & IP65 certified [officedepot.com](https://www.officedepot.com/a/products/419619/Panasonic-Toughbook-31-CF-31WALEHLM-131/), [newegg.com](https://www.newegg.com/panasonic-toughbook-13-1-xga-touch-screen-2-40ghz-4gb-memory-160gb-hdd-black/p/1TS-000H-00EZ7), [barcodediscount.com](https://www.barcodediscount.com/catalog/panasonic/part-cf-31sbleb1m.htm)</li>';
    var cleanedSnippet = box.stripLinks(realCf31Snippet);
    // VERIFIED LIVE against the real SKU 2647: keeping the anchor text ("officedepot.com" as plain
    // text) still triggered Error 240 — eBay's filter also flags plain-text competitor-site mentions,
    // not only clickable links. So the whole citation is dropped, domain name included, not de-linked.
    test('(links) real SKU 2647 citation snippet has no URLs left', !/https?:\/\//.test(cleanedSnippet));
    test('(links) citation domain names are dropped entirely, not just de-linked', !/officedepot\.com/.test(cleanedSnippet) && !/newegg\.com/.test(cleanedSnippet) && !/barcodediscount\.com/.test(cleanedSnippet));
    test('(links) surrounding sentence survives intact',            /MIL-STD-810G, MIL-STD-461F & IP65 certified/.test(cleanedSnippet));
    test('(links) citation cluster leaves no double-comma/space debris', cleanedSnippet === '<li><strong>Construction:</strong> Rugged, MIL-STD-810G, MIL-STD-461F & IP65 certified</li>');
    test('(links) real HTML <a> tags dropped entirely, not just unwrapped', box.stripLinks('See <a href="https://example.com/x">the spec sheet</a> for details.') === 'See for details.');
    test('(links) bare URL with no markdown/anchor also removed',   box.stripLinks('Source: https://example.com/foo?bar=1 confirmed.') === 'Source: confirmed.');
    test('(links) plain text with no links passes through unchanged', box.stripLinks('Powers on and boots to BIOS.') === 'Powers on and boots to BIOS.');

    // ── end-to-end: buildAddItemXml never contains a link OR a citation domain name, using the
    // real SKU 2647 description ──
    var linkyRecord = { sku: '2647', listing: { title: 'Panasonic Toughbook CF-31 w/ Charger', category_id: 177, suggested_price: 240, custom_sku: '2647-G2',
      description_html: '<h3>Overview</h3><p>Rugged laptop.</p><h3>Specifications</h3><ul>' + realCf31Snippet + '</ul>', item_specifics: {} }, meta: { grade: 'B' } };
    var linkyXml = box.buildXml(linkyRecord, { categoryId: 177, pictureUrls: [], conditionId: null, policies: null });
    test('(links) buildAddItemXml output contains no http(s) URLs at all', !/https?:\/\//.test(linkyXml));
    test('(links) buildAddItemXml output contains no citation domain names', !/officedepot\.com/.test(linkyXml) && !/newegg\.com/.test(linkyXml) && !/barcodediscount\.com/.test(linkyXml));
  } catch(e){
    test('category 177 auto-fill + sanitizer functional eval', false);
    console.log('    ERROR:', e.message);
  }
})();

// ── functional: sanitizeTitleForCategoryQuery + resolveLeafCategoryFromTitle query priority ──
// Proves the sanitizer really strips the exact noise the spec calls out (grade words, "w/",
// "Tested", a long part number) and proves resolveLeafCategoryFromTitle tries Clean Core first,
// then Sanitized Title, then Brand+Type — stubbing getSuggestedCategory/getCategoryFeatures so
// this runs with no network, deterministically choosing which attempt "wins".
section('CLEAN QUERY functional behavior (no network)');
(function(){
  function ex(n){
    var s2 = content.indexOf('function ' + n + '(');
    if (s2 < 0) return '';
    var d = 0, seen = false, e = -1;
    for (var i = s2; i < content.length; i++) { var c = content[i]; if (c === '{') { d++; seen = true; } else if (c === '}') { d--; if (seen && d === 0) { e = i + 1; break; } } }
    return content.slice(s2, e);
  }
  try {
    var box = {};
    var code = ex('sanitizeTitleForCategoryQuery') + '\n'
      + 'box.sanitize = sanitizeTitleForCategoryQuery;';
    var _log = console.log; console.log = function(){};
    eval(code);
    console.log = _log;
    var S = box.sanitize;

    var zebraTitle = 'Zebra P4T Direct Thermal Label Printer w/ Power Adapter P4D-0UJ10000-00 Grade B Tested';
    var zClean = S(zebraTitle);
    test('(sanitize) strips "w/ Power Adapter" phrase marker', zClean.toLowerCase().indexOf('w/') < 0);
    test('(sanitize) strips long part number P4D-0UJ10000-00', zClean.indexOf('0UJ10000') < 0);
    test('(sanitize) strips "Grade B"',                        !/grade b/i.test(zClean));
    test('(sanitize) strips "Tested"',                         !/\btested\b/i.test(zClean));
    test('(sanitize) keeps short model number P4T',            /\bP4T\b/.test(zClean));
    test('(sanitize) keeps brand and product words',           /Zebra/.test(zClean) && /Label/i.test(zClean) && /Printer/i.test(zClean));

    var nintendoTitle = 'Nintendo Switch OLED Console UTL-001 with Dock - For Parts Missing Joy-Con';
    var nClean = S(nintendoTitle);
    test('(sanitize) strips "with" and "for parts" noise',     !/\bwith\b/i.test(nClean) && !/for parts/i.test(nClean));
    test('(sanitize) keeps short model number UTL-001',        /UTL-001/.test(nClean));
  } catch(e){
    test('sanitizeTitleForCategoryQuery functional eval', false);
    console.log('    ERROR:', e.message);
  }

  // ── query priority order, stubbed network ──
  try {
    var box2 = {};
    var code2 = ex('sanitizeTitleForCategoryQuery') + '\n' + ex('trySuggestedLeaf') + '\n' + ex('resolveLeafCategoryFromTitle') + '\n'
      + 'box2.resolve = resolveLeafCategoryFromTitle;';
    var _log2 = console.log; console.log = function(){};
    eval(code2);
    console.log = _log2;
    var R = box2.resolve;

    // Stub getSuggestedCategory (now the Taxonomy REST call, returning a single {category_id,
    // category_name} object per the migrated contract) / getCategoryFeatures so ONLY the "Zebra
    // P4T Label Printer" query (the Clean Core attempt) resolves — proves attempt 1 wins when it
    // works, and that resolveLeafCategoryFromTitle never even tries the noisy attempts after a hit.
    var queriesTried = [];
    global.getSuggestedCategory = function(q, tok, cb){ queriesTried.push(q); if(q === 'Zebra P4T Label Printer'){ cb(null, {category_id:'175677', category_name:'Label/Thermal Printers'}); } else { cb(new Error('get_category_suggestions returned 0 suggestions for "' + q + '"')); } };
    global.getCategoryFeatures = function(id, tok, cb){ cb(null, {leaf: id === '175677', conditions: ['1000','3000']}); };
    R({ brand:'Zebra', model:'P4T', product_type:'Label Printer', title: 'Zebra P4T Direct Thermal Label Printer w/ Power Adapter P4D-0UJ10000-00 Grade B Tested' }, 'tok', function(err, cat){
      test('(priority) Clean Core query used first',   queriesTried[0] === 'Zebra P4T Label Printer');
      test('(priority) stops after first successful attempt', queriesTried.length === 1);
      test('(priority) resolves the expected leaf',    !err && cat && cat.id === 175677);
    });

    // Now make Clean Core fail (0 suggestions) so it must fall through to Sanitized Title.
    var queriesTried2 = [];
    global.getSuggestedCategory = function(q, tok, cb){ queriesTried2.push(q); if(q.indexOf('Zebra') === 0 && q.indexOf('Printer') > 0 && queriesTried2.length > 1){ cb(null, {category_id:'175677', category_name:'Label/Thermal Printers'}); } else { cb(new Error('get_category_suggestions returned 0 suggestions for "' + q + '"')); } };
    global.getCategoryFeatures = function(id, tok, cb){ cb(null, {leaf: id === '175677', conditions: []}); };
    R({ brand:'Zebra', model:'P4T', product_type:'Label Printer', title: 'Zebra P4T Direct Thermal Label Printer w/ Power Adapter P4D-0UJ10000-00 Grade B Tested' }, 'tok', function(err, cat){
      test('(priority) falls through to a later attempt when Clean Core finds nothing', queriesTried2.length > 1);
    });
    delete global.getSuggestedCategory; delete global.getCategoryFeatures;
  } catch(e){
    test('resolveLeafCategoryFromTitle priority functional eval', false);
    console.log('    ERROR:', e.message);
  }
})();

// ── functional: getSuggestedCategory's OWN HTTP-response parsing, against realistic Taxonomy
// JSON — stubs https.request (not getSuggestedCategory itself), so this exercises the actual
// migrated parsing code, proving it reads categorySuggestions[0].category.{categoryId,
// categoryName} the way eBay's real Taxonomy API responds.
section('TAXONOMY RESPONSE PARSING (real parser, stubbed HTTP)');
(function(){
  function ex(n){
    var s2 = content.indexOf('function ' + n + '(');
    if (s2 < 0) return '';
    var d = 0, seen = false, e = -1;
    for (var i = s2; i < content.length; i++) { var c = content[i]; if (c === '{') { d++; seen = true; } else if (c === '}') { d--; if (seen && d === 0) { e = i + 1; break; } } }
    return content.slice(s2, e);
  }
  var https = require('https');
  var realRequest = https.request;
  function mockHttps(statusCode, bodyObj){
    https.request = function(options, cb){
      var body = JSON.stringify(bodyObj);
      var res = { statusCode: statusCode, on: function(evt, handler){ if(evt === 'data') handler(body); else if(evt === 'end') handler(); } };
      cb(res);
      return { on: function(){}, end: function(){} };
    };
  }
  try {
    var box = {};
    var code = "var EBAY_BASE = 'https://api.ebay.com';\n" + ex('getSuggestedCategory') + '\nbox.get = getSuggestedCategory;';
    var _log = console.log; console.log = function(){};
    eval(code);
    console.log = _log;
    var G = box.get;

    mockHttps(200, { categorySuggestions: [
      { category: { categoryId: '175677', categoryName: 'Label/Thermal Printers' }, categoryTreeNodeLevel: 5 },
      { category: { categoryId: '183446', categoryName: 'Other Consumer Electronics' }, categoryTreeNodeLevel: 3 }
    ]});
    G('Zebra P4T Label Printer', 'tok', function(err, cat){
      test('(taxonomy parse) uses categorySuggestions[0], not a later entry', !err && cat.category_id === '175677');
      test('(taxonomy parse) reads category_name from category.categoryName', !err && cat.category_name === 'Label/Thermal Printers');
    });

    mockHttps(200, { categorySuggestions: [] });
    G('totally unmatched gibberish query', 'tok', function(err, cat){
      test('(taxonomy parse) 0 suggestions -> error, not a crash', !!err && !cat);
    });

    mockHttps(410, { errors: [{ message: 'Resource not found' }] });
    G('Zebra P4T Label Printer', 'tok', function(err, cat){
      test('(taxonomy parse) non-2xx HTTP surfaces as an error', !!err && /410/.test(err.message));
    });

    mockHttps(200, { categorySuggestions: [ { categoryTreeNodeLevel: 5 } ] }); // malformed: no .category
    G('Zebra P4T Label Printer', 'tok', function(err, cat){
      test('(taxonomy parse) missing category.categoryId -> error, not a crash', !!err && !cat);
    });
  } catch(e){
    test('getSuggestedCategory Taxonomy parsing functional eval', false);
    console.log('    ERROR:', e.message);
  } finally {
    https.request = realRequest;
  }
})();

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
