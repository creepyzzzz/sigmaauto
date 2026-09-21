/**
 * Client-Side Lksfy Solver
 * 
 * Executes the lksfy navigation and challenge token extraction
 * directly from the end-user's browser (residential IP), routed
 * through the Cloudflare Worker proxy to handle CORS and redirects.
 */

export const CLOUDFLARE_PROXY_URL =
  process.env.NEXT_PUBLIC_CLOUDFLARE_PROXY_URL ||
  "https://royal-bar-c2da.tariqmir1278.workers.dev";

export async function clientProxyFetch(
  targetUrl: string,
  options: {
    method?: string;
    targetReferer?: string;
    targetCookie?: string;
    redirectMode?: string;
    contentType?: string;
    body?: string;
  } = {}
): Promise<{ status: number; text: () => Promise<string>; json: () => Promise<any>; headers: Headers }> {
  const proxyEndpoint = `${CLOUDFLARE_PROXY_URL.replace(/\/+$/, '')}?url=${encodeURIComponent(targetUrl)}`;
  const headers: Record<string, string> = {};

  if (options.targetReferer) headers['x-target-referer'] = options.targetReferer;
  if (options.targetCookie) headers['x-target-cookie'] = options.targetCookie;
  if (options.redirectMode) headers['x-redirect-mode'] = options.redirectMode;
  if (options.contentType) headers['Content-Type'] = options.contentType;

  return fetch(proxyEndpoint, {
    method: options.method || 'GET',
    headers,
    body: options.body,
  });
}

function findBase64ChallengeToken(html: string): string | null {
  const m1 = html.match(/var\s+base64\s*=\s*['"]([^'"]+)['"]/i);
  const m2 = html.match(/base64\s*=\s*['"]([A-Za-z0-9+/=]{20,})['"]/i);
  const m3 = html.match(/name="base64"[^>]*value="([^"]+)"/i);
  const m4 = html.match(/data-base64="([^"]+)"/i);
  return m1?.[1] || m2?.[1] || m3?.[1] || m4?.[1] || null;
}

export interface ClientExtractionResult {
  success: boolean;
  key?: string;
  url?: string;
  associatedUrl?: string;
  source?: string;
  error?: string;
}

