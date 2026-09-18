import { useEffect } from 'react';
import { X } from 'lucide-react';
import { clamp } from '../lib/time';
import { DEFAULT_SETTINGS } from '../lib/defaults';
import type { NotifyPermission } from '../lib/notify';
import type { PomodoroSettings } from '../types';

interface Props {
  open: boolean;
  settings: PomodoroSettings;
  notifyPermission: NotifyPermission;
  onChange: (patch: Partial<PomodoroSettings>) => void;
  onNotificationsChange: (enabled: boolean) => void;
  onClose: () => void;
}

const SANS = 'system-ui, sans-serif';

export function SettingsDrawer({
  open,
  settings,
  notifyPermission,
  onChange,
  onNotificationsChange,
  onClose,
}: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const notifyDisabled = notifyPermission === 'unsupported' || notifyPermission === 'denied';

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
        className={`fixed right-0 top-0 z-[90] flex h-full w-full max-w-full flex-col bg-[#0d1620]/70 backdrop-blur-2xl sm:max-w-[380px] ${
          open ? 'translate-x-0' : 'translate-x-full'
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
        aria-label="设置"
      >
        <div className="flex items-center justify-between px-6 py-6">
          <h2 className="text-base font-medium">设置</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭设置"
            className="liquid-glass flex h-9 w-9 items-center justify-center rounded-full"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-8">
          <Stepper
            label="专注时长"
            value={settings.focusMinutes}
            min={5}
            max={120}
            step={5}
            unit="分钟"
            onChange={(value) => onChange({ focusMinutes: value })}
          />
          <Stepper
            label="短休时长"
            value={settings.shortBreakMinutes}
            min={1}
            max={30}
            step={1}
            unit="分钟"
            onChange={(value) => onChange({ shortBreakMinutes: value })}
          />
          <Stepper
            label="长休时长"
            value={settings.longBreakMinutes}
            min={5}
            max={60}
            step={5}
            unit="分钟"
            onChange={(value) => onChange({ longBreakMinutes: value })}
          />
          <Stepper
            label="长休间隔"
            value={settings.longBreakInterval}
            min={2}
            max={8}
            step={1}
            unit="个番茄"
            onChange={(value) => onChange({ longBreakInterval: value })}
          />

          <div className="mt-2 border-t border-white/10 pt-2">
            <Row label="自动开始下一段">
              <Toggle
                checked={settings.autoStartNext}
                onChange={(checked) => onChange({ autoStartNext: checked })}
                label="自动开始下一段"
              />
            </Row>

            <Row label="阶段结束提示音">
              <Toggle
                checked={settings.chimeEnabled}
                onChange={(checked) => onChange({ chimeEnabled: checked })}
                label="阶段结束提示音"
              />
            </Row>

            <Row
              label="系统通知"
              hint={
                notifyPermission === 'unsupported'
                  ? '当前浏览器不支持'
                  : notifyPermission === 'denied'
                    ? '已被浏览器拒绝，需在地址栏权限里手动允许'
                    : '切到别的窗口时也能收到提醒'
              }
            >
              <Toggle
                checked={settings.notificationsEnabled}
                disabled={notifyDisabled}
                onChange={onNotificationsChange}
                label="系统通知"
              />
            </Row>
          </div>

          <button
            type="button"
            onClick={() => onChange({ ...DEFAULT_SETTINGS })}
            className="liquid-glass mt-6 w-full rounded-full py-3 text-sm"
          >
            恢复默认设置
          </button>

          <p className="mt-6 text-xs leading-relaxed text-white/45">
            快捷键：Space 开始/暂停 · R 重置 · S 跳过 · 1–4 切换场景 · M 静音 · T 今日意图 ·
            F 专注模式
          </p>
        </div>
      </aside>
    </>
  );
}

function Row({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-white/[0.06] py-4 last:border-b-0">
      <div className="min-w-0">
        <div className="text-sm">{label}</div>
        {hint && <div className="mt-0.5 text-[11px] leading-snug text-white/40">{hint}</div>}
      </div>
      {children}
    </div>
  );
}

interface StepperProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (value: number) => void;
}

function Stepper({ label, value, min, max, step, unit, onChange }: StepperProps) {
  return (
    <div className="flex items-center justify-between border-t border-white/10 py-4">
      <span className="text-sm">{label}</span>
      <div className="flex items-center gap-2" role="group" aria-label={label}>
        <button
          type="button"
          aria-label={`减少${label}`}
          onClick={() => onChange(clamp(value - step, min, max))}
          className="liquid-glass flex h-8 w-8 items-center justify-center rounded-full text-base leading-none"
        >
          −
        </button>
        <span
          className="w-[74px] text-center text-sm tabular-nums"
          aria-live="polite"
          aria-atomic="true"
        >
          {value} {unit}
        </span>
        <button
          type="button"
          aria-label={`增加${label}`}
          onClick={() => onChange(clamp(value + step, min, max))}
          className="liquid-glass flex h-8 w-8 items-center justify-center rounded-full text-base leading-none"
        >
          +
        </button>
      </div>
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  label,
  disabled = false,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="relative h-6 w-11 shrink-0 rounded-full transition-colors duration-300 disabled:opacity-35"
      style={{
        background: checked ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.2)',
      }}
    >
      <span
        className="absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform duration-300"
        style={{
          transform: checked ? 'translateX(22px)' : 'translateX(2px)',
          boxShadow: '0 1px 3px rgba(0,0,0,0.35)',
        }}
      />
    </button>
  );
}
