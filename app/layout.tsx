import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ROUGLE',
  description: 'A roguelike Wordle. One pool of guesses per act.',
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
