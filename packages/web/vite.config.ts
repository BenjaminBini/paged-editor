import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  build: {
    lib: {
      entry: {
        index: resolve(__dirname, "src/index.ts"),
        server: resolve(__dirname, "src/server.ts"),
      },
      formats: ["es"],
    },
    rollupOptions: {
      // node builtins and peer deps stay external
      external: ["node:path", "node:url", "@benjaminbini/paged-editor-base/server"],
    },
  },
});
