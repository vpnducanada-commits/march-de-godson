import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [
        'init.js',
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
        display_override: ['standalone', 'minimal-ui'],
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
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        // Ne pas précacher index.html en CacheFirst : sinon un ancien Service Worker
        // sert l'ancien bundle JS et provoque un faux 404 sur toute nouvelle route déployée.
        globPatterns: ['**/*.{js,css,svg,png,woff2}'],
        navigateFallback: null,
        runtimeCaching: [
          {
            // Navigation HTML : toujours privilégier le réseau (3s max) puis fallback hors-ligne
            urlPattern: ({ request, url }) =>
              request.mode === 'navigate' &&
              !url.pathname.startsWith('/apk/') &&
              !/\.(?:apk|zip|pdf|xml|txt)$/i.test(url.pathname),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'html-navigation-cache',
              networkTimeoutSeconds: 3,
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 7 },
              cacheableResponse: { statuses: [200] },
            },
          },
          {
            urlPattern: /\/demo\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'demo-images',
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Supabase Storage : uniquement les buckets d'images (jamais listing-videos / flux HTTP Range MP4)
            urlPattern:
              /^https:\/\/[^/]+\.supabase\.co\/storage\/v1\/object\/public\/(?:listing-images|avatars)\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'supabase-images',
              expiration: { maxEntries: 120, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          supabase: ['@supabase/supabase-js'],
          vendor: ['react','react-dom','react-router-dom'],
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
