import type { MetadataRoute } from 'next';
export default function manifest(): MetadataRoute.Manifest {
  return { name: 'SpaCare', short_name: 'SpaCare', start_url: '/workspace', scope: '/',
    display: 'standalone', background_color: '#f6f7f2', theme_color: '#356454',
    icons: [{ src: '/icons/spacare-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/spacare-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' }] };
}
