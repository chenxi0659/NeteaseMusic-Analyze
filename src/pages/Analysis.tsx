import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpRight,
  Clock3,
  Disc3,
  Heart,
  Info,
  Music2,
  Search,
  Users,
} from 'lucide-react';
import { aggregate, rankChanges, weight, type Metric } from '../../shared/analysis';
import type { Capture, RankRow } from '../../shared/types';
import { Chart, barOption, colors } from '../Chart';
import { Empty, Panel, type PageContext } from '../App';
import { date, duration, num, request, type CaptureIndex } from '../api';

const labels = { tracks: '曲目数', plays: '返回的播放次数', score: '官方排行分数' };
export function AnalysisPage(
  ctx: PageContext & { page: string; search: string; setSearch: (s: string) => void },
) {
  const { state, index, demo, notify, page, search, setSearch } = ctx;
  const [source, setSource] = useState('rank-all');
  const [selected, setSelected] = useState('latest');
  const [baseline, setBaseline] = useState('previous');
  const [capture, setCapture] = useState<Capture | null>(null);
  const [previous, setPrevious] = useState<Capture | null>(null);
  const [likes, setLikes] = useState<string[]>([]);
  const [metric, setMetric] = useState<Metric>('tracks');
  const [tab, setTab] = useState<'songs' | 'artists' | 'albums'>('songs');
  const [sort, setSort] = useState('rank');
  const [likedOnly, setLikedOnly] = useState(false);
  const [tablePage, setTablePage] = useState(1);
  const [detail, setDetail] = useState<RankRow | null>(null);
  const suffix = demo ? '?demo=1' : '';
  const available = index.filter((c) => c.source_id === source && !c.error);
  const chosen =
    selected === 'latest' ? available[0] : available.find((c) => c.id === Number(selected));
  const compare =
    baseline === 'previous'
      ? available.find((c) => chosen && c.id < chosen.id)
      : available.find((c) => c.id === Number(baseline));
  useEffect(() => {
    setSelected('latest');
    setBaseline('previous');
    setCapture(null);
    setPrevious(null);
    setTablePage(1);
  }, [source, demo]);
  useEffect(() => {
    let active = true;
    setCapture(null);
    if (chosen)
      request<Capture>(`/captures/${chosen.id}${suffix}`)
        .then((c) => {
          if (active) setCapture(c);
        })
        .catch((e) => notify(e.message));
    return () => {
      active = false;
    };
  }, [chosen?.id, suffix]);
  useEffect(() => {
    let active = true;
    setPrevious(null);
    if (compare)
      request<Capture>(`/captures/${compare.id}${suffix}`)
        .then((c) => {
          if (active) setPrevious(c);
        })
        .catch((e) => notify(e.message));
    return () => {
      active = false;
    };
  }, [compare?.id, suffix]);
  useEffect(() => {
    let active = true;
    const c = index.find((c) => c.source_id === 'likes' && !c.error);
    setLikes([]);
    if (c)
      request<Capture>(`/captures/${c.id}${suffix}`)
        .then((c) => {
          if (active) setLikes((c.payload.ids || []).map(String));
        })
        .catch((e) => notify(e.message));
    return () => {
      active = false;
    };
  }, [index.find((c) => c.source_id === 'likes' && !c.error)?.id, suffix]);
  const rows = capture?.rows || [];
  const filtered = useMemo(
    () =>
      rows.filter(
        (r) =>
          (!likedOnly || likes.includes(r.id)) &&
          `${r.name} ${r.artists.map((a) => a.name).join(' ')} ${r.album}`
            .toLowerCase()
            .includes(search.toLowerCase()),
      ),
    [rows, search, likedOnly, likes],
  );
  const artists = aggregate(filtered, 'artist', metric),
    albums = aggregate(filtered, 'album', metric);
  const sum = filtered.reduce((s, r) => s + (weight(r, metric) || 0), 0);
  const playRows = filtered.filter((r) => r.value !== null);
  const times = filtered.filter((r) => r.duration !== null).map((r) => r.duration!);
  const knownYears = filtered.filter((r) => r.publishTime && r.publishTime > 0);
  const yearMap = new Map<string, number>();
  for (const r of knownYears) {
    const key = String(new Date(r.publishTime!).getUTCFullYear());
    yearMap.set(key, (yearMap.get(key) || 0) + 1);
  }
  const yearData = [...yearMap]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([name, value]) => ({ name, value }));
  const changes = rankChanges(filtered, previous?.rows || []);
  const ordered = [...changes].sort((a, b) =>
    sort === 'rank'
      ? a.rank - b.rank
      : sort === 'plays'
        ? (b.value ?? -1) - (a.value ?? -1)
        : sort === 'duration'
          ? (b.duration ?? -1) - (a.duration ?? -1)
          : (b.publishTime ?? -1) - (a.publishTime ?? -1),
  );
  const currentSource = state.sources.find((s) => s.id === source)!;
  useEffect(() => setTablePage(1), [search, likedOnly, sort, tab, capture?.id]);
  const topArtist = artists[0];
  return (
    <>
      <div className="filterbar">
        <div className="filter-group">
          <span>分析数据</span>
          <select
            aria-label="分析数据源"
            value={source}
            onChange={(e) => setSource(e.target.value)}
          >
            {state.sources
              .filter((s) => ['rank', 'recent'].includes(s.kind))
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
          </select>
          <select
            aria-label="数据快照"
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
          >
            <option value="latest">最近一次成功采集</option>
            {available.map((c) => (
              <option key={c.id} value={c.id}>
                {c.period} · {date(c.fetched_at, true)}
              </option>
            ))}
          </select>
        </div>
        <span className="filter-meta">
          {capture ? `${capture.period} · ${num(rows.length)} 首` : '尚无可用快照'}
        </span>
      </div>
      <div className="source-note">
        <Info size={15} />
        <span>
          {currentSource.description} {capture && `采集于 ${date(capture.fetched_at, true)}。`}
        </span>
      </div>
      {!capture?.rows.length ? (
        <Panel title="你的听歌档案">
          <Empty
            title={capture ? '接口未返回可识别的歌曲列表' : '这个数据源还没有记录'}
            text={
              capture
                ? '原始响应已保留，可以前往周期报告查看字段，或在数据管理中检查接口状态。'
                : '同步后选择可用的数据源；受账号权限影响，不同接口的覆盖范围可能不同。'
            }
          />
        </Panel>
      ) : (
        <>
          <div className="stats-grid">
            <Stat
              icon={<Music2 size={20} />}
              label="当前样本歌曲"
              value={num(filtered.length)}
              unit="首"
              caption={`${likedOnly ? '仅已喜欢 · ' : ''}原始快照 ${rows.length} 首`}
            />
            <Stat
              icon={<Users size={20} />}
              label="参与歌手"
              value={num(new Set(filtered.flatMap((r) => r.artists.map((a) => a.id))).size)}
              unit="位"
              caption="合作歌曲包含所有参与歌手"
            />
            <Stat
              icon={<HeadphonesIcon />}
              label="已返回播放次数"
              value={playRows.length ? num(playRows.reduce((s, r) => s + r.value!, 0)) : '—'}
              unit={playRows.length ? '次' : ''}
              caption={`${playRows.length} / ${filtered.length} 首有计数，不代表全部收听`}
            />
            <Stat
              icon={<Clock3 size={20} />}
              label="平均歌曲长度"
              value={times.length ? duration(times.reduce((a, b) => a + b, 0) / times.length) : '—'}
              caption="曲目元数据，不是实际听歌时长"
            />
          </div>
          {page === 'overview' && (
            <div className="insight-banner">
              <div>
                <span className="eyebrow">A LITTLE ABOUT YOUR TASTE</span>
                <h2>
                  {topArtist ? (
                    <>
                      {topArtist.name}
                      <span>，在你的音乐里占有一席之地。</span>
                    </>
                  ) : (
                    '你的音乐档案正在生长。'
                  )}
                </h2>
                <p>
                  按{labels[metric]}统计，当前样本占比{' '}
                  {sum && topArtist ? num((topArtist.value / sum) * 100, 1) : '—'}
                  %。合作歌曲按参与歌手平均分配权重。
                </p>
              </div>
              <div className="record-art">
                <span />
                <Disc3 size={70} strokeWidth={0.7} />
              </div>
            </div>
          )}
          <div className="section-toolbar">
            <div>
              <h2>偏好画像</h2>
              <p>分析范围随上方数据源和筛选条件变化</p>
            </div>
            <div className="segmented">
              {(['tracks', 'plays', 'score'] as Metric[]).map((m) => (
                <button
                  className={metric === m ? 'selected' : ''}
                  key={m}
                  onClick={() => setMetric(m)}
                >
                  {m === 'tracks' ? '按曲目' : m === 'plays' ? '按次数' : '按分数'}
                </button>
              ))}
            </div>
          </div>
          <div className="two-columns">
            <Panel
              title="常听歌手"
              caption={`${labels[metric]} · 合作歌曲均分权重`}
              action={<span className="tag">TOP 8</span>}
            >
              {artists.length ? (
                <Chart option={barOption(artists.slice(0, 8))} />
              ) : (
                <Empty title="该口径没有可用数值" text="可以切换为按曲目统计。" />
              )}
            </Panel>
            <Panel title="专辑分布" caption={`${labels[metric]} · 前 5 张专辑与其余样本`}>
              {albums.length ? (
                <div className="donut-layout">
                  <Chart
                    height={260}
                    option={{
                      color: colors,
                      tooltip: { trigger: 'item', formatter: '{b}<br/>{c} · {d}%' },
                      series: [
                        {
                          type: 'pie',
                          radius: ['60%', '79%'],
                          center: ['50%', '50%'],
                          label: { show: false },
                          itemStyle: { borderColor: '#fff', borderWidth: 4 },
                          data: [
                            ...albums.slice(0, 5),
                            ...(albums.length > 5
                              ? [
                                  {
                                    name: '其余专辑',
                                    value: albums.slice(5).reduce((s, r) => s + r.value, 0),
                                  },
                                ]
                              : []),
                          ],
                        },
                      ],
                    }}
                  />
                  <div className="legend-list">
                    {albums.slice(0, 5).map((a, i) => (
                      <div key={a.name}>
                        <i style={{ background: colors[i] }} />
                        <span title={a.name}>{a.name}</span>
                        <strong>{sum ? num((a.value / sum) * 100, 1) : 0}%</strong>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <Empty title="该口径没有可用数值" text="可以切换为按曲目统计。" />
              )}
            </Panel>
          </div>
          {page === 'library' && (
            <div className="two-columns">
              <Panel title="发行年份" caption={`${knownYears.length} 首有发行时间 · 按歌曲数统计`}>
                {yearData.length ? (
                  <Chart option={barOption(yearData, false)} />
                ) : (
                  <Empty title="暂无发行时间" text="仅展示 API 实际返回的时间字段。" />
                )}
              </Panel>
              <Panel title="歌曲长度分布" caption="按曲目数统计，与实际收听时长无关">
                <Chart
                  option={barOption(
                    [
                      { name: '< 3 分钟', value: times.filter((t) => t < 180000).length },
                      {
                        name: '3–4 分钟',
                        value: times.filter((t) => t >= 180000 && t < 240000).length,
                      },
                      {
                        name: '4–5 分钟',
                        value: times.filter((t) => t >= 240000 && t < 300000).length,
                      },
                      { name: '≥ 5 分钟', value: times.filter((t) => t >= 300000).length },
                    ],
                    false,
                  )}
                />
              </Panel>
            </div>
          )}
          <Panel
            title="音乐明细"
            caption="点击歌曲查看元数据；名次变化以所选快照为基准"
            action={<span className="tag">{num(filtered.length)} 首</span>}
          >
            <div className="table-tools">
              <div className="tabs">
                {[
                  ['songs', '歌曲'],
                  ['artists', '歌手'],
                  ['albums', '专辑'],
                ].map(([id, name]) => (
                  <button
                    key={id}
                    className={tab === id ? 'active' : ''}
                    onClick={() => setTab(id as any)}
                  >
                    {name}
                  </button>
                ))}
              </div>
              <div className="table-filters">
                <label className="search">
                  <Search size={15} />
                  <input
                    aria-label="搜索音乐明细"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="搜索歌曲、歌手、专辑"
                  />
                </label>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={likedOnly}
                    onChange={(e) => setLikedOnly(e.target.checked)}
                  />
                  已喜欢
                </label>
              </div>
            </div>
            {tab === 'songs' ? (
              <>
                <div className="table-subtools">
                  <span>排行基准</span>
                  <select
                    aria-label="对比快照"
                    value={baseline}
                    onChange={(e) => setBaseline(e.target.value)}
                  >
                    <option value="previous">上一份成功快照</option>
                    {available
                      .filter((c) => c.id !== chosen?.id)
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.period} · {date(c.fetched_at, true)}
                        </option>
                      ))}
                  </select>
                  <span className="muted">
                    {previous ? `对比 ${previous.period}，未上榜不等于未播放` : '尚无对比快照'}
                  </span>
                  <select
                    aria-label="明细排序"
                    value={sort}
                    onChange={(e) => setSort(e.target.value)}
                  >
                    <option value="rank">按原始名次</option>
                    <option value="plays">按播放次数</option>
                    <option value="duration">按歌曲长度</option>
                    <option value="release">按发行时间</option>
                  </select>
                </div>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>歌曲 / 歌手</th>
                        <th>专辑</th>
                        <th>播放次数</th>
                        <th>排行分数</th>
                        <th>长度</th>
                        <th>名次变化</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ordered.slice((tablePage - 1) * 30, tablePage * 30).map((r) => (
                        <tr key={r.id}>
                          <td className="rank">{String(r.rank).padStart(2, '0')}</td>
                          <td>
                            <button className="song-cell" onClick={() => setDetail(r)}>
                              <Cover row={r} />
                              <span>
                                <strong>
                                  {r.name}
                                  {likes.includes(r.id) && (
                                    <Heart size={12} className="heart" fill="currentColor" />
                                  )}
                                </strong>
                                <small>
                                  {r.artists.map((a) => a.name).join(' / ') || '未知歌手'}
                                </small>
                              </span>
                            </button>
                          </td>
                          <td className="album-cell" title={r.album}>
                            {r.album || '—'}
                          </td>
                          <td className="numeric">{num(r.value)}</td>
                          <td className="muted numeric">{num(r.score)}</td>
                          <td className="muted numeric">{duration(r.duration)}</td>
                          <td>
                            {!previous ? (
                              <span className="muted">—</span>
                            ) : r.change === null ? (
                              <span className="new-label">新上榜</span>
                            ) : r.change === 0 ? (
                              <span className="muted">持平</span>
                            ) : (
                              <span className={r.change > 0 ? 'change-up' : 'change-down'}>
                                {r.change > 0 ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
                                {Math.abs(r.change)}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {!filtered.length && (
                  <Empty title="没有匹配的歌曲" text="试试其他关键词或取消已喜欢筛选。" />
                )}
                <div className="pagination">
                  <span>{filtered.length} 首 · 仅统计当前快照返回内容</span>
                  <div>
                    <button disabled={tablePage === 1} onClick={() => setTablePage((p) => p - 1)}>
                      上一页
                    </button>
                    <span>
                      {tablePage} / {Math.max(1, Math.ceil(filtered.length / 30))}
                    </span>
                    <button
                      disabled={tablePage * 30 >= filtered.length}
                      onClick={() => setTablePage((p) => p + 1)}
                    >
                      下一页
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>{tab === 'artists' ? '歌手' : '专辑'}</th>
                      <th>覆盖歌曲</th>
                      <th>{labels[metric]}</th>
                      <th>样本权重占比</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(tab === 'artists' ? artists : albums).map((r, i) => (
                      <tr key={`${r.name}-${i}`}>
                        <td>{i + 1}</td>
                        <td>
                          <strong>{r.name}</strong>
                        </td>
                        <td>{r.tracks}</td>
                        <td>{num(r.value, 2)}</td>
                        <td>
                          <div className="share-cell">
                            <span style={{ width: `${sum ? (r.value / sum) * 100 : 0}%` }} />
                            <small>{sum ? num((r.value / sum) * 100, 1) : 0}%</small>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </>
      )}
      {detail && (
        <div className="modal-backdrop" onClick={() => setDetail(null)}>
          <section
            className="modal detail-modal"
            role="dialog"
            aria-modal="true"
            aria-label="歌曲详情"
            onClick={(e) => e.stopPropagation()}
          >
            <button className="modal-close" onClick={() => setDetail(null)} aria-label="关闭">
              ×
            </button>
            <Cover row={detail} />
            <h2>{detail.name}</h2>
            <p>{detail.artists.map((a) => a.name).join(' / ')}</p>
            <dl>
              {[
                ['专辑', detail.album || '—'],
                ['歌曲 ID', detail.id],
                ['歌曲长度', duration(detail.duration)],
                ['发行日期', date(detail.publishTime)],
                ['热度（API 原值）', num(detail.popularity)],
                ['播放次数', num(detail.value)],
                ['官方排行分数', num(detail.score)],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
            {!demo && (
              <a
                className="button primary"
                href={`https://music.163.com/song?id=${detail.id}`}
                target="_blank"
                rel="noreferrer"
              >
                在网易云查看
                <ArrowUpRight size={15} />
              </a>
            )}
          </section>
        </div>
      )}
    </>
  );
}
function HeadphonesIcon() {
  return <Music2 size={20} />;
}
export function Stat({
  icon,
  label,
  value,
  unit,
  caption,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  unit?: string;
  caption: string;
}) {
  return (
    <section className="stat">
      <div className="stat-label">
        {label}
        <span>{icon}</span>
      </div>
      <div className="stat-value">
        {value}
        <small>{unit}</small>
      </div>
      <p>{caption}</p>
    </section>
  );
}
export function Cover({ row }: { row: RankRow }) {
  return (
    <span className={`cover cover-${Number(row.id.replace(/\D/g, '').slice(-1)) % 5}`}>
      {row.cover ? (
        <img src={row.cover} alt="" loading="lazy" referrerPolicy="no-referrer" />
      ) : (
        <Disc3 size={24} strokeWidth={1.2} />
      )}
    </span>
  );
}
