import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Weazy PMS — Hotel Property Management System',
  description: 'Cloud-based Serverless SaaS Hotel PMS integrated with Weazy Billing POS',
  keywords: ['hotel pms', 'property management', 'hotel software', 'weazy pms'],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
