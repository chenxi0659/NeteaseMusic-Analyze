import express from 'express';
import { resolve, join } from 'node:path';
import { existsSync, mkdirSync } from 'node:fs';
import { backup } from 'node:sqlite';
import { Store } from './store.js';
import { Upstream } from './upstream.js';
import { Collector, historySpecs, type RequestSpec } from './sync.js';
import { sources } from './catalog.js';
import { demoData } from './demo.js';
import { fetchPlaylist, listPlaylists, playlistMarkdown, playlistExcel } from './playlists.js';
import { passwordLogin } from './auth.js';

const dataDir = resolve(process.env.DATA_DIR || 'data');
mkdirSync(dataDir, { recursive: true });
const store = new Store(join(dataDir, 'music.sqlite'));
const api = new Upstream(dataDir);
const collector = new Collector(store, api);
collector.schedule();
const demo = demoData();
const playlistCache = new Map<string, any[]>();
const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '64kb' }));
app.use('/api', (req, res, next) => {
  // Keep the local account's write endpoints same-origin, including when accessed by other websites.
  if (
    req.method !== 'GET' &&
    req.headers.origin &&
    ![
      'http://127.0.0.1:5173',
      `http://127.0.0.1:${process.env.PORT || 3001}`,
      'http://localhost:5173',
      `http://localhost:${process.env.PORT || 3001}`,
    ].includes(req.headers.origin)
  ) {
    res.status(403).json({ error: '请从本地工具页面发起操作' });
    return;
  }
  res.setHeader('Cache-Control', 'no-store');
  next();
});
const profile = () => store.setting<any>('profile', null);
const uid = () => profile()?.userId || '';
const requireLogin: express.RequestHandler = (_req, res, next) => {
  if (!uid() || !api.cookie) {
    res.status(401).json({ error: '请先登录网易云音乐' });
    return;
  }
  next();
};

