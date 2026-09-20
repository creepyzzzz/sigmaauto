import crypto from 'crypto';

const DEFAULT_TARGET = "https://zoo0.pages.dev";
const DEFAULT_APP_USER_AGENT = "Dart/3.8 (dart:io)";
const DEFAULT_BROWSER_USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36";
const XOR_KEY = "k6kW8r#Tz3f;";

export interface ExtractionResult {
  success: boolean;
  key?: string;
  url?: string;
  associatedUrl?: string;
  source?: string;
  error?: string;
}

export function extractTelegramKey(url: string): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.toLowerCase().includes("t.me") && !parsed.hostname.toLowerCase().includes("telegram.me")) {
      return null;
    }
    const startParam = parsed.searchParams.get("start");
    if (!startParam) return null;
    if (startParam.includes("_")) {
      return startParam.split("_").pop()?.trim() || null;
    }
    return startParam.trim();
  } catch {
    return null;
  }
}

export function decryptAesCbc(ciphertextB64: string, alias: string): string | null {
  try {
    const keySource = "sDye71jNq5" + alias;
    const ivSource = "7M9u8DG4X" + alias;

    const keyHash = crypto.createHash("sha256").update(keySource, "utf8").digest("hex");
    const ivHash = crypto.createHash("sha256").update(ivSource, "utf8").digest("hex");

    const keyBytes = Buffer.from(keyHash.slice(0, 32), "utf8");
    const ivBytes = Buffer.from(ivHash.slice(0, 16), "utf8");

    // Double base64 decode
    const firstB64 = Buffer.from(ciphertextB64, "base64").toString("utf8");
    const encryptedBuffer = Buffer.from(firstB64, "base64");

    const decipher = crypto.createDecipheriv("aes-256-cbc", keyBytes, ivBytes);
    decipher.setAutoPadding(true);

    let decrypted = decipher.update(encryptedBuffer);
    decrypted = Buffer.concat([decrypted, decipher.final()]);

    const text = decrypted.toString("utf8");
    return text.replace(/[\x00\r\n\t ]+$/, "").trim();
  } catch (err) {
    // Attempt raw decryption without auto-padding fallback
    try {
      const keySource = "sDye71jNq5" + alias;
      const ivSource = "7M9u8DG4X" + alias;
      const keyBytes = Buffer.from(crypto.createHash("sha256").update(keySource).digest("hex").slice(0, 32), "utf8");
      const ivBytes = Buffer.from(crypto.createHash("sha256").update(ivSource).digest("hex").slice(0, 16), "utf8");
      
      const firstB64 = Buffer.from(ciphertextB64, "base64").toString("utf8");
      const encryptedBuffer = Buffer.from(firstB64, "base64");

      const decipher = crypto.createDecipheriv("aes-256-cbc", keyBytes, ivBytes);
      decipher.setAutoPadding(false);

      let decrypted = Buffer.concat([decipher.update(encryptedBuffer), decipher.final()]);
      
      // Manual PKCS7 unpad
      if (decrypted.length > 0) {
        const padLen = decrypted[decrypted.length - 1];
        if (padLen >= 1 && padLen <= 16) {
          decrypted = decrypted.subarray(0, decrypted.length - padLen);
        }
      }
      return decrypted.toString("utf8").replace(/[\x00\r\n\t ]+$/, "").trim();
    } catch {
      return null;
    }
  }
}

export function extractFormData(html: string) {
  const csrfMatch = html.match(/name="_csrfToken"[^>]*value="([^"]+)"/);
  const adFormDataMatch = html.match(/name="ad_form_data"[^>]*value="([^"]+)"/);
  const tokenFieldsMatch = html.match(/name="_Token\[fields\]"[^>]*value="([^"]+)"/);
  const tokenUnlockedMatch = html.match(/name="_Token\[unlocked\]"[^>]*value="([^"]+)"/);
  const actionMatch = html.match(/action="([^"]+)"/);

  return {
    csrfToken: csrfMatch ? csrfMatch[1] : "",
    adFormData: adFormDataMatch ? adFormDataMatch[1] : "",
    tokenFields: tokenFieldsMatch ? tokenFieldsMatch[1] : "",
    tokenUnlocked: tokenUnlockedMatch ? tokenUnlockedMatch[1] : "",
    action: actionMatch ? actionMatch[1] : "",
  };
}

const CLOUDFLARE_PROXY_URL = process.env.CLOUDFLARE_PROXY_URL || "https://royal-bar-c2da.tariqmir1278.workers.dev";

