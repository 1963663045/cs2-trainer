// 端到端测试：使用 VITE_E2E=1 的测试构建。该构建用「假锁定」替代真实 Pointer Lock，
// 并允许测试脚本向本页面自己的输入层注入模拟鼠标移动（生产构建中不存在这些代码）。
import { expect, test, type Page } from '@playwright/test';

const errors: string[] = [];

test.beforeEach(async ({ page }) => {
  errors.length = 0;
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
});

test.afterEach(() => {
  expect(errors, `页面错误：\n${errors.join('\n')}`).toEqual([]);
});

/** 在页面里按理想补偿路径注入移动（从 mousedown 的时间戳开始），返回 Promise 在注入完成后结束 */
async function armCompensation(page: Page, opts: { scale: number }) {
  await page.evaluate(async ({ scale }) => {
    const w = await (await fetch('data/weapons/demo-pattern.json')).json();
    const st = JSON.parse(localStorage.getItem('cs2-trainer-settings') || '{"state":{}}').state;
    const dpc = (st.sens ?? 1) * (st.mYaw ?? 0.022);
    const pat: { x: number; y: number }[] = w.perBullet;
    const cyc = w.cycleTime * 1000;
    // 目标：视角 = -弹道 × scale（scale=1 为完美补偿，0 为完全不压）
    const target = (t: number) => {
      const k = Math.min(pat.length - 1, t / cyc);
      const i = Math.floor(k);
      const f = Math.min(1, k - i);
      const a = pat[i];
      const b = pat[Math.min(pat.length - 1, i + 1)];
      return { x: -(a.x + (b.x - a.x) * f) * scale, y: -(a.y + (b.y - a.y) * f) * scale };
    };
    const canvas = document.querySelector('[data-testid=trainer-canvas]')!;
    (window as unknown as { __done: Promise<void> }).__done = new Promise<void>((resolve) => {
      canvas.addEventListener(
        'mousedown',
        (e) => {
          const t0 = (e as MouseEvent).timeStamp;
          let cx = 0;
          let cy = 0; // 已发送的累计 counts
          const step = () => {
            const t = performance.now() - t0;
            const v = target(t);
            // 视角 x = cx*dpc；视角 y = -cy*dpc
            const wantX = Math.round(v.x / dpc);
            const wantY = Math.round(-v.y / dpc);
            if (wantX !== cx || wantY !== cy) {
              window.__cs2e2e!.move(wantX - cx, wantY - cy, 1);
              cx = wantX;
              cy = wantY;
            }
            if (t < pat.length * cyc + 50) setTimeout(step, 2);
            else resolve();
          };
          step();
        },
        { once: true }
      );
    });
  }, opts);
}

