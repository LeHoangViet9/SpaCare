import type { MetadataRoute } from 'next';
export default function manifest(): MetadataRoute.Manifest {
  return { name: 'SpaCare', short_name: 'SpaCare', start_url: '/workspace', scope: '/',
    display: 'standalone', background_color: '#f6f7f2', theme_color: '#356454',
    icons: [{ src: '/icons/spacare.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }] };
}
