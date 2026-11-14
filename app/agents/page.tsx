import AgentsGrid from '@/components/AgentsGrid';
import { Section, ErrorBox } from '@/components/ui';
import { listCoins, safeView } from '@/lib/server/views';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Agents' };

export default async function AgentsPage({ searchParams }: { searchParams: { sort?: string } }) {
  const coins = await safeView(() => listCoins(), []);
  return (
    <Section kicker="ALL COINS" title="AGENTS">
      {coins.error ? <ErrorBox reason="Agents are unavailable right now. The database did not answer." /> : <AgentsGrid coins={coins.data} initialSort={searchParams.sort} />}
    </Section>
  );
}
