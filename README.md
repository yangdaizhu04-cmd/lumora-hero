# Lumora Focus

一个沉浸式个人工作台：**番茄钟 + 四场景音景 + 自定义混音 + 今日意图 + 专注回顾**。

四个视觉场景（Golden Hour / Still Water / Deep Woods / Quiet Dawn）各自绑定一套真实环境音，
切换场景时画面与声音同步交叉淡入；配合任务清单、专注统计与本地洞察，让你在一个不被打扰的空间里推进真正重要的事。

> 本项目由营销落地页（Lumora Hero）改造而来。

[![CI](https://github.com/yangdaizhu04-cmd/lumora-hero/actions/workflows/ci.yml/badge.svg)](https://github.com/yangdaizhu04-cmd/lumora-hero/actions/workflows/ci.yml)

---

## 快速开始

> 需要 **Node ≥ 22.19**：`jsdom@30`（`^22.22.2 || ^24.15.0`）与 `undici@8`（`>=22.19.0`）的下限。
> 本地开发与 CI 都跑在 **Node 24** 上，两边版本请保持一致（原因见 `开发踩坑点.md` 记录 24）。

```bash
npm install
npm run dev           # 开发服务器 http://localhost:5173
npm run build         # 类型检查 + 生产构建
npm run preview       # 预览构建产物（Service Worker 只在这里生效）
npm test              # 单元测试（13 个文件 / 119 个用例）
npm run lint          # ESLint
npm run format        # Prettier 格式化
npm run format:check  # 只校验不写入（CI 用这条）
```

Windows 用户也可直接双击 `start-lumora.bat`。

> **环境音只在计时运行时发声**：待机、暂停都是安静的（浏览器自动播放策略也要求首次发声来自用户手势）。
> 想在不开始计时的情况下听环境音，用设置里的「睡眠定时」。

---

## 功能

### 番茄钟

- 专注 / 短休 / 长休时长可配置，长休间隔可配置
- **时间戳驱动计时**：以绝对时间戳计算剩余，后台标签页不漂移
- **刷新不丢进度**：运行中的会话（含已完成的阶段与分心次数）会持久化，
  哪怕刷新或崩溃恢复，回来时剩余时间仍然准确；离开期间刚好结束的专注会被补记
- 细线进度环 + 巨型衬线数字（定宽渲染，数字不跳动）
- **开始前的 3 秒准备**：给大脑一个进入状态的信号（可关）
- **专注法预设**：经典番茄 / 深度工作 / 短冲刺 / 完整周期，一键切换节奏；
  手调过任一数值就不再高亮任何预设（免得让人以为改动没生效）
- **Flowtime**：不倒计时、只往上累计真实专注时间，随时按「结束」把这段记进去；
  另有四小时安全上限，防忘记停
- **延长 5 分钟**：运行中 / 暂停中可给当前阶段续时间（总时长同步加长，进度环不跳变）
- **误触保护**：计时进行中切换阶段会被拦下并提示，不会静默丢掉这一段
- 阶段结束：合成钟声 + 中央提示（环境音自动压低 duck）
- 系统媒体控制：**耳机上的播放/暂停键、锁屏控件都能控制番茄钟**，锁屏显示剩余进度
- 窗口标题实时倒计时

### 四场景音景

- 视频交叉淡入，**只播放当前场景**，页面不可见时全部暂停（省电）
- **跟随计时状态**：只在专注 / 休息进行中发声（含开始前的准备倒计时），
  待机与暂停会淡出并**真正暂停音频解码**；待机时连 `AudioContext` 都不创建
- **预热**：解锁后 4 个场景的音层全部加载好，切换是瞬时的
- **自适应垫层**：随专注进度缓慢铺入一层**真实录音的房间底噪**（无音高），越投入越厚；
  默认关闭，强度可调，拖动滑杆或点「试听」可以立刻听到效果，不用跑满一个番茄
- **空间化**：环境音在左右耳之间极缓慢游移（水流偏左、鸟鸣偏右）
- **自动场景编排**：专注进深林、休息靠水边，夜间休息换成黎明
- 音量 / 静音 / 提示音开关

### 自定义混音

四套场景音景是配好的"套餐"，混音器则让你自己搭：

- 6 个独立音源（雨声 / 海浪 / 风声 / 溪流 / 虫鸣 / 鸟鸣）各有独立音量，可任意叠加
- 4 个预设（雨夜 / 海边 / 林间 / 夏夜）作为起点，不用从零调六个滑块
- 拖动即试听，不必跑满一个番茄才知道效果
- 开启后**取代**场景音景的发声，场景仍决定画面，自适应垫层照常可用
- 音量为 0 的音源不加载；关闭时不预热这 6 个文件（省流环境下不白下载 3MB）

### 今日意图与回顾

- 添加 / 删除 / 勾选，可设预估番茄数；点任务设为「进行中」，番茄完成后自动 +1
- **行内编辑**：点铅笔改标题、预估番茄数与标签（回车保存、Esc 取消）
- **标签**：空格或逗号分隔即可（中文逗号、顿号也认）；回顾页按标签看「哪类事花了多久」
- **拖拽排序**：按住手柄拖动调整优先级；手柄本身是按钮，键盘用户可按上下方向键
- **删除可撤销**：删除后 6 秒内一键恢复（含当天的归档记录）
- 跳过阶段不计入统计与任务进度
- **跨天自动归档**：未完成任务标记为「未完成」并顺延，已完成任务移出工作列表
- **回顾页**：按天展示任务快照 + 番茄数 + 离开次数，往期未完成项标注「已顺延」
- **周期复盘**：本周 / 本月做到现在，与上一周期**同期**对比（周中不拿 1 天去比 7 天），
  配每日分布柱状图；上周期为 0 时不出百分比
- **按任务投入**：把日志里的 `taskId` 汇成「我在哪件事上花了多少时间」，
  并如实分出「未挂任务」与「已删除的任务」——总额永远对得上，不会凭空少一块时间
- **专注质量**：完整没被打断的专注占比、平均中断次数、最容易被打断的时段；
  早期记录没有中断字段，不会被当成「0 次」混进来充数
- **打断打点**：被打断的当下按一下、选个原因（外部打断 / 走神 / 身体需要 / 主动切换），
  回顾页按原因归因 —— 与自动检测的「切走标签页」互补，两者的漏报方向正好相反
- **预估准度**：已完成任务的「计划几个番茄 vs 实际用掉几个」，只讲偏差方向
  （偏多 / 偏少）而不给评分；没用番茄钟就勾掉的任务单独列出，不拉偏结论
- **12 周热力图**：回顾页顶部一眼看到最近三个月的节奏
- **CSV 导出**：把专注日志导出成表格，方便在 Excel / Notion 里继续分析
- **分心自察**：专注期间统计切走标签页的次数，只呈现不评判

### 本地洞察（离线、无需模型）

- 高效时段：「9:00–11:00 是你的高效时段，累计完成 6 个番茄」
- 平均专注时长、主力场景、平均离开次数、最高产的一天
- 数据不足 6 条时**不输出任何结论**，宁可不说也不误导
- **声化日报**：新的一天第一次打开时，把昨天的成果变成一小段上行音阶

### 夜间与氛围

- **夜间模式**：自动降亮度、静音钟声、偏向 Quiet Dawn（起始时间可设）
- **睡眠定时**：15 / 30 / 60 分钟内让环境音缓慢淡出并停止，适合睡前收尾
- **省电模式**：低电量或省流环境下自动改用静态渐变背景，也可手动强制；
  提示会区分「手动开启 / 电量偏低 / 省流」三种来源，不会误报成电量问题
- 尊重 `prefers-reduced-motion`

### 数据与工程

- 数据全部本地存储（`localStorage`），**零后端、零上传**
- **导出 / 导入备份**（JSON）与 **CSV 导出**；可一键清空专注记录或全部数据
- **导入校验**：备份里的每个字段都会逐项校验，非法值回落到默认值，而不是把应用写崩
- **错误边界**：真出异常时能先导出数据再重置，不会白屏丢数据
- 多标签页打开同一份数据时会跟随同步，不会静默互相覆盖
- **音景配方分享**：把当前氛围编码成链接（`#p=…`），对方打开即还原
- **PWA**：可安装到桌面（含 iOS PNG 图标与桌面快捷方式），**实测离线可打开**
  （应用外壳与音频走缓存，视频交给浏览器缓存）；**新版本会提示「点一下刷新」**，不再静默停留在旧代码
- 13 个文件 / 119 个单元测试（纯函数跑 `node`，hooks 与备份用 `// @vitest-environment jsdom`）
  + ESLint + Prettier + GitHub Actions CI

---

## 键盘快捷键

| 键 | 作用 |
|---|---|
| `Space` | 开始 / 暂停（抽屉内保留原生行为） |
| `R` | 重置当前阶段 |
| `S` | 跳过当前阶段（不计入统计） |
| `1`–`9` | 切换场景 |
| `M` | 静音 / 取消静音 |
| `T` | 打开 / 关闭今日意图 |
| `F` | 进入 / 退出专注模式（含浏览器全屏） |
| `Esc` | 关闭面板 / 退出专注模式 |

---

## 四场景音景映射

| 场景 | 视觉 | 音景 | 空间位置 | 明暗 |
|---|---|---|---|---|
| Golden Hour | 暖金色黄昏 | 黄昏虫鸣 | 居中 | 浅色文字 |
| Still Water | 静谧水面 | 平缓水流 | 偏左 | 浅色文字 |
| Deep Woods | 幽深森林 | 林间鸟鸣 | 偏右 | 深色文字 |
| Quiet Dawn | 清晨黎明 | 清风掠过 | 略偏左 | 浅色文字 |

> 四个场景各自再叠一层**自适应垫层**（`focus-bed.mp3`，CC0 房间底噪）。它挂在每个场景里，
> 但响度只由专注进度与「垫层强度」决定 —— 切场景不会把它切断，也不会跟着场景换音色。

---

## 技术栈

- React 18 + TypeScript + Vite 6
- Tailwind CSS 4（`@tailwindcss/vite`）+ lucide-react
- 原生 Web Audio API：多层环境音、交叉淡化、duck、空间化与合成钟声
- PWA：手写 Service Worker（无插件），缓存策略见 `public/sw.js`；更新需用户确认（`src/lib/swUpdate.ts`）
- 测试：Vitest 3（21 文件 / 198 用例；默认 `node` 环境，需要 DOM 的用例在**文件首行**声明
  `// @vitest-environment jsdom`）+ 真实浏览器端到端验证
- CI：GitHub Actions（`npm ci` → lint → format:check → test → build，Node 24 + actions v5）
- **生产依赖零新增**（React 之外只有 lucide-react；jsdom / @testing-library/react 只在 devDependencies）

---

## 目录结构

```
src/
  App.tsx                    # 布局 + 状态编排（快捷键 / 专注模式 / 角标 / 自动场景已抽成 hook）
  config.ts                  # 所有可调参数集中在这里
  types.ts                   # 全局类型
  data/
    scenes.ts                # 场景唯一数据源（视频 + 音景 + 兜底渐变 + 可读性遮罩）
    phases.ts                # 阶段元数据
  hooks/
    usePomodoro.ts           # 计时状态机绑定 + 会话持久化
    useTasks.ts              # 今日意图 + 跨天归档 + 撤销删除
    useFocusLog.ts           # 专注日志与统计派生（接分钟级时钟，跨零点自动刷新）
    useAudioEngine.ts        # 音频引擎 React 绑定
    useAttention.ts          # 分心自察
    useMediaSession.ts       # 耳机按键 / 锁屏
    useRitual.ts             # 开始前准备倒计时
    useClockTick.ts          # 分钟级时钟（夜间模式 / 睡眠倒计时 / 统计刷新）
    usePersistentState.ts    # localStorage 绑定（去抖写盘 + 多标签同步 + 写入失败事件）
    useKeyboardShortcuts.ts  # 全局快捷键（处理函数走 ref，监听器只挂一次）
    useFocusMode.ts          # 专注模式 + 浏览器全屏同步
    useAutoScene.ts          # 阶段 → 场景自动编排
    useAppBadge.ts           # PWA 图标角标
    usePrefersReducedMotion.ts
  audio/
    engine.ts                # 音频引擎：当前场景即时可用、其余空闲预热、空间化、duck、睡眠淡出
    chime.ts                 # 转场钟声、点击音、声化日报动机（节点用完即释放）
  lib/
    pomodoroMachine.ts       # 纯函数状态机（含 EXTEND，28 个测试覆盖全转移）
    session.ts               # 会话序列化与恢复
    stats.ts  review.ts      # 统计 / 按天回顾 / 热力图数据 / 周目标
    insights.ts              # 本地启发式洞察
    csv.ts                   # 专注日志 CSV 导出
    preset.ts                # 音景配方编解码
    backup.ts                # 数据导出 / 导入（逐字段校验）+ 清空数据
    swUpdate.ts              # 新版本就绪检测与用户确认刷新
    ui.ts                    # 共享 UI 常量（字体栈、快捷键文案）
    device.ts                # 低电量 / 省流检测（手动 / 电量 / 省流三态提示）
    notify.ts  storage.ts  time.ts  id.ts  defaults.ts
  components/                # 23 个展示组件（多数做了 memo）
public/
  audio/                     # 4 段环境音 + 自适应垫层 + 6 段混音音源（CC0）
  fonts/                     # 自托管 Instrument Serif（43KB）
  overlay.webp               # 浮层图（原 1.9MB PNG → 195KB）
  icon.svg  icon-192.png  icon-512.png  apple-touch-icon.png
  manifest.webmanifest  sw.js
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
| 自适应垫层 | `focus-bed.mp3` | [RoomTone07](https://freesound.org/s/474832/) | [richwise](https://freesound.org/people/richwise/) |

循环剪辑取自开源项目 [funcoder/omarchy-ambient](https://github.com/funcoder/omarchy-ambient)；
本项目为压缩体积与全平台兼容，用 ffmpeg 转码为 96kbps / 48kHz / 立体声 mp3（30MB → 11.5MB）。

**自定义混音**的 6 个音源同样来自 [funcoder/omarchy-ambient](https://github.com/funcoder/omarchy-ambient)（CC0），
每个都裁成 47 秒**无缝循环**（3 秒等功率 wrap 交叉淡化）、单声道 96kbps / 48kHz，并统一做过响度归一化：

| 音源 | 文件 | 原始素材 |
|---|---|---|
| 雨声 | `mix-rain.mp3` | `rain.ogg` |
| 海浪 | `mix-waves.mp3` | `waves.ogg` |
| 风声 | `mix-wind.mp3` | `wind.ogg` |
| 溪流 | `mix-stream.mp3` | `stream.ogg` |
| 虫鸣 | `mix-crickets.mp3` | `crickets.ogg` |
| 鸟鸣 | `mix-birds.mp3` | `birds.ogg` |

阶段钟声、点击音与声化日报动机**不含任何音频文件**，由 Web Audio API 实时合成（`src/audio/chime.ts`）。

浮层图原为 1.9MB PNG，转 WebP 后 195KB（`ffmpeg -c:v libwebp -quality 88`，alpha 通道保持无损）。
字体为 Google Fonts 的 Instrument Serif，已镜像到本地，不再有外部依赖。

---

## 数据与隐私

所有数据（设置、任务、专注日志、每日归档、会话）只存在浏览器 `localStorage`，不上传任何服务器。
键位说明见 `开发者交接文档.md` §localStorage 键位。

---

## 文档

| 文件 | 用途 |
|---|---|
| `README.md` | 项目说明、运行方式、功能与结构 |
| `开发踩坑点.md` | 30 条真实踩坑记录 + 39 条风险规避清单 |
| `开发者交接文档.md` | 交接内容、设计决策、调试后门、剩余工作、验证清单 |

---

## 路线图

- [x] **P0** 计时核心（状态机、进度环、控制条、快捷键、持久化）
- [x] **P1** 音景（真实音源、场景绑定、音量 / 静音、转场钟声）
- [x] **P2** 工作台数据（今日意图、专注统计、系统通知）
- [x] **P3** 打磨（呼吸引导、专注模式、移动端、无障碍）
- [x] **跨天归档与回顾**（未完成任务自动顺延、按天回顾）
- [x] **工程化**（git 版本控制、ESLint / Prettier、Vitest 80 个测试）
- [x] **性能**（秒级状态更新、组件 memo、隐藏页暂停视频）
- [x] **健壮性**（资源本地化、会话持久化、视频兜底、PWA 离线）
- [x] **夜间灵感十二项**（Media Session、自动场景、自适应音景、空间化、夜间模式、
      睡眠定时、分心自察、低电量省电、启动仪式、本地洞察、声化日报、音景分享、数据备份）
- [x] **可用性打磨**（删除撤销、延长 5 分钟、周目标、12 周热力图、CSV 导出、数据清空）
- [x] **性能与流量**（视频按需挂载、音频空闲预热、CDN 预连接、写盘去抖）
- [x] **自定义混音**（6 个 CC0 音源 + 4 个预设 + 试听；接管场景发声，关闭时不预热）
- [x] **任务编辑与排序**（行内改标题 / 预估数；拖拽排序 + 手柄方向键，均只在本组内）
- [x] **按任务投入**（日志里的 `taskId` 汇成投入分布；未挂任务 / 已删除任务分列，总额守恒）
- [x] **周期复盘**（本周 / 本月 + 同期对比 + 每日分布；上周期为 0 时不出百分比）
- [x] **专注质量与预估准度**（心流率 + 时段归因；预估只讲偏差方向，不给评分）
- [x] **专注法预设与 Flowtime**（一键切换工作节奏；正计时并把真实时长记成一笔）
- [x] **任务标签与按标签投入**（解析容错中英标点；多标签的时长会分别计入，界面已说明）
- [x] **打断打点与归因**（专注中一键记下原因，随会话存档，刷新不丢）
- [x] **工程化**（导入逐字段校验、错误边界、多标签同步、SW 更新提示、
      hooks 测试 198 个、GitHub Actions CI）
- [x] **开源协作**（GitHub 公开仓库 + Actions CI：Node 24 / actions v5，
      21 文件 198 用例全绿；本机 `github.com` 被阻断时走 SSH-over-443 推送）
- [ ] 可选：多端同步（WebDAV）
- [ ] 实验分支：本地 LLM 总结回顾（`WebLLM`，需下载 1–2GB 模型，**不建议进主线**，理由见交接文档）
