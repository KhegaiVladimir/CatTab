import { defineConfig } from 'vite';
import { resolve } from 'path';
import { copyFileSync, mkdirSync, readdirSync, statSync, existsSync } from 'fs';
import { join, dirname } from 'path';

function copyDirPlugin(src: string, dest: string) {
  return {
    name: 'copy-dir',
    closeBundle() {
      if (!existsSync(src)) return;
      function copy(s: string, d: string): void {
        mkdirSync(d, { recursive: true });
        for (const entry of readdirSync(s)) {
          const sp = join(s, entry);
          const dp = join(d, entry);
          if (statSync(sp).isDirectory()) copy(sp, dp);
          else copyFileSync(sp, dp);
        }
      }
      copy(src, dest);
    },
  };
}

/** Copies HTML files from src/ to matching paths under dist/ */
function copyHtmlPlugin(files: Array<{ from: string; to: string }>) {
  return {
    name: 'copy-html',
    closeBundle() {
      for (const { from, to } of files) {
        mkdirSync(dirname(to), { recursive: true });
        copyFileSync(from, to);
      }
    },
  };
}

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    minify: false,
    rollupOptions: {
      input: {
        'background/service-worker': resolve(__dirname, 'src/background/service-worker.ts'),
        'content/index': resolve(__dirname, 'src/content/index.ts'),
        'popup/popup': resolve(__dirname, 'src/popup/popup.ts'),
        'options/options': resolve(__dirname, 'src/options/options.ts'),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'shared/[name].js',
        assetFileNames: '[name][extname]',
      },
    },
  },
  resolve: {
    alias: {
      '@shared': resolve(__dirname, 'src/shared'),
    },
  },
  plugins: [
    copyDirPlugin('public', 'dist'),
    copyHtmlPlugin([
      { from: 'src/popup/index.html',   to: 'dist/popup/index.html' },
      { from: 'src/popup/popup.css',    to: 'dist/popup/popup.css' },
      { from: 'src/options/index.html', to: 'dist/options/index.html' },
      { from: 'src/options/options.css', to: 'dist/options/options.css' },
      { from: 'src/styles/pet.css',     to: 'dist/styles/pet.css' },
    ]),
  ],
});