async function spray(page: Page, scale: number) {
  await armCompensation(page, { scale });
  const canvas = page.getByTestId('trainer-canvas');
  const box = (await canvas.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.evaluate(() => (window as unknown as { __done: Promise<void> }).__done);
  await expect(page.getByTestId('trainer-result')).toBeVisible();
  await page.mouse.up();
  return Number(await page.getByTestId('score-total').textContent());
}

async function lockTrainer(page: Page) {
  await page.getByTestId('trainer-canvas').click();
  await expect(page.getByTestId('trainer-canvas')).toHaveAttribute('data-locked', '1');
}

test('所有页面可以打开，标题与导航正确，未知路由显示 404', async ({ page }) => {
  await page.goto('./');
  await expect(page).toHaveTitle(/设置 · CS2/);
  for (const [name, title] of [
    ['灵敏度', '灵敏度'],
    ['压枪训练', '压枪训练'],
    ['弹道学习', '弹道学习'],
    ['记录', '记录']
  ]) {
    await page.getByRole('navigation').getByRole('link', { name }).click();
    await expect(page.getByRole('heading', { level: 2 }).first()).toBeVisible();
    await expect(page).toHaveTitle(new RegExp(`${title} · CS2`));
  }
  await page.goto('./#/no-such-page');
  await expect(page.getByRole('heading', { name: '页面不存在' })).toBeVisible();
});

test('首次使用提示；设置校验；刷新后设置仍在', async ({ page }) => {
  await page.goto('./#/sens');
  await expect(page.getByTestId('onboarding')).toBeVisible();
  await page.goto('./');
  await page.getByTestId('f-dpi').fill('1600');
  await page.getByTestId('f-sens').fill('0.5');
  await expect(page.getByTestId('home-edpi')).toHaveText('800');
  await expect(page.getByTestId('home-cm360')).toHaveText('51.95 cm');
  // 非法值：显示错误，不写入
  await page.getByTestId('f-sens').fill('0');
  await expect(page.locator('#f-sens-hint')).toHaveText(/范围/);
  await expect(page.getByTestId('home-edpi')).toHaveText('800');
  await page.getByTestId('f-sens').fill('-3');
  await expect(page.getByTestId('f-sens')).toHaveAttribute('aria-invalid', 'true');
  await page.getByTestId('f-aspect').selectOption('4:3-stretched');
  await expect(page.getByTestId('home-hfov')).toHaveText('90.00°');
  await page.getByTestId('f-aspect').selectOption('16:10');
  await expect(page.getByTestId('home-hfov')).toHaveText('100.39°');
  await page.reload();
  await expect(page.getByTestId('f-dpi')).toHaveValue('1600');
  await expect(page.getByTestId('f-sens')).toHaveValue('0.5');
  await expect(page.getByTestId('f-aspect')).toHaveValue('16:10');
  await page.goto('./#/sens');
  await expect(page.getByTestId('onboarding')).toHaveCount(0);
});

test('灵敏度计算器与跨游戏换算', async ({ page }) => {
  await page.goto('./#/sens');
  await expect(page.getByTestId('sens-edpi')).toHaveText('800');
  await expect(page.getByTestId('sens-cm360')).toHaveText('51.95 cm');
  await page.getByTestId('conv-sens').fill('2');
  await expect(page.getByTestId('conv-valorant').locator('td').nth(2)).toHaveText('0.6286');
  await expect(page.getByTestId('conv-ow2').locator('td').nth(2)).toHaveText('6.6667');
  await page.getByTestId('conv-dpi').fill('1600');
  await expect(page.getByTestId('conv-cs2').locator('td').nth(2)).toHaveText('1.0000');
  await page.getByTestId('conv-sens').fill('0');
  await expect(page.getByTestId('conv-cs2').locator('td').nth(2)).toHaveText('—');
});

test('压枪训练：示意弹道完美补偿高分、不压低分，记录保存并出现在趋势图', async ({ page }) => {
  await page.goto('./#/spray');
  await expect(page.getByText('示意数据，非游戏真实弹道').first()).toBeVisible();
  await lockTrainer(page);
  const good = await spray(page, 1);
  expect(good).toBeGreaterThanOrEqual(85);
  const bad = await spray(page, 0);
  expect(bad).toBeLessThan(20);
  await expect(page.getByTestId('trainer-info')).toContainText('总分');

  // R 重置
  await page.keyboard.press('r');
  await expect(page.getByTestId('trainer-result')).toHaveCount(0);

  // 仅记录模式：AK-47 无逐发弹道
  await page.getByLabel('武器：').selectOption('ak47');
  await expect(page.locator('.banner.info', { hasText: '待实测' })).toBeVisible();
  // 仅记录：开火后不评分（画布仍处于锁定状态）
  await expect(page.getByTestId('trainer-canvas')).toHaveAttribute('data-locked', '1');
  const box = (await page.getByTestId('trainer-canvas').boundingBox())!;
  await page.mouse.move(box.x + 50, box.y + 50);
  await page.mouse.down();
  await page.evaluate(() => window.__cs2e2e!.move(0, 30, 1));
  await page.waitForTimeout(400);
  await page.mouse.up();
  await expect(page.getByTestId('trainer-info')).toContainText('仅记录，未评分');
  await expect(page.getByTestId('trainer-result')).toHaveCount(0);

  await page.getByRole('navigation').getByRole('link', { name: '记录' }).click();
  await expect(page.locator('tbody tr', { hasText: '示意弹道' })).toHaveCount(2);
  await expect(page.locator('tbody tr', { hasText: 'AK-47' })).toHaveCount(1);
  await expect(page.getByText('条仅记录')).toBeVisible();
  await expect(page.getByRole('heading', { name: /示意数据趋势/ })).toBeVisible();
  // 趋势图画布有内容（非全空像素）
  const painted = await page.locator('canvas.chart').nth(1).evaluate((c: HTMLCanvasElement) => {
    const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i + 1] > 150) n++; // 绿色/蓝色线条
    return n;
  });
  expect(painted).toBeGreaterThan(50);
  // 武器筛选
  await page.getByLabel('武器筛选').selectOption('demo');
  await expect(page.locator('tbody tr', { hasText: '示意弹道' })).toHaveCount(2);
});

