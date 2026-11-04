import { useEffect, useState } from 'react';
import {
  ArrowDownToLine,
  FileSpreadsheet,
  FileText,
  ListMusic,
  RefreshCw,
  Search,
} from 'lucide-react';
import { Empty, Panel, type PageContext } from '../App';
import { request, date, duration, num } from '../api';
import { saveDownload } from './Data';

export function PlaylistsPage({ state, demo, notify }: PageContext) {
  const [playlists, setPlaylists] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState('');
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<any>(null);
  const [manual, setManual] = useState('');
  async function load() {
    setLoading(true);
    setError('');
    try {
      setPlaylists(await request('/playlists'));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    if (state.profile && !demo) void load();
  }, [state.profile?.userId, demo]);
  async function exportFile(id: string, format: string) {
    setExporting(`${id}-${format}`);
    try {
      await saveDownload(`/playlists/${id}/export?format=${format}`, notify);
      notify('歌单已导出');
    } catch {
      /* saveDownload shows the API error. */
    } finally {
      setExporting('');
    }
  }
  async function inspect(id: string) {
    setExporting(`${id}-preview`);
    try {
      setPreview(await request(`/playlists/${id}/export`));
    } catch (e: any) {
      notify(e.message);
    } finally {
      setExporting('');
    }
  }
  const visible = playlists.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) &&
      (filter === 'all' || (filter === 'owned' ? p.owned : !p.owned)),
  );
  return (
    <>
      <div className="export-hero">
        <div className="export-hero-icon">
          <FileSpreadsheet size={36} strokeWidth={1.3} />
        </div>
        <div>
          <div className="eyebrow">TAKE YOUR MUSIC WITH YOU</div>
          <h2>把你的喜欢，留成一份清单。</h2>
          <p>
            导出歌曲、歌手、专辑、长度、链接及接口提供的时间。大歌单分批补齐详情，保持原始顺序。
          </p>
        </div>
      </div>
      <div className="source-note">
        <ListMusic size={16} />
        <span>
          收藏歌单时间与歌曲加入歌单的时间分别处理。API 的 trackIds.at
          会作为「歌单条目时间」导出并注明来源；含义未核验时不直接标为收藏时间，未提供则留空。
        </span>
      </div>
      <Panel
        title="我的歌单"
        caption="包含创建与收藏的歌单，按接口返回顺序展示"
        action={
          <button
            className="button secondary compact"
            disabled={loading || demo || !state.profile}
            onClick={load}
          >
            <RefreshCw size={14} className={loading ? 'spin' : ''} />
            刷新歌单
          </button>
        }
      >
        <div className="table-tools">
          <div className="tabs">
            {[
              ['all', '全部'],
              ['owned', '我创建的'],
              ['saved', '我收藏的'],
            ].map(([v, l]) => (
              <button key={v} className={filter === v ? 'active' : ''} onClick={() => setFilter(v)}>
                {l}
              </button>
            ))}
          </div>
          <label className="search">
            <Search size={15} />
            <input
              aria-label="搜索歌单"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索歌单名称"
            />
          </label>
        </div>
        {error && <div className="notice error">{error}</div>}
        {loading ? (
          <div className="loading">
            <RefreshCw className="spin" size={18} />
            正在获取全部歌单…
          </div>
        ) : visible.length ? (
          <div className="playlist-grid">
            {visible.map((p) => (
              <article className="playlist-card" key={p.id}>
                <div className="playlist-heading">
                  <div className="playlist-cover">
                    {p.cover ? (
                      <img src={p.cover} alt="" loading="lazy" referrerPolicy="no-referrer" />
                    ) : (
                      <ListMusic size={30} />
                    )}
                  </div>
                  <div>
                    <span className="tag">{p.owned ? '我创建的' : '我收藏的'}</span>
                    <h3>{p.name}</h3>
                    <p>
                      {num(p.trackCount)} 首 · {p.creator}
                    </p>
                  </div>
                </div>
                <dl>
                  <div>
                    <dt>最近更新</dt>
                    <dd>{date(p.updatedAt)}</dd>
                  </div>
                  <div>
                    <dt>收藏歌单时间</dt>
                    <dd>{p.owned ? '—' : date(p.subscribedAt)}</dd>
                  </div>
                </dl>
                <div className="playlist-actions">
                  <button disabled={!!exporting} onClick={() => inspect(p.id)}>
                    预览
                  </button>
                  <button disabled={!!exporting} onClick={() => exportFile(p.id, 'xlsx')}>
                    <FileSpreadsheet size={15} />
                    {exporting === `${p.id}-xlsx` ? '导出中…' : 'Excel'}
                  </button>
                  <button disabled={!!exporting} onClick={() => exportFile(p.id, 'md')}>
                    <FileText size={15} />
                    {exporting === `${p.id}-md` ? '导出中…' : 'Markdown'}
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <Empty
            title={
              demo
                ? '连接真实账号后导出歌单'
                : !state.profile
                  ? '先连接你的网易云账号'
                  : '没有匹配的歌单'
            }
            text={
              demo
                ? '演示模式不会读取账号或生成伪造的个人歌单。'
                : '可导出当前账号有权限访问的歌单，也可以在下方输入歌单 ID。'
            }
          />
        )}
      </Panel>
      <Panel
        title="按歌单链接或 ID 导出"
        caption="适合导出公开歌单，以及未显示在列表中的可访问歌单"
      >
        <div className="manual-export">
          <input
            aria-label="歌单链接或 ID"
            placeholder="粘贴网易云歌单链接，或输入歌单 ID"
            value={manual}
            onChange={(e) => setManual(e.target.value)}
          />
          <button
            className="button secondary"
            disabled={demo || !state.profile || !!exporting || !manual.trim()}
            onClick={() => {
              const id = manual.match(/[?&]id=(\d+)/)?.[1] || manual.trim();
              if (!/^\d+$/.test(id)) {
                notify('请输入有效歌单链接或数字 ID');
                return;
              }
              void inspect(id);
            }}
          >
            读取并预览
          </button>
        </div>
      </Panel>
      {preview && (
        <Panel
          title={preview.name}
          caption={`声明 ${preview.declaredCount} 首 · 返回 ${preview.rows.length} 条 · ${date(preview.fetchedAt, true)}`}
          action={
            <div className="button-row">
              <button
                className="button secondary compact"
                disabled={!!exporting}
                onClick={() => exportFile(preview.id, 'xlsx')}
              >
                <FileSpreadsheet size={15} />
                Excel
              </button>
              <button
                className="button secondary compact"
                disabled={!!exporting}
                onClick={() => exportFile(preview.id, 'md')}
              >
                <FileText size={15} />
                Markdown
              </button>
            </div>
          }
        >
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>歌曲</th>
                  <th>歌手</th>
                  <th>长度</th>
                  <th>歌单条目时间</th>
                  <th>字段来源</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.slice(0, 100).map((r: any) => (
                  <tr key={`${r.index}-${r.id}`}>
                    <td>{r.index}</td>
                    <td>{r.track?.name || `详情不可用 · ${r.id}`}</td>
                    <td>{r.track?.artists.map((a: any) => a.name).join(' / ') || '—'}</td>
                    <td>{duration(r.track?.duration ?? null)}</td>
                    <td>{date(r.addedAt, true)}</td>
                    <td className="muted">{r.addedAtSource || '未返回'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="source-note">
            预览前 100 条，导出包含全部返回条目。API 不提供的详情与时间留空。
          </p>
        </Panel>
      )}
    </>
  );
}
