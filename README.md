# CS2 灵敏度 & 压枪练习（v0.3.1）

纯前端网页：灵敏度计算 / 360° 校准 / PSA 找灵敏度 / 手动压枪练习 / 弹道学习 / 训练记录与趋势图。
技术栈：**React 18 + Vite + TypeScript**，HashRouter（适配 GitHub Pages），Zustand（设置持久化到 localStorage），Dexie（IndexedDB 训练记录），Vitest（单元测试）。

> 本项目只用于**手动练习**：只读取你自己的鼠标移动，不包含任何宏、自动压枪、鼠标控制或游戏内存读取功能，也不会向游戏发送输入。非官方粉丝工具，与 Valve 无关。

## 本地运行

需要 Node.js 20.19+。

```bash
npm install
npm run dev
```

浏览器打开 http://localhost:5173 。建议使用最新版 **Chrome / Edge**（支持 `unadjustedMovement` 原始鼠标输入）。

## 运行测试 / 构建

```bash
npm test          # Vitest 单元测试：灵敏度换算与非法输入、视野/投影、输入层锁定生命周期与尖峰过滤、采样、评分、PSA、恢复近似、趋势数据、数据校验
npm run lint      # ESLint
npm run typecheck # tsc --noEmit
npm run check     # 以上三项
npm run build     # 类型检查 + 生成 dist/
npm run preview   # 本地预览 dist
npm run test:e2e  # 构建测试版（dist-e2e）并运行 Playwright 端到端测试
```

E2E 测试需要 Chromium：`npx playwright install chromium`，或用已安装的 Chrome：`CHROME_PATH=/usr/bin/google-chrome npm run test:e2e`。

**测试钩子说明**：浏览器自动化无法真正进入 Pointer Lock，所以 `npm run build:e2e` 会以 `VITE_E2E=1` 构建一个测试版：用「假锁定」代替真实锁定，并允许测试脚本向**本页面自己的输入层**注入模拟移动（走与真实事件相同的尖峰过滤流程），用来验证开火计时、评分、记录保存与 PSA 流程。生产构建中 `VITE_E2E` 为常量 false，这些代码会被移除，线上版本没有任何注入接口。

CI（`.github/workflows/deploy.yml`）：`check`（lint + typecheck + 单元测试）与 `e2e`（Playwright）都通过后才 `build` 并部署到 Pages；PR 只跑检查不部署。

## 部署到 GitHub Pages

1. 在 GitHub 新建仓库（例如 `cs2-trainer`），把本项目推送到 `main` 分支：
   ```bash
   git init && git add . && git commit -m "init"
   git branch -M main
   git remote add origin https://github.com/<你的用户名>/cs2-trainer.git
   git push -u origin main
   ```
2. 打开仓库 **Settings → Pages**，在 **Build and deployment → Source** 选择 **GitHub Actions**。
3. 仓库已带 `.github/workflows/deploy.yml`：每次推送 `main` 会自动测试、构建并部署（也可在 Actions 页手动 Run workflow）。
4. 部署完成后访问 `https://<你的用户名>.github.io/cs2-trainer/`。

`vite.config.ts` 会在 Actions 中根据 `GITHUB_REPOSITORY` 自动把 `base` 设为 `/<仓库名>/`（仓库名为 `<用户名>.github.io` 时为 `/`）。如使用自定义域名或其它路径，构建时设置环境变量 `VITE_BASE`，例如 `VITE_BASE=/ npm run build`。路由使用 Hash 模式（`#/spray`），刷新不会 404。

## 国内访问说明

- 页面不使用任何外部 CDN、Google Fonts 或第三方统计；字体使用系统字体，所有依赖都打包进 `dist/`。
- `*.github.io` 在国内部分网络下访问不稳定。可以把 `dist/` 同时部署到国内静态托管（如 Gitee Pages、腾讯云/阿里云 OSS + CDN、Cloudflare Pages 等，按实际可用性与备案要求选择），构建时用 `VITE_BASE` 设置对应路径。

