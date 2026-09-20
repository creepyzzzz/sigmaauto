import { NextRequest, NextResponse } from 'next/server';
import { autoGenerateKey, discoverKeyUrl, decryptChallengeToken, decryptFinalUrl } from '@/lib/extractor';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    let body: any = {};
    try {
      body = await req.json();
    } catch {}

    const { phase, stream } = body || {};

    // ─── Phased client-side extraction flow ───

    // Phase 1: Discover keyUrl
    if (phase === 'discover') {
      const result = await discoverKeyUrl();
      return NextResponse.json(result);
    }

    // Phase 3: Decrypt challenge token → return form data
    if (phase === 'decrypt-token') {
      const { base64Token, alias } = body;
      if (!base64Token || !alias) {
        return NextResponse.json({ success: false, error: 'Missing base64Token or alias.' }, { status: 400 });
      }
      const result = decryptChallengeToken(base64Token, alias);
      return NextResponse.json(result);
    }

    // Phase 5: Decrypt final URL → return key
    if (phase === 'decrypt-final') {
      const { encryptedUrl, alias } = body;
      if (!encryptedUrl || !alias) {
        return NextResponse.json({ success: false, error: 'Missing encryptedUrl or alias.' }, { status: 400 });
      }
      const result = decryptFinalUrl(encryptedUrl, alias);
      return NextResponse.json(result);
    }

    // ─── Legacy server-side flow (streaming) ───

    if (stream) {
      const responseStream = new TransformStream();
      const writer = responseStream.writable.getWriter();
      const encoder = new TextEncoder();

      let writeChain = Promise.resolve();
      const sendEvent = (data: any) => {
        writeChain = writeChain.then(async () => {
          try {
            await writer.ready;
            await writer.write(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
          } catch {}
        });
        return writeChain;
      };

      (async () => {
        try {
          const result = await autoGenerateKey((step, countdown) => {
            sendEvent({ type: 'progress', step, countdown });
          });

          if (result.success) {
            await sendEvent({ type: 'result', ...result });
          } else {
            await sendEvent({ type: 'error', error: result.error || 'Failed to auto-generate key.' });
          }
        } catch (err: any) {
          await sendEvent({ type: 'error', error: err?.message || 'Server error occurred.' });
        } finally {
          try {
            await writeChain;
            await writer.close();
          } catch {}
        }
      })();

      return new Response(responseStream.readable, {
        headers: {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache, no-transform',
          'Connection': 'keep-alive',
        },
      });
    }

    const result = await autoGenerateKey();
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Internal server error.' },
      { status: 500 }
    );
  }
}
