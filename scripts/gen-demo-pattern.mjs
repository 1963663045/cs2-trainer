// 生成「示意」弹道：平滑的合成曲线，仅用于测试可视化与评分流程。
// 它不是 CS2 的真实弹道，不得当作真实数据展示。
import { writeFileSync } from 'node:fs';
const N = 30;
const pts = [];
for (let k = 0; k < N; k++) {
  const y = 9 * (1 - Math.exp(-k / 4.5)) + 0.08 * k; // 先快速上升后趋缓
  const x = k < 9 ? 0.15 * Math.sin(k / 3) : 2.6 * Math.sin((k - 9) / 4.2); // 后段左右摆动
  pts.push({ shot: k + 1, x: +x.toFixed(3), y: +y.toFixed(3) });
}
const data = {
  id: 'demo',
  name: '示意弹道（DEMO）',
  isDemo: true,
  demoNotice: '示意数据，非游戏真实弹道',
  cycleTime: 0.1,
  clipSize: 30,
  sources: { perBullet: 'scripts/gen-demo-pattern.mjs 生成的合成曲线（非游戏数据）', cycleTime: '借用 AK-47 的 m_flCycleTime=0.1（weapons.vdata）' },
  perBullet: pts,
  notes: ['仅用于测试界面、计时与评分；请勿用于学习真实压枪。']
};
writeFileSync(new URL('../public/data/weapons/demo-pattern.json', import.meta.url), JSON.stringify(data, null, 2));
console.log('demo-pattern.json written');