export async function executeClientLksfyFlow(
  keyUrl: string,
  alias: string,
  onProgress?: (step: string, countdown?: number) => void
): Promise<ClientExtractionResult> {
  try {
    onProgress?.("Resolving shortener redirect...");

    // Request 1: Initial GET with redirect capture
    const r1 = await clientProxyFetch(keyUrl, {
      redirectMode: "manual",
      targetReferer: keyUrl,
    });

    let cookies: string[] = [];
    try {
      if (typeof (r1.headers as any).getSetCookie === "function") {
        cookies = (r1.headers as any).getSetCookie();
      }
    } catch {}
    if (!cookies.length) {
      const single = r1.headers.get("set-cookie");
      if (single) cookies = [single];
    }
    // Fallback: read from custom proxy header (browsers block Set-Cookie on cross-origin)
    if (!cookies.length) {
      const proxied = r1.headers.get("x-proxied-set-cookie");
      if (proxied) cookies = [proxied];
    }
    const cookieHeader = cookies.map((c) => c.split(";")[0].trim()).join("; ");

    let redirectUrl = r1.headers.get("location");
    const r1Text = await r1.text();

    const jsMatch =
      r1Text.match(/window\.location(?:\.href)?\s*=\s*['"]([^'"]+)['"]/i) ||
      r1Text.match(/location\.replace\(['"]([^'"]+)['"]\)/i) ||
      r1Text.match(/url=([^"'>\s]+)/i);

    if (!redirectUrl && jsMatch) {
      redirectUrl = jsMatch[1];
    }

    // Resolve intermediary blog / scanner redirect if needed
    let refererUrl = redirectUrl || keyUrl;
    if (redirectUrl && !redirectUrl.includes("lksfy.com")) {
      try {
        const rInter = await clientProxyFetch(redirectUrl, {
          targetReferer: keyUrl,
          redirectMode: "manual",
        });
        const nextLoc = rInter.headers.get("location");
        const interText = await rInter.text();
        const interJsMatch =
          interText.match(/window\.location(?:\.href)?\s*=\s*['"]([^'"]+)['"]/i) ||
          interText.match(/location\.replace\(['"]([^'"]+)['"]\)/i);
        if (nextLoc) refererUrl = nextLoc;
        else if (interJsMatch) refererUrl = interJsMatch[1];
      } catch (err: any) {
        console.warn("[ClientLksfy] Intermediary redirect resolve warning:", err?.message);
      }
    }

    onProgress?.("Fetching security challenge payload...");

    // Request 2: GET with Referer & Cookie persistence
    const r2 = await clientProxyFetch(keyUrl, {
      targetReferer: refererUrl,
      targetCookie: cookieHeader,
    });
    let html = await r2.text();

    let base64Val = findBase64ChallengeToken(html);

    // Fallback 1: initial redirect URL
    if (!base64Val && redirectUrl && redirectUrl !== refererUrl) {
      try {
        const rFallback = await clientProxyFetch(keyUrl, {
          targetReferer: redirectUrl,
          targetCookie: cookieHeader,
        });
        const fallbackHtml = await rFallback.text();
        base64Val = findBase64ChallengeToken(fallbackHtml);
        if (base64Val) html = fallbackHtml;
      } catch {}
    }

    // Fallback 2: direct lksfy.com referer
    if (!base64Val) {
      try {
        const rFallback = await clientProxyFetch(keyUrl, {
          targetReferer: "https://lksfy.com/",
          targetCookie: cookieHeader,
        });
        const fallbackHtml = await rFallback.text();
        base64Val = findBase64ChallengeToken(fallbackHtml);
        if (base64Val) html = fallbackHtml;
      } catch {}
    }

    if (!base64Val) {
      return { success: false, error: "Could not locate challenge token on page." };
    }

    // Ask server to decrypt the token and return form params
    onProgress?.("Decoding security challenge...");
    const decryptResp = await fetch("/api/auto-generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phase: "decrypt-token", base64Token: base64Val, alias }),
    });
    const decryptJson = await decryptResp.json();
    if (!decryptJson.success || !decryptJson.formAction || !decryptJson.csrfToken) {
      return { success: false, error: decryptJson.error || "Failed to decrypt challenge parameters." };
    }

    // 10s wait for bot protection
    for (let s = 10; s > 0; s--) {
      onProgress?.("Bypassing countdown protection...", s);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    onProgress?.("Submitting verified payload...");
    const postUrl = `https://lksfy.com${decryptJson.formAction}`;
    const postBody =
      `_method=POST` +
      `&_csrfToken=${encodeURIComponent(decryptJson.csrfToken)}` +
      `&ad_form_data=${encodeURIComponent(decryptJson.adFormData || "")}` +
      `&_Token%5Bfields%5D=${decryptJson.tokenFields || ""}` +
      `&_Token%5Bunlocked%5D=${encodeURIComponent(decryptJson.tokenUnlocked || "")}`;

    let postCookieHeader = `csrfToken=${decryptJson.csrfToken}`;
    if (cookieHeader) postCookieHeader += `; ${cookieHeader}`;

    let postJson: any = null;
    let postError = "Failed to generate key URL.";

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const postResp = await clientProxyFetch(postUrl, {
          method: "POST",
          contentType: "application/x-www-form-urlencoded; charset=UTF-8",
          targetReferer: "https://lksfy.com/",
          targetCookie: postCookieHeader,
          body: postBody,
        });

        if (postResp.status === 200) {
          postJson = await postResp.json();
          if (postJson?.url) break;
          postError = postJson?.message || postError;
        }
      } catch (e: any) {
        postError = e?.message || postError;
      }
      if (attempt < 3) {
        await new Promise((r) => setTimeout(r, 1500));
      }
    }

    if (!postJson || !postJson.url) {
      return { success: false, error: postError };
    }

    // Ask server to decrypt the final URL and extract key
    onProgress?.("Extracting final access token...");
    const finalResp = await fetch("/api/auto-generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phase: "decrypt-final", encryptedUrl: postJson.url, alias }),
    });
    const finalResult = await finalResp.json();
    return finalResult;
  } catch (err: any) {
    return { success: false, error: err?.message || "Client extraction encountered an unexpected error." };
  }
}
