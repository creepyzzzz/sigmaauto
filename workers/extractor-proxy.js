/**
 * Keyo Cloudflare Worker Edge Proxy
 */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Expose-Headers": "*",
};

export default {
  async fetch(request, env, ctx) {
    // 1. Handle CORS Preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: CORS_HEADERS,
      });
    }

    try {
      const url = new URL(request.url);
      const targetUrl = url.searchParams.get("url");

      if (!targetUrl) {
        return new Response(JSON.stringify({ error: "Missing 'url' query parameter" }), {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            ...CORS_HEADERS,
          },
        });
      }

      const parsedTarget = new URL(targetUrl);

      // Browser Identity Headers
      const headers = new Headers();
      headers.set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36");
      headers.set("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8");
      headers.set("Accept-Language", "en-US,en;q=0.9");
      headers.set("Sec-Ch-Ua", '"Not A(Brand";v="8", "Chromium";v="133", "Google Chrome";v="133"');
      headers.set("Sec-Ch-Ua-Mobile", "?0");
      headers.set("Sec-Ch-Ua-Platform", '"Windows"');
      headers.set("Sec-Fetch-Dest", "document");
      headers.set("Sec-Fetch-Mode", "navigate");
      headers.set("Sec-Fetch-Site", "none");
      headers.set("Sec-Fetch-User", "?1");
      headers.set("Upgrade-Insecure-Requests", "1");

      const incomingReferer = request.headers.get("x-target-referer") || `${parsedTarget.origin}/`;
      const incomingCookie = request.headers.get("x-target-cookie");
      if (incomingReferer) headers.set("Referer", incomingReferer);
      if (incomingCookie) headers.set("Cookie", incomingCookie);

      const redirectMode = request.headers.get("x-redirect-mode") || "manual";

      const init = {
        method: request.method,
        headers,
        redirect: redirectMode,
      };

      if (request.method === "POST") {
        init.body = await request.text();
        headers.set("Content-Type", request.headers.get("Content-Type") || "application/x-www-form-urlencoded; charset=UTF-8");
        headers.set("X-Requested-With", "XMLHttpRequest");
        headers.set("Origin", parsedTarget.origin);
        headers.set("Accept", "application/json, text/javascript, */*; q=0.01");
      }

      const upstream = await fetch(targetUrl, init);

      // Read as ArrayBuffer to break raw stream passthrough and force header application
      const bodyBuffer = await upstream.arrayBuffer();

      const outHeaders = new Headers();
      for (const [k, v] of upstream.headers.entries()) {
        const lower = k.toLowerCase();
        if (lower === "content-encoding" || lower === "content-length") continue;
        try {
          outHeaders.set(k, v);
        } catch {}
      }

      // Forward Set-Cookie via custom header (browsers block Set-Cookie on cross-origin)
      const setCookieVal = upstream.headers.get("set-cookie");
      if (setCookieVal) {
        outHeaders.set("x-proxied-set-cookie", setCookieVal);
      }

      // Force CORS headers
      for (const [k, v] of Object.entries(CORS_HEADERS)) {
        outHeaders.set(k, v);
      }

      // When redirect mode is manual and upstream returned a 3xx, override to 200
      // so the browser doesn't chase the redirect into a CORS-blocked domain.
      let responseStatus = upstream.status;
      let responseStatusText = upstream.statusText;
      if (redirectMode === "manual" && upstream.status >= 300 && upstream.status < 400) {
        outHeaders.set("x-original-status", String(upstream.status));
        responseStatus = 200;
        responseStatusText = "OK";
      }

      return new Response(bodyBuffer, {
        status: responseStatus,
        statusText: responseStatusText,
        headers: outHeaders,
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          ...CORS_HEADERS,
        },
      });
    }
  },
};
