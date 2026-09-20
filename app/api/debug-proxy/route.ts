import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/**
 * Debug endpoint: test different fetch strategies against lksfy.com from Vercel's IPs
 */
export async function GET(req: NextRequest) {
  const testUrl = req.nextUrl.searchParams.get('url') || 'https://lksfy.com/';
  const results: Record<string, any> = {};

  // Strategy 1: Minimal headers (curl-like)
  try {
    const r = await fetch(testUrl, {
      headers: { "User-Agent": "curl/8.5.0" },
      redirect: "manual",
    });
    const text = await r.text();
    results.curl = { status: r.status, challenge: text.includes("Just a moment"), length: text.length, snippet: text.slice(0, 150) };
  } catch (e: any) { results.curl = { error: e.message }; }

  // Strategy 2: Dart UA (same as discovery endpoint)
  try {
    const r = await fetch(testUrl, {
      headers: { "User-Agent": "Dart/3.8 (dart:io)" },
      redirect: "manual",
    });
    const text = await r.text();
    results.dart = { status: r.status, challenge: text.includes("Just a moment"), length: text.length, snippet: text.slice(0, 150) };
  } catch (e: any) { results.dart = { error: e.message }; }

  // Strategy 3: Googlebot
  try {
    const r = await fetch(testUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)" },
      redirect: "manual",
    });
    const text = await r.text();
    results.googlebot = { status: r.status, challenge: text.includes("Just a moment"), length: text.length, snippet: text.slice(0, 150) };
  } catch (e: any) { results.googlebot = { error: e.message }; }

  // Strategy 4: No UA
  try {
    const r = await fetch(testUrl, { redirect: "manual" });
    const text = await r.text();
    results.noUA = { status: r.status, challenge: text.includes("Just a moment"), length: text.length, snippet: text.slice(0, 150) };
  } catch (e: any) { results.noUA = { error: e.message }; }

  // Strategy 5: Full browser headers with Sec-Fetch
  try {
    const r = await fetch(testUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
        "Sec-Fetch-User": "?1",
      },
      redirect: "manual",
    });
    const text = await r.text();
    results.fullBrowser = { status: r.status, challenge: text.includes("Just a moment"), length: text.length, snippet: text.slice(0, 150) };
  } catch (e: any) { results.fullBrowser = { error: e.message }; }

  // Strategy 6: Python requests style
  try {
    const r = await fetch(testUrl, {
      headers: { "User-Agent": "python-requests/2.31.0", "Accept": "*/*" },
      redirect: "manual",
    });
    const text = await r.text();
    results.python = { status: r.status, challenge: text.includes("Just a moment"), length: text.length, snippet: text.slice(0, 150) };
  } catch (e: any) { results.python = { error: e.message }; }

  return NextResponse.json(results, { status: 200 });
}
