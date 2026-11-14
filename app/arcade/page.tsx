import Arcade from '@/components/Arcade';

export const metadata = { title: 'Arcade' };

export default function ArcadePage({ searchParams }: { searchParams: { focus?: string } }) {
  return <Arcade focus={searchParams.focus} />;
}
