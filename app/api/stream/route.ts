import { recentEvents } from '@/lib/server/views';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Server-Sent Events: polls the events table every 3 s and pushes new rows. Clients reconnect automatically. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const lastHeader = req.headers.get('last-event-id');
  let last = Number(lastHeader ?? url.searchParams.get('after') ?? 0) || 0;
  const coinId = url.searchParams.get('coin') ? Number(url.searchParams.get('coin')) : undefined;
  const enc = new TextEncoder();
  let closed = false;
  req.signal.addEventListener('abort', () => {
    closed = true;
  });

  const stream = new ReadableStream({
    async start(controller) {
      const send = (s: string) => {
        if (!closed) controller.enqueue(enc.encode(s));
      };
      send('retry: 3000\n\n');
      if (!last) {
        try {
          const latest = await recentEvents({ coinId, limit: 1 });
          last = latest[0]?.id ?? 0;
        } catch {
          /* empty db */
        }
      }
      const started = Date.now();
      while (!closed && Date.now() - started < 55_000) {
        try {
          const evs = await recentEvents({ coinId, afterId: last, limit: 50 });
          for (const e of evs.reverse()) {
            send(`id: ${e.id}\nevent: ev\ndata: ${JSON.stringify(e)}\n\n`);
            last = e.id;
          }
          send(': ping\n\n');
        } catch {
          send(': db unavailable\n\n');
        }
        await new Promise((r) => setTimeout(r, 3000));
      }
      if (!closed) controller.close();
    },
  });
  return new Response(stream, {
    headers: { 'content-type': 'text/event-stream', 'cache-control': 'no-cache, no-transform', connection: 'keep-alive' },
  });
}
