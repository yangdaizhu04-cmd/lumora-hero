import { Fragment, memo, useEffect, useRef, useState } from 'react';
import type {
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
} from 'react';
import {
  Check,
  Circle,
  GripVertical,
  Pencil,
  Plus,
  Target,
  Trash2,
  X,
} from 'lucide-react';
import { ReviewList } from './ReviewList';
import { LIMITS } from '../config';
import { formatTags, parseTags, taskTags } from '../lib/tags';
import { resolveMoveTarget } from '../lib/taskOrder';
import { clamp } from '../lib/time';
import { SANS } from '../lib/ui';
import type { Insight } from '../lib/insights';
import type { FocusLogEntry, ReviewEntry, Task } from '../types';

interface Props {
  open: boolean;
  tasks: Task[];
  review: ReviewEntry[];
  insights: Insight[];
  /** 热力图原始数据（按天聚合在组件内做） */
  log: FocusLogEntry[];
  /** 分钟级时钟，与统计保持同一时间基准 */
  now: number;
  activeTaskId: string | null;
  onClose: () => void;
  onAdd: (title: string, estimate: number) => void;
  /** 编辑标题 / 预估番茄数 / 标签 */
  onUpdate: (
    id: string,
    patch: { title?: string; estimatedPomodoros?: number; tags?: string[] },
  ) => void;
  /** 在同一分组内移动任务（未完成组内排序），toIndex 是组内索引 */
  onMove: (id: string, toIndex: number) => void;
  onToggleDone: (id: string) => void;
  onRemove: (id: string) => void;
  onSetActive: (id: string | null) => void;
  onClearCompleted: () => void;
}

type Tab = 'today' | 'review';

