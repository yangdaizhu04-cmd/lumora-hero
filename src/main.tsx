import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* 顶层错误边界：一次渲染异常不该让整个工作台白屏（数据还在本地，要能自救） */}
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);

// PWA 的 Service Worker 注册与"新版本就绪"检测都在 App 里（见 lib/swUpdate.ts）：
// 这样可以复用应用内的提示条，而不是在入口处再造一套 UI。
