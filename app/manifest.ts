import { MetadataRoute } from 'next'

// Cache busting version - update this to force PWA refresh
const ICON_VERSION = 'v3'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Pachu',
    short_name: 'Pachu',
    description: 'Discover restaurants through AI recommendations and friends\' reviews',
    start_url: `/?v=${ICON_VERSION}`,
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#C5459C',
    icons: [
      {
        src: `/android-chrome-192x192.png?v=${ICON_VERSION}`,
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: `/android-chrome-192x192.png?v=${ICON_VERSION}`,
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: `/android-chrome-512x512.png?v=${ICON_VERSION}`,
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: `/android-chrome-512x512.png?v=${ICON_VERSION}`,
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: `/apple-touch-icon.png?v=${ICON_VERSION}`,
        sizes: '180x180',
        type: 'image/png',
      },
      {
        src: `/favicon-16x16.png?v=${ICON_VERSION}`,
        sizes: '16x16',
        type: 'image/png',
      },
      {
        src: `/favicon-32x32.png?v=${ICON_VERSION}`,
        sizes: '32x32',
        type: 'image/png',
      },
    ],
  }
}