## 目录结构

```
src/core/input     鼠标输入：Pointer Lock + unadjustedMovement、pointerrawupdate / getCoalescedEvents、原始输入状态
src/core/sens      eDPI、cm/360、跨游戏换算、Hor+ 视野、PSA 区间逻辑（psa.ts）、甩枪+跟枪小任务（microTask.ts）
src/core/weapons   武器数据类型与加载
src/core/spray     射击计时（连续时间，不按 tick 取整）、路径采样插值、单次尝试状态机、停火恢复近似（recovery.ts）
src/core/scoring   逐发误差（度 / 厘米）、总分、前 10 发、最差片段
src/core/replay    Dexie 训练记录 + PSA 结果、趋势图数据整理（trend.ts）
src/render         Canvas 绘制（在 React 渲染循环外，用 ref + 按需 requestAnimationFrame：只在锁定 / 开火 / 播放时持续绘制）；趋势图为自绘 Canvas，无第三方图表库
e2e/               Playwright 端到端测试（使用测试构建）
src/pages          设置 / 灵敏度 / 压枪训练 / 弹道学习 / 记录
src/store          Zustand 设置（持久化）与运行时状态
public/data/weapons 武器数据 JSON
```

## 功能说明（v0.2 新增）

### PSA 找灵敏度（灵敏度页）
- 以当前灵敏度为中心，初始区间 ±50%（可选 25% / 75%），默认 7 轮（可选 5–8）。
- 每轮用区间两端的两个灵敏度各做一次小任务：锁定后 0.8 s 准备（这期间的点击，包括锁定那一下，都不计），然后 6 个甩枪目标——每个目标要么点中、要么 4 s 超时（记失误），没点中的点击只记「空枪」不跳目标；处理满 6 个后进入 4 s 跟枪。两组以 **A / B 隐藏标签**呈现，顺序每轮随机。
- 选出手感更好的一组后，另一端收缩到区间中点，区间每轮减半；7 轮后区间宽度为初始的 1/128，取中点作为结果（保留 3 位小数），同时给出 cm/360。
- 可勾选「选择时显示客观数据」（命中/失误、甩枪平均用时、跟枪平均角误差）。默认不显示，以免干扰手感判断。
- 结果保存到 IndexedDB（`psaResults` 表），在「记录」页查看，可一键应用为当前灵敏度。
- 浏览器的帧率、显示延迟、视野与游戏不同，结果仅作起点，请回 CS2 确认。

### 武器数据
新增 M4A4、M4A1-S、Galil AR、FAMAS（`m4a4.json` / `m4a1s.json` / `galil.json` / `famas.json`），参数来自同一份 `weapons.vdata`（GameTracking-CS2 commit `f68ba6aa24`，2026-10-09 06:39 UTC+8，build 2000930）。每把枪在文件中有 3 个条目（`*_prefab`、数字物品 ID、`weapon_*`），已核对所列字段三者完全一致。

| 武器 | vdata 类名 | 射击间隔 s | 弹匣 | 全自动 | 恢复 站立/最终 s | 恢复 蹲/最终 s | RecoilSeed |
|---|---|---|---|---|---|---|---|
| AK-47 | weapon_ak47 | 0.1 | 30 | 是 | 0.368 / 0.506 | 0.305257 / 0.419728 | 223 |
| M4A4 | weapon_m4a1 | 0.09 | 30 | 是 | 0.338941 / 0.466044 | 0.2421 / 0.332888 | 38965 |
| M4A1-S | weapon_m4a1_silencer | 0.1 | 20 | 是 | 0.338941 / 0.466044 | 0.2421 / 0.332888 | 38965 |
| Galil AR | weapon_galilar | 0.09 | 35 | 是 | 0.3 / 0.5 | 0.15 / 0.47 | 51191 |
| FAMAS | weapon_famas | 0.09 | 25 | 是（另有连发模式，本站不模拟） | 0.25 / 0.5 | 0.12 / 0.48 | 39623 |