test('压枪中途退出锁定：本次中断、不保存、不会卡在开火状态', async ({ page }) => {
  await page.goto('./#/spray');
  await lockTrainer(page);
  const canvas = page.getByTestId('trainer-canvas');
  const box = (await canvas.boundingBox())!;
  await page.mouse.move(box.x + 100, box.y + 100);
  await page.mouse.down();
  await page.evaluate(() => window.__cs2e2e!.move(5, 40, 1));
  await page.waitForTimeout(300);
  await page.evaluate(() => window.__cs2e2e!.unlock());
  await expect(page.getByTestId('trainer-info')).toContainText('中断');
  await expect(canvas).toHaveAttribute('data-locked', '0');
  await page.mouse.up();
  // 异常尖峰被过滤：重新锁定后注入一个巨大位移，再正常开火
  await lockTrainer(page);
  await page.evaluate(() => window.__cs2e2e!.move(50000, 0, 0));
  const s = await spray(page, 1);
  expect(s).toBeGreaterThanOrEqual(85);
  await expect(page.getByTestId('trainer-info')).toContainText('已过滤异常位移事件 1 个');
  await page.getByRole('navigation').getByRole('link', { name: '记录' }).click();
  await expect(page.locator('tbody tr', { hasText: '示意弹道' })).toHaveCount(1);
});

test('弹道学习页：动画运行、暂停、快捷键', async ({ page }) => {
  await page.goto('./#/learn');
  await expect(page.getByText('示意数据，非游戏真实弹道').first()).toBeVisible();
  await page.getByRole('button', { name: '暂停（空格）' }).click();
  await expect(page.getByRole('button', { name: '播放（空格）' })).toBeVisible();
  await page.keyboard.press(' ');
  await expect(page.getByRole('button', { name: '暂停（空格）' })).toBeVisible();
});

test('PSA 找灵敏度：5 轮盲测完成并保存结果', async ({ page }) => {
  await page.goto('./#/sens');
  await page.getByLabel('轮数').selectOption('5');
  await page.getByRole('button', { name: '开始' }).click();
  const canvas = page.getByTestId('psa-canvas');
  for (let round = 0; round < 5; round++) {
    for (let run = 0; run < 2; run++) {
      await canvas.click(); // 锁定（测试构建为假锁定）
      // 在页面内完成一组：瞄准每个目标并点击，然后等跟枪阶段结束
      await page.evaluate(async () => {
        type Task = { yaw: number; pitch: number; target: { yaw: number; pitch: number }; phase: string; degPerCount: number; done: boolean };
        const hook = window.__cs2e2e!;
        const cv = document.querySelector('[data-testid=psa-canvas]')!;
        const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
        const task = () => hook.psaTask!() as Task | null;
        while (task() && task()!.phase === 'ready') await sleep(20);
        let guard = 0;
        while (task() && task()!.phase === 'flick' && guard++ < 50) {
          const t = task()!;
          await sleep(30); // 等目标生成
          let dx = (t.target.yaw - t.yaw) / t.degPerCount;
          let dy = (t.pitch - t.target.pitch) / t.degPerCount;
          // 分段移动（单次不超过尖峰过滤上限）
          while (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
            const sx = Math.max(-400, Math.min(400, dx));
            const sy = Math.max(-400, Math.min(400, dy));
            hook.move(sx, sy, 0);
            dx -= sx;
            dy -= sy;
          }
          cv.dispatchEvent(new MouseEvent('mousedown', { button: 0, bubbles: true }));
          await sleep(20);
        }
        const t0 = performance.now();
        while (task() && !task()!.done && performance.now() - t0 < 8000) await sleep(50);
        await sleep(100);
      });
    }
    await page.getByRole('button', { name: 'A 手感更好' }).click();
  }
  await expect(page.getByTestId('psa-result')).toBeVisible();
  const fin = Number(await page.getByTestId('psa-final').textContent());
  expect(fin).toBeGreaterThan(0.5);
  expect(fin).toBeLessThan(1.5);
  await page.getByRole('navigation').getByRole('link', { name: '记录' }).click();
  await expect(page.getByRole('cell', { name: String(fin), exact: true })).toBeVisible();
});

