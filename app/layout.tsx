import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ROUGLE',
  description: 'A roguelike Wordle. One pool of guesses per act.',
  icons: {
    icon: [
      { url: '/icons/favicon.ico' },
      { url: '/icons/rougle-icon-16.png', sizes: '16x16', type: 'image/png' },
      { url: '/icons/rougle-icon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icons/rougle-icon-48.png', sizes: '48x48', type: 'image/png' },
    ],
    apple: [
      { url: '/icons/rougle-icon-180.png', sizes: '180x180', type: 'image/png' },
    ],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0A0A0A',
};

/**
 * Server component. Owns the token imports and pins the theme.
 *
 * `data-theme="dark"` is pinned and there is no toggle — the design bundle
 * ships one theme (AGENTS.md non-negotiable 9).
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark">
      <body>{children}</body>
    </html>
  );
}
