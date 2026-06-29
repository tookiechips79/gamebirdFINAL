import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  base: '/',
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: false,
  },
  plugins: [
    react(),
    mode === 'development' &&
    componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    chunkSizeWarningLimit: 1000,
    // Force cache busting with timestamp-based file names
    rollupOptions: {
      output: {
        manualChunks: undefined,
        // Add timestamp to filenames for cache busting
        entryFileNames: `assets/[name]-[hash].js`,
        chunkFileNames: `assets/[name]-[hash].js`,
        assetFileNames: `assets/[name]-[hash][extname]`,
      },
    },
    // Ensure clean builds
    emptyOutDir: true,
    sourcemap: false,
    // Use default Vite minifier (esbuild) - no need for terser
    minify: true,
  },
  ssr: {
    noExternal: ['@rollup/rollup-linux-x64-gnu'],
  },
}));
