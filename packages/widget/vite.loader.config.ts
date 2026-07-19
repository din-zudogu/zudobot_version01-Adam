import { defineConfig } from "vite";

export default defineConfig({
  build: {
    lib: {
      entry:   "src/iframe-loader.ts",
      name:    "ZudobotLoader",
      fileName: "zudobot-loader",
      formats: ["iife"],
    },
    rollupOptions: {
      output: { inlineDynamicImports: true },
    },
    outDir:      "dist",
    emptyOutDir: false,   // don't wipe widget.js built first
    minify:      "esbuild",
  },
});
