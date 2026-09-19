import { memo, useState } from 'react';
import { BREAK_REASONS } from '../data/breakReasons';
import { SANS } from '../lib/ui';

interface Props {
  /** 本段专注已记录的打断次数 */
  count: number;
  onLog: (reasonId: string) => void;
}

/**
 * 打断打点：被打断的那一刻按一下，记下原因。
 *
 * 刻意做成"收起时只有一个不起眼的文字按钮"：
 * 它出现在专注进行中，任何抢眼的设计都会变成新的干扰源。
 * 展开后也只给一行原因、点完即收，不做二次确认 —— 正在被打断的人没耐心走流程。
 */
export const BreakLogger = memo(function BreakLogger({ count, onLog }: Props) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <div className="mt-4 flex justify-center" style={{ fontFamily: SANS }}>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="记录一次打断"
          className="rounded-full px-3 py-1 text-[11px] text-white/40 transition-colors duration-300 hover:bg-white/[0.08] hover:text-white/70"
        >
          被打断{count > 0 ? ` · ${count}` : ''}
        </button>
      </div>
    );
  }

  return (
    <div
      className="mt-4 flex flex-wrap items-center justify-center gap-2 px-4"
      style={{ fontFamily: SANS }}
    >
      <span className="text-[11px] text-white/50">是什么打断了？</span>
      {BREAK_REASONS.map((reason) => (
        <button
          key={reason.id}
          type="button"
          // 鼠标悬停能看到判断依据，省得在「走神」和「主动切换」之间犹豫
          title={reason.hint}
          onClick={() => {
            onLog(reason.id);
            setOpen(false);
          }}
          className="liquid-glass rounded-full px-3 py-1 text-[11px] transition-opacity duration-300 hover:opacity-80"
        >
          {reason.label}
        </button>
      ))}
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="text-[11px] text-white/35 transition-opacity hover:opacity-70"
      >
        取消
      </button>
    </div>
  );
});
