import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/components/auth/auth-provider';
import { AppDialogProvider } from '@/components/ui/app-dialog-provider';

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
        <AppDialogProvider>
          <AuthProvider>
            {children}
          </AuthProvider>
        </AppDialogProvider>
      </body>
    </html>
  );
}