import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ListTodo, Settings as SettingsIcon } from 'lucide-react';
import { SceneBackground } from './components/SceneBackground';
import { TimerRing } from './components/TimerRing';
import { TimerDisplay } from './components/TimerDisplay';
import { ControlBar } from './components/ControlBar';
import { SceneSwitcher } from './components/SceneSwitcher';
import { VolumeControl } from './components/VolumeControl';
import { SettingsDrawer } from './components/SettingsDrawer';
import { TaskPanel } from './components/TaskPanel';
import { StatsBar } from './components/StatsBar';
import { ActiveTaskBar } from './components/ActiveTaskBar';
import { BreathingGuide } from './components/BreathingGuide';
import { PhaseToast } from './components/PhaseToast';
import { DEFAULT_SCENE_INDEX, SCENES } from './data/scenes';
import { usePomodoro } from './hooks/usePomodoro';
import { useAudioEngine } from './hooks/useAudioEngine';
import { useTasks, type RolloverInfo } from './hooks/useTasks';
import { useFocusLog } from './hooks/useFocusLog';
import { usePrefersReducedMotion } from './hooks/usePrefersReducedMotion';
import { DEFAULT_SETTINGS } from './lib/defaults';
import { buildReview } from './lib/review';
import { STORAGE_KEYS, usePersistentState } from './lib/storage';
import { formatClock } from './lib/time';
import {
  notificationPermission,
  requestNotificationPermission,
  showNotification,
  type NotifyPermission,
} from './lib/notify';
import { PHASE_META, type Phase, type PomodoroSettings } from './types';

const OVERLAY_PNG =
  'https://soft-zoom-63098134.figma.site/_assets/v11/0b4a435b2df2747593c43d7a1c9b4578f7d8d90c.png';

const SANS = 'system-ui, sans-serif';
const PHASES: Phase[] = ['focus', 'shortBreak', 'longBreak'];

