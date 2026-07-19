import { defineConfig } from "vite";

export default defineConfig({
  build: {
    lib: {
      entry: "src/index.ts",
      name: "Zudobot",
      fileName: "zudobot",
      formats: ["iife"], // Single file, self-executing — works on any website
    },
    rollupOptions: {
      output: {
        entryFileNames: "widget.js", // served as /widget.js from CDN
        inlineDynamicImports: true,
      },
    },
    outDir: "dist",
    minify: "esbuild",
  },
});