function TaskPanelComponent({
  open,
  tasks,
  review,
  insights,
  log,
  now,
  activeTaskId,
  onClose,
  onAdd,
  onUpdate,
  onMove,
  onToggleDone,
  onRemove,
  onSetActive,
  onClearCompleted,
}: Props) {
  const [tab, setTab] = useState<Tab>('today');
  const [title, setTitle] = useState('');
  const [estimate, setEstimate] = useState(1);
  const inputRef = useRef<HTMLInputElement>(null);

  // ---------- 行内编辑 ----------
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftEstimate, setDraftEstimate] = useState(1);
  /** 标签在输入框里以文本形态存在，提交时才解析成数组 */
  const [draftTags, setDraftTags] = useState('');

  // ---------- 拖拽排序 ----------
  const [dragId, setDragId] = useState<string | null>(null);
  /** 插入位置（0..openTasks.length），null 表示没在拖 */
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const itemRefs = useRef(new Map<string, HTMLDivElement>());

  // Esc 由 App 的全局快捷键统一处理（此前面板内也监听一次，同一次按键会被处理两遍）
  useEffect(() => {
    if (!open) return;
    const focusTimer = window.setTimeout(() => {
      if (tab === 'today') inputRef.current?.focus();
    }, 300);
    return () => window.clearTimeout(focusTimer);
  }, [open, tab]);

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

  // ---------- 行内编辑 ----------
  const startEdit = (task: Task) => {
    setEditingId(task.id);
    setDraftTitle(task.title);
    setDraftEstimate(task.estimatedPomodoros);
    setDraftTags(formatTags(task.tags));
  };

  const commitEdit = () => {
    if (editingId === null) return;
    const trimmed = draftTitle.trim();
    // 空标题直接放弃这次修改，而不是把任务变成一行点不到的空白
    if (trimmed) {
      onUpdate(editingId, {
        title: trimmed,
        estimatedPomodoros: draftEstimate,
        // 清空输入框 = 清空标签，所以这里照常传空数组
        tags: parseTags(draftTags),
      });
    }
    setEditingId(null);
  };

  // ---------- 拖拽排序 ----------
  /**
   * 指针的 Y 落在第几个间隙 → 插入位置（0..openTasks.length）。
   * 用 DOM 实测的矩形而不是"固定行高 × 序号"：标题折行、字号变化、
   * 浏览器缩放都会让行高不等于预设值（见 开发踩坑点.md 记录 18）。
   */
  const resolveDropIndex = (clientY: number): number => {
    for (let index = 0; index < openTasks.length; index += 1) {
      const node = itemRefs.current.get(openTasks[index].id);
      if (!node) continue;
      const rect = node.getBoundingClientRect();
      if (clientY < rect.top + rect.height / 2) return index;
    }
    return openTasks.length;
  };

  const handleDragStart = (event: ReactPointerEvent<HTMLButtonElement>, id: string) => {
    event.preventDefault();
    // 捕获指针：拖到列表外面（甚至面板外面）也能继续收到 move / up
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragId(id);
    setDropIndex(openTasks.findIndex((task) => task.id === id));
  };

  const handleDragMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (dragId === null) return;
    const next = resolveDropIndex(event.clientY);
    // 只在真正变化时才更新：拖动期间 pointermove 每秒触发几十次，
    // 每次都 setState 会让这三百多行 JSX 跟着重渲染（见 开发踩坑点.md 记录 15）
    setDropIndex((prev) => (prev === next ? prev : next));
  };

  const handleDragEnd = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (dragId === null) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    const from = openTasks.findIndex((task) => task.id === dragId);
    const insertAt = dropIndex;
    setDragId(null);
    setDropIndex(null);
    if (from < 0 || insertAt === null) return;

    const target = resolveMoveTarget(from, insertAt);
    if (target !== from) onMove(dragId, target);
  };

  /**
   * 手柄上的上下方向键。
   * 拖动是指针操作，键盘用户到不了 —— 这是等价的替代路径，
   * 也是这个手柄要写成 <button> 而不是 <span> 的原因。
   */
  const handleHandleKey = (
    event: ReactKeyboardEvent<HTMLButtonElement>,
    task: Task,
    index: number,
  ) => {
    if (event.key === 'ArrowUp' && index > 0) {
      event.preventDefault();
      onMove(task.id, index - 1);
    } else if (event.key === 'ArrowDown' && index < openTasks.length - 1) {
      event.preventDefault();
      onMove(task.id, index + 1);
    }
  };

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
        role="dialog"
        aria-modal="true"
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
                <>
                  {ordered.map((task) => {
                    const isActive = task.id === activeTaskId && !task.done;
                    const isEditing = editingId === task.id;
                    // 组内索引只在未完成组里有意义（排序只支持未完成组）
                    const groupIndex = task.done
                      ? -1
                      : openTasks.findIndex((item) => item.id === task.id);

                    return (
                      <Fragment key={task.id}>
                        {/* 拖拽中：在当前插入位置画一条线 */}
                        {dragId !== null && dropIndex === groupIndex && (
                          <div
                            className="mx-3 h-[2px] rounded-full bg-white/45"
                            aria-hidden="true"
                          />
                        )}

                        <div
                          ref={(node) => {
                            if (node) itemRefs.current.set(task.id, node);
                            else itemRefs.current.delete(task.id);
                          }}
                          className={`group flex items-start gap-3 rounded-2xl px-3 py-3 transition-colors duration-300 ${
                            isActive ? 'bg-white/10' : 'hover:bg-white/[0.06]'
                          } ${dragId === task.id ? 'opacity-40' : ''}`}
                        >
                          {isEditing ? (
                            <div className="min-w-0 flex-1 space-y-2">
                              <input
                                autoFocus
                                value={draftTitle}
                                onChange={(event) => setDraftTitle(event.target.value)}
                                onKeyDown={(event) => {
                                  if (event.key === 'Enter') {
                                    event.preventDefault();
                                    commitEdit();
                                  } else if (event.key === 'Escape') {
                                    // 只取消编辑：全局快捷键遇到 INPUT 会直接 return，
                                    // 所以这里不会连带把面板一起关掉
                                    event.preventDefault();
                                    setEditingId(null);
                                  }
                                }}
                                aria-label="编辑任务内容"
                                className="liquid-glass w-full rounded-full px-3 py-2 text-sm"
                                style={{ color: 'inherit' }}
                              />
                              <input
                                value={draftTags}
                                onChange={(event) => setDraftTags(event.target.value)}
                                placeholder="标签（空格或逗号分隔，可留空）"
                                aria-label="任务标签"
                                className="liquid-glass w-full rounded-full px-3 py-2 text-[12px]"
                                style={{ color: 'inherit' }}
                              />
                              <div className="flex items-center justify-between gap-2">
                                <span className="flex items-center gap-2 text-[11px] text-white/50">
                                  预估
                                  <button
                                    type="button"
                                    aria-label="减少预估番茄数"
                                    onClick={() =>
                                      setDraftEstimate((prev) =>
                                        clamp(prev - 1, 1, LIMITS.taskEstimate),
                                      )
                                    }
                                    className="liquid-glass flex h-6 w-6 items-center justify-center rounded-full leading-none"
                                  >
                                    −
                                  </button>
                                  <span className="w-5 text-center tabular-nums text-white/80">
                                    {draftEstimate}
                                  </span>
                                  <button
                                    type="button"
                                    aria-label="增加预估番茄数"
                                    onClick={() =>
                                      setDraftEstimate((prev) =>
                                        clamp(prev + 1, 1, LIMITS.taskEstimate),
                                      )
                                    }
                                    className="liquid-glass flex h-6 w-6 items-center justify-center rounded-full leading-none"
                                  >
                                    +
                                  </button>
                                </span>
                                <span className="flex items-center gap-2 text-[11px]">
                                  <button
                                    type="button"
                                    onClick={() => setEditingId(null)}
                                    className="rounded-full px-2 py-1 text-white/55 transition-opacity hover:opacity-80"
                                  >
                                    取消
                                  </button>
                                  <button
                                    type="button"
                                    onClick={commitEdit}
                                    className="rounded-full bg-white/90 px-3 py-1 text-[#182C41] transition-transform hover:scale-[1.03]"
                                  >
                                    保存
                                  </button>
                                </span>
                              </div>
                            </div>
                          ) : (
                            <>
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
                                    {task.completedPomodoros}/{task.estimatedPomodoros}{' '}
                                    番茄
                                  </span>
                                  {taskTags(task.tags).length > 0 && (
                                    <span className="min-w-0 truncate text-white/35">
                                      {taskTags(task.tags)
                                        .map((tag) => `#${tag}`)
                                        .join(' ')}
                                    </span>
                                  )}
                                  {isActive && (
                                    <span className="flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-white/80">
                                      <Target className="h-3 w-3" />
                                      进行中
                                    </span>
                                  )}
                                </div>
                              </button>

                              {/* 排序手柄：只有未完成的任务有（已完成组是一段历史，排它没意义） */}
                              {!task.done && (
                                <button
                                  type="button"
                                  onPointerDown={(event) =>
                                    handleDragStart(event, task.id)
                                  }
                                  onPointerMove={handleDragMove}
                                  onPointerUp={handleDragEnd}
                                  onPointerCancel={handleDragEnd}
                                  onKeyDown={(event) =>
                                    handleHandleKey(event, task, groupIndex)
                                  }
                                  aria-label={`调整顺序：${task.title}（可拖动，也可用上下方向键）`}
                                  className="mt-0.5 shrink-0 cursor-grab opacity-25 transition-opacity duration-300 hover:opacity-70 group-hover:opacity-50"
                                  // 触屏上必须交给我们处理：否则按住手柄会被浏览器当成滚动列表
                                  style={{ touchAction: 'none' }}
                                >
                                  <GripVertical className="h-3.5 w-3.5" />
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => startEdit(task)}
                                aria-label={`编辑任务：${task.title}`}
                                className="mt-0.5 shrink-0 opacity-0 transition-opacity duration-300 hover:opacity-80 focus-visible:opacity-80 group-hover:opacity-50"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>

                              <button
                                type="button"
                                onClick={() => onRemove(task.id)}
                                aria-label={`删除任务：${task.title}`}
                                className="mt-0.5 shrink-0 opacity-0 transition-opacity duration-300 hover:opacity-80 focus-visible:opacity-80 group-hover:opacity-50"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </Fragment>
                    );
                  })}

                  {/* 拖到列表末尾时，最后一条指示线 */}
                  {dragId !== null && dropIndex === openTasks.length && (
                    <div
                      className="mx-3 h-[2px] rounded-full bg-white/45"
                      aria-hidden="true"
                    />
                  )}
                </>
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
            <ReviewList
              review={review}
              insights={insights}
              log={log}
              now={now}
              openTasks={tasks}
            />
          </div>
        )}
      </aside>
    </>
  );
}

/**
 * 抽屉常驻挂载（靠 visibility 隐藏），如果不做 memo，
 * 计时器每秒的状态更新都会把这里三百多行 JSX 重新求值一次。
 */
export const TaskPanel = memo(TaskPanelComponent);
