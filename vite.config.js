import { defineConfig } from "vite";
import { resolve } from "node:path";
import { writeFileSync, mkdirSync } from "node:fs";

export default defineConfig({
  build: {
    target: "node20",
    outDir: "dist",
    lib: {
      entry: resolve(__dirname, "src/cli.js"),
      formats: ["es"],
      fileName: "cli",
    },
    rollupOptions: {
      external: [
        // Node.js built-ins
        /^node:/,
        "fs",
        "path",
        "os",
        "child_process",
        "url",
        "events",
        "stream",
        "util",
        "http",
        "https",
        "net",
        "tls",
        "crypto",
        "zlib",
        "buffer",
        "assert",
        "tty",
        "readline",
        // External dependencies
        "puppeteer",
        "@google/genai",
        "zod",
      ],
      output: {
        banner: "#!/usr/bin/env node",
      },
    },
    minify: true,
    sourcemap: false,
  },
  plugins: [
    {
      name: "generate-dist-package-json",
      closeBundle() {
        const distPackageJson = {
          name: "bing-auto-search",
          version: "1.0.0",
          type: "module",
          main: "cli.js",
          bin: {
            "bing-auto-search": "./cli.js",
          },
          dependencies: {
            puppeteer: "^24.0.0",
            "@google/genai": "^0.14.0",
            zod: "^3.25.56",
          },
        };

        mkdirSync("dist", { recursive: true });
        writeFileSync(resolve(__dirname, "dist/package.json"), JSON.stringify(distPackageJson, null, 2));
        console.log("✓ Generated dist/package.json");
      },
    },
  ],
});
