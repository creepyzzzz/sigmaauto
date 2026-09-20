/**
 * Directly test the Live Vercel site's API endpoints exactly as the live browser executes them:
 * 1. POST https://thisiskeyo.vercel.app/api/auto-generate { phase: 'discover' }
 * 2. Client extracts challenge from lksfy via CF Worker proxy
 * 3. POST https://thisiskeyo.vercel.app/api/auto-generate { phase: 'decrypt-token', base64Token, alias }
 * 4. Client waits 10s and POSTs to lksfy via CF Worker proxy
 * 5. POST https://thisiskeyo.vercel.app/api/auto-generate { phase: 'decrypt-final', encryptedUrl, alias }
 */

const LIVE_HOST = 'https://thisiskeyo.vercel.app';
const CF_PROXY = 'https://royal-bar-c2da.tariqmir1278.workers.dev';

async function clientProxyFetch(targetUrl, opts = {}) {
  const ep = `${CF_PROXY}?url=${encodeURIComponent(targetUrl)}`;
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
  console.log('1. Calling Live Vercel for Phase 1 (discover)...');
  const dResp = await fetch(`${LIVE_HOST}/api/auto-generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phase: 'discover' }),
  });
  const dJson = await dResp.json();
  console.log('   Response:', dJson);

  if (!dJson.success || !dJson.keyUrl) {
    throw new Error('Live Vercel discover phase failed: ' + JSON.stringify(dJson));
  }

  const { keyUrl, alias } = dJson;

  console.log('\n2. Scraping lksfy page via CF Worker proxy...');
  const r1 = await clientProxyFetch(keyUrl, { redirectMode: 'manual', targetReferer: keyUrl });
  let cookies = [];
  try {
    if (typeof r1.headers.getSetCookie === 'function') cookies = r1.headers.getSetCookie();
  } catch {}
  if (!cookies.length) {
    const s = r1.headers.get('set-cookie');
    if (s) cookies = [s];
  }
  const cookieHeader = cookies.map(c => c.split(';')[0].trim()).join('; ');

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
    } catch {}
  }

  const r2 = await clientProxyFetch(keyUrl, { targetReferer: refererUrl, targetCookie: cookieHeader });
  const html = await r2.text();
  const base64Token = findBase64Token(html);
  if (!base64Token) {
    throw new Error('Base64 challenge token not found in HTML. Check snippet: ' + html.slice(0, 300));
  }
  console.log('   Token extracted! Length:', base64Token.length);

  console.log('\n3. Calling Live Vercel for Phase 3 (decrypt-token)...');
  const tokResp = await fetch(`${LIVE_HOST}/api/auto-generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phase: 'decrypt-token', base64Token, alias }),
  });
  const tokJson = await tokResp.json();
  console.log('   Response:', tokJson);
  if (!tokJson.success || !tokJson.formAction) {
    throw new Error('Live Vercel decrypt-token failed: ' + JSON.stringify(tokJson));
  }

  console.log('\n4. Waiting 10s countdown...');
  for (let s = 10; s > 0; s--) {
    process.stdout.write(`   ${s}s remaining...\r`);
    await new Promise(r => setTimeout(r, 1000));
  }
  console.log('   10s wait complete. Submitting POST payload...');

  const postUrl = `https://lksfy.com${tokJson.formAction}`;
  const postBody = `_method=POST&_csrfToken=${encodeURIComponent(tokJson.csrfToken)}&ad_form_data=${encodeURIComponent(tokJson.adFormData || '')}&_Token%5Bfields%5D=${tokJson.tokenFields || ''}&_Token%5Bunlocked%5D=${encodeURIComponent(tokJson.tokenUnlocked || '')}`;
  let postCookie = `csrfToken=${tokJson.csrfToken}`;
  if (cookieHeader) postCookie += `; ${cookieHeader}`;

  const postResp = await clientProxyFetch(postUrl, {
    method: 'POST',
    contentType: 'application/x-www-form-urlencoded; charset=UTF-8',
    targetReferer: 'https://lksfy.com/',
    targetCookie: postCookie,
    body: postBody,
  });

  const postJson = await postResp.json();
  console.log('   Post response:', postJson);
  if (!postJson?.url) {
    throw new Error('POST failed: ' + JSON.stringify(postJson));
  }

  console.log('\n5. Calling Live Vercel for Phase 5 (decrypt-final)...');
  const finalResp = await fetch(`${LIVE_HOST}/api/auto-generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phase: 'decrypt-final', encryptedUrl: postJson.url, alias }),
  });
  const finalJson = await finalResp.json();
  console.log('   Response:', finalJson);

  if (finalJson.success && finalJson.key) {
    console.log('\n===============================================');
    console.log('🎉 LIVE VERCEL TEST PASSED! Key:', finalJson.key);
    console.log('===============================================');
  } else {
    throw new Error('Live Vercel final decrypt failed: ' + JSON.stringify(finalJson));
  }
}

run().catch(err => {
  console.error('\n❌ Test failed:', err);
  process.exit(1);
});
