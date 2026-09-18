import { useEffect, useRef, useState } from 'react';
import { Check, Circle, Plus, Target, Trash2, X } from 'lucide-react';
import { formatDayLabel, sumReview } from '../lib/review';
import { formatMinutes } from '../lib/stats';
import { clamp } from '../lib/time';
import type { ReviewEntry, Task } from '../types';

interface Props {
  open: boolean;
  tasks: Task[];
  review: ReviewEntry[];
  activeTaskId: string | null;
  onClose: () => void;
  onAdd: (title: string, estimate: number) => void;
  onToggleDone: (id: string) => void;
  onRemove: (id: string) => void;
  onSetActive: (id: string | null) => void;
  onClearCompleted: () => void;
}

const SANS = 'system-ui, sans-serif';

type Tab = 'today' | 'review';

export function TaskPanel({
  open,
  tasks,
  review,
  activeTaskId,
  onClose,
  onAdd,
  onToggleDone,
  onRemove,
  onSetActive,
  onClearCompleted,
}: Props) {
  const [tab, setTab] = useState<Tab>('today');
  const [title, setTitle] = useState('');
  const [estimate, setEstimate] = useState(1);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const focusTimer = window.setTimeout(() => {
      if (tab === 'today') inputRef.current?.focus();
    }, 300);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.clearTimeout(focusTimer);
    };
  }, [open, onClose, tab]);

  const submit = () => {
    if (!title.trim()) return;
    onAdd(title, estimate);
    setTitle('');
    setEstimate(1);
    inputRef.current?.focus();
  };

  const doneCount = tasks.filter((task) => task.done).length;
  const openTasks = tasks.filter((task) => !task.done);
  const closedTasks = tasks.filter((task) => task.done);
  const ordered = [...openTasks, ...closedTasks];

  return (
    <>
      <div
        className={`fixed inset-0 z-[80] bg-black/30 transition-opacity duration-500 ${
          open ? 'pointer-events-auto' : 'pointer-events-none'
        }`}
        style={{ opacity: open ? 1 : 0 }}
        onClick={onClose}
        aria-hidden="true"
      />

      <aside
        className={`fixed left-0 top-0 z-[90] flex h-full w-full max-w-full flex-col bg-[#0d1620]/70 backdrop-blur-2xl sm:max-w-[380px] ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{
          fontFamily: SANS,
          color: '#ffffff',
          // visibility 参与过渡：关闭动画播完后隐藏，避免键盘 Tab 进入不可见面板
          visibility: open ? 'visible' : 'hidden',
          transitionProperty: 'transform, visibility',
          transitionDuration: '500ms',
          transitionTimingFunction: 'cubic-bezier(0.4,0,0.2,1)',
        }}
        aria-hidden={!open}
        aria-label="今日意图"
      >
        <div className="flex items-center justify-between px-6 py-6">
          <h2 className="text-base font-medium">今日意图</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭任务面板"
            className="liquid-glass flex h-9 w-9 items-center justify-center rounded-full"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* 标签页 */}
        <div className="px-6">
          <div className="liquid-glass flex items-center gap-1 rounded-full p-1">
            {(
              [
                ['today', '今日'],
                ['review', '回顾'],
              ] as [Tab, string][]
            ).map(([key, label]) => {
              const isActive = tab === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTab(key)}
                  aria-pressed={isActive}
                  className="flex-1 rounded-full py-2 text-xs transition-colors duration-300"
                  style={{
                    background: isActive ? 'rgba(255,255,255,0.9)' : 'transparent',
                    color: isActive ? '#182C41' : 'inherit',
                    opacity: isActive ? 1 : 0.75,
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {tab === 'today' ? (
          <>
            <div className="px-6 pt-5">
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  submit();
                }}
                className="flex items-center gap-2"
              >
                <input
                  ref={inputRef}
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="今天要推进什么？"
                  aria-label="任务内容"
                  className="liquid-glass min-w-0 flex-1 rounded-full px-4 py-3 text-sm"
                  style={{ color: 'inherit' }}
                />
                <button
                  type="submit"
                  aria-label="添加任务"
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-[#182C41] transition-transform duration-300 hover:scale-[1.04]"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </form>

              <div className="mt-3 flex items-center justify-between text-xs text-white/50">
                <span>预估番茄数</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    aria-label="减少预估番茄数"
                    onClick={() => setEstimate((prev) => clamp(prev - 1, 1, 12))}
                    className="liquid-glass flex h-7 w-7 items-center justify-center rounded-full leading-none"
                  >
                    −
                  </button>
                  <span className="w-6 text-center text-sm tabular-nums text-white/80">
                    {estimate}
                  </span>
                  <button
                    type="button"
                    aria-label="增加预估番茄数"
                    onClick={() => setEstimate((prev) => clamp(prev + 1, 1, 12))}
                    className="liquid-glass flex h-7 w-7 items-center justify-center rounded-full leading-none"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-4 flex-1 overflow-y-auto px-4 pb-4">
              {ordered.length === 0 ? (
                <p className="px-2 py-8 text-center text-sm text-white/40">
                  还没有任务。
                  <br />
                  写下今天最想推进的一件事。
                </p>
              ) : (
                ordered.map((task) => {
                  const isActive = task.id === activeTaskId && !task.done;
                  return (
                    <div
                      key={task.id}
                      className={`group flex items-start gap-3 rounded-2xl px-3 py-3 transition-colors duration-300 ${
                        isActive ? 'bg-white/10' : 'hover:bg-white/[0.06]'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => onToggleDone(task.id)}
                        aria-label={task.done ? '标记为未完成' : '标记为已完成'}
                        className="mt-0.5 shrink-0 opacity-70 transition-opacity hover:opacity-100"
                      >
                        {task.done ? (
                          <Check className="h-4 w-4" />
                        ) : (
                          <Circle className="h-4 w-4" />
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => onSetActive(isActive ? null : task.id)}
                        aria-label={
                          isActive
                            ? `取消进行中：${task.title}`
                            : `设为进行中：${task.title}`
                        }
                        className="min-w-0 flex-1 text-left"
                      >
                        <div
                          className={`truncate text-sm ${
                            task.done ? 'line-through opacity-40' : ''
                          }`}
                        >
                          {task.title}
                        </div>
                        <div className="mt-1 flex items-center gap-2 text-[11px] text-white/45">
                          <span className="tabular-nums">
                            {task.completedPomodoros}/{task.estimatedPomodoros} 番茄
                          </span>
                          {isActive && (
                            <span className="flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-white/80">
                              <Target className="h-3 w-3" />
                              进行中
                            </span>
                          )}
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => onRemove(task.id)}
                        aria-label={`删除任务：${task.title}`}
                        className="mt-0.5 shrink-0 opacity-0 transition-opacity duration-300 hover:opacity-80 focus-visible:opacity-80 group-hover:opacity-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            <div className="flex items-center justify-between border-t border-white/10 px-6 py-4 text-xs text-white/50">
              <span>
                {openTasks.length} 项待办
                {doneCount > 0 ? ` · ${doneCount} 项已完成` : ''}
              </span>
              {doneCount > 0 && (
                <button
                  type="button"
                  onClick={onClearCompleted}
                  className="transition-opacity hover:opacity-80"
                >
                  清除已完成
                </button>
              )}
            </div>
          </>
        ) : (
          <div className="mt-4 flex-1 overflow-y-auto px-5 pb-6">
            <ReviewList review={review} />
          </div>
        )}
      </aside>
    </>
  );
}