恢复过渡区间（`m_nRecoveryTransitionStartBullet/EndBullet`）均为 2 → 5。后坐力（`m_flRecoilAngle`、`m_flRecoilAngleVariance`、`m_flRecoilMagnitude`、`m_flRecoilMagnitudeVariance`）与精度（`m_flSpread`、`m_flInaccuracyStand/Crouch/Fire/Move`、`m_flMaxSpeed`）按原样保存在 JSON 的 `recoilParams` / `accuracyParams` 中，并在训练页「vdata 原始参数」里展示。数组为 `[主模式, 副模式]`。**这些是引擎内部参数，单位未由 Valve 公开，不能直接当作弹道或散布角。**

所有新增武器的 `perBullet` 都为空（**待实测**），训练页按「仅记录模式」处理：记录轨迹与计时，不评分。

### 评分规则
- 连射少于 **5 发**（`MIN_SHOTS`）不评分也不保存，界面提示「射击太短，未计分」。
- 第 1 发在按下瞬间发射，视角还没动、弹道偏移也为 0，误差恒为 0，因此**不计入**总分 / 前 10 发 / 平均误差 / 最差片段（逐发表中标为「不计分」）。「前 10 发」= 第 2–10 发。
- 单发得分 = max(0, 100 × (1 − 误差 / 容差))，总分为计分发数的平均。

