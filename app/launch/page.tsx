import { Suspense } from 'react';
import LaunchFlow from '@/components/LaunchFlow';
import { PixelBar } from '@/components/ui';

export const metadata = { title: 'Launch' };

export default function LaunchPage() {
  return (
    <Suspense fallback={<PixelBar />}>
      <LaunchFlow />
    </Suspense>
  );
}
