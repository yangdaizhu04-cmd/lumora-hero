# Lumora Focus

一个沉浸式个人工作台：**番茄钟 + 任务清单 + 专注统计 + 四场景音景**。

四个视觉场景（Golden Hour / Still Water / Deep Woods / Quiet Dawn）各自绑定一套真实环境音，
切换场景时画面与声音同步交叉淡入；配合今日意图清单与专注数据，让你在一个不被打扰的空间里推进真正重要的事。

> 本项目由营销落地页（Lumora Hero）改造而来。

---

## 快速开始

```bash
npm install
npm run dev      # 开发服务器，默认 http://localhost:5173
npm run build    # 类型检查 + 生产构建
npm run preview  # 预览构建产物
```

Windows 用户也可直接双击 `start-lumora.bat`。

> 音频需要用户手势后才能播放（浏览器自动播放策略）。首次点击「开始专注」或点击场景时才会初始化音频引擎。

---

## 功能

### 番茄钟

- 专注 25 / 短休 5 / 长休 15 分钟（可配置），长休间隔默认 4 个番茄（可配置）
- **时间戳驱动计时**：以绝对时间戳计算剩余时间，后台标签页不漂移
- 细线进度环 + 巨型衬线数字（定宽渲染，数字不跳动）
- 阶段结束：合成钟声 + 中央提示语（环境音自动压低 duck）
- 窗口标题同步倒计时，切到别的标签页也能看到剩余时间
- 番茄进度点：环上方小圆点显示本轮已完成到第几个番茄

### 场景与音景

- 四场景视频交叉淡入，**只播放当前场景的视频**（不做四路并发解码）
- 每场景绑定真实环境音，切换时 1.2 秒交叉淡化，无爆音
- 全局音量滑杆 + 一键静音
- 阶段提示音可关闭

### 今日意图（任务）

- 添加 / 删除 / 勾选完成，可设预估番茄数（1–12）
- 点任务本身设为「进行中」，进行中任务显示在计时器下方
- 番茄完成后自动给进行中任务 +1，并记录到专注日志
- 跳过阶段不计入统计与任务进度
- 顶栏图标带未完成数量徽标

### 跨天归档与回顾

- **自动归档**：跨天时（或应用隔了一天再打开时）把未完成任务标记为「未完成」并顺延到新的一天
- 已完成的任务移出工作列表，记录保留在当天归档里
- 任务在勾选完成的**当下**就写入归档，所以「清除已完成」不会丢失回顾数据
- 任务面板「回顾」标签页：按天展示任务快照（完成 / 未完成）+ 当天番茄数与专注时长，
  往期未完成项标注「已顺延到次日」
- 归档保留 180 天，回顾面板默认展示近 30 天

### 专注统计

- 今日番茄数 / 专注时长 / 连续专注天数
- 近 7 天迷你柱状图（纯 SVG，无图表库）
- 数据全部存在本地 `localStorage`，无网络请求

### 体验细节

- **呼吸引导**：休息阶段进度环按 4-7-8 呼吸法缩放，并显示「吸气 / 屏息 / 呼气」
- **专注模式**：`F` 隐藏顶栏底栏、只留计时器，并尝试进入浏览器全屏
- 系统通知：可选，仅在页面处于后台时提醒（需在设置里手动开启）
- 响应式：小屏场景切换器横向滚动，抽屉全屏化
- 无障碍：阶段变化 `aria-live` 播报、`:focus-visible` 描边、开关使用 `role="switch"`
- 尊重 `prefers-reduced-motion`（停用呼吸动画与背景浮动动画）

---

## 键盘快捷键

| 键 | 作用 |
|---|---|
| `Space` | 开始 / 暂停 |
| `R` | 重置当前阶段 |
| `S` | 跳过当前阶段（不计入统计） |
| `1`–`9` | 切换场景 |
| `M` | 静音 / 取消静音 |
| `T` | 打开 / 关闭今日意图 |
| `F` | 进入 / 退出专注模式 |
| `Esc` | 关闭面板 / 退出专注模式 |

---

## 四场景音景映射

| 场景 | 视觉 | 音景 | 明暗 |
|---|---|---|---|
| Golden Hour | 暖金色黄昏 | 黄昏虫鸣 | 浅色文字 |
| Still Water | 静谧水面 | 平缓水流 | 浅色文字 |
| Deep Woods | 幽深森林 | 林间鸟鸣 | 深色文字 |
| Quiet Dawn | 清晨黎明 | 清风掠过 | 浅色文字 |

---

## 技术栈

