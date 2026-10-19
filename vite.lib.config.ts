import { defineConfig } from "vite";

/**
 * Library build config — compiles the core library and widget into
 * ESM bundles in dist/ for npm publishing. Vite handles the SCSS import
 * in the widget and the Web Worker entry automatically. The worker is
 * imported with `?worker&inline` (see lib/widget/widget.ts), so it is
 * bundled INTO the widget as a self-contained blob — consumers of the
 * npm package need no extra build configuration to load it.
 */
export default defineConfig({
  // The library build must not copy the website's public/ assets into dist/.
  publicDir: false,
  build: {
    lib: {
      entry: {
        "core/index": "lib/core/index.ts",
        "widget/widget": "lib/widget/widget.ts",
      },
      formats: ["es"],
    },
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      external: ["node:crypto"],
    },
    minify: false,
  },
});
