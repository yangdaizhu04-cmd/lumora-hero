import { describe, expect, it } from 'vitest';
import { describeDeviceState } from './device';

describe('省电提示文案', () => {
  it('手动开启省电模式时，不说成"电量偏低"', () => {
    const hint = describeDeviceState({ manual: true, battery: false, saveData: false });
    expect(hint).toContain('省电模式');
    expect(hint).not.toContain('电量');
  });

  it('电量偏低触发时说明原因', () => {
    expect(
      describeDeviceState({ manual: false, battery: true, saveData: false }),
    ).toContain('电量偏低');
  });

  it('省流环境触发时说明原因', () => {
    expect(
      describeDeviceState({ manual: false, battery: false, saveData: true }),
    ).toContain('省流');
  });

  it('手动与电量同时命中时，优先说明是用户自己开的', () => {
    const hint = describeDeviceState({ manual: true, battery: true, saveData: false });
    expect(hint).not.toContain('电量');
  });

  it('都没有时不给提示', () => {
    expect(
      describeDeviceState({ manual: false, battery: false, saveData: false }),
    ).toBeNull();
  });
});
