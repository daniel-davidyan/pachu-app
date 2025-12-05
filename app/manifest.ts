import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Pachu',
    short_name: 'Pachu',
    description: 'Discover restaurants through AI recommendations and friends\' reviews',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#C5459C',
    icons: [
      {
        src: '/favicon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
      },
    ],
  }
}

