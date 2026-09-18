import { LIMITS } from '../config';
import { SCENE_BY_ID } from '../data/scenes';
import { dayKey } from './stats';
import type { FocusLogEntry } from '../types';

export interface Insight {
  id: string;
  text: string;
}

/**
 * 本地启发式洞察：完全离线、纯数学，不需要任何模型。
 *
 * 数据不足时（少于 LIMITS.insightMinEntries 条）不输出任何结论 ——
 * 宁可不说，也不要基于 2 条记录给出"你上午效率最高"这种误导。
 */
export function buildInsights(log: FocusLogEntry[], now = new Date()): Insight[] {
  if (log.length < LIMITS.insightMinEntries) return [];

  const insights: Insight[] = [];

  // 1) 黄金时段：滑动 2 小时窗口里完成最多的一段
  const byHour = new Array<number>(24).fill(0);
  log.forEach((entry) => {
    byHour[new Date(entry.finishedAt).getHours()] += 1;
  });

  let bestStart = -1;
  let bestCount = 0;
  for (let start = 0; start < 23; start += 1) {
    const count = byHour[start] + byHour[start + 1];
    if (count > bestCount) {
      bestCount = count;
      bestStart = start;
    }
  }

  if (bestStart >= 0 && bestCount >= 3) {
    insights.push({
      id: 'peak-hours',
      text: `${bestStart}:00–${bestStart + 2}:00 是你的高效时段，累计完成 ${bestCount} 个番茄`,
    });
  }

  // 2) 平均每段时长
  const avgMinutes = Math.round(
    log.reduce((sum, entry) => sum + entry.minutes, 0) / log.length,
  );
  if (avgMinutes > 0) {
    insights.push({
      id: 'avg-length',
      text: `你的专注段平均 ${avgMinutes} 分钟`,
    });
  }

  // 3) 最常使用的场景
  const sceneCount = new Map<string, number>();
  log.forEach((entry) => {
    sceneCount.set(entry.scene, (sceneCount.get(entry.scene) ?? 0) + 1);
  });
  let favoriteScene: string | null = null;
  let favoriteCount = 0;
  sceneCount.forEach((count, scene) => {
    if (count > favoriteCount) {
      favoriteCount = count;
      favoriteScene = scene;
    }
  });
  if (favoriteScene) {
    const label = SCENE_BY_ID[favoriteScene as keyof typeof SCENE_BY_ID]?.label;
    if (label) {
      insights.push({
        id: 'favorite-scene',
        text: `${label} 是你的主力场景（${favoriteCount} 个番茄）`,
      });
    }
  }

  // 4) 分心情况（只在采集到数据时才有意义）
  const withInterruptions = log.filter(
    (entry) => typeof entry.interruptions === 'number',
  );
  if (withInterruptions.length >= LIMITS.insightMinEntries) {
    const total = withInterruptions.reduce(
      (sum, entry) => sum + (entry.interruptions ?? 0),
      0,
    );
    const avg = total / withInterruptions.length;
    if (avg > 0.2) {
      insights.push({
        id: 'interruptions',
        text: `平均每段专注会离开 ${avg.toFixed(1)} 次，给它们留个记录本会很有用`,
      });
    }
  }

  // 5) 最近的一次高光日
  const perDay = new Map<string, number>();
  log.forEach((entry) => {
    perDay.set(entry.date, (perDay.get(entry.date) ?? 0) + 1);
  });
  const today = dayKey(now);
  let bestDay: string | null = null;
  let bestDayCount = 0;
  perDay.forEach((count, date) => {
    if (date === today) return;
    if (count > bestDayCount) {
      bestDayCount = count;
      bestDay = date;
    }
  });
  if (bestDay && bestDayCount >= 4) {
    const [, month, day] = (bestDay as string).split('-');
    insights.push({
      id: 'best-day',
      text: `${Number(month)} 月 ${Number(day)} 日是你的最高产的一天（${bestDayCount} 个番茄）`,
    });
  }

  return insights.slice(0, 3);
}
