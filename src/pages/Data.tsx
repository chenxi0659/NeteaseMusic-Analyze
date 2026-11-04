import { useState } from 'react';
import { ArrowDownToLine, Check, Clock3, Database, FileJson, RefreshCw, Save } from 'lucide-react';
import { Empty, Panel, type PageContext } from '../App';
import { date, num, post, request } from '../api';
import { Stat } from './Analysis';

export async function saveDownload(path: string, notify: (message: string) => void) {
  try {
    const response = await fetch(`/api${path}`);
    if (!response.ok) throw new Error((await response.json()).error);
    const disposition = response.headers.get('Content-Disposition') || '';
    const encoded = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
    const plain = disposition.match(/filename="([^"]+)"/)?.[1];
    const blob = await response.blob(),
      url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = encoded ? decodeURIComponent(encoded) : plain || 'export';
    a.click();
    URL.revokeObjectURL(url);
  } catch (e: any) {
    notify(e.message);
    throw e;
  }
}
export function DataPage({ state, index, demo, reload, notify }: PageContext) {
  const [interval, setInterval] = useState(state.settings.intervalMinutes);
  const [limit, setLimit] = useState(state.settings.recentLimit);
  const [months, setMonths] = useState(6);
  const [year, setYear] = useState(new Date().getFullYear() - 1);
  const [weekEnd, setWeekEnd] = useState('');
  const [selection, setSelection] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const locked = demo || !state.profile || state.syncing || busy;
  async function action(fn: () => Promise<any>, message: string) {
    setBusy(true);
    try {
      await fn();
      await reload();
      notify(message);
    } catch (e: any) {
      notify(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="stats-grid">
        <Stat
          icon={<Database size={20} />}
          label="成功数据快照"
          value={num(state.counts.captures)}
          unit="份"
          caption="包括报告和排行，不是播放次数"
        />
        <Stat
          icon={<FileJson size={20} />}
          label="保存歌曲"
          value={num(state.counts.tracks)}
          unit="首"
          caption="当前账号下的不同歌曲 ID"
        />
        <Stat
          icon={<Clock3 size={20} />}
          label="开始积累"
          value={date(state.counts.first)}
          caption="首份成功响应的采集日期"
        />
        <Stat
          icon={<RefreshCw size={20} />}
          label="自动同步"
          value={state.settings.intervalMinutes ? String(state.settings.intervalMinutes) : '已关闭'}
          unit={state.settings.intervalMinutes ? '分钟' : ''}
          caption="后端运行且电脑未休眠时执行"
        />
      </div>
      <div className="two-columns">
        <Panel title="采集设置" caption="只采集数据，不执行播放、打卡或歌单修改">
          <div className="form-body">
            <label>
              自动同步间隔
              <select
                aria-label="自动同步间隔"
                value={interval}
                onChange={(e) => setInterval(Number(e.target.value))}
              >
                {[
                  [0, '关闭自动同步'],
                  [15, '15 分钟'],
                  [30, '30 分钟（推荐）'],
                  [60, '60 分钟'],
                  [120, '120 分钟'],
                ].map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
            <label>
              最近播放请求条数
              <select
                aria-label="最近播放条数"
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value))}
              >
                {[100, 300, 1000].map((v) => (
                  <option key={v} value={v}>
                    {v} 条
                  </option>
                ))}
              </select>
            </label>
            <p className="muted">请求数量不保证实际返回数量，也不能保证恢复全部历史记录。</p>
            <button
              className="button primary"
              disabled={demo || busy}
              onClick={() =>
                action(
                  () =>
                    request('/settings', {
                      method: 'PUT',
                      body: JSON.stringify({ intervalMinutes: interval, recentLimit: limit }),
                    }),
                  '采集设置已保存',
                )
              }
            >
              <Save size={16} />
              保存设置
            </button>
          </div>
        </Panel>
        <Panel title="历史数据回填" caption="在 API 和账号权限允许的范围内，读取已结束的周期">
          <div className="form-body">
            <div className="inline-form">
              <label>
                历史月份
                <select
                  aria-label="回填月份数"
                  value={months}
                  onChange={(e) => setMonths(Number(e.target.value))}
                >
                  {[1, 3, 6, 12, 24].map((v) => (
                    <option key={v} value={v}>
                      最近 {v} 个完整月份
                    </option>
                  ))}
                </select>
              </label>
              <button
                className="button secondary"
                disabled={locked}
                onClick={() => action(() => post('/history', { months }), '历史月份回填已开始')}
              >
                回填月报告
              </button>
            </div>
            <div className="inline-form">
              <label>
                年度报告
                <select
                  aria-label="回填年份"
                  value={year}
                  onChange={(e) => setYear(Number(e.target.value))}
                >
                  {Array.from(
                    { length: new Date().getFullYear() - 2017 },
                    (_, i) => new Date().getFullYear() - 1 - i,
                  ).map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </label>
              <button
                className="button secondary"
                disabled={locked}
                onClick={() => action(() => post('/history', { year }), '年度报告回填已开始')}
              >
                回填年报告
              </button>
            </div>
            <div className="inline-form">
              <label>
                历史周截止（周六）
                <input
                  aria-label="历史周截止日期"
                  type="date"
                  value={weekEnd}
                  onChange={(e) => setWeekEnd(e.target.value)}
                />
              </label>
              <button
                className="button secondary"
                disabled={locked || !weekEnd}
                onClick={() => action(() => post('/history', { weekEnd }), '周报告回填已开始')}
              >
                回填周报告
              </button>
            </div>
            <p className="muted">部分年度总结接口仅支持特定年份；失败原因会保存在下方状态中。</p>
          </div>
        </Panel>
      </div>
      <Panel
        title="数据源状态"
        caption="勾选数据源可以单独同步；失败不会覆盖已有的成功快照"
        action={
          <button
            className="button secondary compact"
            disabled={locked || !selection.length}
            onClick={() =>
              action(() => post('/sync', { sources: selection }), '选中的数据源开始同步')
            }
          >
            <RefreshCw size={14} />
            同步所选 {selection.length ? `(${selection.length})` : ''}
          </button>
        }
      >
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>
                  <input
                    aria-label="全选常规数据源"
                    type="checkbox"
                    checked={selection.length === state.sources.length - 1}
                    onChange={(e) =>
                      setSelection(
                        e.target.checked
                          ? state.sources.filter((s) => s.id !== 'annual').map((s) => s.id)
                          : [],
                      )
                    }
                  />
                </th>
                <th>数据源 / 接口</th>
                <th>最近状态</th>
                <th>最近成功采集</th>
                <th>返回曲目</th>
              </tr>
            </thead>
            <tbody>
              {state.sources.map((s) => {
                const latest = index.find((c) => c.source_id === s.id),
                  ok = index.find((c) => c.source_id === s.id && !c.error);
                return (
                  <tr key={s.id}>
                    <td>
                      <input
                        type="checkbox"
                        aria-label={`选择${s.title}`}
                        disabled={s.id === 'annual'}
                        checked={selection.includes(s.id)}
                        onChange={(e) =>
                          setSelection((v) =>
                            e.target.checked ? [...v, s.id] : v.filter((id) => id !== s.id),
                          )
                        }
                      />
                    </td>
                    <td>
                      <strong>{s.title}</strong>
                      <small className="block muted">{s.path}</small>
                    </td>
                    <td>
                      {latest ? (
                        latest.error ? (
                          <details className="error-details">
                            <summary>请求失败</summary>
                            <p>{latest.error}</p>
                          </details>
                        ) : (
                          <span className="status success">
                            <Check size={12} />
                            已采集
                          </span>
                        )
                      ) : (
                        <span className="muted">未采集</span>
                      )}
                    </td>
                    <td className="muted">{date(ok?.fetched_at, true)}</td>
                    <td>{ok && ['rank', 'recent'].includes(s.kind) ? ok.row_count : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>
      <div className="two-columns">
        <Panel
          title="导出与备份"
          caption="导出当前账号的分析数据；数据库备份包含本机已采集的所有账号数据"
        >
          <div className="form-body">
            <button
              className="export-option"
              disabled={demo || !state.profile || busy}
              onClick={() => action(() => saveDownload('/export', notify), '分析数据已导出')}
            >
              <FileJson size={23} />
              <span>
                <strong>导出完整数据 · JSON</strong>
                <small>报告、排行快照、带时间记录和来源参数</small>
              </span>
              <ArrowDownToLine size={18} />
            </button>
            <button
              className="export-option"
              disabled={demo || !state.profile || busy}
              onClick={() => action(() => saveDownload('/backup', notify), 'SQLite 数据库已备份')}
            >
              <Database size={23} />
              <span>
                <strong>备份数据库 · SQLite</strong>
                <small>包含已采集数据和设置，不含登录 Cookie</small>
              </span>
              <ArrowDownToLine size={18} />
            </button>
            <p className="muted">歌单的 Excel / Markdown 导出在「歌单导出」页面。</p>
          </div>
        </Panel>
        <Panel title="同步任务" caption="最近 30 次同步结果，包括中断与部分成功">
          {!state.jobs.length ? (
            <Empty
              title="还没有同步任务"
              text={demo ? '演示数据不会写入数据库或触发采集。' : '连接账号后点击同步数据。'}
            />
          ) : (
            <div className="job-list">
              {state.jobs.map((j) => (
                <div key={j.id}>
                  <span
                    className={`status ${j.status === 'success' ? 'success' : j.status === 'running' ? 'running' : 'warning'}`}
                  >
                    {
                      (
                        {
                          success: '完成',
                          partial: '部分成功',
                          running: '进行中',
                          failed: '失败',
                          interrupted: '中断',
                        } as any
                      )[j.status]
                    }
                  </span>
                  <div>
                    <strong>{j.message}</strong>
                    <small>
                      {date(j.started_at, true)} · 成功 {j.success} / 失败 {j.failed}
                    </small>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
      <Panel title="数据口径">
        <div className="method-grid">
          <div>
            <h4>快照不是播放流水</h4>
            <p>排行每天保存一份，不会把同一周期的多份排行相加。不同接口的统计也不合并累计。</p>
          </div>
          <div>
            <h4>缺失不等于零</h4>
            <p>未返回的计数显示为「—」；Top 20 之外的歌曲不记作零次播放。</p>
          </div>
          <div>
            <h4>中断期间可能缺记录</h4>
            <p>电脑关机、休眠或接口失效会中断采集。恢复后只补取接口仍能提供的数据。</p>
          </div>
          <div>
            <h4>恢复本地备份</h4>
            <p>
              关闭服务后，将备份复制为 data/music.sqlite，并移走原数据库对应的 -wal 和 -shm
              文件，再重新启动。
            </p>
          </div>
        </div>
      </Panel>
    </>
  );
}
