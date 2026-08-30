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

    onProgress?.("Resolving shortener redirect...");

    // Step 1: Initial GET with redirect capture
    const r1 = await fetch(keyUrl, {
      headers: {
        "User-Agent": DEFAULT_BROWSER_USER_AGENT,
        "Referer": keyUrl,
      },
      redirect: "manual",
    });

    let redirectUrl = r1.headers.get("location");
    if (!redirectUrl && (r1.status === 200 || r1.status === 302)) {
      redirectUrl = keyUrl;
    }

    // Step 2: GET with Referer
    onProgress?.("Fetching security challenge payload...");
    const r2 = await fetch(keyUrl, {
      headers: {
        "User-Agent": DEFAULT_BROWSER_USER_AGENT,
        "Referer": redirectUrl || keyUrl,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      },
    });

    const html = await r2.text();
    const base64Match = html.match(/var base64 = '([^']+)'/);
    if (!base64Match) {
      return { success: false, error: "Could not locate challenge token on page." };
    }

    const base64Val = base64Match[1];
    const decryptedHtml = decryptAesCbc(base64Val, alias);
    if (!decryptedHtml) {
      return { success: false, error: "Failed to decrypt challenge parameters." };
    }

    const formData = extractFormData(decryptedHtml);
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

    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const postResp = await fetch(postUrl, {
          method: "POST",
          headers: {
            "User-Agent": DEFAULT_BROWSER_USER_AGENT,
            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
            "Referer": "https://lksfy.com/",
            "Origin": "https://lksfy.com",
            "Cookie": `csrfToken=${formData.csrfToken}`,
            "X-Requested-With": "XMLHttpRequest",
            "Accept": "application/json, text/javascript, */*; q=0.01",
          },
          body: postBody,
        });

        if (postResp.ok) {
          postJson = await postResp.json();
          if (postJson?.status === "success" && postJson?.url) {
            break;
          }
          postError = postJson?.message || postError;
        }
      } catch (e: any) {
        postError = e?.message || postError;
      }

      if (attempt < 2) {
        await new Promise((r) => setTimeout(r, 2000));
      }
    }

    if (!postJson || postJson.status !== "success" || !postJson.url) {
      return { success: false, error: postError };
    }

    // Step 5: Decrypt final destination URL
    const finalUrl = decryptAesCbc(postJson.url, alias);
    if (!finalUrl) {
      return { success: false, error: "Failed to decrypt final destination URL." };
    }

    // Check Telegram
    const tgKey = extractTelegramKey(finalUrl);
    if (tgKey) {
      return { success: true, key: tgKey, url: finalUrl, associatedUrl: finalUrl, source: "Telegram" };
    }

    // Check query params
    const finalParsed = new URL(finalUrl);
    const key = finalParsed.searchParams.get("key")?.trim() ||
                finalParsed.searchParams.get("code")?.trim() ||
                finalParsed.searchParams.get("token")?.trim();

    if (key) {
      return { success: true, key, url: finalUrl, source: "Lksfy" };
    }

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

    const r = await fetch(DEFAULT_TARGET, {
      headers: { "User-Agent": DEFAULT_APP_USER_AGENT },
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

    onProgress?.("Generating auth session key...");
    const genUrl = `${baseUrl.replace(/\/+$/, "")}/api/v1/auth/generate?server=1`;
    const genResp = await fetch(genUrl, {
      headers: { "User-Agent": DEFAULT_APP_USER_AGENT },
    });
    const genJson = await genResp.json();

    const keyUrl = genJson?.data?.keyUrl;
    if (!keyUrl) {
      return { success: false, error: "Auth endpoint did not return keyUrl." };
    }

    onProgress?.("Routing key URL to resolver...");
    return processDirectUrl(keyUrl, onProgress);
  } catch (err: any) {
    return { success: false, error: err?.message || "Auto-generation discovery failed." };
  }
}
