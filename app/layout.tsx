import type { Metadata, Viewport } from 'next';
import { Press_Start_2P, VT323 } from 'next/font/google';
import './globals.css';
import { Header, Footer, CrtSync } from '@/components/ui';

const head = Press_Start_2P({ weight: '400', subsets: ['latin'], variable: '--font-head', display: 'swap' });
const body = VT323({ weight: '400', subsets: ['latin'], variable: '--font-body', display: 'swap' });

const site = process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : 'http://localhost:3000';

export const metadata: Metadata = {
  metadataBase: new URL(site),
  title: { default: 'Insert Coin', template: '%s · Insert Coin' },
  description: 'Drop a post or an idea. Get a pixel fighter, a Solana coin, and an agent that works with its creator fees.',
  openGraph: { images: ['/api/og'] },
  twitter: { card: 'summary_large_image', images: ['/api/og'] },
  icons: { apple: '/apple-touch-icon.png' },
};

export const viewport: Viewport = { themeColor: '#141414', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${head.variable} ${body.variable}`}>
      <body className="crt">
        <CrtSync />
        <Header />
        <main>{children}</main>
        <Footer />
      </body>
    </html>
  );
}
