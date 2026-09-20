/**
 * Keyo Cloudflare Worker Edge Proxy
 * 
 * Runs on Cloudflare's global Anycast edge (AS13335),
 * completely bypassing AWS/datacenter IP blocks, Cloudflare Turnstile,
 * and handles JS redirects + AJAX POST verification.
 */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Expose-Headers": "*",
};

export default {
  async fetch(request, env, ctx) {
    // Handle CORS preflight
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
      headers.set("Accept-Encoding", "gzip, deflate, br");
      headers.set("Sec-Ch-Ua", '"Not A(Brand";v="8", "Chromium";v="133", "Google Chrome";v="133"');
      headers.set("Sec-Ch-Ua-Mobile", "?0");
      headers.set("Sec-Ch-Ua-Platform", '"Windows"');
      headers.set("Sec-Fetch-Dest", "document");
      headers.set("Sec-Fetch-Mode", "navigate");
      headers.set("Sec-Fetch-Site", "none");
      headers.set("Sec-Fetch-User", "?1");
      headers.set("Upgrade-Insecure-Requests", "1");
      headers.set("Cache-Control", "max-age=0");
      headers.set("Connection", "keep-alive");

      // Forward Referer and Cookie
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

      const response = await fetch(targetUrl, init);

      // Build clean response headers with mandatory CORS
      const responseHeaders = new Headers();
      for (const [k, v] of response.headers.entries()) {
        // Skip content-encoding if CF decompresses it
        if (k.toLowerCase() === "content-encoding") continue;
        responseHeaders.append(k, v);
      }

      // Explicitly overwrite CORS headers
      for (const [k, v] of Object.entries(CORS_HEADERS)) {
        responseHeaders.set(k, v);
      }

      return new Response(response.body, {
        status: response.status,
        headers: responseHeaders,
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
