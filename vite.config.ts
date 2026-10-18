import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [
        'favicon.png',
        'favicon.svg',
        'logo.png',
        'logo-symbol.png',
        'og-image.png',
        'icons/icon-192.png',
        'icons/icon-512.png',
      ],
      manifest: {
        name: 'GODSON Marketplace — Le marché gabonais, à portée de clic',
        short_name: 'Godson Market',
        description:
          'Achetez, vendez et trouvez des services au Gabon. Annonces, produits et services au FCFA, de Libreville à Port-Gentil.',
        lang: 'fr',
        dir: 'ltr',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait-primary',
        background_color: '#0A1633',
        theme_color: '#0A1633',
        categories: ['shopping', 'lifestyle'],
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallbackDenylist: [/^\/admin/],
        runtimeCaching: [
          {
            urlPattern: /\/demo\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'demo-images',
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        // Découpe : le client Supabase (~300 kB) dans son propre chunk
        // pour garder le bundle principal léger (et sous le seuil d'avertissement).
        manualChunks: {
          supabase: ['@supabase/supabase-js'],
        },
      },
    },
  },
  server: {
    host: true,
    port: 5173,
    // Autorise les hôtes d'aperçu de l'environnement de développement
    allowedHosts: ['.e2b.app'],
  },
  preview: {
    host: true,
    port: 4173,
    allowedHosts: ['.e2b.app'],
  },
});
