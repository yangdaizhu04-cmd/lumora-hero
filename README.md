# Lumora Focus

一个沉浸式个人工作台：**番茄钟 + 四场景音景 + 今日意图 + 专注回顾**。

四个视觉场景（Golden Hour / Still Water / Deep Woods / Quiet Dawn）各自绑定一套真实环境音，
切换场景时画面与声音同步交叉淡入；配合任务清单、专注统计与本地洞察，让你在一个不被打扰的空间里推进真正重要的事。

> 本项目由营销落地页（Lumora Hero）改造而来。

---

## 快速开始

```bash
npm install
npm run dev      # 开发服务器 http://localhost:5173
npm run build    # 类型检查 + 生产构建
npm run preview  # 预览构建产物（Service Worker 只在这里生效）
npm test         # 单元测试（80 个）
npm run lint     # ESLint
npm run format   # Prettier 格式化
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
- 阶段结束：合成钟声 + 中央提示（环境音自动压低 duck）
- 系统媒体控制：**耳机上的播放/暂停键、锁屏控件都能控制番茄钟**，锁屏显示剩余进度
- 窗口标题实时倒计时

### 四场景音景

- 视频交叉淡入，**只播放当前场景**，页面不可见时全部暂停（省电）
- **跟随计时状态**：只在专注 / 休息进行中发声（含开始前的准备倒计时），
  待机与暂停会淡出并**真正暂停音频解码**；待机时连 `AudioContext` 都不创建
- **预热**：解锁后 4 个场景的音层全部加载好，切换是瞬时的
- **自适应音景**：随专注进度缓慢铺入一层合成的低频长音，越投入越沉
- **空间化**：环境音在左右耳之间极缓慢游移（水流偏左、鸟鸣偏右）
- **自动场景编排**：专注进深林、休息靠水边，夜间休息换成黎明
- 音量 / 静音 / 提示音开关

### 今日意图与回顾

- 添加 / 删除 / 勾选，可设预估番茄数；点任务设为「进行中」，番茄完成后自动 +1
- 跳过阶段不计入统计与任务进度
- **跨天自动归档**：未完成任务标记为「未完成」并顺延，已完成任务移出工作列表
- **回顾页**：按天展示任务快照 + 番茄数 + 离开次数，往期未完成项标注「已顺延」
- **分心自察**：专注期间统计切走标签页的次数，只呈现不评判

### 本地洞察（离线、无需模型）

- 高效时段：「9:00–11:00 是你的高效时段，累计完成 6 个番茄」
- 平均专注时长、主力场景、平均离开次数、最高产的一天
- 数据不足 6 条时**不输出任何结论**，宁可不说也不误导
- **声化日报**：新的一天第一次打开时，把昨天的成果变成一小段上行音阶

### 夜间与氛围

- **夜间模式**：自动降亮度、静音钟声、偏向 Quiet Dawn（起始时间可设）
- **睡眠定时**：15 / 30 / 60 分钟内让环境音缓慢淡出并停止，适合睡前收尾
- **省电模式**：低电量或省流环境下自动改用静态渐变背景，也可手动强制
- 尊重 `prefers-reduced-motion`

### 数据与工程

- 数据全部本地存储（`localStorage`），**零后端、零上传**
- **导出 / 导入备份**（JSON），可在设备间迁移
- **音景配方分享**：把当前氛围编码成链接（`#p=…`），对方打开即还原
- **PWA**：可安装到桌面，**实测离线可打开**（应用外壳与音频走缓存，视频交给浏览器缓存）
- 80 个单元测试 + ESLint + Prettier

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

| 场景 | 视觉 | 音景 | 空间位置 | pad 基频 | 明暗 |
|---|---|---|---|---|---|
| Golden Hour | 暖金色黄昏 | 黄昏虫鸣 | 居中 | A2 | 浅色文字 |
| Still Water | 静谧水面 | 平缓水流 | 偏左 | D2 | 浅色文字 |
| Deep Woods | 幽深森林 | 林间鸟鸣 | 偏右 | C2 | 深色文字 |
| Quiet Dawn | 清晨黎明 | 清风掠过 | 略偏左 | G2 | 浅色文字 |

---

## 技术栈

- React 18 + TypeScript + Vite 6
- Tailwind CSS 4（`@tailwindcss/vite`）+ lucide-react
- 原生 Web Audio API：多层环境音、交叉淡化、duck、空间化、合成 pad 与钟声
- PWA：手写 Service Worker（无插件），缓存策略见 `public/sw.js`
- 测试：Vitest（纯函数）+ 浏览器端到端验证
- **生产依赖零新增**（React 之外只有 lucide-react）

---

## 目录结构

```
src/
  App.tsx                    # 布局 + 状态编排 + 快捷键
  config.ts                  # 所有可调参数集中在这里
  types.ts                   # 全局类型
  data/
    scenes.ts                # 场景数据源 + 阶段→场景编排规则
    phases.ts                # 阶段元数据
  hooks/
    usePomodoro.ts           # 计时状态机绑定 + 会话持久化
    useTasks.ts              # 今日意图 + 跨天归档
    useFocusLog.ts           # 专注日志与统计派生
    useAudioEngine.ts        # 音频引擎 React 绑定
    useAttention.ts          # 分心自察
    useMediaSession.ts       # 耳机按键 / 锁屏
    useRitual.ts             # 开始前准备倒计时
    useClockTick.ts          # 分钟级时钟（夜间模式 / 睡眠倒计时）
    usePrefersReducedMotion.ts
  audio/
    engine.ts                # 音频引擎：预热、分层、空间化、duck、睡眠淡出
    pad.ts                   # 合成 pad（自适应音景）
    chime.ts                 # 转场钟声、点击音、声化日报动机
  lib/
    pomodoroMachine.ts       # 纯函数状态机（23 个测试覆盖全转移）
    session.ts               # 会话序列化与恢复
    stats.ts  review.ts      # 统计与按天回顾聚合
    insights.ts              # 本地启发式洞察
    preset.ts                # 音景配方编解码
    backup.ts                # 数据导出 / 导入
    device.ts                # 低电量 / 省流检测
    notify.ts  storage.ts  time.ts  id.ts  defaults.ts
  components/                # 13 个展示组件（多数做了 memo）
public/
  audio/                     # 4 段环境音（CC0）
  fonts/                     # 自托管 Instrument Serif（43KB）
  overlay.webp               # 浮层图（原 1.9MB PNG → 195KB）
  icon.svg  manifest.webmanifest  sw.js
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
| `开发踩坑点.md` | 17 条真实踩坑记录 + 13 条风险规避清单 |
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
- [ ] 可选：多端同步（WebDAV）、日志导出 CSV、白噪音混音器 UI
- [ ] 实验分支：本地 LLM 总结回顾（`WebLLM`，需下载 1–2GB 模型，**不建议进主线**，理由见交接文档）
