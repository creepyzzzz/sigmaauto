/**
 * Standalone test script validating the 3 phases of client-side extraction:
 * Phase 1: Call discoverKeyUrl() (simulating server phase 1)
 * Phase 2: Client fetch lksfy via CF Worker proxy -> extract base64 challenge token
 * Phase 3: Call decryptChallengeToken(base64Token, alias) (simulating server phase 3)
 * Phase 4: Client 10s wait + POST to lksfy via CF Worker proxy
 * Phase 5: Call decryptFinalUrl(encryptedUrl, alias) (simulating server phase 5)
 */

import { discoverKeyUrl, decryptChallengeToken, decryptFinalUrl, CLOUDFLARE_PROXY_URL } from '../lib/extractor';

async function clientProxyFetch(targetUrl, opts = {}) {
  const ep = `${CLOUDFLARE_PROXY_URL.replace(/\/+$/, '')}?url=${encodeURIComponent(targetUrl)}`;
  const headers = {};
  if (opts.targetReferer) headers['x-target-referer'] = opts.targetReferer;
  if (opts.targetCookie) headers['x-target-cookie'] = opts.targetCookie;
  if (opts.redirectMode) headers['x-redirect-mode'] = opts.redirectMode;
  if (opts.contentType) headers['Content-Type'] = opts.contentType;
  return fetch(ep, { method: opts.method || 'GET', headers, body: opts.body });
}

function findBase64Token(str) {
  const m1 = str.match(/var\s+base64\s*=\s*['"]([^'"]+)['"]/i);
  const m2 = str.match(/base64\s*=\s*['"]([A-Za-z0-9+/=]{20,})['"]/i);
  const m3 = str.match(/name="base64"[^>]*value="([^"]+)"/i);
  const m4 = str.match(/data-base64="([^"]+)"/i);
  return m1?.[1] || m2?.[1] || m3?.[1] || m4?.[1] || null;
}

async function run() {
  console.log('=== STEP 1: Server Discovery (Phase 1) ===');
  const dRes = await discoverKeyUrl();
  console.log('Discovery result:', dRes);
  if (!dRes.success || !dRes.keyUrl || !dRes.alias) {
    throw new Error('Discovery failed: ' + dRes.error);
  }

  const { keyUrl, alias } = dRes;

  console.log('\n=== STEP 2: Browser/Client scraping lksfy via CF Worker (Phase 2) ===');
  // R1: initial redirect capture
  const r1 = await clientProxyFetch(keyUrl, { redirectMode: 'manual', targetReferer: keyUrl });
  console.log('R1 status:', r1.status);

  let cookies = [];
  try {
    if (typeof r1.headers.getSetCookie === 'function') cookies = r1.headers.getSetCookie();
  } catch {}
  if (!cookies.length) {
    const single = r1.headers.get('set-cookie');
    if (single) cookies = [single];
  }
  const cookieHeader = cookies.map(c => c.split(';')[0].trim()).join('; ');
  console.log('Cookies captured:', cookieHeader);

  let redirectUrl = r1.headers.get('location');
  const r1Text = await r1.text();
  const jsMatch = r1Text.match(/window\.location(?:\.href)?\s*=\s*['"]([^'"]+)['"]/i) ||
                  r1Text.match(/location\.replace\(['"]([^'"]+)['"]\)/i);
  if (!redirectUrl && jsMatch) redirectUrl = jsMatch[1];

  let refererUrl = redirectUrl || keyUrl;
  if (redirectUrl && !redirectUrl.includes('lksfy.com')) {
    try {
      const rInter = await clientProxyFetch(redirectUrl, { targetReferer: keyUrl, redirectMode: 'manual' });
      const nextLoc = rInter.headers.get('location');
      const interText = await rInter.text();
      const interJs = interText.match(/window\.location(?:\.href)?\s*=\s*['"]([^'"]+)['"]/i);
      if (nextLoc) refererUrl = nextLoc;
      else if (interJs) refererUrl = interJs[1];
    } catch (e) {
      console.warn('Intermediary resolve error:', e.message);
    }
  }
  console.log('Referer URL determined:', refererUrl);

  const r2 = await clientProxyFetch(keyUrl, { targetReferer: refererUrl, targetCookie: cookieHeader });
  const html = await r2.text();
  let base64Token = findBase64Token(html);
  if (!base64Token) {
    throw new Error('Base64 challenge token not found in HTML. Snippet: ' + html.slice(0, 300));
  }
  console.log('Base64 token found! Length:', base64Token.length);

  console.log('\n=== STEP 3: Server Decrypt Challenge Token (Phase 3) ===');
  const tokenRes = decryptChallengeToken(base64Token, alias);
  console.log('Decrypted token result:', tokenRes);
  if (!tokenRes.success || !tokenRes.formAction || !tokenRes.csrfToken) {
    throw new Error('Decrypt challenge token failed: ' + tokenRes.error);
  }

  console.log('\n=== STEP 4: Client 10s wait + POST (Phase 4) ===');
  for (let s = 10; s > 0; s--) {
    process.stdout.write(`\rWaiting ${s}s countdown...`);
    await new Promise(r => setTimeout(r, 1000));
  }
  console.log('\rWaiting 10s countdown... done!     ');

  const postUrl = `https://lksfy.com${tokenRes.formAction}`;
  const postBody = `_method=POST&_csrfToken=${encodeURIComponent(tokenRes.csrfToken)}&ad_form_data=${encodeURIComponent(tokenRes.adFormData || '')}&_Token%5Bfields%5D=${tokenRes.tokenFields || ''}&_Token%5Bunlocked%5D=${encodeURIComponent(tokenRes.tokenUnlocked || '')}`;
  let postCookie = `csrfToken=${tokenRes.csrfToken}`;
  if (cookieHeader) postCookie += `; ${cookieHeader}`;

  const postResp = await clientProxyFetch(postUrl, {
    method: 'POST',
    contentType: 'application/x-www-form-urlencoded; charset=UTF-8',
    targetReferer: 'https://lksfy.com/',
    targetCookie: postCookie,
    body: postBody,
  });

  const postJson = await postResp.json();
  console.log('Post response JSON:', postJson);
  if (!postJson?.url) {
    throw new Error('POST failed: ' + JSON.stringify(postJson));
  }

  console.log('\n=== STEP 5: Server Decrypt Final URL (Phase 5) ===');
  const finalRes = decryptFinalUrl(postJson.url, alias);
  console.log('Final extracted result:', finalRes);
  if (finalRes.success && finalRes.key) {
    console.log('\n🎉 SUCCESS! Extracted Key:', finalRes.key);
  } else {
    throw new Error('Decryption of final url failed');
  }
}

run().catch(err => {
  console.error('\n❌ Test Error:', err);
  process.exit(1);
});
