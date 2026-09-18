import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      'dist',
      'node_modules',
      'public/sw.js',
      'public/audio/**',
      'npm-install.log',
    ],
  },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      // 这条规则会抓「依赖数组写错导致定时器反复重建」这类问题（见 开发踩坑点.md 记录 4）
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
    },
  },
  {
    // 构建脚本 / 测试配置跑在 Node 里
    files: ['*.config.{ts,js}', 'src/**/*.test.ts'],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
);
