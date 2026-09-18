import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // 默认 node（纯函数测试足够快）；需要 DOM 的 hook 测试在文件顶部
    // 用 `// @vitest-environment jsdom` 单独声明
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