### 原始输入与平台
Chrome / Edge 88+ 在 **Windows、macOS（10.15.1+）、ChromeOS** 上支持 `requestPointerLock({ unadjustedMovement: true })`；**Linux 版 Chrome 目前不支持**，请求会以 `NotSupportedError` 拒绝（见 [web.dev：Disable mouse acceleration](https://web.dev/articles/disable-mouse-acceleration) 的「Operating system support」一节，以及 Chrome 开发者在 [w3c/pointerlock#36](https://github.com/w3c/pointerlock/issues/36) 中的说明）。本站会自动降级为普通锁定，并用不占版面的浮层提示；Linux 上若系统鼠标加速已设为「平坦 / flat」，手感基本等同原始输入。

### 容差圈（压枪训练页）
- 黄色圆圈画在每一发的**理想视角点**（理想补偿路径上的点）周围，当前这一发高亮。
- **半径用的是设置页的「单发容差（度）」，标注为「容差圈（设置值）」**，不是游戏里的真实散布。原因：vdata 的 `m_flInaccuracy*` / `m_flSpread` 单位与换算方式没有公开说明，从这些字段推出角度半径没有可靠依据，所以不做这种换算。
- 只有带逐发弹道的武器（目前只有示意数据）才会画圈。

### 停火恢复（近似，默认关闭）
- 训练页勾选「停火恢复（近似）」后：松开左键再按下时，如果距离上次停火还不到恢复时间，就从衰减后的弹道序号继续，而不是从第 1 发重新开始。
- 计算方式：恢复时间 T 在第 `RecoveryTransitionStartBullet` 到 `EndBullet` 发之间，从 `RecoveryTimeStand` 线性过渡到 `RecoveryTimeStandFinal`；新的起始序号 = ⌊上次序号 × max(0, 1 − 停火时长 / T)⌋。
- 从中间开始时，弹道以起始那一发为原点重新归零（忽略残留后坐力）。
- **这是近似**：vdata 只给出恢复时间，Valve 没有公开衰减曲线（是否线性、视角回弹等都未知）。目前只按站立姿态计算。

### 记录页趋势图
- 自绘 Canvas 折线图（无 CDN、无第三方图表库），显示每次评分的总分与前 10 发得分随时间的变化，可以按武器筛选。
- **示意数据的成绩单独画一张虚线图**，并标注「示意数据，非游戏真实弹道」，不和真实武器的成绩放在一起。没有逐发弹道的「仅记录」尝试不计入趋势，只显示条数。
- 底部列出 PSA 找灵敏度的历史结果。

## 数据说明（重要）

| 文件 | 内容 | 状态 |
|---|---|---|
| `public/data/weapons/ak47.json` | AK-47 射击间隔 0.1 s、弹匣 30、恢复参数、后坐力参数（来自 CS2 `weapons.vdata`） | **真实参数**；`perBullet` 为空（逐发弹道待实测） |
| `public/data/weapons/{m4a4,m4a1s,galil,famas}.json` | 同上（同一 vdata 版本） | **真实参数**；`perBullet` 为空（待实测） |
| `public/data/weapons/ak47-research.json` | 调研记录：每个字段的来源 URL、版本、校验目标、实测步骤、被拒绝的数据源及原因 | 参考 |
| `public/data/weapons/demo-pattern.json` | `isDemo: true` 的合成平滑曲线（`scripts/gen-demo-pattern.mjs` 生成） | **示意数据，非游戏真实弹道**，界面会显著标注 |

目前没有找到合法、可验证来源的 CS2 逐发弹道数据（宏/自动压枪脚本衍生数据、逆向游戏程序得到的数据都不使用），所以真实武器只有参数，没有逐发坐标。

### 实测后替换数据

1. 按 `ak47-research.json` 中 `measurementProcedure` 在**离线本地服**实测（`weapon_accuracy_nospread 1`、`sv_showimpacts 1` 等，键盘绑定开火、不碰鼠标，打满 30 发，多次取平均）。
2. 把结果填进 `ak47.json` 的 `perBullet`：
   ```json
   "perBullet": [ { "shot": 1, "x": 0, "y": 0 }, { "shot": 2, "x": -0.05, "y": 0.4 }, ... ]
   ```
   单位为**视角角度（度）**：`x` 向右为正，`y` 向上为正（子弹上跳方向）。理想补偿由程序自动取反。
3. 在 `gameBuild` 中写明测量时的游戏版本，并核对整体尺寸（`validationTargets` 字段，数据来自 csstats 2023-08-22 页面：AK 高 11.06°/宽 7.14°，M4A4 9.06°/6.29°，M4A1-S 5.93°/4.62°，Galil 7.31°/7.06°，FAMAS 6.96°/4.89°；页面较旧，之后的补丁可能有改动）。实测步骤也写在每个武器 JSON 的 `measurementProcedure` 里。
4. 新武器：复制一份 JSON，加入 `public/data/weapons/index.json`。

## 验收清单（真实鼠标手动检查）

自动化测试覆盖了计算、流程与数据保存，但下面这些只能用真鼠标、真浏览器确认。建议用最新版 Chrome / Edge，Windows 上测一遍。

**输入层**
- [ ] 点击训练画布后右上角显示「原始输入 ✓」（Windows / macOS 的 Chrome / Edge）；Linux 版 Chrome 显示「非原始输入」并在右下角浮层说明这是平台限制。锁定 / 解锁时页面不跳动。
- [ ] Windows 开启「提高指针精确度」后，Chrome 中同样的物理移动得到的角度不变（raw 生效）。
- [ ] 按 Esc 退出锁定后立刻再点画布：出现「需要等约 1 秒」的提示而不是报错；稍后再点能正常锁定。
- [ ] 压枪途中按 Esc / Alt+Tab / 切换标签页：提示「本次尝试已中断（不保存）」，记录页没有这条，回来后不会一直处于开火状态。
- [ ] 按住左键开火时把鼠标快速甩动，不会出现准星瞬移（尖峰过滤），结果里「已过滤异常位移事件」数量正常为 0 或个位数。
- [ ] 1000 Hz / 4000 Hz 以上回报率鼠标：轨迹平滑，无明显台阶。

**灵敏度**
- [ ] 设置页填入自己的 DPI / 灵敏度，刷新后仍在；输入 0、负数、空值时显示错误且不保存。
- [ ] 360° 校准：在鼠标垫上移动「理论 cm/360」的距离，累计转角约 360°（±2%），与 CS2 内转身一致；R 归零可用。
- [ ] PSA：每组先有约 0.8 秒准备，然后必须处理满 6 个目标（命中或 4 秒超时）才进入跟枪，左上角显示「目标 n/6」；目标在画面外时边缘有红色箭头。7 轮流程能走完；中途 Esc 后该组会重做；结果可「应用为当前灵敏度」，记录页出现结果。PSA 手感（角速度）与游戏内相近。

**压枪训练 / 弹道学习**
- [ ] 示意弹道：按住开火 30 发约 3 秒（0.1 s 间隔）自动结束；松开提前结束；R 重置。单击或不足 5 发显示「射击太短，未计分」且不保存。换武器后上一把的结果消失。
- [ ] 认真压一梭子得分明显高于不压；容差圈、补偿线开关生效；4:3 拉伸时圈变成横向椭圆。
- [ ] 打开「停火恢复（近似）」后，快速点射时提示从第 N 发弹道开始。
- [ ] 选 AK-47 等真实武器：显示「仅记录模式」，不评分，记录页计入「仅记录」条数。
- [ ] 弹道学习：动画播放、暂停（空格）、从头播放（R）；切走标签页再回来不跳帧。

**界面**
- [ ] 首次打开（无痕窗口）各页顶部有填写设置的提示，填写后消失。
- [ ] 窄窗口（< 640 px）与 125% / 150% 系统缩放下布局不错乱，画布等比缩小。
- [ ] 手机打开显示「需要鼠标」提示。
- [ ] 地址栏输入不存在的路径（如 `/cs2-trainer/abc` 或 `#/abc`）能回到应用 / 显示「页面不存在」。

## 已知限制

- 浏览器无法完全复刻 CS2 的视野、帧延迟与输入链路；Firefox / Safari 不支持 `unadjustedMovement`，会显示警告。
- 压枪训练 / 弹道学习画布：以画布高度对应 CS2 垂直视野（73.74°，Hor+ 下所有比例相同）换算每度像素，再放大 ×3 便于观察；4:3 拉伸时横向乘以「显示器宽高比 ÷ 4/3」。这是中心附近的线性近似（±15° 内误差很小）；评分只依赖角度，不受显示缩放影响。
- PSA 画布按**显示器高度**换算每度像素，让角度/像素关系接近全屏游戏，但画布只是屏幕的一部分。
- 单个移动事件超过 1000 counts 会当作异常尖峰丢弃（Chrome 已知会偶发巨大 movementX/Y）；极高 DPI + 极快甩动理论上可能误伤，丢弃数量会显示在训练结果里。
- 浏览器无法得知 unadjustedMovement 是否真的生效，只能根据 `requestPointerLock` 是否接受该选项判断；不返回 Promise 的旧浏览器一律按「非原始输入」提示。
- 不模拟随机散布与镜头抖动；停火恢复只有近似模型（默认关闭）；FAMAS 连发模式不模拟。
- PSA 小任务用线性角度投影（小角度下足够准确），视野、帧率与游戏不同。

## 数据来源与致谢

- 武器参数：[SteamTracking/GameTracking-CS2](https://github.com/SteamTracking/GameTracking-CS2) 中的 `game/csgo/pak01_dir/scripts/weapons.vdata`（游戏数据版权归 Valve）。
- 弹道整体尺寸校验：[csstats.gg CS2 Spray Patterns](https://csstats.gg/spray-patterns)。
- yaw 常数：CS2/CS:GO/Apex 0.022、VALORANT 0.07、Overwatch 2 0.0066，参考 [Source2AllSensitivityConverter README](https://github.com/swiiftex/Source2AllSensitivityConverter)、[skin.club CS:GO→CS2 换算说明](https://community.skin.club/pro/tools/mouse-sensitivity-converter/csgo-to-cs2) 等公开资料。
- Pointer Lock / unadjustedMovement：[MDN](https://developer.mozilla.org/en-US/docs/Web/API/Element/requestPointerLock)。
- 代码均为本项目原创编写，未移植第三方项目代码。
