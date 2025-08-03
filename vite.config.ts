import { defineConfig } from "vite";
import path from "path";
import builtins from "builtin-modules";
import { viteStaticCopy } from "vite-plugin-static-copy";

export default defineConfig(({ mode }) => {
  const prod = mode === "production";
  const outDir = "dist/.obsidian/plugins/convert-to-docx";

  return {
    resolve: {
      alias: { "@": path.resolve(__dirname, "src") },
    },
    build: {
      target: "esnext",
      minify: prod,
      sourcemap: prod ? false : "inline",
      cssCodeSplit: false,
      emptyOutDir: false,
      outDir,
      lib: {
        entry: path.resolve(__dirname, "src/main.ts"),
        formats: ["cjs"],
        fileName: () => "main.js",
      },
      rollupOptions: {
        external: [
          "obsidian",
          "electron",
          "@codemirror/autocomplete",
          "@codemirror/collab",
          "@codemirror/commands",
          "@codemirror/language",
          "@codemirror/lint",
          "@codemirror/search",
          "@codemirror/state",
          "@codemirror/view",
          "@lezer/common",
          "@lezer/highlight",
          "@lezer/lr",
          ...builtins,
        ],
        output: {
          entryFileNames: "main.js",
          assetFileNames: "styles.css",
        },
      },
      commonjsOptions: {
        include: [/node_modules/],
      },
    },
    plugins: [
      viteStaticCopy({
        targets: [
          { src: "manifest.json", dest: '.' },
          { src: "README.md", dest: '.' },
          { src: "LICENSE", dest: '.' },
        ],
      }),
    ],
  };
});