/** 按天回顾：任务快照 + 当天专注数据 */
function ReviewList({ review }: { review: ReviewEntry[] }) {
  if (review.length === 0) {
    return (
      <p className="px-2 py-10 text-center text-sm text-white/40">
        还没有记录。
        <br />
        完成第一个番茄后这里会出现每日回顾。
      </p>
    );
  }

  const totals = sumReview(review);

  return (
    <div className="space-y-3">
      <p className="px-1 text-[11px] text-white/45">
        近 {totals.days} 天累计 {totals.count} 个番茄 ·{' '}
        {formatMinutes(totals.minutes)}
      </p>

      {review.map((day) => {
        const unfinished = day.tasks.filter((task) => task.status === 'unfinished');
        return (
          <div key={day.date} className="rounded-2xl bg-white/[0.05] px-4 py-3">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-sm">{formatDayLabel(day.date)}</span>
              <span className="shrink-0 text-[11px] tabular-nums text-white/50">
                {day.focusCount} 个番茄 · {formatMinutes(day.focusMinutes)}
              </span>
            </div>

            {day.tasks.length > 0 ? (
              <ul className="mt-2 space-y-1.5">
                {day.tasks.map((task) => (
                  <li key={task.id} className="flex items-start gap-2 text-[12px]">
                    {task.status === 'done' ? (
                      <Check className="mt-[2px] h-3 w-3 shrink-0 opacity-70" />
                    ) : (
                      <Circle className="mt-[2px] h-3 w-3 shrink-0 opacity-30" />
                    )}
                    <span
                      className={`min-w-0 flex-1 truncate ${
                        task.status === 'done'
                          ? 'line-through opacity-45'
                          : 'opacity-85'
                      }`}
                    >
                      {task.title}
                    </span>
                    <span className="shrink-0 tabular-nums text-white/40">
                      {task.completedPomodoros}/{task.estimatedPomodoros}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-[11px] text-white/35">当天没有任务记录</p>
            )}

            {!day.isToday && unfinished.length > 0 && (
              <p className="mt-2 text-[11px] text-white/35">
                {unfinished.length} 项未完成，已顺延到次日
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