export default function App() {
  const [settings, setSettings] = usePersistentState<PomodoroSettings>(
    STORAGE_KEYS.settings,
    DEFAULT_SETTINGS,
  );
  const [sceneIndex, setSceneIndex] = usePersistentState<number>(
    STORAGE_KEYS.scene,
    DEFAULT_SCENE_INDEX,
  );

  const [isSettingsOpen, setSettingsOpen] = useState(false);
  const [isTasksOpen, setTasksOpen] = useState(false);
  const [isFocusMode, setFocusMode] = useState(false);
  const [toast, setToast] = useState<{ id: number; text: string } | null>(null);
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const [notifyPermission, setNotifyPermission] = useState<NotifyPermission>(
    () => notificationPermission(),
  );

  const audio = useAudioEngine();

  /** 跨天归档完成后的提示 */
  const handleRollover = useCallback((info: RolloverInfo) => {
    setToast({
      id: Date.now(),
      text:
        info.carried > 0
          ? `新的一天 · ${info.carried} 项任务已顺延`
          : '新的一天，开始吧',
    });
  }, []);

  const tasks = useTasks({ onRollover: handleRollover });
  const log = useFocusLog();
  const reducedMotion = usePrefersReducedMotion();

  /** 今日意图 + 归档 + 专注日志合成每日回顾 */
  const review = useMemo(
    () => buildReview(tasks.archive, log.log, tasks.tasks),
    [tasks.archive, log.log, tasks.tasks],
  );

  const activeIndex =
    ((sceneIndex % SCENES.length) + SCENES.length) % SCENES.length;
  const scene = SCENES[activeIndex];

  /** 当前阶段的总时长；阶段结束时回调里要用，用 ref 规避闭包顺序问题 */
  const totalMsRef = useRef(0);

  const handlePhaseComplete = useCallback(
    (finished: Phase, _next: Phase, credited: boolean) => {
      if (settings.chimeEnabled) {
        audio.chime(finished === 'focus' ? 'focusEnd' : 'breakEnd');
      }

      // 只有真正完成（非跳过）的专注才计入统计与任务进度
      if (finished === 'focus' && credited) {
        const minutes = Math.round(totalMsRef.current / 60000);
        log.addEntry(minutes, tasks.activeTaskId, scene.id);
        tasks.completePomodoro();
      }

      setToast({
        id: Date.now(),
        text: credited
          ? PHASE_META[finished].hint
          : `已跳过「${PHASE_META[finished].label}」`,
      });

      // 页面在后台时才发系统通知，前台有 toast 就够了
      if (settings.notificationsEnabled && document.visibilityState !== 'visible') {
        showNotification(
          finished === 'focus' ? '专注完成' : '休息结束',
          credited ? PHASE_META[finished].hint : '已跳过当前阶段',
        );
      }
    },
    [
      audio,
      log,
      tasks,
      scene.id,
      settings.chimeEnabled,
      settings.notificationsEnabled,
    ],
  );

  const pomodoro = usePomodoro(settings, handlePhaseComplete);
  totalMsRef.current = pomodoro.totalMs;

  // ---------- 音频与场景 / 设置同步 ----------
  useEffect(() => {
    audio.setScene(scene.layers);
  }, [audio, scene]);

  useEffect(() => {
    audio.setVolume(settings.volume);
  }, [audio, settings.volume]);

  useEffect(() => {
    audio.setMuted(settings.muted);
  }, [audio, settings.muted]);

  // ---------- 窗口标题倒计时 ----------
  useEffect(() => {
    document.title = `${formatClock(pomodoro.remainingMs)} · ${
      PHASE_META[pomodoro.phase].label
    } — Lumora`;
  }, [pomodoro.remainingMs, pomodoro.phase]);

  // ---------- 交互 ----------
  const unlockedRef = useRef(false);
  const unlockAudio = useCallback(() => {
    if (unlockedRef.current) return;
    unlockedRef.current = true;
    setAudioUnlocked(true);
    void audio.unlock();
  }, [audio]);

  const handleToggle = useCallback(() => {
    unlockAudio();
    audio.tick(pomodoro.status !== 'running');
    pomodoro.toggle();
  }, [unlockAudio, audio, pomodoro]);

  const handleSelectScene = useCallback(
    (index: number) => {
      unlockAudio();
      setSceneIndex(index);
    },
    [unlockAudio, setSceneIndex],
  );

  const handleToggleMute = useCallback(() => {
    setSettings((prev) =>
      prev.muted
        ? { ...prev, muted: false, volume: prev.volume > 0 ? prev.volume : 0.7 }
        : { ...prev, muted: true },
    );
  }, [setSettings]);

  const handleVolumeChange = useCallback(
    (volume: number) => {
      setSettings((prev) => ({
        ...prev,
        volume,
        muted: volume > 0 ? false : prev.muted,
      }));
    },
    [setSettings],
  );

  const openSettings = useCallback(() => setSettingsOpen(true), []);
  const closeSettings = useCallback(() => setSettingsOpen(false), []);
  const openTasks = useCallback(() => setTasksOpen(true), []);
  const closeTasks = useCallback(() => setTasksOpen(false), []);
  const dismissToast = useCallback(() => setToast(null), []);
  const handleSettingsChange = useCallback(
    (patch: Partial<PomodoroSettings>) =>
      setSettings((prev) => ({ ...prev, ...patch })),
    [setSettings],
  );

  const handleNotificationsChange = useCallback(
    async (enabled: boolean) => {
      if (!enabled) {
        setSettings((prev) => ({ ...prev, notificationsEnabled: false }));
        return;
      }
      const permission = await requestNotificationPermission();
      setNotifyPermission(permission);
      const granted = permission === 'granted';
      setSettings((prev) => ({ ...prev, notificationsEnabled: granted }));
      if (!granted) {
        setToast({ id: Date.now(), text: '浏览器未授权通知' });
      }
    },
    [setSettings],
  );

  // ---------- 专注模式 ----------
  const focusModeRef = useRef(false);

  const toggleFocusMode = useCallback(() => {
    const next = !focusModeRef.current;
    focusModeRef.current = next;
    setFocusMode(next);

    if (next) {
      const request = document.documentElement.requestFullscreen?.();
      if (request) void request.catch(() => undefined);
    } else if (document.fullscreenElement) {
      const exit = document.exitFullscreen?.();
      if (exit) void exit.catch(() => undefined);
    }
  }, []);

  // 用户按 Esc 退出浏览器全屏时，同步退出专注模式
  useEffect(() => {
    const onFullscreenChange = () => {
      if (!document.fullscreenElement && focusModeRef.current) {
        focusModeRef.current = false;
        setFocusMode(false);
      }
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () =>
      document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  // ---------- 键盘快捷键 ----------
  const shortcutRef = useRef<(event: KeyboardEvent) => void>(() => undefined);
  shortcutRef.current = (event: KeyboardEvent) => {
    const target = event.target as HTMLElement | null;
    if (
      target &&
      (target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable)
    ) {
      return;
    }

    // 抽屉内部保留原生行为（开关/按钮用空格激活），全局空格只服务计时器
    if (event.code === 'Space' && target?.closest('aside')) return;

    switch (event.code) {
      case 'Space':
        event.preventDefault();
        handleToggle();
        break;
      case 'KeyR':
        pomodoro.reset();
        break;
      case 'KeyS':
        pomodoro.skip();
        break;
      case 'KeyM':
        handleToggleMute();
        break;
      case 'KeyT':
        setTasksOpen((prev) => !prev);
        break;
      case 'KeyF':
        toggleFocusMode();
        break;
      case 'Escape':
        if (focusModeRef.current) {
          toggleFocusMode();
        } else {
          closeSettings();
          closeTasks();
        }
        break;
      default: {
        if (/^Digit[1-9]$/.test(event.code)) {
          const index = Number(event.code.slice(5)) - 1;
          if (index < SCENES.length) handleSelectScene(index);
        }
      }
    }
  };

  useEffect(() => {
    const listener = (event: KeyboardEvent) => shortcutRef.current(event);
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, []);

  // ---------- 渲染 ----------
  const breathing = !reducedMotion && pomodoro.phase !== 'focus' && pomodoro.status === 'running';
  const showChrome = !isFocusMode;

  return (
    <section className="relative h-screen w-full overflow-hidden bg-black">
      <SceneBackground scenes={SCENES} activeIndex={activeIndex} />

      <img
        src={OVERLAY_PNG}
        alt=""
        aria-hidden="true"
        className="train-bob pointer-events-none absolute inset-0 z-[1] h-full w-full object-cover"
      />

      <div
        className="relative z-[2] flex h-full flex-col"
        style={{
          color: scene.textColor,
          transitionProperty: 'color',
          transitionDuration: '700ms',
          transitionTimingFunction: 'ease-in-out',
        }}
      >
        {/* 顶栏 */}
        <header
          className={`flex items-center justify-between px-5 py-5 transition-opacity duration-500 sm:px-8 sm:py-6 md:px-10 ${
            showChrome ? 'opacity-100' : 'pointer-events-none opacity-0'
          }`}
        >
          <div className="flex items-baseline gap-3">
            <span
              className="text-xl italic sm:text-2xl"
              style={{ fontFamily: "'Instrument Serif', serif" }}
            >
              Lumora
            </span>
            <span
              className="hidden text-[10px] uppercase tracking-[0.28em] opacity-55 sm:inline"
              style={{ fontFamily: SANS }}
            >
              Focus
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={openTasks}
              aria-label="打开今日意图"
              title="今日意图 (T)"
              className="liquid-glass relative flex h-10 w-10 items-center justify-center rounded-full transition-opacity duration-300 hover:opacity-70"
            >
              <ListTodo className="h-4 w-4" />
              {tasks.remainingCount > 0 && (
                <span
                  className="absolute -right-1.5 -top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-white px-1 text-[10px] font-medium tabular-nums text-[#182C41]"
                  aria-hidden="true"
                >
                  {tasks.remainingCount}
                </span>
              )}
            </button>

            <VolumeControl
              volume={settings.volume}
              muted={settings.muted}
              onVolumeChange={handleVolumeChange}
              onToggleMute={handleToggleMute}
            />

            <button
              type="button"
              onClick={openSettings}
              aria-label="打开设置"
              className="liquid-glass flex h-10 w-10 items-center justify-center rounded-full transition-opacity duration-300 hover:opacity-70"
            >
              <SettingsIcon className="h-4 w-4" />
            </button>
          </div>
        </header>

        {/* 主区 */}
        <main className="flex flex-1 flex-col items-center justify-center px-5 pb-4 text-center sm:px-8">
          <div
            className={`transition-opacity duration-500 ${
              showChrome ? 'opacity-100' : 'pointer-events-none opacity-0'
            }`}
          >
            <div className="liquid-glass flex items-center gap-1 rounded-full p-1.5">
              {PHASES.map((phase) => {
                const isActive = pomodoro.phase === phase;
                return (
                  <button
                    key={phase}
                    type="button"
                    onClick={() => pomodoro.select(phase)}
                    aria-pressed={isActive}
                    className="rounded-full px-3 py-1.5 text-[11px] transition-colors duration-300 sm:px-4 sm:text-xs"
                    style={{
                      fontFamily: SANS,
                      background: isActive ? 'rgba(255,255,255,0.9)' : 'transparent',
                      color: isActive ? '#182C41' : 'inherit',
                      opacity: isActive ? 1 : 0.7,
                    }}
                  >
                    {PHASE_META[phase].label}
                  </button>
                );
              })}
            </div>

            <div
              className="mt-5 flex items-center justify-center gap-2"
              aria-label={`本轮已完成 ${pomodoro.completedFocus} 个番茄`}
            >
              {Array.from({ length: settings.longBreakInterval }).map((_, index) => (
                <span
                  key={index}
                  className="h-1.5 w-1.5 rounded-full transition-opacity duration-500"
                  style={{
                    background: 'currentColor',
                    opacity: index < pomodoro.completedFocus ? 0.9 : 0.25,
                  }}
                />
              ))}
            </div>
          </div>

          <div
            className={`mt-6 transition-transform duration-[1200ms] ease-in-out sm:mt-8 ${
              breathing ? 'breathe-478' : ''
            }`}
          >
            <TimerRing
              progress={pomodoro.progress}
              soft={pomodoro.phase !== 'focus'}
            >
              <div className="flex flex-col items-center">
                <div
                  data-testid="timer"
                  className="text-[3.6rem] leading-none sm:text-[5rem]"
                >
                  <TimerDisplay text={formatClock(pomodoro.remainingMs)} />
                </div>
                <p
                  data-testid="phase-status"
                  className="mt-4 text-[10px] uppercase tracking-[0.28em] opacity-60 sm:text-[11px]"
                  style={{ fontFamily: SANS }}
                >
                  {pomodoro.status === 'running'
                    ? PHASE_META[pomodoro.phase].label
                    : pomodoro.status === 'paused'
                      ? '已暂停'
                      : '准备开始'}
                </p>
                <BreathingGuide active={breathing} />
              </div>
            </TimerRing>
          </div>

          <ControlBar
            isRunning={pomodoro.status === 'running'}
            onToggle={handleToggle}
            onReset={pomodoro.reset}
            onSkip={pomodoro.skip}
          />

          {tasks.activeTask && (
            <ActiveTaskBar task={tasks.activeTask} onClick={openTasks} />
          )}

          <p
            className={`mt-6 hidden text-[11px] opacity-45 transition-opacity duration-500 sm:block ${
              showChrome ? '' : 'opacity-0'
            }`}
            style={{ fontFamily: SANS }}
          >
            Space 开始/暂停 · R 重置 · S 跳过 · 1–4 切换场景 · M 静音 · T 今日意图 · F 专注模式
          </p>
        </main>

        {/* 底栏：今日数据 + 场景 / 音景 */}
        <footer
          className={`flex flex-col items-center gap-4 px-5 pb-6 transition-opacity duration-500 sm:gap-5 sm:px-8 sm:pb-8 ${
            showChrome ? 'opacity-100' : 'pointer-events-none opacity-0'
          }`}
        >
          <StatsBar stats={log.stats} />
          <SceneSwitcher
            scenes={SCENES}
            activeIndex={activeIndex}
            audioReady={audioUnlocked}
            muted={settings.muted}
            onSelect={handleSelectScene}
          />
        </footer>

        {isFocusMode && (
          <p
            className="absolute bottom-4 left-1/2 -translate-x-1/2 text-[11px] opacity-25 transition-opacity duration-500 hover:opacity-60"
            style={{ fontFamily: SANS }}
          >
            按 F 退出专注模式
          </p>
        )}
      </div>

      <PhaseToast toast={toast} onDismiss={dismissToast} />

      <TaskPanel
        open={isTasksOpen}
        tasks={tasks.tasks}
        review={review}
        activeTaskId={tasks.activeTaskId}
        onClose={closeTasks}
        onAdd={tasks.addTask}
        onToggleDone={tasks.toggleDone}
        onRemove={tasks.removeTask}
        onSetActive={tasks.setActiveTask}
        onClearCompleted={tasks.clearCompleted}
      />

      <SettingsDrawer
        open={isSettingsOpen}
        settings={settings}
        notifyPermission={notifyPermission}
        onChange={handleSettingsChange}
        onNotificationsChange={handleNotificationsChange}
        onClose={closeSettings}
      />
    </section>
  );
}
