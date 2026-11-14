import type { Metadata } from 'next';
import Terminal from '@/components/Terminal';

export async function generateMetadata({ params }: { params: { ticker: string } }): Promise<Metadata> {
  const t = params.ticker.toUpperCase();
  return { title: `$${t} terminal`, openGraph: { images: [`/api/og?t=${t}`] } };
}

export default function TerminalPage({ params }: { params: { ticker: string } }) {
  return (
    <div className="h-[calc(100vh-64px)] screen" style={{ borderWidth: 0 }}>
      <Terminal ticker={params.ticker} />
    </div>
  );
}
