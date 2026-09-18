import { memo, useEffect, useRef, type ReactNode } from 'react';
import { Download, Link2, Moon, Upload, X } from 'lucide-react';
import { clamp, formatRemainingMinutes } from '../lib/time';
import { DEFAULT_SETTINGS } from '../lib/defaults';
import type { NotifyPermission } from '../lib/notify';
import type { PomodoroSettings } from '../types';

interface Props {
  open: boolean;
  settings: PomodoroSettings;
  notifyPermission: NotifyPermission;
  /** 设备相关的提示（低电量 / 省流） */
  deviceHint: string | null;
  /** 睡眠定时剩余毫秒，0 表示未启用 */
  sleepRemainingMs: number;
  onChange: (patch: Partial<PomodoroSettings>) => void;
  onNotificationsChange: (enabled: boolean) => void;
  onStartSleep: (minutes: number) => void;
  onCancelSleep: () => void;
  onExport: () => void;
  onImport: (file: File) => void;
  onShare: () => void;
  onClose: () => void;
}

const SANS = 'system-ui, sans-serif';
const SLEEP_OPTIONS = [15, 30, 60];

function SettingsDrawerComponent({
  open,
  settings,
  notifyPermission,
  deviceHint,
  sleepRemainingMs,
  onChange,
  onNotificationsChange,
  onStartSleep,
  onCancelSleep,
  onExport,
  onImport,
  onShare,
  onClose,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const notifyDisabled =
    notifyPermission === 'unsupported' || notifyPermission === 'denied';

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

        <div className="flex-1 overflow-y-auto px-6 pb-10">
          {/* ---------- 计时 ---------- */}
          <Section title="计时">
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
            <Row label="自动开始下一段">
              <Toggle
                checked={settings.autoStartNext}
                onChange={(checked) => onChange({ autoStartNext: checked })}
                label="自动开始下一段"
              />
            </Row>
            <Row label="开始前 3 秒准备" hint="给大脑一个进入状态的信号">
              <Toggle
                checked={settings.ritualEnabled}
                onChange={(checked) => onChange({ ritualEnabled: checked })}
                label="开始前 3 秒准备"
              />
            </Row>
          </Section>

          {/* ---------- 声音 ---------- */}
          <Section title="声音">
            <Row label="阶段结束提示音">
              <Toggle
                checked={settings.chimeEnabled}
                onChange={(checked) => onChange({ chimeEnabled: checked })}
                label="阶段结束提示音"
              />
            </Row>
            <Row label="自适应音景" hint="随专注进度缓慢铺入一层低频长音，越投入越沉">
              <Toggle
                checked={settings.adaptiveSound}
                onChange={(checked) => onChange({ adaptiveSound: checked })}
                label="自适应音景"
              />
            </Row>
            <Row label="空间化" hint="环境音在左右耳之间极缓慢地游移（建议戴耳机）">
              <Toggle
                checked={settings.spatialSound}
                onChange={(checked) => onChange({ spatialSound: checked })}
                label="空间化"
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
          </Section>

          {/* ---------- 氛围 ---------- */}
          <Section title="氛围">
            <Row label="自动切换场景" hint="专注进深林，休息靠水边">
              <Toggle
                checked={settings.autoScene}
                onChange={(checked) => onChange({ autoScene: checked })}
                label="自动切换场景"
              />
            </Row>
            <Row label="夜间模式" hint="降低亮度、静音钟声、偏向 Quiet Dawn">
              <Toggle
                checked={settings.nightModeEnabled}
                onChange={(checked) => onChange({ nightModeEnabled: checked })}
                label="夜间模式"
              />
            </Row>
            {settings.nightModeEnabled && (
              <Stepper
                label="夜间起点"
                value={settings.nightStartHour}
                min={18}
                max={23}
                step={1}
                unit="点"
                onChange={(value) => onChange({ nightStartHour: value })}
              />
            )}
            <Row
              label="省电模式"
              hint={deviceHint ?? '用静态渐变代替背景视频，显著降低耗电与流量'}
            >
              <Toggle
                checked={settings.lowPowerMode}
                onChange={(checked) => onChange({ lowPowerMode: checked })}
                label="省电模式"
              />
            </Row>
          </Section>

          {/* ---------- 睡眠 ---------- */}
          <Section title="睡眠定时">
            {sleepRemainingMs > 0 ? (
              <div className="flex items-center justify-between py-3">
                <span className="flex items-center gap-2 text-sm">
                  <Moon className="h-3.5 w-3.5 opacity-70" />
                  还有 {formatRemainingMinutes(sleepRemainingMs)}淡出
                </span>
                <button
                  type="button"
                  onClick={onCancelSleep}
                  className="liquid-glass rounded-full px-4 py-2 text-xs"
                >
                  取消
                </button>
              </div>
            ) : (
              <div className="py-3">
                <p className="text-[11px] leading-snug text-white/40">
                  环境音会在设定时间内缓慢淡出并停止，适合睡前收尾。
                </p>
                <div className="mt-3 flex gap-2">
                  {SLEEP_OPTIONS.map((minutes) => (
                    <button
                      key={minutes}
                      type="button"
                      onClick={() => onStartSleep(minutes)}
                      className="liquid-glass flex-1 rounded-full py-2.5 text-xs transition-opacity hover:opacity-75"
                    >
                      {minutes} 分钟
                    </button>
                  ))}
                </div>
              </div>
            )}
          </Section>

          {/* ---------- 数据 ---------- */}
          <Section title="数据">
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={onExport}
                className="liquid-glass flex flex-1 items-center justify-center gap-1.5 rounded-full py-2.5 text-xs transition-opacity hover:opacity-75"
              >
                <Download className="h-3.5 w-3.5" />
                导出备份
              </button>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="liquid-glass flex flex-1 items-center justify-center gap-1.5 rounded-full py-2.5 text-xs transition-opacity hover:opacity-75"
              >
                <Upload className="h-3.5 w-3.5" />
                导入备份
              </button>
            </div>
            <button
              type="button"
              onClick={onShare}
              className="liquid-glass mt-2 flex w-full items-center justify-center gap-1.5 rounded-full py-2.5 text-xs transition-opacity hover:opacity-75"
            >
              <Link2 className="h-3.5 w-3.5" />
              复制当前音景分享链接
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) onImport(file);
                event.target.value = '';
              }}
            />
          </Section>

          <button
            type="button"
            onClick={() => onChange({ ...DEFAULT_SETTINGS })}
            className="liquid-glass mt-6 w-full rounded-full py-3 text-sm"
          >
            恢复默认设置
          </button>

          <p className="mt-6 text-xs leading-relaxed text-white/45">
            快捷键：Space 开始/暂停 · R 重置 · S 跳过 · 1–4 切换场景 · M 静音 · T
            今日意图 · F 专注模式
          </p>
        </div>
      </aside>
    </>
  );
}

/** 与 TaskPanel 同理：常驻挂载 + 高频重渲染，需要 memo */
export const SettingsDrawer = memo(SettingsDrawerComponent);

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-5 first:mt-0">
      <h3 className="text-[11px] uppercase tracking-[0.22em] text-white/35">{title}</h3>
      <div className="mt-2 border-t border-white/10">{children}</div>
    </section>
  );
}

function Row({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-white/[0.06] py-4 last:border-b-0">
      <div className="min-w-0">
        <div className="text-sm">{label}</div>
        {hint && (
          <div className="mt-0.5 text-[11px] leading-snug text-white/40">{hint}</div>
        )}
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
    <div className="flex items-center justify-between border-b border-white/[0.06] py-4 last:border-b-0">
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
