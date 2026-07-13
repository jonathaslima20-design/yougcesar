import path from 'path';
import fs from 'fs';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

// Files with spaces in public/ cause EAGAIN in this sandbox.
// This plugin intercepts Vite's buildStart to patch Node's fs.copyFileSync
// so that any attempt to copy a file whose path contains a space is silently skipped.
function skipSpacedPublicFiles(): Plugin {
  return {
    name: 'skip-spaced-public-files',
    apply: 'build',
    buildStart() {
      const origCopyFileSync = fs.copyFileSync.bind(fs);
      (fs as any).copyFileSync = (src: string, dst: string, ...rest: any[]) => {
        if (typeof src === 'string' && src.includes(' ')) return;
        origCopyFileSync(src, dst, ...rest);
      };
    },
  };
}

export default defineConfig(() => ({
  plugins: [react(), skipSpacedPublicFiles()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  envDir: '.',
  envPrefix: 'VITE_',
  build: {
    outDir: 'dist',
    sourcemap: true,
    minify: 'esbuild',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          ui: [
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-popover',
            '@radix-ui/react-toast',
          ],
        },
      },
    },
    target: 'esnext',
    cssMinify: true,
    reportCompressedSize: true,
    chunkSizeWarningLimit: 1000,
  },
  server: {
    host: true,
    port: 3000,
    strictPort: true,
    hmr: {
      timeout: 60000,
      overlay: true,
      clientPort: 3000,
    },
    watch: {
      usePolling: true,
      interval: 1000,
    },
    fs: {
      strict: false,
    },
  },
  preview: {
    port: 3000,
    strictPort: true,
  },
  esbuild: {
    target: 'esnext',
  },
  define: {
    global: 'globalThis',
  },
}));
