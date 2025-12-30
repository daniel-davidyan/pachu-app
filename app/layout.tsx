import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { AuthProvider } from '@/components/auth/auth-provider';
import { ToastProvider } from '@/components/ui/toast';
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

// Cache busting version - update this when icons change
const ICON_VERSION = 'v2';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#C5459C',
  interactiveWidget: 'resizes-content', // Makes keyboard behavior better on iOS
};

export const metadata: Metadata = {
  title: "Pachu - the taste signature",
  description: "Discover restaurants through AI recommendations and friends' reviews",
  manifest: `/manifest.webmanifest?v=${ICON_VERSION}`,
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Pachu',
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: `/favicon-32x32.png?v=${ICON_VERSION}`, sizes: '32x32', type: 'image/png' },
      { url: `/favicon-16x16.png?v=${ICON_VERSION}`, sizes: '16x16', type: 'image/png' },
      { url: `/favicon.ico?v=${ICON_VERSION}` },
    ],
    apple: [
      { url: `/apple-touch-icon.png?v=${ICON_VERSION}`, sizes: '180x180', type: 'image/png' },
    ],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        {/* Google Fonts */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Pacifico&display=swap" rel="stylesheet" />
        
        {/* Cache Control - Force Refresh of Icons */}
        <meta httpEquiv="Cache-Control" content="no-cache, no-store, must-revalidate" />
        <meta httpEquiv="Pragma" content="no-cache" />
        <meta httpEquiv="Expires" content="0" />
        
        {/* PWA Meta Tags */}
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Pachu" />
        
        {/* Favicons with cache busting */}
        <link rel="apple-touch-icon" sizes="180x180" href={`/apple-touch-icon.png?v=${ICON_VERSION}`} />
        <link rel="icon" type="image/png" sizes="32x32" href={`/favicon-32x32.png?v=${ICON_VERSION}`} />
        <link rel="icon" type="image/png" sizes="16x16" href={`/favicon-16x16.png?v=${ICON_VERSION}`} />
        <link rel="icon" type="image/x-icon" href={`/favicon.ico?v=${ICON_VERSION}`} />
        <link rel="manifest" href={`/manifest.webmanifest?v=${ICON_VERSION}`} />
        
        {/* iOS Splash Screens and Additional Icons */}
        <link rel="apple-touch-icon-precomposed" sizes="180x180" href={`/apple-touch-icon.png?v=${ICON_VERSION}`} />
        <link rel="apple-touch-startup-image" href={`/apple-touch-icon.png?v=${ICON_VERSION}`} />
      </head>
      <body className={inter.className}>
        <AuthProvider>
          <ToastProvider>
            {children}
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}

