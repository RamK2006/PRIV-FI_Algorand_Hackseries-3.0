import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    headers: {
      // Barretenberg requires SharedArrayBuffer which needs these headers.
      // Without them, in-browser WASM proof generation will fail silently.
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
  define: {
    // Required for algosdk to work in browser
    global: 'globalThis',
  },
  resolve: {
    alias: {
      // Fix for algosdk buffer dependency
      buffer: 'buffer',
    },
  },
  optimizeDeps: {
    esbuildOptions: {
      define: {
        global: 'globalThis',
      },
    },
    // Exclude optional peer dependencies from pre-bundling 
    exclude: ['@perawallet/connect'],
  },
  build: {
    rollupOptions: {
      // Don't fail build on missing optional dynamic imports
      onwarn(warning, warn) {
        // Suppress warnings for optional dynamic imports
        if (warning.code === 'UNRESOLVED_IMPORT' && 
            warning.message?.includes('@perawallet/connect')) {
          return;
        }
        warn(warning);
      },
    },
  },
});
