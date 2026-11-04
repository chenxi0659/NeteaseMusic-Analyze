import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Activity,
  ArrowDownToLine,
  ArrowUpRight,
  AudioLines,
  BarChart3,
  ChevronRight,
  Database,
  Disc3,
  FlaskConical,
  Headphones,
  LayoutDashboard,
  Library,
  ListMusic,
  RefreshCw,
  Search,
  Settings2,
  X,
} from 'lucide-react';
import type { AppState, Capture } from '../shared/types';
import { request, post, date, type CaptureIndex, type Observation } from './api';
import { AnalysisPage } from './pages/Analysis';
import { ActivityPage } from './pages/Activity';
import { ReportsPage } from './pages/Reports';
import { DataPage } from './pages/Data';
import { PlaylistsPage } from './pages/Playlists';
import { LoginModal } from './LoginModal';

const pages = [
  {
    id: 'overview',
    label: '听歌总览',
    icon: LayoutDashboard,
    subtitle: '每一首听过的歌，都留下自己的轨迹。',
  },
  {
    id: 'library',
    label: '歌曲与歌手',
    icon: Library,
    subtitle: '从歌曲、歌手和专辑，重新认识你的偏好。',
  },
  {
    id: 'activity',
    label: '收听习惯',
    icon: Activity,
    subtitle: '让可追溯的时间记录，描绘日常的节奏。',
  },
  {
    id: 'reports',
    label: '周期报告',
    icon: BarChart3,
    subtitle: '浏览官方报告，对比不同周期的真实变化。',
  },
  {
    id: 'playlists',
    label: '歌单导出',
    icon: ListMusic,
    subtitle: '把喜欢的音乐整理成一份可以带走的清单。',
  },
  {
    id: 'data',
    label: '数据管理',
    icon: Database,
    subtitle: '同步、回填、备份，让每一个数字都有出处。',
  },
];
export interface PageContext {
  state: AppState;
  index: CaptureIndex[];
  observations: Observation[];
  demo: boolean;
  reload: () => Promise<void>;
  notify: (message: string) => void;
}
export function Empty({
  title = '还没有可分析的数据',
  text = '连接网易云账号并同步数据，开始积累你的听歌档案。',
  children,
}: {
  title?: string;
  text?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <Disc3 size={30} />
      </div>
      <h3>{title}</h3>
      <p>{text}</p>
      {children}
    </div>
  );
}
export function Panel({
  title,
  caption,
  children,
  action,
  className = '',
}: {
  title: string;
  caption?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel ${className}`}>
      <div className="panel-heading">
        <div>
          <h3>{title}</h3>
          {caption && <p>{caption}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
export function App() {
  const [demo, setDemo] = useState(new URLSearchParams(location.search).get('demo') === '1');
  const mode = useRef(demo);
  mode.current = demo;
  const [page, setPage] = useState(location.hash.slice(1) || 'overview');
  const [state, setState] = useState<AppState | null>(null);
  const [index, setIndex] = useState<CaptureIndex[]>([]);
  const [observations, setObservations] = useState<Observation[]>([]);
  const [toast, setToast] = useState('');
  const [login, setLogin] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [page]);
  const suffix = demo ? '?demo=1' : '';
  const reload = useCallback(async () => {
    try {
      const [s, c, o] = await Promise.all([
        request<AppState>(`/state${suffix}`),
        request<CaptureIndex[]>(`/captures${suffix}`),
        request<Observation[]>(`/observations${suffix}`),
      ]);
      if (mode.current !== demo) return;
      setState(s);
      setIndex(c);
      setObservations(o);
      setError('');
    } catch (e: any) {
      setError(e.message);
    }
  }, [suffix]);
  useEffect(() => {
    setState(null);
    setIndex([]);
    setObservations([]);
    void reload();
  }, [reload]);
  useEffect(() => {
    const timer = setInterval(reload, state?.syncing ? 3000 : 60000);
    return () => clearInterval(timer);
  }, [reload, state?.syncing]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(''), 6000);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    const handler = () => setPage(location.hash.slice(1) || 'overview');
    window.addEventListener('hashchange', handler);
    return () => window.removeEventListener('hashchange', handler);
  }, []);
  const current = pages.find((p) => p.id === page) || pages[0];
  function changeDemo(enabled: boolean) {
    history.replaceState(
      null,
      '',
      `${location.pathname}${enabled ? '?demo=1' : ''}${location.hash}`,
    );
    setDemo(enabled);
  }
  async function sync() {
    try {
      await post('/sync');
      await reload();
      setToast('开始同步，可在数据管理中查看进度');
    } catch (e: any) {
      setToast(e.message);
    }
  }
  const ctx: PageContext | null = state
    ? { state, index, observations, demo, reload, notify: setToast }
    : null;
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#overview">
          <span className="brand-mark">
            <AudioLines size={23} />
          </span>
          <span>
            听迹<small>MUSIC ANALYZE</small>
          </span>
          <span className="version">v0.1</span>
        </a>
        <div className="nav-label">我的音乐档案</div>
        <nav>
          {pages.map((p) => (
            <a key={p.id} href={`#${p.id}`} className={current.id === p.id ? 'active' : ''}>
              <p.icon size={19} />
              {p.label}
              {current.id === p.id && <span className="nav-dot" />}
            </a>
          ))}
        </nav>
        <div className="sidebar-note">
          <Headphones size={22} />
          <h4>让喜欢，有迹可循。</h4>
          <p>
            专注听歌数据，记录那些
            <br />
            陪伴过你的声音。
          </p>
          <span>LOCAL FIRST · 个人档案</span>
        </div>
        <button
          className="sidebar-footer"
          onClick={() => {
            location.hash = 'data';
          }}
        >
          <Settings2 size={17} />
          同步与设置
          <ChevronRight size={15} />
        </button>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            我的空间
            <ChevronRight size={14} />
            <strong>{current.label}</strong>
          </div>
          <div className="topbar-right">
            <span className="local-badge">
              <i />
              本地工作区
            </span>
            <button className="profile-button" onClick={() => setLogin(true)}>
              <span className="avatar">
                {state?.profile?.nickname.slice(0, 1) || <Headphones size={16} />}
              </span>
              {state?.profile?.nickname || '连接账号'}
              <ChevronRight size={14} />
            </button>
          </div>
        </header>
        <main>
          {demo && (
            <div className="demo-banner">
              <span>
                <FlaskConical size={16} />
                正在浏览合成演示数据，与真实账号档案分开存放。
              </span>
              <button onClick={() => changeDemo(false)}>
                退出演示
                <X size={14} />
              </button>
            </div>
          )}
          <div className="page-header">
            <div>
              <div className="eyebrow">YOUR LISTENING JOURNAL</div>
              <h1>
                {current.label}
                <span className="title-dot">.</span>
              </h1>
              <p>{current.subtitle}</p>
            </div>
            <div className="page-actions">
              {!demo && (
                <button className="button secondary" onClick={() => changeDemo(true)}>
                  <FlaskConical size={16} />
                  查看演示
                </button>
              )}
              <button
                className="button primary"
                disabled={demo || state?.syncing}
                onClick={() => (state?.profile ? sync() : setLogin(true))}
              >
                <RefreshCw size={16} className={state?.syncing ? 'spin' : ''} />
                {state?.syncing ? '正在同步' : state?.profile ? '同步数据' : '连接网易云'}
              </button>
            </div>
          </div>
          {error && (
            <div className="notice error">
              无法读取数据：{error}
              <button onClick={reload}>重试</button>
            </div>
          )}
          {!state && !error && (
            <div className="loading">
              <RefreshCw size={20} className="spin" />
              正在打开你的音乐档案…
            </div>
          )}
          {ctx && (
            <>
              {!state!.profile && (
                <div className="connect-banner">
                  <div className="connect-art">
                    <AudioLines size={42} />
                  </div>
                  <div>
                    <h2>从你喜欢的音乐开始。</h2>
                    <p>连接网易云，查看排行与报告，并持续积累自己的听歌档案。</p>
                    <div>
                      <button className="button primary" onClick={() => setLogin(true)}>
                        连接账号
                        <ArrowUpRight size={15} />
                      </button>
                      <button className="button text" onClick={() => changeDemo(true)}>
                        先看看演示
                        <ChevronRight size={15} />
                      </button>
                    </div>
                  </div>
                </div>
              )}
              {['overview', 'library'].includes(current.id) && (
                <AnalysisPage {...ctx} page={current.id} search={search} setSearch={setSearch} />
              )}
              {current.id === 'activity' && <ActivityPage {...ctx} />}
              {current.id === 'reports' && <ReportsPage {...ctx} />}
              {current.id === 'playlists' && <PlaylistsPage {...ctx} />}
              {current.id === 'data' && <DataPage {...ctx} />}
              <footer className="page-footer">
                <span>
                  <AudioLines size={14} />
                  听迹 · 每一份偏好，都值得被看见
                </span>
                <span>
                  北京时间 ·{' '}
                  {state!.counts.last
                    ? `最近采集 ${date(state!.counts.last, true)}`
                    : '尚未开始采集'}
                </span>
              </footer>
            </>
          )}
        </main>
      </div>
      {toast && (
        <div role="status" className="toast">
          {toast}
          <button aria-label="关闭提示" onClick={() => setToast('')}>
            <X size={15} />
          </button>
        </div>
      )}
      {login && (
        <LoginModal
          onClose={() => setLogin(false)}
          onSuccess={() => {
            if (demo) changeDemo(false);
            else void reload();
            setLogin(false);
          }}
          notify={setToast}
          profile={demo ? null : state?.profile}
        />
      )}
    </div>
  );
}