test('单击 / 少于 5 发的点射不计分、不保存；换武器清除上一次结果', async ({ page }) => {
  await page.goto('./#/spray');
  await lockTrainer(page);
  const canvas = page.getByTestId('trainer-canvas');
  const box = (await canvas.boundingBox())!;
  await page.mouse.move(box.x + 200, box.y + 200);
  // 单击
  await page.mouse.down();
  await page.mouse.up();
  await expect(page.getByTestId('trainer-info')).toContainText('射击太短（1 发');
  await expect(page.getByTestId('trainer-result')).toHaveCount(0);
  // 4 发（0.1 s 间隔，按住约 0.35 s）
  await page.mouse.down();
  await page.waitForTimeout(350);
  await page.mouse.up();
  await expect(page.getByTestId('trainer-info')).toContainText(/射击太短（[34] 发/);
  // 正常一梭子 → 有结果；第 1 发标为不计分
  await spray(page, 1);
  await page.getByText('逐发误差').click();
  await expect(page.getByTestId('trainer-result').locator('tbody tr').first().locator('td').last()).toHaveText('不计分');
  // 换武器：结果与提示都被清掉
  await page.getByLabel('武器：').selectOption('ak47');
  await expect(page.locator('.banner.info', { hasText: '待实测' })).toBeVisible();
  await expect(page.getByTestId('trainer-result')).toHaveCount(0);
  await expect(page.getByTestId('trainer-info')).not.toContainText('总分');
  await page.getByRole('navigation').getByRole('link', { name: '记录' }).click();
  await expect(page.locator('tbody tr', { hasText: '示意弹道' })).toHaveCount(1);
  await expect(page.getByTestId('tz')).toHaveText(/.+\/.+|UTC/);
});

test('锁定 / 解锁时布局不跳动（非原始输入提示为浮层）', async ({ page }) => {
  await page.goto('./#/spray');
  await page.evaluate(() => (window.__cs2e2e!.fakeMode = 'os'));
  const canvas = page.getByTestId('trainer-canvas');
  await expect(page.locator('.banner.demo')).toBeVisible(); // 等武器数据加载完、布局稳定
  // 文档坐标（不受点击时自动滚动影响）
  const pos = (sel: string) =>
    page.evaluate((q) => {
      const r = document.querySelector(q)!.getBoundingClientRect();
      return { y: r.y + scrollY, x: r.x + scrollX, w: r.width, h: document.documentElement.scrollHeight };
    }, sel);
  const before = await pos('[data-testid=trainer-canvas]');
  const badgeBefore = await pos('[data-testid=raw-badge]');
  await canvas.click();
  await expect(canvas).toHaveAttribute('data-locked', '1');
  await expect(page.getByTestId('raw-warning')).toBeVisible();
  await expect(page.getByTestId('raw-badge')).toHaveText('非原始输入');
  const during = await pos('[data-testid=trainer-canvas]');
  const badgeDuring = await pos('[data-testid=raw-badge]');
  await page.evaluate(() => window.__cs2e2e!.unlock());
  await expect(page.getByTestId('raw-warning')).toHaveCount(0);
  const after = await pos('[data-testid=trainer-canvas]');
  expect(during).toEqual(before);
  expect(after).toEqual(before);
  expect(badgeDuring).toEqual(badgeBefore);
});

