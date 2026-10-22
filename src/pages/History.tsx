import { useEffect, useMemo, useRef, useState } from 'react';
import { clearAttempts, listAttempts, listPsaResults, type AttemptRecord, type PsaResultRecord } from '../core/replay/db';
import { buildTrend, weaponsIn, type TrendPoint } from '../core/replay/trend';
import { drawTrend } from '../render/trendChart';

function TrendCanvas({ pts, title, dashed }: { pts: TrendPoint[]; title: string; dashed?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current!;
    const draw = () => drawTrend(c, pts, { title, dashed });
    draw();
    window.addEventListener('resize', draw);
    return () => window.removeEventListener('resize', draw);
  }, [pts, title, dashed]);
  return <canvas ref={ref} className="chart" style={{ width: '100%', height: 220 }} />;
}

export default function History() {
  const [rows, setRows] = useState<AttemptRecord[]>([]);
  const [psa, setPsa] = useState<PsaResultRecord[]>([]);
  const [filter, setFilter] = useState('all');
  const reload = () => {
    listAttempts(1000).then(setRows);
    listPsaResults().then(setPsa);
  };
  useEffect(reload, []);
  const weapons = useMemo(() => weaponsIn(rows), [rows]);
  const trend = useMemo(() => buildTrend(rows, filter), [rows, filter]);
  const shown = filter === 'all' ? rows : rows.filter((r) => r.weaponId === filter);

  return (
    <div className="page">
      <h2>训练记录</h2>
      <p className="muted">记录保存在本机 IndexedDB 中，清除浏览器数据会丢失。</p>
      <div className="row">
        <label>
          武器筛选{' '}
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="all">全部</option>
            {weapons.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
                {w.isDemo ? '（示意数据）' : ''}
              </option>
            ))}
          </select>
        </label>
        <button
          onClick={async () => {
            if (confirm('确定清空全部压枪记录？')) {
              await clearAttempts();
              reload();
            }
          }}
        >
          清空记录
        </button>
      </div>

      <h3>成绩趋势（真实武器数据）</h3>
      <TrendCanvas pts={trend.real} title="真实弹道评分：总分 / 前 10 发" />
      {trend.real.length === 0 && (
        <p className="muted">
          暂无真实武器的评分。目前内置武器的逐发弹道都待实测，只能「仅记录」——实测并填入 perBullet 后这里才会有数据。
        </p>
      )}
      {trend.unscored > 0 && <p className="muted">另有 {trend.unscored} 条仅记录（无逐发弹道、未评分）的尝试未计入趋势。</p>}

      {trend.demo.length > 0 && (
        <>
          <h3>
            示意数据趋势 <span className="tag">示意数据，非游戏真实弹道</span>
          </h3>
          <TrendCanvas pts={trend.demo} title="示意弹道评分（仅用于测试功能，不代表游戏内压枪水平）" dashed />
        </>
      )}

      <h3>明细</h3>
      <table>
        <thead>
          <tr><th>时间</th><th>武器</th><th>发数</th><th>总分</th><th>前 10 发</th><th>平均误差</th><th>灵敏度/DPI</th><th>原始输入</th></tr>
        </thead>
        <tbody>
          {shown.map((r) => (
            <tr key={r.id}>
              <td>{new Date(r.createdAt).toLocaleString('zh-CN')}</td>
              <td>{r.weaponName}{r.isDemo && <span className="tag">示意数据</span>}</td>
              <td>{r.shotsFired}</td>
              <td>{r.score ? r.score.total : '—'}</td>
              <td>{r.score ? r.score.first10 : '—'}</td>
              <td>{r.score ? `${r.score.meanErrDeg.toFixed(2)}°` : '—'}</td>
              <td>{r.sens} / {r.dpi}</td>
              <td>{r.rawInput ? '是' : '否'}</td>
            </tr>
          ))}
          {shown.length === 0 && (
            <tr><td colSpan={8} className="muted">暂无记录，去「压枪训练」打一梭子吧。</td></tr>
          )}
        </tbody>
      </table>

      <h3>PSA 找灵敏度结果</h3>
      <table>
        <thead>
          <tr><th>时间</th><th>起始灵敏度</th><th>结果灵敏度</th><th>cm/360</th><th>DPI</th><th>轮数</th></tr>
        </thead>
        <tbody>
          {psa.map((r) => (
            <tr key={r.id}>
              <td>{new Date(r.createdAt).toLocaleString('zh-CN')}</td>
              <td>{r.startSens}</td>
              <td><b>{r.finalSens}</b></td>
              <td>{r.cm360.toFixed(1)}</td>
              <td>{r.dpi}</td>
              <td>{r.rounds.length}</td>
            </tr>
          ))}
          {psa.length === 0 && (
            <tr><td colSpan={6} className="muted">暂无。可在「灵敏度」页运行 PSA 找灵敏度。</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
