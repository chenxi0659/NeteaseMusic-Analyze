import { CalendarDays, Clock3, Heart, TrendingUp, ArrowUpRight } from 'lucide-react';
import { useState } from 'react';
import { Empty, Panel, type PageContext } from '../App';
import { Stat } from './Analysis';
import { Chart } from '../Chart';
import { DistributionPanel, NoteGrid, Change, Provenance, hours } from '../components/ReportUI';
import { comparisonFor, durationMinutes, percentChange } from '../../shared/reports';
import { date, num } from '../api';

export function OverviewPage({ insights, state }: PageContext) {
  const [selected, setSelected] = useState('latest');
  const periods = insights?.periods.filter((p) => p.hasData) || [];
  const current =
    selected === 'latest' ? periods[0] : periods.find((p) => `${p.source}:${p.start}` === selected);
  const years = insights?.years || [],
    year = years.at(-1),
    lastYear = years.find((y) => y.year === (year?.year || 0) - 1);
  const minutes = durationMinutes(year?.duration ?? null, insights?.unit.unit || 'raw');
  const compare = current ? comparisonFor(current, periods) : null;
  const monthly = new Map<string, (typeof periods)[number]>();
  for (const p of [...periods].sort((a, b) => Number(a.realtime) - Number(b.realtime)))
    if (p.type === 'month' && !monthly.has(p.period)) monthly.set(p.period, p);
  const monthlyData = [...monthly.values()].sort((a, b) => a.start - b.start);
  const coverage = new Map<string, NonNullable<typeof insights>['coverage'][number]>();
  for (const c of insights?.coverage || []) if (!coverage.has(c.source)) coverage.set(c.source, c);
  return (
    <>
      <div className="insight-banner overview-hero">
        <div>
          <span className="eyebrow">FROM NUMBERS TO YOUR MUSIC STORY</span>
          <h2>从历年到每日，看见你的听歌轨迹。</h2>
          <p>从年度时长、偏好变化到日常收听，查看属于你的音乐档案。</p>
        </div>
        <TrendingUp size={48} strokeWidth={1} />
      </div>
      <div className="filterbar">
        <div className="filter-group">
          <span>近期报告</span>
          <select
            aria-label="总览周期"
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
          >
            <option value="latest">最近有统计的周期</option>
            {periods.map((p) => (
              <option key={`${p.source}:${p.start}`} value={`${p.source}:${p.start}`}>
                {p.period} · {p.type === 'month' ? '月度' : p.type === 'week' ? '周度' : '年度'}
                {p.realtime ? '（实时）' : ''}
              </option>
            ))}
          </select>
        </div>
        <a className="inline-link" href="#reports">
          查看完整报告
          <ArrowUpRight size={14} />
        </a>
      </div>
      <Provenance>
        近期报告：
        {current ? `${current.period} · ${current.realtime ? '实时累计' : '完整周期'}` : '暂无'}
        。年度数据覆盖 {years.length} 年；时长按各接口的独立口径换算。
      </Provenance>
      <div className="stats-grid">
        <Stat
          icon={<Clock3 size={20} />}
          label={year ? `${year.year} 年收听时长` : '年度收听时长'}
          value={minutes === null ? '—' : hours(minutes)}
          unit="小时"
          caption={year ? `${year.year} 为最近可用年份，不是今年累计` : '同步年度足迹后展示'}
        />
        <Stat
          icon={<TrendingUp size={20} />}
          label="所选周期时长"
          value={hours(current?.minutes ?? null)}
          unit="小时"
          caption={
            current ? `${num(current.minutes)} 分钟 · ${current.period}` : '尚无官方周期统计'
          }
        />
        <Stat
          icon={<CalendarDays size={20} />}
          label="所选周期活跃天数"
          value={num(current?.activeDays)}
          unit="天"
          caption="官方 listenDays，区别于本地采集天数"
        />
        <Stat
          icon={<Heart size={20} />}
          label="喜欢的歌曲"
          value={num(insights?.likesCount)}
          unit="首"
          caption="当前喜欢列表，不用作历史收听次数"
        />
      </div>
      {(year || current) && (
        <div className="report-insight-grid">
          <article>
            <span>年度变化</span>
            <h3>{year ? `${year.year} 年的听歌轨迹` : '年度汇总待同步'}</h3>
            <p>
              {year ? (
                <>
                  官方年度计数为 <strong>{num(year.count)}</strong>。
                  {minutes !== null && (
                    <>
                      收听约 <strong>{hours(minutes)} 小时</strong>。
                    </>
                  )}
                </>
              ) : (
                '年度足迹接口成功返回后即可跨年比较。'
              )}
            </p>
            {year && lastYear && (
              <Change
                value={percentChange(year.duration, lastYear.duration)}
                label={`相对 ${lastYear.year} 年时长`}
              />
            )}
            <a className="inline-link" href="#annual">
              打开年度分析
              <ArrowUpRight size={13} />
            </a>
          </article>
          <article>
            <span>周期变化</span>
            <h3>{current ? `${current.period} 的日常节奏` : '周期统计待同步'}</h3>
            <p>
              {current && (
                <>
                  {current.activeDays !== null && (
                    <>
                      已有 <strong>{current.activeDays} 天</strong>收听。
                    </>
                  )}
                  {current.songCount !== null && (
                    <>
                      官方曲目计数 <strong>{num(current.songCount)}</strong>
                      ，精选列表只是其中一部分。
                    </>
                  )}
                </>
              )}
            </p>
            {compare ? (
              <Change
                value={percentChange(compare.currentMinutes, compare.previousMinutes)}
                label={compare.label}
              />
            ) : (
              <small>没有可比的上一周期，保留为空。</small>
            )}
          </article>
        </div>
      )}
      <div className="two-columns">
        <Panel
          title="月度收听趋势"
          caption="每月取一个官方周期，完整月报优先；实时月份保留标记，不混加周报"
        >
          {monthlyData.length ? (
            <>
              <Chart
                height={270}
                option={{
                  tooltip: {
                    trigger: 'axis',
                    formatter: (items: any[]) =>
                      `${items[0].axisValue}<br/>${num(items[0].value, 1)} 小时${monthlyData[items[0].dataIndex]?.realtime ? ' · 实时' : ''}`,
                  },
                  grid: { top: 20, left: 50, right: 25, bottom: 35 },
                  xAxis: {
                    type: 'category',
                    data: monthlyData.map((p) => p.period),
                    axisTick: { show: false },
                    axisLine: { show: false },
                  },
                  yAxis: {
                    type: 'value',
                    name: '小时',
                    splitLine: { lineStyle: { color: '#edf2ee' } },
                  },
                  series: [
                    {
                      type: 'bar',
                      barMaxWidth: 32,
                      data: monthlyData.map((p) => ({
                        value: p.minutes === null ? null : Number((p.minutes / 60).toFixed(1)),
                        itemStyle: {
                          color: p.realtime ? '#c6d5bc' : '#78aa92',
                          borderRadius: [3, 3, 0, 0],
                        },
                      })),
                    },
                  ],
                }}
              />
              <div className="summary-strip">
                <span>
                  当前有统计月份 <strong>{monthlyData.length}</strong>
                </span>
                <span>缺失月份未补零</span>
              </div>
            </>
          ) : (
            <Empty title="还没有月度时长" text="回填历史月份后，月度趋势会自动出现。" />
          )}
        </Panel>
        {insights?.style.length ? (
          <DistributionPanel
            title="网易云官方曲风偏好"
            data={insights.style}
            caption="来自 style/preference，区别于某一周或某一月的分布"
          />
        ) : (
          <Panel title="官方曲风偏好">
            <Empty title="尚无曲风数据" text="同步曲风偏好后展示，不按歌手或歌名猜测。" />
          </Panel>
        )}
      </div>
      {current?.songHighlights.length ? (
        <Panel
          title="这个周期的音乐记忆"
          caption={`${current.period} · 官方精选`}
          action={
            <a className="inline-link" href="#reports">
              更多分析
              <ArrowUpRight size={13} />
            </a>
          }
        >
          <NoteGrid
            notes={[...current.songHighlights.slice(0, 4), ...current.artistHighlights.slice(0, 2)]}
          />
        </Panel>
      ) : null}
      {insights?.styleTree.length ? (
        <Panel title="官方曲风标签层级" caption="按 API 的父子标签展示，分类目录不等于收听占比">
          <div className="tag-tree">
            {insights.styleTree.map((t) => (
              <details key={t.tagId}>
                <summary>
                  {t.tagName}
                  <span>{t.enName || ''}</span>
                </summary>
                <div>
                  {(t.childrenTags || []).map((c: any) => (
                    <article key={c.tagId}>
                      <strong>{c.tagName}</strong>
                      <small>
                        {(c.childrenTags || []).map((x: any) => x.tagName).join(' · ') ||
                          c.enName ||
                          '子标签未展开'}
                      </small>
                    </article>
                  ))}
                </div>
              </details>
            ))}
          </div>
        </Panel>
      ) : null}
      {!!insights?.recentResources.length && (
        <Panel title="最近常听的音乐入口" caption="采用接口的播放／更新时间，不当作逐首播放记录">
          <NoteGrid
            notes={insights.recentResources.map((r) => ({
              label: r.tag,
              text: `${r.name} · ${date(r.time, true)}`,
            }))}
          />
        </Panel>
      )}
      <Panel
        title="数据覆盖与可用性"
        caption="返回 200 只表示请求成功；没有统计内容的报告不会画成零值"
      >
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>数据源</th>
                <th>实际周期</th>
                <th>可分析内容</th>
                <th>说明</th>
              </tr>
            </thead>
            <tbody>
              {[...coverage.values()].map((c) => (
                <tr key={c.source}>
                  <td>{c.title}</td>
                  <td>{c.period}</td>
                  <td>
                    <span className={`status ${c.hasData ? 'success' : 'warning'}`}>
                      {c.hasData ? '有统计' : '空报告'}
                    </span>
                  </td>
                  <td className="muted">{c.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!coverage.size && (
          <Empty
            title="开始建立你的听歌档案"
            text="连接账号并同步，已有历史报告可直接分析，无需先积累一年。"
          />
        )}
      </Panel>
      <Provenance>
        累计接口 totalDuration 当前原值为 {num(insights?.totalRaw)}
        ，该字段单位未独立核验，因此没有擅自换算并混入年度总量。最近采集：
        {date(state.counts.last, true)}。
      </Provenance>
    </>
  );
}
