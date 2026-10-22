import { lazy, Suspense, useEffect } from 'react';
import { HashRouter, Link, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import Home from './pages/Home';
import { RawBadge, RawWarning } from './components/RawBadge';
import { Notices } from './components/Notices';

// 各训练页按需加载（Dexie / 画布代码只在用到时下载）
const Sens = lazy(() => import('./pages/Sens'));
const SprayTrainer = lazy(() => import('./pages/SprayTrainer'));
const SprayLearn = lazy(() => import('./pages/SprayLearn'));
const History = lazy(() => import('./pages/History'));

const TITLES: Record<string, string> = {
  '/': '设置',
  '/sens': '灵敏度',
  '/spray': '压枪训练',
  '/learn': '弹道学习',
  '/history': '记录'
};

function TitleSync() {
  const { pathname } = useLocation();
  useEffect(() => {
    document.title = `${TITLES[pathname] ?? '页面不存在'} · CS2 灵敏度 & 压枪练习`;
  }, [pathname]);
  return null;
}

function NotFound() {
  return (
    <div className="page">
      <h2>页面不存在</h2>
      <p>
        这个地址没有对应的页面。<Link to="/">回到设置页</Link>
      </p>
    </div>
  );
}

export default function App() {
  return (
    <HashRouter>
      <TitleSync />
      <a className="skip" href="#main">跳到正文</a>
      <header>
        <b>CS2 灵敏度 & 压枪练习</b>
        <nav aria-label="主导航">
          <NavLink to="/" end>设置</NavLink>
          <NavLink to="/sens">灵敏度</NavLink>
          <NavLink to="/spray">压枪训练</NavLink>
          <NavLink to="/learn">弹道学习</NavLink>
          <NavLink to="/history">记录</NavLink>
        </nav>
        <RawBadge />
      </header>
      <Notices />
      <RawWarning />
      <main id="main" tabIndex={-1}>
        <Suspense fallback={<div className="muted" role="status">加载中…</div>}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/sens" element={<Sens />} />
            <Route path="/spray" element={<SprayTrainer />} />
            <Route path="/learn" element={<SprayLearn />} />
            <Route path="/history" element={<History />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </main>
      <footer className="muted">
        非官方粉丝工具，与 Valve 无关。仅用于手动练习：不含宏、不控制鼠标、不读取游戏内存。
      </footer>
    </HashRouter>
  );
}
