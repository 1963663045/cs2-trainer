import { HashRouter, NavLink, Route, Routes } from 'react-router-dom';
import Home from './pages/Home';
import Sens from './pages/Sens';
import SprayTrainer from './pages/SprayTrainer';
import SprayLearn from './pages/SprayLearn';
import History from './pages/History';
import { RawBadge, RawWarning } from './components/RawBadge';

export default function App() {
  return (
    <HashRouter>
      <header>
        <b>CS2 灵敏度 & 压枪练习</b>
        <nav>
          <NavLink to="/" end>设置</NavLink>
          <NavLink to="/sens">灵敏度</NavLink>
          <NavLink to="/spray">压枪训练</NavLink>
          <NavLink to="/learn">弹道学习</NavLink>
          <NavLink to="/history">记录</NavLink>
        </nav>
        <RawBadge />
      </header>
      <RawWarning />
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/sens" element={<Sens />} />
          <Route path="/spray" element={<SprayTrainer />} />
          <Route path="/learn" element={<SprayLearn />} />
          <Route path="/history" element={<History />} />
        </Routes>
      </main>
      <footer className="muted">
        非官方粉丝工具，与 Valve 无关。仅用于手动练习：不含宏、不控制鼠标、不读取游戏内存。
      </footer>
    </HashRouter>
  );
}
