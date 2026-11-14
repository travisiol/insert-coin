import { json } from '@/lib/server/guard';

export const runtime = 'nodejs';

const POST_URL = /^https:\/\/(www\.)?(x|twitter)\.com\/[A-Za-z0-9_]{1,15}\/status\/\d+/;

function decode(s: string): string {
  return s
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&mdash;/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Extract an X post's text via the public oEmbed endpoint. */
export async function GET(req: Request) {
  const url = new URL(req.url).searchParams.get('url') ?? '';
  if (!POST_URL.test(url)) return json({ error: 'Not an X post link.' }, 400);
  try {
    const res = await fetch(`https://publish.twitter.com/oembed?url=${encodeURIComponent(url)}&omit_script=1`, { next: { revalidate: 3600 } } as RequestInit);
    if (!res.ok) throw new Error(String(res.status));
    const j = (await res.json()) as { html?: string; author_name?: string };
    const m = j.html?.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
    const text = m ? decode(m[1]) : '';
    if (!text) throw new Error('empty');
    return json({ text: text.slice(0, 1000), author: j.author_name ?? null });
  } catch {
    const path = url.split('/').slice(3).join(' ');
    return json({ text: path, fallback: true, note: 'Paste the post text for a better result' });
  }
}