async function proxyFetch(
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
  const proxyEndpoint = `${CLOUDFLARE_PROXY_URL.replace(/\/+$/, "")}?url=${encodeURIComponent(targetUrl)}`;
  const headers: Record<string, string> = {};

  if (options.targetReferer) headers["x-target-referer"] = options.targetReferer;
  if (options.targetCookie) headers["x-target-cookie"] = options.targetCookie;
  if (options.redirectMode) headers["x-redirect-mode"] = options.redirectMode;
  if (options.contentType) headers["Content-Type"] = options.contentType;

  try {
    const res = await fetch(proxyEndpoint, {
      method: options.method || "GET",
      headers,
      body: options.body,
    });
    return res;
  } catch (err: any) {
    console.error(`[ProxyFetch] Cloudflare proxy failed for ${targetUrl}:`, err?.message);
    throw new Error(`Proxy request failed: ${err?.message}`);
  }
}

export async function handleLksfy(
  keyUrl: string,
  onProgress?: (step: string, secondsRemaining?: number) => void
): Promise<ExtractionResult> {
  try {
    const parsed = new URL(keyUrl);
    const alias = parsed.pathname.replace(/^\/+|\/+$/g, "").split("/").pop() || "";
    if (!alias) {
      return { success: false, error: "Invalid Lksfy URL alias." };
    }

    console.log(`[Extractor:Lksfy] Starting extraction for ${keyUrl} (alias: ${alias})`);
    onProgress?.("Resolving shortener redirect...");

    // Step 1: Initial GET with redirect capture
    const r1 = await proxyFetch(keyUrl, {
      redirectMode: "manual",
      targetReferer: keyUrl,
    });

    console.log(`[Extractor:Lksfy] Request 1 status: ${r1.status}`);

    // Capture cookies
    let cookies: string[] = [];
    if (typeof (r1.headers as any).getSetCookie === "function") {
      cookies = (r1.headers as any).getSetCookie();
    } else {
      const singleCookie = r1.headers.get("set-cookie");
      if (singleCookie) cookies = [singleCookie];
    }
    const cookieHeader = cookies.map((c) => c.split(";")[0].trim()).join("; ");

    let redirectUrl = r1.headers.get("location");
    const r1Text = await r1.text();

    // Check for JavaScript redirect in initial page
    const jsMatch = r1Text.match(/window\.location(?:\.href)?\s*=\s*['"]([^'"]+)['"]/i) ||
                    r1Text.match(/location\.replace\(['"]([^'"]+)['"]\)/i) ||
                    r1Text.match(/url=([^"'>\s]+)/i);

    if (!redirectUrl && jsMatch) {
      redirectUrl = jsMatch[1];
    }

    // Resolve intermediary scanner/blog redirect (e.g. raptortools.net -> recruitmentaim.in)
    let refererUrl = redirectUrl || keyUrl;
    if (redirectUrl && !redirectUrl.includes("lksfy.com")) {
      try {
        const rInter = await proxyFetch(redirectUrl, {
          targetReferer: keyUrl,
          redirectMode: "manual",
        });
        const nextLoc = rInter.headers.get("location");
        const interText = await rInter.text();
        const interJsMatch = interText.match(/window\.location(?:\.href)?\s*=\s*['"]([^'"]+)['"]/i) ||
                             interText.match(/location\.replace\(['"]([^'"]+)['"]\)/i);
        if (nextLoc) {
          refererUrl = nextLoc;
        } else if (interJsMatch) {
          refererUrl = interJsMatch[1];
        }
        console.log(`[Extractor:Lksfy] Resolved intermediary referer URL: ${refererUrl}`);
      } catch (err: any) {
        console.warn("[Extractor:Lksfy] Intermediary redirect resolve warning:", err?.message);
      }
    }

    console.log(`[Extractor:Lksfy] Using referer URL: ${refererUrl}`);

    // Step 2: GET with Referer & Cookie persistence
    onProgress?.("Fetching security challenge payload...");
    const r2 = await proxyFetch(keyUrl, {
      targetReferer: refererUrl,
      targetCookie: cookieHeader,
    });

    console.log(`[Extractor:Lksfy] Request 2 status: ${r2.status}`);

    let html = await r2.text();
    console.log(`[Extractor:Lksfy] HTML payload length: ${html.length}`);

    // Multi-pattern resilient regex matching for challenge token
    const findBase64 = (str: string) => {
      const m1 = str.match(/var\s+base64\s*=\s*['"]([^'"]+)['"]/i);
      const m2 = str.match(/base64\s*=\s*['"]([A-Za-z0-9+/=]{20,})['"]/i);
      const m3 = str.match(/name="base64"[^>]*value="([^"]+)"/i);
      const m4 = str.match(/data-base64="([^"]+)"/i);
      return m1?.[1] || m2?.[1] || m3?.[1] || m4?.[1] || null;
    };

    let base64Val = findBase64(html);

    // If not found, attempt fallback request with original redirectUrl or domain
    if (!base64Val && redirectUrl && redirectUrl !== refererUrl) {
      console.log("[Extractor:Lksfy] Base64 token not found with intermediary referer, attempting with initial redirectUrl...");
      try {
        const rFallback = await proxyFetch(keyUrl, {
          targetReferer: redirectUrl,
          targetCookie: cookieHeader,
        });
        const fallbackHtml = await rFallback.text();
        const fallbackBase64 = findBase64(fallbackHtml);
        if (fallbackBase64) {
          base64Val = fallbackBase64;
          html = fallbackHtml;
          console.log("[Extractor:Lksfy] Base64 token found via initial redirectUrl fallback!");
        }
      } catch (err: any) {
        console.error("[Extractor:Lksfy] Fallback request error:", err?.message);
      }
    }

    // Secondary fallback
    if (!base64Val) {
      console.log("[Extractor:Lksfy] Base64 token not in primary HTML, attempting fallback referer request...");
      try {
        const rFallback = await proxyFetch(keyUrl, {
          targetReferer: "https://lksfy.com/",
          targetCookie: cookieHeader,
        });
        const fallbackHtml = await rFallback.text();
        const fallbackBase64 = findBase64(fallbackHtml);
        if (fallbackBase64) {
          base64Val = fallbackBase64;
          html = fallbackHtml;
          console.log("[Extractor:Lksfy] Base64 token found via lksfy referer fallback!");
        }
      } catch (err: any) {
        console.error("[Extractor:Lksfy] Fallback request error:", err?.message);
      }
    }

    if (!base64Val) {
      console.error("[Extractor:Lksfy] Challenge token could not be located in HTML snippet:", html.slice(0, 500));
      const finalTg = extractTelegramKey(keyUrl);
      if (finalTg) {
        return { success: true, key: finalTg, url: keyUrl, source: "Telegram" };
      }
      return { success: false, error: "Could not locate challenge token on page.", debug: { htmlSnippet: html.slice(0, 600), htmlLength: html.length, cookies: cookieHeader, redirectUrl, refererUrl, r1Status: r1.status, r2Status: r2.status } } as any;
    }

    console.log(`[Extractor:Lksfy] Found base64 challenge token (length: ${base64Val.length})`);
    const decryptedHtml = decryptAesCbc(base64Val, alias);
    if (!decryptedHtml) {
      console.error("[Extractor:Lksfy] Decryption failed for base64 token");
      return { success: false, error: "Failed to decrypt challenge parameters." };
    }

    const formData = extractFormData(decryptedHtml);
    console.log(`[Extractor:Lksfy] Extracted form action: ${formData.action}, csrf: ${!!formData.csrfToken}`);
    if (!formData.action || !formData.csrfToken) {
      return { success: false, error: "Incomplete form parameters." };
    }

    // Step 3: 10s wait to bypass bot/timer validation
    for (let s = 10; s > 0; s--) {
      onProgress?.("Bypassing countdown protection...", s);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    // Step 4: POST to /links/go
    onProgress?.("Submitting verified payload...");
    const postUrl = `https://lksfy.com${formData.action}`;
    const postBody = (
      `_method=POST` +
      `&_csrfToken=${encodeURIComponent(formData.csrfToken)}` +
      `&ad_form_data=${encodeURIComponent(formData.adFormData)}` +
      `&_Token%5Bfields%5D=${formData.tokenFields}` +
      `&_Token%5Bunlocked%5D=${encodeURIComponent(formData.tokenUnlocked)}`
    );

    let postJson: any = null;
    let postError = "Failed to generate key URL.";

    let postCookieHeader = `csrfToken=${formData.csrfToken}`;
    if (cookieHeader) {
      postCookieHeader += `; ${cookieHeader}`;
    }

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const postResp = await proxyFetch(postUrl, {
          method: "POST",
          contentType: "application/x-www-form-urlencoded; charset=UTF-8",
          targetReferer: "https://lksfy.com/",
          targetCookie: postCookieHeader,
          body: postBody,
        });

        if (postResp.status === 200) {
          postJson = await postResp.json();
          if (postJson?.url) {
            break;
          }
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
      console.error(`[Extractor:Lksfy] POST to ${postUrl} failed: ${postError}`);
      return { success: false, error: postError };
    }

    console.log(`[Extractor:Lksfy] POST succeeded, received encrypted final URL`);

    // Step 5: Decrypt final destination URL
    const finalUrl = decryptAesCbc(postJson.url, alias);
    if (!finalUrl) {
      console.error("[Extractor:Lksfy] Failed to decrypt final destination URL");
      return { success: false, error: "Failed to decrypt final destination URL." };
    }

    console.log(`[Extractor:Lksfy] Decrypted destination URL: ${finalUrl}`);

    // Check Telegram
    const tgKey = extractTelegramKey(finalUrl);
    if (tgKey) {
      console.log(`[Extractor:Lksfy] Resolved Telegram Key: ${tgKey}`);
      return { success: true, key: tgKey, url: finalUrl, associatedUrl: finalUrl, source: "Telegram" };
    }

    // Check query params
    const finalParsed = new URL(finalUrl);
    const key = finalParsed.searchParams.get("key")?.trim() ||
                finalParsed.searchParams.get("code")?.trim() ||
                finalParsed.searchParams.get("token")?.trim();

    if (key) {
      console.log(`[Extractor:Lksfy] Resolved Key: ${key}`);
      return { success: true, key, url: finalUrl, source: "Lksfy" };
    }

    console.error(`[Extractor:Lksfy] Key parameter not found in destination URL: ${finalUrl}`);
    return { success: false, error: "Key not found in destination URL", url: finalUrl };
  } catch (err: any) {
    return { success: false, error: err?.message || "Lksfy extraction failed." };
  }
}

export async function handleNanolinks(keyUrl: string): Promise<ExtractionResult> {
  try {
    const parsed = new URL(keyUrl);
    const extractedId = parsed.pathname.replace(/^\/+|\/+$/g, "").split("/").pop() || "";
    
    const firstUrl = `https://nano.tackledsoul.com/includes/open.php?id=${extractedId}`;
    const r1 = await fetch(firstUrl, {
      headers: {
        "User-Agent": DEFAULT_BROWSER_USER_AGENT,
        "Cookie": `tp=${extractedId}; open=${extractedId}`,
      },
      redirect: "manual",
    });

    const redirectUrl = r1.headers.get("location");
    if (!redirectUrl) {
      return { success: false, error: "Initial redirect missing from nanolinks." };
    }

    const redirectParsed = new URL(redirectUrl);
    const newId = redirectParsed.pathname.replace(/^\/+|\/+$/g, "").split("/").pop() || "";

    const secondUrl = `https://vi-music.app/includes/open.php?id=${newId}`;
    const r2 = await fetch(secondUrl, {
      headers: {
        "User-Agent": DEFAULT_BROWSER_USER_AGENT,
        "Cookie": `tp=${newId}; open=${newId}`,
      },
      redirect: "manual",
    });

    const finalRedirect = r2.headers.get("location");
    if (!finalRedirect) {
      return { success: false, error: "Final redirect missing from nanolinks." };
    }

    const finalParsed = new URL(finalRedirect);
    const key = finalParsed.searchParams.get("key")?.trim();

    if (key) {
      return { success: true, key, url: finalRedirect, source: "Nanolinks" };
    }
    return { success: false, error: "Key parameter missing from nanolinks destination." };
  } catch (err: any) {
    return { success: false, error: err?.message || "Nanolinks extraction failed." };
  }
}

export async function handleArolinks(keyUrl: string): Promise<ExtractionResult> {
  try {
    const parsed = new URL(keyUrl);
    const identifier = parsed.pathname.replace(/^\/+|\/+$/g, "").split("/").pop() || "";

    const r1 = await fetch(keyUrl, {
      headers: { "User-Agent": DEFAULT_BROWSER_USER_AGENT },
    });
    const html1 = await r1.text();

    const redirectMatch = html1.match(/window\.location\.href\s*=\s*"([^"]+)"/) || html1.match(/<a\s+href="([^"]+)"/);
    if (!redirectMatch) {
      return { success: false, error: "Could not find intermediate redirect in Arolinks." };
    }
    const redirectUrl = redirectMatch[1];

    const r2 = await fetch(keyUrl, {
      headers: {
        "User-Agent": DEFAULT_BROWSER_USER_AGENT,
        "Cookie": `gt_uc_=${identifier}`,
        "Referer": redirectUrl,
      },
    });
    const html2 = await r2.text();

    const finalMatch = html2.match(/href="(https?:\/\/[^"]+(?:key|code)=[^"&]+[^"]*)"/);
    if (!finalMatch) {
      return { success: false, error: "Final key URL not found in Arolinks response." };
    }

    const finalUrl = finalMatch[1];
    const finalParsed = new URL(finalUrl);
    const key = finalParsed.searchParams.get("key")?.trim() || finalParsed.searchParams.get("code")?.trim();

    if (key) {
      return { success: true, key, url: finalUrl, source: "Arolinks" };
    }
    return { success: false, error: "Key missing in final Arolinks URL." };
  } catch (err: any) {
    return { success: false, error: err?.message || "Arolinks extraction failed." };
  }
}

export async function processDirectUrl(
  url: string,
  onProgress?: (step: string, countdown?: number) => void
): Promise<ExtractionResult> {
  const lower = url.toLowerCase();

  if (lower.includes("t.me/") || lower.includes("telegram.me")) {
    const key = extractTelegramKey(url);
    if (key) return { success: true, key, url, source: "Telegram" };
    return { success: false, error: "No start key found in Telegram URL." };
  }

  if (lower.includes("lksfy")) {
    return handleLksfy(url, onProgress);
  }

  if (lower.includes("nanolinks")) {
    onProgress?.("Resolving Nanolinks chain...");
    return handleNanolinks(url);
  }

  if (lower.includes("arolinks")) {
    onProgress?.("Resolving Arolinks challenge...");
    return handleArolinks(url);
  }

  // Fallback to lksfy if unknown
  return handleLksfy(url, onProgress);
}

export async function autoGenerateKey(
  onProgress?: (step: string, countdown?: number) => void
): Promise<ExtractionResult> {
  try {
    onProgress?.("Contacting discovery endpoint...");

    const r = await proxyFetch(DEFAULT_TARGET, {
      targetReferer: DEFAULT_TARGET,
    });

    const headerNames = ["x-request-id", "x-payload", "authorization", "x-data"];
    let combined = "";
    for (const hn of headerNames) {
      const val = r.headers.get(hn);
      if (val) combined += val.trim();
    }

    if (!combined) {
      return { success: false, error: "Failed to retrieve encrypted headers from target." };
    }

    // Base64 decode + XOR
    const decodedBytes = Buffer.from(combined, "base64");
    const keyBytes = Buffer.from(XOR_KEY, "utf8");
    const outBytes = Buffer.alloc(decodedBytes.length);

    for (let i = 0; i < decodedBytes.length; i++) {
      outBytes[i] = decodedBytes[i] ^ keyBytes[i % keyBytes.length];
    }

    let jsonStr = outBytes.toString("utf8");
    let baseObj: any;
    try {
      baseObj = JSON.parse(jsonStr);
    } catch {
      const start = jsonStr.indexOf("{");
      const end = jsonStr.lastIndexOf("}");
      if (start !== -1 && end !== -1) {
        baseObj = JSON.parse(jsonStr.substring(start, end + 1));
      }
    }

    const baseUrl = baseObj?.baseUrl || baseObj?.baseurl || baseObj?.base_url;
    if (!baseUrl) {
      return { success: false, error: "Could not locate baseUrl in discovery payload." };
    }

    // Try server 1, then fallback to server 2, then server 3
    const servers = [1, 2, 3];
    let lastError = "Auto-generation discovery failed.";
    let lastResult: any = null;

    for (const serverId of servers) {
      try {
        onProgress?.(`Generating auth session key (server ${serverId})...`);
        const genUrl = `${baseUrl.replace(/\/+$/, "")}/api/v1/auth/generate?server=${serverId}`;
        const genResp = await proxyFetch(genUrl, {
          targetReferer: baseUrl,
        });
        const genJson = await genResp.json();

        const keyUrl = genJson?.data?.keyUrl;
        if (!keyUrl) {
          lastError = `Server ${serverId} did not return keyUrl.`;
          continue;
        }

        onProgress?.("Routing key URL to resolver...");
        const result = await processDirectUrl(keyUrl, onProgress);
        if (result.success) {
          return result;
        }
        lastError = result.error || lastError;
        lastResult = result;
      } catch (err: any) {
        lastError = err?.message || lastError;
      }
    }

    return lastResult || { success: false, error: lastError };
  } catch (err: any) {
    return { success: false, error: err?.message || "Auto-generation discovery failed." };
  }
}
