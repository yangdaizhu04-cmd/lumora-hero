import { useEffect, type Dispatch, type SetStateAction } from 'react';
import { sceneForPhase, sceneIndexById } from '../data/scenes';
import type { Phase } from '../types';

/**
 * 阶段 → 场景的自动编排：专注进深林，休息靠水边，夜间休息换成黎明。
 * 只在开关打开时生效；同时保留用户手动切换的能力（关掉开关即可自由选场景）。
 */
export function useAutoScene(
  enabled: boolean,
  phase: Phase,
  night: boolean,
  setSceneIndex: Dispatch<SetStateAction<number>>,
): void {
  useEffect(() => {
    if (!enabled) return;
    const index = sceneIndexById(sceneForPhase(phase, night));
    setSceneIndex((prev) => (prev === index ? prev : index));
  }, [enabled, phase, night, setSceneIndex]);
}
