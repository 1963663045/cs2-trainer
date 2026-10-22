/// <reference types="vitest" />
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { copyFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

// GitHub Pages 项目页地址为 https://<用户>.github.io/<仓库名>/ ，因此 base 需要是 /<仓库名>/。
// 优先使用 VITE_BASE；在 GitHub Actions 中自动从 GITHUB_REPOSITORY（owner/repo）推导；本地开发为 '/'.
function resolveBase(): string {
  if (process.env.VITE_BASE) return process.env.VITE_BASE;
  const repo = process.env.GITHUB_REPOSITORY?.split('/')[1];
  if (repo) return repo.endsWith('.github.io') ? '/' : `/${repo}/`;
  return '/';
}

// GitHub Pages 对不存在的路径返回 404.html：复制一份 index.html，让任何误入的路径也能加载应用（路由本身用 Hash）
function spa404(): Plugin {
  let outDir = 'dist';
  return {
    name: 'spa-404',
    apply: 'build',
    configResolved(c) {
      outDir = resolve(c.root, c.build.outDir);
    },
    closeBundle() {
      const idx = resolve(outDir, 'index.html');
      if (existsSync(idx)) copyFileSync(idx, resolve(outDir, '404.html'));
    }
  };
}

export default defineConfig({
  base: resolveBase(),
  plugins: [react(), spa404()],
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
  build: { chunkSizeWarningLimit: 300 }
});