- React 18 + TypeScript + Vite 6
- Tailwind CSS 4（`@tailwindcss/vite`）
- lucide-react（图标）
- 原生 Web Audio API（环境音层 + 交叉淡化 + duck + 合成钟声）
- **无新增运行时依赖**

---

## 目录结构

```
src/
  App.tsx                    # 布局 + 状态编排 + 快捷键
  data/scenes.ts             # 四场景唯一数据源（视频、音景、文字色、遮罩）
  types.ts                   # 全局类型
  hooks/
    usePomodoro.ts           # 计时状态机（时间戳驱动）
    useTasks.ts              # 今日意图 + 进行中任务 + 番茄计数
    useFocusLog.ts           # 专注日志与统计派生
    useAudioEngine.ts        # 音景引擎 React 绑定
    usePrefersReducedMotion.ts
  audio/
    engine.ts                # 音频引擎：分层、交叉淡化、duck、主音量
    chime.ts                 # 转场钟声与点击音（Web Audio 合成）
  components/
    SceneBackground.tsx      # 四视频交叉淡入（只播放当前场景）
    TimerRing.tsx            # SVG 进度环
    TimerDisplay.tsx         # 定宽倒计时数字
    ControlBar.tsx           # 开始/暂停/重置/跳过
    SceneSwitcher.tsx        # 场景切换（含音景状态）
    VolumeControl.tsx        # 音量与静音
    StatsBar.tsx             # 今日统计 + 7 天柱状图
    TaskPanel.tsx            # 今日意图 / 回顾（标签页）
    ActiveTaskBar.tsx        # 计时器下方的进行中任务
    BreathingGuide.tsx       # 4-7-8 呼吸引导文案
    SettingsDrawer.tsx       # 设置面板
    PhaseToast.tsx           # 阶段切换提示
  lib/
    storage.ts               # localStorage 封装
    stats.ts                 # 统计计算（连续天数 / 7 天聚合）
    review.ts                # 每日归档聚合与日期标签
    notify.ts                # 系统通知封装
    time.ts  id.ts  defaults.ts
public/audio/                # 环境音文件（见下方音源署名）
```

---

## 音源署名

四段环境音位于 `public/audio/`，均为 **CC0 1.0（公共领域）** 录音 —— 可自由复制、修改、分发，
**无强制署名义务**。以下来源信息出于对录音者的尊重而保留：

| 场景 | 文件 | 原始录音 | 录音者 |
|---|---|---|---|
| Golden Hour | `golden-hour.mp3` | [Crickets (close recording)](https://freesound.org/s/476672/) | [felix.blume](https://freesound.org/people/felix.blume/) |
| Still Water | `still-water.mp3` | [Relaxing River Sound](https://freesound.org/s/722875/) | [IceVFX](https://freesound.org/people/IceVFX/) |
| Deep Woods | `deep-woods.mp3` | [Forest quiet atmosphere with some birds](https://freesound.org/s/414098/) | [felix.blume](https://freesound.org/people/felix.blume/) |
| Quiet Dawn | `quiet-dawn.mp3` | [Wind on bushes, close to desert ground](https://freesound.org/s/711106/) | [felix.blume](https://freesound.org/people/felix.blume/) |

循环剪辑取自开源项目 [funcoder/omarchy-ambient](https://github.com/funcoder/omarchy-ambient)；
本项目为压缩体积与全平台兼容，用 ffmpeg 转码为 96kbps / 48kHz / 立体声 mp3（30MB → 11.5MB）。

阶段转场钟声不含任何音频文件，由 Web Audio API 实时合成（`src/audio/chime.ts`）。

---

## 数据与隐私

所有数据（设置、任务、专注日志、每日归档）只存在浏览器 `localStorage`，不上传任何服务器。
键位说明见 `开发者交接文档.md` §localStorage 键位。

---

## 文档

| 文件 | 用途 |
|---|---|
| `README.md` | 项目说明、运行方式、功能与结构 |
| `开发踩坑点.md` | 开发过程中遇到的坑与解决方法（13 条真实记录 + 规避清单） |
| `开发者交接文档.md` | 交接内容、设计决策、剩余工作、验证清单 |

---

## 路线图

- [x] **P0** 计时核心（状态机、进度环、控制条、快捷键、持久化）
- [x] **P1** 音景（真实音源、场景绑定、音量/静音、转场钟声）
- [x] **P2** 工作台数据（今日意图、专注统计、系统通知、设置项扩展）
- [x] **P3** 打磨（呼吸引导、专注模式、移动端、无障碍）
- [x] **跨天归档与回顾**（未完成任务自动顺延、按天回顾）
- [ ] 可选增强：白噪音混音器、日志导出、PWA 离线、部署上线（见 `开发者交接文档.md` §剩余工作）
