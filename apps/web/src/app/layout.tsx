import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/components/auth/auth-provider';

export const metadata: Metadata = {
  title: {
    default: 'Unicolors Workspace',
    template: '%s | Unicolors Workspace',
  },
  description:
    'Internal task and project management workspace for Unicolors.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}