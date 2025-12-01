import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { AuthProvider } from '@/components/auth/auth-provider';
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Pachu - Your Personal Taste Recommender",
  description: "Discover restaurants through AI recommendations and friends' reviews",
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
  },
  themeColor: '#C5459C',
  icons: {
    icon: [
      { url: '/icon' },
      { url: '/favicon.svg', type: 'image/svg+xml' },
    ],
    apple: '/apple-icon',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AuthProvider>
        {children}
        </AuthProvider>
      </body>
    </html>
  );
}

