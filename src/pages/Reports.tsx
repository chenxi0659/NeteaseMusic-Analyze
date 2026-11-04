import { useEffect, useMemo, useState } from 'react';
import { Braces, FileJson, Search, TrendingUp } from 'lucide-react';
import { scalarFields } from '../../shared/analysis';
import type { Capture } from '../../shared/types';
import { Chart } from '../Chart';
import { Empty, Panel, type PageContext } from '../App';
import { request, date, download, num } from '../api';
import { CycleReports } from './Cycles';

export function ReportsPage(ctx: PageContext) {
  const [view, setView] = useState('analysis');
  return (
    <>
      <div className="view-switch">
        <button className={view === 'analysis' ? 'active' : ''} onClick={() => setView('analysis')}>
          分析报告
        </button>
        <button className={view === 'raw' ? 'active' : ''} onClick={() => setView('raw')}>
          原始字段与导出
        </button>
      </div>
      {view === 'analysis' ? <CycleReports {...ctx} /> : <RawReportsPage {...ctx} />}
    </>
  );
}

function RawReportsPage({ index, state, demo, notify }: PageContext) {
  const [source, setSource] = useState('report-month');
  const [selected, setSelected] = useState('latest');
  const [capture, setCapture] = useState<Capture | null>(null);
  const [snapshots, setSnapshots] = useState<Capture[]>([]);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState('fields');
  const [field, setField] = useState('');
  const suffix = demo ? '?demo=1' : '';
  const available = index.filter((c) => c.source_id === source && !c.error);
  const chosen =
    selected === 'latest' ? available[0] : available.find((c) => c.id === Number(selected));
  useEffect(() => {
    setSelected('latest');
    setField('');
    setSearch('');
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
  const fields = useMemo(
    () => (capture ? scalarFields(capture.payload).filter((f) => f.value !== undefined) : []),
    [capture],
  );
  const numbers = fields.filter(
    (f) =>
      typeof f.value === 'number' &&
      !/(^|\.)(code|id|userId|songId|artistId|albumId)$/.test(f.path),
  );
  const activeField = field || numbers[0]?.path || '';
  useEffect(() => {
    let active = true;
    // One successful snapshot per reporting period; avoid adding overlapping totals together.
    const periods = new Map<string, number>();
    for (const c of available) if (!periods.has(c.period)) periods.set(c.period, c.id);
    setSnapshots([]);
    Promise.all(
      [...periods.values()].slice(0, 24).map((id) => request<Capture>(`/captures/${id}${suffix}`)),
    )
      .then((c) => {
        if (active) setSnapshots(c);
      })
      .catch((e) => notify(e.message));
    return () => {
      active = false;
    };
  }, [source, available[0]?.id, suffix]);
  const series = snapshots
    .map((c) => {
      const periodDate = c.period.match(/\d{4}-\d{2}(?:-\d{2})?/)?.[0];
      const periodTime =
        Number(c.params.endTime) ||
        (periodDate
          ? Date.parse(periodDate.length === 7 ? `${periodDate}-01` : periodDate)
          : c.fetched_at);
      return {
        period: c.period,
        time: c.fetched_at,
        order: periodTime,
        value: scalarFields(c.payload).find((f) => f.path === activeField)?.value,
      };
    })
    .filter((p) => typeof p.value === 'number')
    .sort((a, b) => a.order - b.order);
  const filtered = fields.filter((f) =>
    `${f.path} ${f.value}`.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <>
      <div className="filterbar">
        <div className="filter-group">
          <span>官方数据</span>
          <select
            aria-label="报告数据源"
            value={source}
            onChange={(e) => setSource(e.target.value)}
          >
            {state.sources.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </select>
          <select
            aria-label="报告快照"
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
        {capture && (
          <button
            className="button secondary compact"
            onClick={() =>
              download(
                JSON.stringify(capture, null, 2),
                `${source}-${capture.id}.json`,
                'application/json',
              )
            }
          >
            <FileJson size={15} />
            导出报告
          </button>
        )}
      </div>
      <div className="source-note">
        <Braces size={15} />
        <span>
          完整保留 API
          返回字段。未核验单位的数值按原值展示，不自动换算时长；曲风偏好、年度足迹等嵌套数据也可在这里查询。
        </span>
      </div>
      {!capture ? (
        <Panel title="官方报告">
          <Empty
            title="尚无该报告的成功响应"
            text="先同步数据，或在数据管理中回填历史月份、年份。部分接口可能需要会员权限。"
          />
        </Panel>
      ) : (
        <>
          <div className="report-meta">
            <div>
              <span>数据来源</span>
              <strong>{state.sources.find((s) => s.id === source)?.path}</strong>
            </div>
            <div>
              <span>报告周期</span>
              <strong>{capture.period}</strong>
            </div>
            <div>
              <span>采集时间</span>
              <strong>{date(capture.fetched_at, true)}</strong>
            </div>
            <div>
              <span>返回字段</span>
              <strong>{num(fields.length)} 个</strong>
            </div>
          </div>
          {numbers.length > 0 && (
            <Panel
              title="跨周期字段对比"
              caption="同一字段、同一来源，每个周期取最近一次成功采集；不对重叠周期求和"
              action={<TrendingUp size={19} className="muted" />}
            >
              <div className="field-selector">
                <label>
                  对比字段
                  <select
                    aria-label="趋势字段"
                    value={activeField}
                    onChange={(e) => setField(e.target.value)}
                  >
                    {numbers.map((f) => (
                      <option key={f.path} value={f.path}>
                        {f.path}
                      </option>
                    ))}
                  </select>
                </label>
                <span className="tag">API 原始数值 · 单位待核验</span>
              </div>
              {series.length > 1 ? (
                <Chart
                  option={{
                    tooltip: { trigger: 'axis' },
                    grid: { top: 25, left: 70, right: 30, bottom: 45 },
                    xAxis: {
                      type: 'category',
                      data: series.map((s) => s.period),
                      axisTick: { show: false },
                      axisLine: { show: false },
                    },
                    yAxis: {
                      type: 'value',
                      scale: true,
                      splitLine: { lineStyle: { color: '#eef1f0' } },
                    },
                    series: [
                      {
                        type: 'line',
                        data: series.map((s) => s.value),
                        symbolSize: 8,
                        lineStyle: { color: '#238574', width: 3 },
                        itemStyle: { color: '#238574' },
                      },
                    ],
                  }}
                />
              ) : (
                <div className="single-metric">
                  <span>{activeField}</span>
                  <strong>
                    {num(numbers.find((f) => f.path === activeField)?.value as number, 3)}
                  </strong>
                  <p>当前仅一个周期有此字段，积累更多报告后可比较。</p>
                </div>
              )}
              <details className="series-details">
                <summary>查看对比数据（{series.length} 个周期）</summary>
                <table>
                  <thead>
                    <tr>
                      <th>周期</th>
                      <th>原始数值</th>
                      <th>采集时间</th>
                    </tr>
                  </thead>
                  <tbody>
                    {series.map((s) => (
                      <tr key={`${s.period}-${s.time}`}>
                        <td>{s.period}</td>
                        <td>{num(s.value as number, 3)}</td>
                        <td>{date(s.time, true)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </details>
            </Panel>
          )}
          <Panel title="报告内容" caption={state.sources.find((s) => s.id === source)?.description}>
            <div className="table-tools">
              <div className="tabs">
                <button
                  className={tab === 'fields' ? 'active' : ''}
                  onClick={() => setTab('fields')}
                >
                  字段浏览
                </button>
                <button className={tab === 'raw' ? 'active' : ''} onClick={() => setTab('raw')}>
                  原始 JSON
                </button>
              </div>
              <label className="search">
                <Search size={15} />
                <input
                  aria-label="搜索报告字段"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="搜索字段路径或内容"
                />
              </label>
            </div>
            {tab === 'raw' ? (
              <pre className="json-view">{JSON.stringify(capture.payload, null, 2)}</pre>
            ) : (
              <div className="table-scroll field-table">
                <table>
                  <thead>
                    <tr>
                      <th>字段路径</th>
                      <th>API 返回值</th>
                      <th>类型</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.slice(0, 1000).map((f) => (
                      <tr key={f.path}>
                        <td>
                          <code>{f.path}</code>
                        </td>
                        <td>
                          {f.value === null ? (
                            <span className="muted">null（未提供）</span>
                          ) : (
                            String(f.value)
                          )}
                        </td>
                        <td className="muted">{f.value === null ? 'null' : typeof f.value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filtered.length > 1000 && (
                  <p className="source-note">
                    展示前 1,000 个匹配字段，使用搜索缩小范围，或导出完整报告。
                  </p>
                )}
                {!filtered.length && (
                  <Empty title="没有匹配的字段" text="可以切换到原始 JSON 查看空对象或数组。" />
                )}
              </div>
            )}
          </Panel>
        </>
      )}
    </>
  );
}
