import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActiveTaskBar } from './components/ActiveTaskBar';
import { BreathingGuide } from './components/BreathingGuide';
import { ControlBar } from './components/ControlBar';
import { PhaseTabs } from './components/PhaseTabs';
import { PhaseToast } from './components/PhaseToast';
import { RitualOverlay } from './components/RitualOverlay';
import { SceneBackground } from './components/SceneBackground';
import { SceneSwitcher } from './components/SceneSwitcher';
import { SettingsDrawer } from './components/SettingsDrawer';
import { StatsBar } from './components/StatsBar';
import { TaskPanel } from './components/TaskPanel';
import { TimerDisplay } from './components/TimerDisplay';
import { TimerRing } from './components/TimerRing';
import { TopBar } from './components/TopBar';
import { AUDIO, UX } from './config';
import { PHASE_META } from './data/phases';
import {
  DEFAULT_SCENE_INDEX,
  SCENES,
  sceneForPhase,
  sceneIndexById,
} from './data/scenes';
import { useAttention } from './hooks/useAttention';
import { useAudioEngine } from './hooks/useAudioEngine';
import { useClockTick } from './hooks/useClockTick';
import { useFocusLog } from './hooks/useFocusLog';
import { useMediaSession } from './hooks/useMediaSession';
import { usePomodoro } from './hooks/usePomodoro';
import { usePrefersReducedMotion } from './hooks/usePrefersReducedMotion';
import { useRitual } from './hooks/useRitual';
import { useTasks, type RolloverInfo } from './hooks/useTasks';
import { downloadBackup, importBackup } from './lib/backup';
import { DEFAULT_SETTINGS } from './lib/defaults';
import {
  describeDeviceState,
  detectLowPower,
  detectSaveData,
} from './lib/device';
import { buildInsights } from './lib/insights';
import {
  notificationPermission,
  requestNotificationPermission,
  showNotification,
  type NotifyPermission,
} from './lib/notify';
import {
  buildShareUrl,
  clearPresetFromLocation,
  encodePreset,
  readPresetFromLocation,
  type SoundPreset,
} from './lib/preset';
import { buildReview } from './lib/review';
import type { RestoredPhase } from './lib/session';
import { STORAGE_KEYS, usePersistentState } from './lib/storage';
import { formatClock, isNightTime } from './lib/time';
import type {
  FocusLogEntry,
  Phase,
  PomodoroSettings,
  Scene,
} from './types';

/** 浮层图已镜像到本地：原图 1.9MB PNG → 195KB WebP，且不再依赖 Figma 临时域名 */
const OVERLAY_IMAGE = '/overlay.webp';
const SANS = 'system-ui, sans-serif';

