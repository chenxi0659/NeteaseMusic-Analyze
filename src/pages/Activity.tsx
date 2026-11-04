import { useMemo, useState } from 'react';
import { CalendarDays, Clock3, Music2, Radio } from 'lucide-react';
import { chinaParts } from '../../shared/analysis';
import { Chart, barOption } from '../Chart';
import { Empty, Panel, type PageContext } from '../App';
import { date, num } from '../api';
import { Cover, Stat } from './Analysis';

export function ActivityPage({ observations, state }: PageContext) {
  const [days, setDays] = useState(30);
  const now = Date.now();
  const data = useMemo(
    () => observations.filter((o) => !days || o.playedAt >= now - days * 86400000),
    [observations, days],
  );
  const dates = new Map<string, number>(),
    hours = Array(24).fill(0),
    weekdays = Array(7).fill(0);
  for (const o of data) {
    const p = chinaParts(o.playedAt);
    dates.set(p.date, (dates.get(p.date) || 0) + 1);
    hours[p.hour]++;
    weekdays[(p.weekday + 6) % 7]++;
  }
  const entries = [...dates].sort((a, b) => a[0].localeCompare(b[0]));
  const unique = new Set(data.map((o) => o.track.id)).size;
  const first = entries[0]?.[0],
    last = entries.at(-1)?.[0];
  const calendarEnd = chinaParts(now).date;
  const calendarStart = chinaParts(now - 364 * 86400000).date;
  return (
    <>
      <div className="filterbar">
        <div className="filter-group">
          <span>观察窗口</span>
          <select
            aria-label="收听记录时间范围"
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
          >
            {[
              [7, '最近 7 天'],
              [30, '最近 30 天'],
              [90, '最近 90 天'],
              [365, '最近一年'],
              [0, '全部已采集记录'],
            ].map(([v, label]) => (
              <option key={v} value={v}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <span className="filter-meta">北京时间 · Asia/Shanghai</span>
      </div>
      <div className="source-note">
        <Radio size={15} />
        <span>
          基于最近播放接口的 playTime，按「歌曲 ID +
          时间」去重。这是观察到的记录，不保证完整播放流水，也不能据此计算实际听完率。
        </span>
      </div>
      {!data.length ? (
        <Panel title="收听习惯">
          <Empty
            title="还没有带时间的播放记录"
            text="同步最近播放后，仅当 API 返回有效 playTime 才会生成时间分析；采集时间不会代替播放时间。"
          />
        </Panel>
      ) : (
        <>
          <div className="stats-grid">
            <Stat
              icon={<Radio size={20} />}
              label="观察到的记录"
              value={num(data.length)}
              unit="条"
              caption="相同歌曲与时间去重后的记录"
            />
            <Stat
              icon={<Music2 size={20} />}
              label="涉及歌曲"
              value={num(unique)}
              unit="首"
              caption="按网易云歌曲 ID 去重"
            />
            <Stat
              icon={<CalendarDays size={20} />}
              label="有记录的日期"
              value={num(dates.size)}
              unit="天"
              caption="没有记录的日期不代表未听歌"
            />
            <Stat
              icon={<Clock3 size={20} />}
              label="最常出现的时段"
              value={`${String(hours.indexOf(Math.max(...hours))).padStart(2, '0')}:00`}
              caption="仅按已观察记录统计"
            />
          </div>
          <Panel
            title="听歌日历"
            caption={`日历展示最近一年 · 当前样本 ${first} 至 ${last} · 空白表示无已采集记录`}
          >
            <div className="calendar-scroll">
              <Chart
                height={240}
                option={{
                  tooltip: { formatter: (p: any) => `${p.value[0]}<br/>观察记录 ${p.value[1]} 条` },
                  visualMap: {
                    min: 0,
                    max: Math.max(...dates.values()),
                    orient: 'horizontal',
                    left: 'center',
                    bottom: 0,
                    inRange: { color: ['#eff5f2', '#b4d7c3', '#66a88d', '#21776b'] },
                    text: ['较多', '较少'],
                  },
                  calendar: {
                    top: 40,
                    left: 45,
                    right: 25,
                    bottom: 60,
                    range: [calendarStart, calendarEnd],
                    cellSize: ['auto', 19],
                    splitLine: { show: false },
                    itemStyle: { color: '#f2f5f4', borderWidth: 3, borderColor: '#fff' },
                    yearLabel: { show: false },
                    dayLabel: { firstDay: 1, nameMap: 'ZH' },
                    monthLabel: { nameMap: 'ZH' },
                  },
                  series: [{ type: 'heatmap', coordinateSystem: 'calendar', data: entries }],
                }}
              />
            </div>
          </Panel>
          <div className="two-columns">
            <Panel title="一天中的音乐时刻" caption="北京时间 · 记录条数">
              <Chart
                option={barOption(
                  hours.map((value, hour) => ({ name: `${hour}`, value })),
                  false,
                )}
              />
            </Panel>
            <Panel title="一周的节奏" caption="按星期汇总 · 记录条数">
              <Chart
                option={barOption(
                  weekdays.map((value, i) => ({
                    name: ['周一', '周二', '周三', '周四', '周五', '周六', '周日'][i],
                    value,
                  })),
                  false,
                )}
              />
            </Panel>
          </div>
          <div className="two-columns">
            <Panel title="每日记录变化" caption="只展示有记录的日期，不填补缺失日期">
              <Chart
                option={{
                  tooltip: { trigger: 'axis' },
                  grid: { top: 20, left: 40, right: 20, bottom: 35 },
                  xAxis: {
                    type: 'category',
                    data: entries.map((e) => e[0].slice(5)),
                    axisLine: { show: false },
                    axisTick: { show: false },
                  },
                  yAxis: {
                    type: 'value',
                    minInterval: 1,
                    splitLine: { lineStyle: { color: '#eef1f0' } },
                  },
                  series: [
                    {
                      type: 'line',
                      data: entries.map((e) => e[1]),
                      smooth: false,
                      symbolSize: 5,
                      lineStyle: { color: '#238574' },
                      itemStyle: { color: '#238574' },
                      areaStyle: { color: '#eaf3ed' },
                    },
                  ],
                }}
              />
            </Panel>
            <Panel
              title="样本里的重复出现"
              caption="同一歌曲在不同时间出现；不等于网易云官方重播率"
            >
              <div className="large-ratio">
                {num(data.length ? ((data.length - unique) / data.length) * 100 : 0, 1)}
                <small>%</small>
              </div>
              <p className="metric-description">（记录条数 − 不同歌曲数）÷ 记录条数</p>
              <div className="mini-metrics">
                <div>
                  <strong>{num(unique)}</strong>
                  <span>不同歌曲</span>
                </div>
                <div>
                  <strong>{num(data.length - unique)}</strong>
                  <span>后续重复记录</span>
                </div>
              </div>
            </Panel>
          </div>
          <Panel title="最近观察记录" caption="最多展示最近 60 条；完整记录可在数据管理导出">
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>记录时间</th>
                    <th>歌曲 / 歌手</th>
                    <th>首次采集时间</th>
                  </tr>
                </thead>
                <tbody>
                  {data.slice(0, 60).map((o) => (
                    <tr key={`${o.track.id}-${o.playedAt}`}>
                      <td className="numeric">{date(o.playedAt, true)}</td>
                      <td>
                        <div className="song-cell">
                          <Cover row={o.track} />
                          <span>
                            <strong>{o.track.name}</strong>
                            <small>{o.track.artists.map((a) => a.name).join(' / ')}</small>
                          </span>
                        </div>
                      </td>
                      <td className="muted">{date(o.firstSeen, true)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </>
      )}
    </>
  );
}
