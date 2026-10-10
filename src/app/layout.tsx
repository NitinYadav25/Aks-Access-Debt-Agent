import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Aks | Explainable Graph-Grounded Access Debt Agent',
  description:
    'Finds stale and ownerless access paths across identities, groups, repositories, and cloud roles with verifiable before-and-after graph proof.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&family=Outfit:wght@500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