export default function App() {
  // 仅开发环境：渲染计数。用来验证"计时状态只在显示的秒数变化时更新"
  // 这条性能约束没有被后续改动破坏（生产构建会被 tree-shake 掉）。
  if (import.meta.env.DEV) {
    const counter = window as unknown as { __lumoraRenders?: number };
    counter.__lumoraRenders = (counter.__lumoraRenders ?? 0) + 1;
  }

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
  const [sleepUntil, setSleepUntil] = useState<number | null>(null);
  const [autoLowPower, setAutoLowPower] = useState(false);

  const audio = useAudioEngine();

  const activeIndex =
    ((sceneIndex % SCENES.length) + SCENES.length) % SCENES.length;
  const scene = SCENES[activeIndex];

  // ---------- 时间 / 设备 ----------
  const clockTick = useClockTick(30_000);
  const night =
    settings.nightModeEnabled &&
    isNightTime(settings.nightStartHour, new Date(clockTick));

  const saveData = useMemo(() => detectSaveData(), []);
  const lowPower = settings.lowPowerMode || autoLowPower || saveData;
  const deviceHint = describeDeviceState({
    lowPower: settings.lowPowerMode || autoLowPower,
    saveData,
  });

  useEffect(() => {
    let cancelled = false;
    void detectLowPower().then((detected) => {
      if (!cancelled) setAutoLowPower(detected);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * 供回调读取"最新值"的单一 ref。
   * 有了它，阶段完成回调就不必把 log / tasks / scene 这些每次都变的引用塞进依赖数组，
   * 也就不会出现闭包读到旧值的问题。
   */
  const latest = useRef({
    log: [] as FocusLogEntry[],
    activeTaskId: null as string | null,
    scene: SCENES[DEFAULT_SCENE_INDEX] as Scene,
    night: false,
    attention: 0,
    totalMs: 0,
    settings: DEFAULT_SETTINGS,
  });

  /** 待播放的声化日报（音频未解锁时先存着） */
  const motifRef = useRef<number | null>(null);

  const handleRollover = useCallback((info: RolloverInfo) => {
    setToast({
      id: Date.now(),
      text:
        info.carried > 0
          ? `新的一天 · ${info.carried} 项任务已顺延`
          : '新的一天，开始吧',
    });

    // 声化日报：把昨天的成果变成一小段音阶，等音频解锁后播放
    const yesterday = latest.current.log.filter(
      (entry) => entry.date === info.endedDay,
    ).length;
    if (yesterday > 0) motifRef.current = yesterday;
  }, []);

  const tasks = useTasks({ onRollover: handleRollover });
  const log = useFocusLog();
  const reducedMotion = usePrefersReducedMotion();

  // ---------- 阶段完成 ----------
  const handlePhaseComplete = useCallback(
    (finished: Phase, _next: Phase, credited: boolean) => {
      const current = latest.current;
      const isFocus = finished === 'focus';

      if (current.settings.chimeEnabled && !current.night) {
        audio.chime(isFocus ? 'focusEnd' : 'breakEnd');
      }

      // 只有真正完成（非跳过）的专注才计入统计与任务进度
      if (isFocus && credited) {
        const minutes = Math.round(current.totalMs / 60_000);
        log.addEntry(
          minutes,
          current.activeTaskId,
          current.scene.id,
          current.attention,
        );
        tasks.completePomodoro();
      }

      const interruptions = current.attention;
      setToast({
        id: Date.now(),
        text: credited
          ? isFocus && interruptions > 0
            ? `${PHASE_META[finished].hint} · 期间离开 ${interruptions} 次`
            : PHASE_META[finished].hint
          : `已跳过「${PHASE_META[finished].label}」`,
      });

      // 页面在后台时才发系统通知，前台有 toast 就够了
      if (
        current.settings.notificationsEnabled &&
        document.visibilityState !== 'visible'
      ) {
        showNotification(
          isFocus ? '专注完成' : '休息结束',
          credited ? PHASE_META[finished].hint : '已跳过当前阶段',
        );
      }
    },
    [audio, log, tasks],
  );

  /** 刷新/关闭期间恰好完成的专注：补记成绩（时长以恢复结果为准） */
  const handleSessionRestored = useCallback(
    (restored: RestoredPhase) => {
      const current = latest.current;
      log.addEntry(restored.minutes, current.activeTaskId, current.scene.id);
      setToast({ id: Date.now(), text: '上一段专注已在你离开时完成' });
    },
    [log],
  );

  const pomodoro = usePomodoro(settings, handlePhaseComplete, {
    onSessionRestored: handleSessionRestored,
  });

  /** 分心自察：只在专注真正运行时统计 */
  const attention = useAttention(
    pomodoro.phase === 'focus' && pomodoro.status === 'running',
  );

  // 每次渲染同步"最新值"（refs 是给回调读的，不会触发重渲染）
  latest.current = {
    log: log.log,
    activeTaskId: tasks.activeTaskId,
    scene,
    night,
    attention: attention.count,
    totalMs: pomodoro.totalMs,
    settings,
  };

  const review = useMemo(
    () => buildReview(tasks.archive, log.log, tasks.tasks),
    [tasks.archive, log.log, tasks.tasks],
  );
  const insights = useMemo(() => buildInsights(log.log), [log.log]);

  // ---------- 准备倒计时 ----------
  const ritual = useRitual(
    useCallback(() => {
      pomodoro.start();
    }, [pomodoro.start]),
  );

  // ---------- 交互 ----------
  const unlockedRef = useRef(false);
  const unlockAudio = useCallback(() => {
    if (unlockedRef.current) return;
    unlockedRef.current = true;
    setAudioUnlocked(true);
    void audio.unlock().then(() => {
      const pending = motifRef.current;
      if (pending === null) return;
      motifRef.current = null;
      window.setTimeout(() => audio.playMotif(pending), 700);
    });
  }, [audio]);

  /** 任何主动操作都视为"我还醒着"：取消睡眠定时并恢复播放 */
  const wake = useCallback(() => {
    audio.cancelSleep();
    setSleepUntil(null);
  }, [audio]);

  const handleToggle = useCallback(() => {
    unlockAudio();
    wake();

    if (ritual.isActive) {
      ritual.cancel();
      return;
    }

    if (pomodoro.status === 'running') {
      audio.tick(false);
      pomodoro.pause();
      return;
    }

    audio.tick(true);
    if (
      pomodoro.status === 'idle' &&
      pomodoro.phase === 'focus' &&
      settings.ritualEnabled
    ) {
      ritual.start(UX.ritualSeconds);
      return;
    }
    pomodoro.start();
  }, [
    unlockAudio,
    wake,
    audio,
    ritual.isActive,
    ritual.cancel,
    ritual.start,
    pomodoro.status,
    pomodoro.phase,
    pomodoro.pause,
    pomodoro.start,
    settings.ritualEnabled,
  ]);

  const handleSelectScene = useCallback(
    (index: number) => {
      unlockAudio();
      wake();
      setSceneIndex(index);
    },
    [unlockAudio, wake, setSceneIndex],
  );

  const handleSelectPhase = useCallback(
    (phase: Phase) => {
      wake();
      pomodoro.select(phase);
    },
    [wake, pomodoro.select],
  );

  const handleToggleMute = useCallback(() => {
    wake();
    setSettings((prev) =>
      prev.muted
        ? { ...prev, muted: false, volume: prev.volume > 0 ? prev.volume : 0.7 }
        : { ...prev, muted: true },
    );
  }, [wake, setSettings]);

  const handleVolumeChange = useCallback(
    (volume: number) => {
      wake();
      setSettings((prev) => ({
        ...prev,
        volume,
        muted: volume > 0 ? false : prev.muted,
      }));
    },
    [wake, setSettings],
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

  // ---------- 睡眠定时 ----------
  const handleStartSleep = useCallback(
    (minutes: number) => {
      unlockAudio();
      audio.startSleepFade(minutes * 60);
      setSleepUntil(Date.now() + minutes * 60 * 1000);
      setSettingsOpen(false);
      setToast({ id: Date.now(), text: `${minutes} 分钟后环境音淡出` });
    },
    [audio, unlockAudio],
  );

  const handleCancelSleep = useCallback(() => {
    audio.cancelSleep();
    setSleepUntil(null);
  }, [audio]);

  useEffect(() => {
    if (sleepUntil !== null && sleepUntil <= clockTick) setSleepUntil(null);
  }, [clockTick, sleepUntil]);

  // ---------- 数据 ----------
  const handleExport = useCallback(() => {
    downloadBackup();
    setToast({ id: Date.now(), text: '备份已导出' });
  }, []);

  const handleImport = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = importBackup(String(reader.result ?? ''));
      setToast({ id: Date.now(), text: result.message });
      if (result.ok) {
        window.setTimeout(() => window.location.reload(), 900);
      }
    };
    reader.onerror = () => setToast({ id: Date.now(), text: '读取文件失败' });
    reader.readAsText(file);
  }, []);

  const handleShare = useCallback(async () => {
    const current = latest.current;
    const preset: SoundPreset = {
      scene: current.scene.id,
      volume: Math.round(current.settings.volume * 100),
      nightMode: current.settings.nightModeEnabled,
      autoScene: current.settings.autoScene,
      adaptiveSound: current.settings.adaptiveSound,
      spatialSound: current.settings.spatialSound,
    };

    try {
      await navigator.clipboard.writeText(buildShareUrl(preset));
      setToast({ id: Date.now(), text: '分享链接已复制' });
    } catch {
      // 剪贴板不可用时退化为"把链接放到地址栏"
      window.history.replaceState(null, '', encodePreset(preset));
      setToast({ id: Date.now(), text: '链接已放到地址栏，可手动复制' });
    }
  }, []);

  // ---------- 音频同步 ----------
  useEffect(() => {
    audio.setRegistry(SCENES.flatMap((item) => item.layers));
  }, [audio]);

  useEffect(() => {
    audio.setScene(scene.layers);
  }, [audio, scene]);

  useEffect(() => {
    audio.setPadRoot(scene.padRootHz);
  }, [audio, scene]);

  useEffect(() => {
    audio.setVolume(settings.volume);
  }, [audio, settings.volume]);

  useEffect(() => {
    audio.setMuted(settings.muted);
  }, [audio, settings.muted]);

  useEffect(() => {
    audio.setSpatial(settings.spatialSound);
  }, [audio, settings.spatialSound]);

  // 自适应音景：pad 随专注进度缓慢渐入；环境音同时轻微收敛
  const padRatioRef = useRef(-1);
  useEffect(() => {
    const progress =
      pomodoro.phase === 'focus' && pomodoro.status !== 'idle'
        ? pomodoro.progress
        : 0;

    let target = 0;
    if (settings.adaptiveSound) {
      target =
        pomodoro.phase === 'focus'
          ? progress * AUDIO.padFocusRamp
          : pomodoro.status === 'running'
            ? 0.05
            : 0;
    }

    const changed = Math.abs(target - padRatioRef.current) >= 0.02;
    if (!changed) return;
    padRatioRef.current = target;
    audio.setPadLevel(target, 5);
  }, [
    audio,
    settings.adaptiveSound,
    pomodoro.phase,
    pomodoro.status,
    pomodoro.progress,
  ]);

  useEffect(() => {
    scene.layers.forEach((layer) => {
      const factor =
        settings.adaptiveSound && pomodoro.phase === 'focus'
          ? 1 - (1 - AUDIO.adaptiveDip) * pomodoro.progress
          : 1;
      audio.setAdaptive(layer.src, factor);
    });
  }, [audio, scene, settings.adaptiveSound, pomodoro.phase, pomodoro.progress]);

  // ---------- 自动场景编排 ----------
  useEffect(() => {
    if (!settings.autoScene) return;
    const index = sceneIndexById(sceneForPhase(pomodoro.phase, night));
    setSceneIndex((prev) => (prev === index ? prev : index));
  }, [settings.autoScene, pomodoro.phase, night, setSceneIndex]);

  // ---------- 分心自察 ----------
  // 只在"进入一个全新的专注阶段"时清零；暂停后继续不应该丢掉计数
  const lastAttentionPhaseRef = useRef<Phase | null>(null);
  useEffect(() => {
    if (pomodoro.phase === 'focus' && lastAttentionPhaseRef.current !== 'focus') {
      attention.reset();
    }
    lastAttentionPhaseRef.current = pomodoro.phase;
  }, [pomodoro.phase, attention.reset]);

  // ---------- 窗口标题 ----------
  useEffect(() => {
    document.title = `${formatClock(pomodoro.remainingMs)} · ${
      PHASE_META[pomodoro.phase].label
    } — Lumora`;
  }, [pomodoro.remainingMs, pomodoro.phase]);

  // ---------- 系统媒体控制（耳机按键 / 锁屏） ----------
  const mediaPlay = useCallback(() => {
    unlockAudio();
    pomodoro.start();
  }, [unlockAudio, pomodoro.start]);
  const mediaPause = useCallback(() => pomodoro.pause(), [pomodoro.pause]);
  const mediaStop = useCallback(() => pomodoro.reset(), [pomodoro.reset]);
  const mediaNext = useCallback(() => pomodoro.skip(), [pomodoro.skip]);

  useMediaSession({
    title: `${formatClock(pomodoro.remainingMs)} · ${PHASE_META[pomodoro.phase].label}`,
    artist:
      pomodoro.status === 'running'
        ? '专注中'
        : pomodoro.status === 'paused'
          ? '已暂停'
          : '准备开始',
    album: scene.label,
    isPlaying: pomodoro.status === 'running',
    durationMs: pomodoro.totalMs,
    positionMs: pomodoro.totalMs - pomodoro.remainingMs,
    onPlay: mediaPlay,
    onPause: mediaPause,
    onStop: mediaStop,
    onNext: mediaNext,
  });

  // ---------- 应用图标角标（安装为 PWA 后可见） ----------
  useEffect(() => {
    const nav = navigator as unknown as {
      setAppBadge?: (value?: number) => Promise<void>;
      clearAppBadge?: () => Promise<void>;
    };
    if (!nav.setAppBadge) return;
    if (tasks.remainingCount > 0) {
      void nav.setAppBadge(tasks.remainingCount).catch(() => undefined);
    } else {
      void nav.clearAppBadge?.().catch(() => undefined);
    }
  }, [tasks.remainingCount]);

  // ---------- 分享链接 ----------
  const presetAppliedRef = useRef(false);
  useEffect(() => {
    if (presetAppliedRef.current) return;
    presetAppliedRef.current = true;

    const preset = readPresetFromLocation();
    if (!preset) return;

    setSettings((prev) => ({
      ...prev,
      volume: preset.volume / 100,
      muted: preset.volume > 0 ? false : prev.muted,
      nightModeEnabled: preset.nightMode,
      autoScene: preset.autoScene,
      adaptiveSound: preset.adaptiveSound,
      spatialSound: preset.spatialSound,
    }));
    setSceneIndex(sceneIndexById(preset.scene));
    clearPresetFromLocation();
    setToast({ id: Date.now(), text: '已应用分享的音景配方' });
  }, [setSettings, setSceneIndex]);

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
  const breathing =
    !reducedMotion &&
    pomodoro.phase !== 'focus' &&
    pomodoro.status === 'running';
  const showChrome = !isFocusMode;

  const statusText = ritual.isActive
    ? '准备中'
    : pomodoro.status === 'running'
      ? PHASE_META[pomodoro.phase].label
      : pomodoro.status === 'paused'
        ? '已暂停'
        : '准备开始';

  return (
    <section className="relative h-screen w-full overflow-hidden bg-black">
      <SceneBackground
        scenes={SCENES}
        activeIndex={activeIndex}
        mode={lowPower ? 'still' : 'video'}
      />

      <img
        src={OVERLAY_IMAGE}
        alt=""
        aria-hidden="true"
        decoding="async"
        className="train-bob pointer-events-none absolute inset-0 z-[1] h-full w-full object-cover"
      />

      {/* 夜间模式：只压暗画面，不用 filter（filter 会影响 fixed 定位的抽屉） */}
      <div
        className="pointer-events-none absolute inset-0 z-[1] transition-opacity duration-1000"
        style={{ background: 'rgba(6,10,14,0.34)', opacity: night ? 1 : 0 }}
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
        <div
          className={`transition-opacity duration-500 ${
            showChrome ? 'opacity-100' : 'pointer-events-none opacity-0'
          }`}
        >
          <TopBar
            remainingTasks={tasks.remainingCount}
            volume={settings.volume}
            muted={settings.muted}
            onOpenTasks={openTasks}
            onVolumeChange={handleVolumeChange}
            onToggleMute={handleToggleMute}
            onOpenSettings={openSettings}
          />
        </div>

        <main className="flex flex-1 flex-col items-center justify-center px-5 pb-4 text-center sm:px-8">
          <div
            className={`transition-opacity duration-500 ${
              showChrome ? 'opacity-100' : 'pointer-events-none opacity-0'
            }`}
          >
            <PhaseTabs
              phase={pomodoro.phase}
              completedFocus={pomodoro.completedFocus}
              longBreakInterval={settings.longBreakInterval}
              onSelect={handleSelectPhase}
            />
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
                  {statusText}
                </p>
                <BreathingGuide active={breathing} />
              </div>
            </TimerRing>
          </div>

          <ControlBar
            isRunning={pomodoro.status === 'running'}
            isPreparing={ritual.isActive}
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
            Space 开始/暂停 · R 重置 · S 跳过 · 1–4 切换场景 · M 静音 · T
            今日意图 · F 专注模式
          </p>
        </main>

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

      <RitualOverlay count={ritual.count} />
      <PhaseToast toast={toast} onDismiss={dismissToast} />

      <TaskPanel
        open={isTasksOpen}
        tasks={tasks.tasks}
        review={review}
        insights={insights}
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
        deviceHint={deviceHint}
        sleepRemainingMs={sleepUntil ? Math.max(0, sleepUntil - clockTick) : 0}
        onChange={handleSettingsChange}
        onNotificationsChange={handleNotificationsChange}
        onStartSleep={handleStartSleep}
        onCancelSleep={handleCancelSleep}
        onExport={handleExport}
        onImport={handleImport}
        onShare={handleShare}
        onClose={closeSettings}
      />
    </section>
  );
}