app.get('/api/state', (req, res) => {
  const isDemo = req.query.demo === '1';
  const index: any[] = isDemo
    ? demo.captures.map((c) => ({ ...c, row_count: c.rows.length }))
    : store.index(uid());
  const latest = sources.flatMap((s) => {
    const c = index.find((c) => c.source_id === s.id);
    return c
      ? [
          {
            source_id: s.id,
            title: s.title,
            fetched_at: c.fetched_at,
            error: c.error,
            row_count: c.row_count,
          },
        ]
      : [];
  });
  res.json({
    profile: isDemo ? { userId: 'demo', nickname: '音乐漫游者', avatarUrl: '' } : profile(),
    settings: collector.settings(),
    syncing: collector.running,
    sources,
    sourceStatus: latest,
    jobs: isDemo ? [] : store.jobs(uid()),
    counts: isDemo
      ? {
          captures: index.length,
          tracks: 24,
          observations: demo.observations.length,
          first: Date.now() - 180 * 86400000,
          last: Date.now(),
        }
      : store.counts(uid()),
  });
});
app.get('/api/captures', (req, res) => {
  const index =
    req.query.demo === '1'
      ? demo.captures.map(({ payload, rows, ...c }) => ({ ...c, row_count: rows.length }))
      : store.index(uid());
  res.json(index);
});
app.get('/api/captures/:id', (req, res) => {
  const id = Number(req.params.id);
  const capture =
    req.query.demo === '1' ? demo.captures.find((c) => c.id === id) : store.capture(uid(), id);
  if (!capture) {
    res.status(404).json({ error: '未找到数据快照' });
    return;
  }
  res.json(capture);
});
app.get('/api/observations', (req, res) =>
  res.json(req.query.demo === '1' ? demo.observations : store.observations(uid())),
);
app.post('/api/auth/qr', async (_req, res) => {
  const keyResponse = await api.call('login_qr_key', {}, false);
  const key = keyResponse.data?.unikey;
  if (!key) throw new Error('二维码生成失败，请重试');
  const image = await api.call('login_qr_create', { key, qrimg: true }, false);
  res.json({ key, image: image.data.qrimg });
});
app.post('/api/auth/password', async (req, res) => {
  if (collector.running) {
    res.status(409).json({ error: '请等待当前同步结束后切换账号' });
    return;
  }
  try {
    const session = await passwordLogin(api, req.body || {});
    if (collector.running) {
      res.status(409).json({ error: '同步任务已经开始，请结束后重新登录' });
      return;
    }
    api.setCookie(session.cookie);
    store.set('profile', session.profile);
    res.json({ profile: session.profile });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});
app.post('/api/auth/check', async (req, res) => {
  if (collector.running) {
    res.status(409).json({ error: '请等待当前同步结束后切换账号' });
    return;
  }
  const body = await api.call(
    'login_qr_check',
    { key: String(req.body.key), noCookie: true },
    false,
  );
  if (body.code === 803 && body.cookie) {
    const p = await api.profile(body.cookie);
    if (collector.running) {
      res.status(409).json({ error: '同步任务已经开始，请结束后重新登录' });
      return;
    }
    api.setCookie(body.cookie);
    store.set('profile', p);
    res.json({ code: 803, profile: p });
  } else res.json({ code: body.code, message: body.message });
});
app.post('/api/auth/verify', requireLogin, async (_req, res) => {
  const p = await api.profile();
  store.set('profile', p);
  res.json(p);
});
app.post('/api/auth/logout', (_req, res) => {
  if (collector.running) {
    res.status(409).json({ error: '请等待同步结束后退出登录' });
    return;
  }
  api.setCookie('');
  store.set('profile', null);
  res.json({ ok: true });
});
app.post('/api/sync', requireLogin, (req, res) => {
  if (collector.running) {
    res.status(409).json({ error: '已有同步任务正在运行' });
    return;
  }
  const ids = req.body.sources as string[] | undefined;
  if (
    ids &&
    (!Array.isArray(ids) ||
      !ids.length ||
      ids.some((id) => !sources.some((s) => s.id === id) || id === 'annual'))
  ) {
    res.status(400).json({ error: '请选择有效数据源' });
    return;
  }
  void collector.run(ids?.map((sourceId) => ({ sourceId }))).catch(console.error);
  res.status(202).json({ ok: true });
});
app.post('/api/history', requireLogin, (req, res) => {
  if (collector.running) {
    res.status(409).json({ error: '已有同步任务正在运行' });
    return;
  }
  let specs: RequestSpec[];
  if (req.body.year) {
    const year = Number(req.body.year);
    if (!Number.isInteger(year) || year < 2017 || year > new Date().getFullYear() - 1) {
      res.status(400).json({ error: '请选择 2017 年至上一年的年份' });
      return;
    }
    specs = [
      { sourceId: 'annual', params: { year } },
      {
        sourceId: 'report-year',
        params: { endTime: new Date(`${year}-12-31T00:00:00+08:00`).getTime() },
      },
    ];
  } else if (req.body.weekEnd) {
    const endTime = new Date(`${req.body.weekEnd}T00:00:00+08:00`).getTime();
    if (
      !Number.isFinite(endTime) ||
      new Date(`${req.body.weekEnd}T00:00:00Z`).getUTCDay() !== 6 ||
      endTime > Date.now()
    ) {
      res.status(400).json({ error: '周报告截止日期请选择已过去的周六' });
      return;
    }
    specs = ['foot-week', 'report-week'].map((sourceId) => ({ sourceId, params: { endTime } }));
  } else {
    const months = Number(req.body.months);
    if (!Number.isInteger(months) || months < 1 || months > 24) {
      res.status(400).json({ error: '回填范围为 1–24 个月' });
      return;
    }
    specs = historySpecs(months);
  }
  void collector.run(specs).catch(console.error);
  res.status(202).json({ ok: true });
});
app.put('/api/settings', (req, res) => {
  const { intervalMinutes, recentLimit } = req.body;
  if (![0, 15, 30, 60, 120].includes(intervalMinutes) || ![100, 300, 1000].includes(recentLimit)) {
    res.status(400).json({ error: '设置值不在支持范围内' });
    return;
  }
  store.set('settings', { intervalMinutes, recentLimit });
  collector.schedule();
  res.json(collector.settings());
});
app.get('/api/export', requireLogin, (_req, res) => {
  res.attachment('listening-data.json').json({
    version: 1,
    exportedAt: Date.now(),
    profile: profile(),
    captures: store.captures(uid()),
    observations: store.observations(uid()),
  });
});
app.get('/api/backup', requireLogin, async (_req, res) => {
  const file = join(dataDir, 'backup.sqlite');
  await backup(store.db, file);
  res.download(file, 'music-backup.sqlite');
});
app.get('/api/playlists', requireLogin, async (_req, res) => {
  const list = await listPlaylists(api, uid());
  playlistCache.set(uid(), list);
  res.json(list);
});
app.get('/api/playlists/:id/export', requireLogin, async (req, res) => {
  const id = String(req.params.id);
  if (!/^\d+$/.test(id)) {
    res.status(400).json({ error: '歌单 ID 应为数字' });
    return;
  }
  const data = await fetchPlaylist(api, id);
  data.subscribedAt ||= playlistCache.get(uid())?.find((p) => p.id === id)?.subscribedAt || null;
  const format = req.query.format;
  const name = data.name.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').slice(0, 80) || 'playlist';
  if (format === 'xlsx') {
    res.attachment(`${name}.xlsx`).send(Buffer.from(await playlistExcel(data)));
  } else if (format === 'md') {
    res.attachment(`${name}.md`).type('text/markdown; charset=utf-8').send(playlistMarkdown(data));
  } else res.json(data);
});
app.get('/api/health', (_req, res) => res.json({ ok: true }));
if (existsSync(resolve('dist/client/index.html'))) {
  app.use(express.static(resolve('dist/client')));
  app.get('/{*path}', (_req, res) => res.sendFile(resolve('dist/client/index.html')));
}
app.use((error: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  res.status(500).json({ error: error.message || '操作失败' });
});
const port = Number(process.env.PORT || 3001);
const server = app.listen(port, '127.0.0.1', () =>
  console.log(`听迹 API: http://127.0.0.1:${port}`),
);
server.on('error', (e: any) => {
  console.error(e.code === 'EADDRINUSE' ? `端口 ${port} 已被占用` : e.message);
  process.exit(1);
});
function stop() {
  clearInterval(collector.timer);
  server.close(() => {
    store.db.close();
    process.exit(0);
  });
}
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
