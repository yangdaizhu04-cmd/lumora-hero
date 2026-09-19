import { describe, expect, it } from 'vitest';
import { FOCUS_METHODS, matchFocusMethod, methodPatch } from './focusMethods';

describe('专注法预设', () => {
  it('应用预设只改四个时长字段', () => {
    const patch = methodPatch(FOCUS_METHODS[0]);
    expect(Object.keys(patch).sort()).toEqual([
      'focusMinutes',
      'longBreakInterval',
      'longBreakMinutes',
      'shortBreakMinutes',
    ]);
  });

  it('四个字段全中才算匹配', () => {
    const classic = FOCUS_METHODS.find((method) => method.id === 'classic');
    expect(classic).toBeDefined();
    if (!classic) return;

    const { focusMinutes, shortBreakMinutes, longBreakMinutes, longBreakInterval } =
      classic;

    expect(
      matchFocusMethod({
        focusMinutes,
        shortBreakMinutes,
        longBreakMinutes,
        longBreakInterval,
      })?.id,
    ).toBe('classic');
  });

  // 手调过任意一个就不该继续高亮某个预设，否则会让人以为改动没生效
  it('手调过任一时长就不再匹配任何预设', () => {
    const classic = FOCUS_METHODS[0];
    expect(
      matchFocusMethod({
        focusMinutes: classic.focusMinutes + 5,
        shortBreakMinutes: classic.shortBreakMinutes,
        longBreakMinutes: classic.longBreakMinutes,
        longBreakInterval: classic.longBreakInterval,
      }),
    ).toBeNull();
  });

  /**
   * 预设的值必须落在设置面板各 Stepper 的 min/max 内，
   * 否则点完预设会出现"显示值和控件范围打架"（比如 Stepper 明明上限 60，
   * 却显示着 90）。这条是防将来加预设时手滑。
   */
  it('每个预设都落在设置面板允许的范围内', () => {
    FOCUS_METHODS.forEach((method) => {
      expect(method.focusMinutes).toBeGreaterThanOrEqual(5);
      expect(method.focusMinutes).toBeLessThanOrEqual(120);
      expect(method.shortBreakMinutes).toBeGreaterThanOrEqual(1);
      expect(method.shortBreakMinutes).toBeLessThanOrEqual(30);
      expect(method.longBreakMinutes).toBeGreaterThanOrEqual(5);
      expect(method.longBreakMinutes).toBeLessThanOrEqual(60);
      expect(method.longBreakInterval).toBeGreaterThanOrEqual(2);
      expect(method.longBreakInterval).toBeLessThanOrEqual(8);
    });
  });

  it('预设的 id 不重复，且每个都有说明文案', () => {
    const ids = FOCUS_METHODS.map((method) => method.id);
    expect(new Set(ids).size).toBe(ids.length);
    FOCUS_METHODS.forEach((method) => {
      expect(method.hint.length).toBeGreaterThan(0);
    });
  });
});
