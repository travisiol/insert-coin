/** Public keyless market data: DexScreener + GeckoTerminal. */

export interface DexPair {
  chainId: string;
  dexId: string;
  url: string;
  pairAddress: string;
  baseToken: { address: string; name: string; symbol: string };
  quoteToken: { address: string; symbol: string };
  priceNative?: string;
  priceUsd?: string;
  txns?: Record<'m5' | 'h1' | 'h6' | 'h24', { buys: number; sells: number }>;
  volume?: Partial<Record<'m5' | 'h1' | 'h6' | 'h24', number>>;
  priceChange?: Partial<Record<'m5' | 'h1' | 'h6' | 'h24', number>>;
  liquidity?: { usd?: number; base?: number; quote?: number };
  fdv?: number;
  marketCap?: number;
  pairCreatedAt?: number;
  info?: { imageUrl?: string };
}

const DS = 'https://api.dexscreener.com';

async function getJson<T>(url: string, revalidate = 60): Promise<T | null> {
  let delay = 400;
  for (let i = 0; i < 3; i++) {
    try {
      const res = await fetch(url, { next: { revalidate } } as RequestInit);
      if (res.status === 429 || res.status >= 500) {
        await new Promise((r) => setTimeout(r, delay));
        delay *= 2;
        continue;
      }
      if (!res.ok) return null;
      return (await res.json()) as T;
    } catch {
      await new Promise((r) => setTimeout(r, delay));
      delay *= 2;
    }
  }
  return null;
}

/** Best pair per mint (highest liquidity), batches of 30. */
export async function pairsFor(mints: string[], revalidate = 60): Promise<Record<string, DexPair>> {
  const out: Record<string, DexPair> = {};
  const uniq = Array.from(new Set(mints.filter(Boolean)));
  for (let i = 0; i < uniq.length; i += 30) {
    const batch = uniq.slice(i, i + 30);
    const pairs = await getJson<DexPair[]>(`${DS}/tokens/v1/solana/${batch.join(',')}`, revalidate);
    for (const p of pairs ?? []) {
      const m = p.baseToken?.address;
      if (!m || !batch.includes(m)) continue;
      const cur = out[m];
      if (!cur || (p.liquidity?.usd ?? 0) > (cur.liquidity?.usd ?? 0)) out[m] = p;
    }
  }
  return out;
}

export interface TwinResult { count: number; top: { name: string; symbol: string; mcap: number; ageDays: number | null; url: string }[] }

export async function twinCheck(ticker: string): Promise<TwinResult | null> {
  const j = await getJson<{ pairs?: DexPair[] }>(`${DS}/latest/dex/search?q=${encodeURIComponent(ticker)}`, 300);
  if (!j) return null;
  const seen = new Map<string, DexPair>();
  for (const p of j.pairs ?? []) {
    if (p.chainId !== 'solana') continue;
    if (p.baseToken.symbol.toUpperCase() !== ticker.toUpperCase()) continue;
    const cur = seen.get(p.baseToken.address);
    if (!cur || (p.marketCap ?? 0) > (cur.marketCap ?? 0)) seen.set(p.baseToken.address, p);
  }
  const list = Array.from(seen.values()).sort((a, b) => (b.marketCap ?? 0) - (a.marketCap ?? 0));
  return {
    count: list.length,
    top: list.slice(0, 3).map((p) => ({
      name: p.baseToken.name,
      symbol: p.baseToken.symbol,
      mcap: p.marketCap ?? p.fdv ?? 0,
      ageDays: p.pairCreatedAt ? Math.floor((Date.now() - p.pairCreatedAt) / 86_400_000) : null,
      url: p.url,
    })),
  };
}

/** Candidate token mints from GeckoTerminal new + trending pools. */
export async function candidateMints(): Promise<string[]> {
  const urls = [
    'https://api.geckoterminal.com/api/v2/networks/solana/new_pools?page=1',
    'https://api.geckoterminal.com/api/v2/networks/solana/trending_pools?page=1',
  ];
  const mints = new Set<string>();
  for (const u of urls) {
    const j = await getJson<{ data?: { relationships?: { base_token?: { data?: { id?: string } } } }[] }>(u, 120);
    for (const p of j?.data ?? []) {
      const id = p.relationships?.base_token?.data?.id;
      if (id?.startsWith('solana_')) mints.add(id.slice(7));
    }
  }
  return Array.from(mints);
}

export function isBonded(p: DexPair | undefined): boolean {
  return !!p && p.dexId !== 'pumpfun';
}

export function fmtUsd(n: number | undefined | null): string {
  if (n === undefined || n === null || !isFinite(n)) return '—';
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  if (n >= 1) return `$${n.toFixed(2)}`;
  if (n === 0) return '$0';
  return `$${n.toPrecision(3)}`;
}

export function fmtPct(n: number | undefined | null): string {
  if (n === undefined || n === null || !isFinite(n)) return '—';
  return `${n > 0 ? '+' : ''}${n.toFixed(1)}%`;
}

export function fmtNum(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return n.toFixed(n < 10 ? 2 : 0);
}

export function fmtSol(lamports: number, digits = 4): string {
  return `${(lamports / 1e9).toFixed(digits)} SOL`;
}
