import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const CLOUDFLARE_PROXY_URL =
  process.env.CLOUDFLARE_PROXY_URL ||
  'https://royal-bar-c2da.tariqmir1278.workers.dev';

export async function ALL(req: NextRequest) {
  try {
    const url = req.nextUrl.searchParams.get('url');
    if (!url) {
      return NextResponse.json({ error: "Missing 'url' parameter" }, { status: 400 });
    }

    const proxyEndpoint = `${CLOUDFLARE_PROXY_URL.replace(/\/+$/, '')}?url=${encodeURIComponent(url)}`;
    const forwardHeaders: Record<string, string> = {};

    const ref = req.headers.get('x-target-referer');
    const cookie = req.headers.get('x-target-cookie');
    const redirectMode = req.headers.get('x-redirect-mode');
    const contentType = req.headers.get('content-type');

    if (ref) forwardHeaders['x-target-referer'] = ref;
    if (cookie) forwardHeaders['x-target-cookie'] = cookie;
    if (redirectMode) forwardHeaders['x-redirect-mode'] = redirectMode;
    if (contentType) forwardHeaders['content-type'] = contentType;

    let body: string | undefined = undefined;
    if (req.method === 'POST') {
      body = await req.text();
    }

    const upstream = await fetch(proxyEndpoint, {
      method: req.method,
      headers: forwardHeaders,
      body,
    });

    const responseText = await upstream.text();

    const responseHeaders = new Headers();
    responseHeaders.set('content-type', upstream.headers.get('content-type') || 'text/html');

    // Forward cookies & location
    const setCookie = upstream.headers.get('set-cookie');
    if (setCookie) responseHeaders.set('set-cookie', setCookie);

    const location = upstream.headers.get('location');
    if (location) responseHeaders.set('location', location);

    return new Response(responseText, {
      status: upstream.status,
      headers: responseHeaders,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export const GET = ALL;
export const POST = ALL;
export const OPTIONS = ALL;
