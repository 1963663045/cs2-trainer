/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages 项目页地址为 https://<用户>.github.io/<仓库名>/ ，因此 base 需要是 /<仓库名>/。
// 优先使用 VITE_BASE；在 GitHub Actions 中自动从 GITHUB_REPOSITORY（owner/repo）推导；本地开发为 '/'.
function resolveBase(): string {
  if (process.env.VITE_BASE) return process.env.VITE_BASE;
  const repo = process.env.GITHUB_REPOSITORY?.split('/')[1];
  if (repo) return repo.endsWith('.github.io') ? '/' : `/${repo}/`;
  return '/';
}

export default defineConfig({
  base: resolveBase(),
  plugins: [react()],
  test: { environment: 'node', include: ['src/**/*.test.ts'] }
});
