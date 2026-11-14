import Link from 'next/link';
import Sprite from '@/components/Sprite';
import { Section, Empty, ErrorBox } from '@/components/ui';
import { listCoins, safeView } from '@/lib/server/views';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Terminals' };

export default async function TerminalsPage({ searchParams }: { searchParams: { sort?: string } }) {
  const coins = await safeView(() => listCoins(), []);
  const sort = searchParams.sort === 'new' ? 'new' : 'trending';
  const list = [...coins.data].sort((a, b) => (sort === 'new' ? b.id - a.id : (b.volume24h ?? 0) - (a.volume24h ?? 0)));
  return (
    <Section kicker="ONE TERMINAL PER COIN" title="TERMINALS">
      <div className="flex gap-2 mb-6">
        <Link href="/terminals" className={`btn btn-sm ${sort === 'trending' ? 'btn-coin' : ''}`}>TRENDING</Link>
        <Link href="/terminals?sort=new" className={`btn btn-sm ${sort === 'new' ? 'btn-coin' : ''}`}>NEWEST</Link>
      </div>
      {coins.error ? (
        <ErrorBox reason="Terminals are unavailable right now." />
      ) : !list.length ? (
        <Empty text="NO TERMINALS YET. EVERY LAUNCHED COIN GETS ONE.">
          <Link href="/launch" className="btn btn-coin">LAUNCH</Link>
        </Empty>
      ) : (
        <div className="grid gap-6 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
          {list.map((c) => (
            <Link key={c.id} href={`/t/${c.ticker}`} className="screen crt-layer p-4 flex flex-col gap-2">
              <div className="flex justify-center bg-tile p-2">
                <Sprite spec={c.spec} frames={c.frames} level={c.level} scale={2} state={c.sleeping ? 'sleep' : 'idle'} />
              </div>
              <div className="font-head text-[10px] text-coin">${c.ticker}</div>
              <div className="text-[18px] text-light truncate">&gt; {c.name.toLowerCase()} online_</div>
            </Link>
          ))}
        </div>
      )}
    </Section>
  );
}