test('弹道学习：加载后从第 1 发开始播放不卡住；最近记录以绿色清晰叠加', async ({ page }) => {
  await page.goto('./#/spray');
  await lockTrainer(page);
  await spray(page, 0.6);
  await page.evaluate(() => window.__cs2e2e!.unlock());
  await page.getByRole('navigation').getByRole('link', { name: '弹道学习' }).click();
  const c = page.getByTestId('learn-canvas');
  await expect(c).toHaveAttribute('data-shot', /\d+/);
  const first = Number(await c.getAttribute('data-shot'));
  expect(first).toBeLessThanOrEqual(2);
  await page.waitForTimeout(1200);
  const later = Number(await c.getAttribute('data-shot'));
  expect(later).toBeGreaterThanOrEqual(first + 8);
  await expect(page.getByText('——暂无记录')).toHaveCount(0);
  await expect(c).toHaveAttribute('data-overlay', 'moving');
  // 回到开头并暂停：此时亮绿“已播放部分”几乎为 0，画面上的绿色主要来自淡绿完整轨迹
  await page.getByRole('button', { name: '从头播放（R）' }).click();
  await page.keyboard.press(' ');
  await expect(page.getByRole('button', { name: '播放（空格）' })).toBeVisible();
  await page.waitForTimeout(100);
  const px = await c.evaluate((el: HTMLCanvasElement) => {
    const d = el.getContext('2d')!.getImageData(0, 0, el.width, el.height).data;
    let green = 0;
    let red = 0;
    for (let i = 0; i < d.length; i += 4) {
      const [r, g, b] = [d[i], d[i + 1], d[i + 2]];
      if (g > 100 && g > r + 50 && g > b + 30) green++; // 色相明确为绿（排除灰、蓝）
      if (r > 130 && r > g + 50 && r > b + 50) red++; // 色相明确为红
    }
    return { green, red, shot: Number(el.dataset.shot) };
  });
  expect(px.shot).toBeLessThanOrEqual(2);
  expect(px.green).toBeGreaterThan(400);
  expect(px.red).toBeGreaterThan(400);
});

test('弹道学习：最近记录几乎没动鼠标时标注“几乎没有移动”', async ({ page }) => {
  await page.goto('./#/spray');
  await lockTrainer(page);
  await spray(page, 0); // 完全不压枪：视角不动
  await page.evaluate(() => window.__cs2e2e!.unlock());
  await page.getByRole('navigation').getByRole('link', { name: '弹道学习' }).click();
  await expect(page.getByTestId('learn-canvas')).toHaveAttribute('data-overlay', 'still');
});

test('PSA：锁定那一下点击不计，必须处理满 6 个目标才进入跟枪', async ({ page }) => {
  await page.goto('./#/sens');
  await page.getByRole('button', { name: '开始' }).click();
  const canvas = page.getByTestId('psa-canvas');
  await canvas.click(); // 锁定点击
  const st = () =>
    page.evaluate(() => {
      const t = window.__cs2e2e!.psaTask!() as { phase: string; results: string[]; missClicks: number } | null;
      return t ? { phase: t.phase, n: t.results.length, miss: t.missClicks } : null;
    });
  expect(await st()).toMatchObject({ n: 0, miss: 0 });
  await expect.poll(async () => (await st())?.phase).toBe('flick');
  // 两次空枪：仍是第 1 个目标
  const box = (await canvas.boundingBox())!;
  await page.mouse.click(box.x + 10, box.y + 10);
  await page.mouse.click(box.x + 10, box.y + 10);
  expect(await st()).toMatchObject({ phase: 'flick', n: 0, miss: 2 });
  // 依次命中 6 个目标，第 5 个之后仍在甩枪阶段
  for (let i = 0; i < 6; i++) {
    expect((await st())!.phase).toBe('flick');
    await page.evaluate(() => {
      const t = window.__cs2e2e!.psaTask!() as { yaw: number; pitch: number; target: { yaw: number; pitch: number }; degPerCount: number };
      let dx = (t.target.yaw - t.yaw) / t.degPerCount;
      let dy = (t.pitch - t.target.pitch) / t.degPerCount;
      while (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
        const sx = Math.max(-400, Math.min(400, dx));
        const sy = Math.max(-400, Math.min(400, dy));
        window.__cs2e2e!.move(sx, sy, 0);
        dx -= sx;
        dy -= sy;
      }
    });
    await page.mouse.click(box.x + 10, box.y + 10);
    expect((await st())!.n).toBe(i + 1);
  }
  expect((await st())!.phase).toBe('track');
});
