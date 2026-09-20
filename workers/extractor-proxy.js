/**
 * Keyo Cloudflare Worker Edge Proxy
 */

export default {
  async fetch(request, env, ctx) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "*",
      "Access-Control-Expose-Headers": "*",
    };

    // 1. Handle CORS Preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders,
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
            ...corsHeaders,
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

      // Clone response to avoid immutable header issues in Cloudflare Worker
      const finalResponse = new Response(upstream.body, {
        status: upstream.status,
        statusText: upstream.statusText,
      });

      // Copy necessary upstream headers
      for (const [k, v] of upstream.headers.entries()) {
        const lower = k.toLowerCase();
        if (lower === "content-encoding" || lower === "content-length") continue;
        try {
          finalResponse.headers.set(k, v);
        } catch {}
      }

      // Guarantee CORS headers
      finalResponse.headers.set("Access-Control-Allow-Origin", "*");
      finalResponse.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      finalResponse.headers.set("Access-Control-Allow-Headers", "*");
      finalResponse.headers.set("Access-Control-Expose-Headers", "*");

      return finalResponse;
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      });
    }
  },
};
