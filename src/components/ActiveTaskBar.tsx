import { memo } from 'react';
import { Target } from 'lucide-react';
import { SANS } from '../lib/ui';
import type { Task } from '../types';

interface Props {
  task: Task;
  onClick: () => void;
}

/** 计时器下方的「进行中任务」快捷入口 */
function ActiveTaskBarComponent({ task, onClick }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      title="打开今日意图"
      className="liquid-glass mt-6 flex max-w-[86vw] items-center gap-2 rounded-full px-4 py-2 text-xs transition-opacity duration-300 hover:opacity-75 sm:max-w-[340px]"
      style={{ fontFamily: SANS }}
    >
      <Target className="h-3.5 w-3.5 shrink-0 opacity-70" />
      <span className="truncate">{task.title}</span>
      <span className="shrink-0 tabular-nums opacity-60">
        {task.completedPomodoros}/{task.estimatedPomodoros}
      </span>
    </button>
  );
}

export const ActiveTaskBar = memo(ActiveTaskBarComponent);
