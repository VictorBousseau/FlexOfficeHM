import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import './globals.css';
import { Toaster } from '@/components/ui/sonner';

export const metadata: Metadata = {
  title: 'Flex Office — 3eme etage Rennes',
  description:
    'Reservation de bureaux en flex office — equipe Distribution & Performance Commerciale, Harmonie Mutuelle Rennes.',
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="fr">
      <body className="min-h-screen bg-background text-foreground antialiased">
        {children}
        <Toaster richColors position="top-center" />
      </body>
    </html>
  );
}
