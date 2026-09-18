import { Component, type ErrorInfo, type ReactNode } from 'react';
import { clearAllData, downloadBackup } from '../lib/backup';
import { SANS } from '../lib/ui';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * 顶层错误边界。
 *
 * 这个应用会在后台连续跑 25 分钟，一次渲染异常意味着白屏 + 计时中断；
 * 而最可能的异常来源恰恰是本地数据（损坏的 localStorage / 手工编辑过的备份），
 * 所以兜底界面除了"重试"，还要能先把数据导出去、再重置 —— 不能让用户以为数据没了。
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    if (import.meta.env.DEV) {
      console.error('[lumora] 渲染异常', error, info);
    }
  }

  private handleRetry = () => {
    this.setState({ error: null });
  };

  private handleExport = () => {
    try {
      downloadBackup();
    } catch {
      /* 导出失败不影响后续操作 */
    }
  };

  private handleReset = () => {
    clearAllData();
    window.location.reload();
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div
        className="flex h-screen w-full flex-col items-center justify-center gap-4 bg-[#0d1620] px-6 text-center"
        style={{ fontFamily: SANS, color: '#ffffff' }}
      >
        <h1 className="text-lg">出了点问题</h1>
        <p className="max-w-md text-sm leading-relaxed text-white/60">
          页面在渲染时遇到异常。你的数据还在本地存储里 ——
          可以先导出备份，再重置数据重启。
        </p>
        <pre className="max-h-24 max-w-md overflow-auto rounded-xl bg-white/[0.06] px-3 py-2 text-left text-[11px] text-white/45">
          {this.state.error.message}
        </pre>
        <div className="mt-2 flex flex-wrap items-center justify-center gap-2 text-xs">
          <button
            type="button"
            onClick={this.handleRetry}
            className="rounded-full bg-white/90 px-4 py-2 text-[#182C41] transition-opacity hover:opacity-85"
          >
            重试
          </button>
          <button
            type="button"
            onClick={this.handleExport}
            className="rounded-full bg-white/10 px-4 py-2 transition-opacity hover:opacity-85"
          >
            导出备份
          </button>
          <button
            type="button"
            onClick={this.handleReset}
            className="rounded-full bg-white/10 px-4 py-2 transition-opacity hover:opacity-85"
          >
            重置数据并重启
          </button>
        </div>
      </div>
    );
  }
}
