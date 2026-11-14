import { Suspense } from 'react';
import Studio from '@/components/Studio';
import { PixelBar } from '@/components/ui';

export const metadata = { title: 'Studio' };

export default function StudioPage() {
  return (
    <Suspense fallback={<PixelBar />}>
      <Studio />
    </Suspense>
  );
}
