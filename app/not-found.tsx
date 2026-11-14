import Link from 'next/link';
import { Empty } from '@/components/ui';

export default function NotFound() {
  return (
    <div className="mx-auto max-w-content px-4">
      <Empty text="GAME OVER. THIS SCREEN DOES NOT EXIST.">
        <Link href="/" className="btn btn-coin">CONTINUE?</Link>
      </Empty>
    </div>
  );
}
