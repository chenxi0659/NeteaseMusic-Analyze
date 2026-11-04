import { useState } from 'react';
import { CalendarDays, Clock3, Flame, Radio } from 'lucide-react';
import { officialDays } from '../../shared/reports';
import { Empty, Panel, type PageContext } from '../App';
import { Chart } from '../Chart';
import { Stat } from './Analysis';
import { Provenance, hours } from '../components/ReportUI';
import { num } from '../api';

export function OfficialActivity({ insights }: PageContext) {
  const days = officialDays(insights?.periods || []);
  const years = [...new Set(days.map((d) => d.date.slice(0, 4)))].sort();
  const [yearChoice, setYear] = useState('latest'),
    [month, setMonth] = useState('all');
  const year =
    yearChoice === 'latest' ? years.at(-1) || String(new Date().getFullYear()) : yearChoice;
  const filtered = days.filter(
    (d) => d.date.startsWith(year) && (month === 'all' || d.date.slice(5, 7) === month),
  );
  const positive = filtered.filter((d) => d.minutes > 0),
    sum = filtered.reduce((s, d) => s + d.minutes, 0);
  const weekdays = Array.from({ length: 7 }, () => ({ sum: 0, count: 0 }));
  let streak = 0,
    longest = 0,
    last = '';
  for (const d of filtered) {
    const weekday = (new Date(`${d.date}T00:00:00Z`).getUTCDay() + 6) % 7;
    weekdays[weekday].sum += d.minutes;
    weekdays[weekday].count++;
    if (d.minutes > 0) {
      streak = last && Date.parse(d.date) - Date.parse(last) === 86400000 ? streak + 1 : 1;
      last = d.date;
      longest = Math.max(longest, streak);
    } else {
      streak = 0;
      last = '';
    }
  }
  const peak = [...filtered].sort((a, b) => b.minutes - a.minutes)[0];
  const start = month === 'all' ? `${year}-01-01` : `${year}-${month}-01`;
  const end =
    month === 'all'
      ? `${year}-12-31`
      : new Date(Date.UTC(Number(year), Number(month), 0)).toISOString().slice(0, 10);
  const known = new Map(filtered.map((d) => [d.date, d]));
  const axis: string[] = [];
  for (let stamp = Date.parse(start); stamp <= Date.parse(end); stamp += 86400000)
    axis.push(new Date(stamp).toISOString().slice(0, 10));
  return (
    <>
      <div className="filterbar">
        <div className="filter-group">
          <span>日期范围</span>
          <select
            aria-label="官方时长年份"
            value={yearChoice}
            onChange={(e) => {
              setYear(e.target.value);
              setMonth('all');
            }}
          >
            <option value="latest">最近有记录年份</option>
            {[...years].reverse().map((y) => (
              <option key={y}>{y}</option>
            ))}
          </select>
          <select
            aria-label="官方时长月份"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          >
            <option value="all">全年已返回日期</option>
            {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0')).map((m) => (
              <option key={m} value={m}>
                {Number(m)} 月
              </option>
            ))}
          </select>
        </div>
        <span className="tag">官方每日分钟数</span>
      </div>
      <Provenance>
        重叠日期只取一份数据，优先完整月报，其次完整周报，再到实时报告。无数据日期保持空白，不作为零分钟。
      </Provenance>
      {!filtered.length ? (
        <Panel title="官方收听日历">
          <Empty
            title="这个范围没有每日明细"
            text="回填历史月报后展示。年度汇总不能拆解成每天的时长。"
          />
        </Panel>
      ) : (
        <>
          <div className="stats-grid">
            <Stat
              icon={<Clock3 size={20} />}
              label="已返回日期的时长合计"
              value={hours(sum)}
              unit="小时"
              caption="只合计下方可见日期，不冒充完整全年数据"
            />
            <Stat
              icon={<CalendarDays size={20} />}
              label="活跃日期"
              value={num(positive.length)}
              unit="天"
              caption={`${filtered.length} 天有值，零分钟与缺失分别处理`}
            />
            <Stat
              icon={<Flame size={20} />}
              label="最长可确认连续收听"
              value={num(longest)}
              unit="天"
              caption="遇到缺失日期或零分钟即中断"
            />
            <Stat
              icon={<Radio size={20} />}
              label="活跃日均时长"
              value={positive.length ? num(sum / positive.length, 1) : '—'}
              unit="分钟"
              caption="已返回时长 ÷ 正时长日期数量"
            />
          </div>
          <Panel
            title={`${year} 年官方收听日历`}
            caption={`当前筛选 ${start} 至 ${end}，收听高峰 ${peak?.date} · ${num(peak?.minutes)} 分钟`}
          >
            <div className="calendar-scroll">
              <Chart
                height={240}
                option={{
                  tooltip: { formatter: (p: any) => `${p.value[0]}<br/>${num(p.value[1])} 分钟` },
                  visualMap: {
                    min: 0,
                    max: Math.max(1, ...filtered.map((d) => d.minutes)),
                    orient: 'horizontal',
                    left: 'center',
                    bottom: 0,
                    inRange: { color: ['#eff5f2', '#b4d7c3', '#66a88d', '#21776b'] },
                    text: ['较长', '较短'],
                  },
                  calendar: {
                    top: 35,
                    left: 45,
                    right: 25,
                    bottom: 60,
                    range: [`${year}-01-01`, `${year}-12-31`],
                    cellSize: ['auto', 19],
                    splitLine: { show: false },
                    itemStyle: { color: '#f2f5f4', borderWidth: 2, borderColor: '#fff' },
                    yearLabel: { show: false },
                    dayLabel: { firstDay: 1, nameMap: 'ZH' },
                    monthLabel: { nameMap: 'ZH' },
                  },
                  series: [
                    {
                      type: 'heatmap',
                      coordinateSystem: 'calendar',
                      data: filtered.map((d) => [d.date, d.minutes]),
                    },
                  ],
                }}
              />
            </div>
          </Panel>
          <div className="two-columns">
            <Panel title="每日官方时长" caption="没有返回值的日期留出空位，不连接为零">
              <Chart
                option={{
                  tooltip: { trigger: 'axis' },
                  grid: { top: 20, left: 50, right: 25, bottom: 35 },
                  xAxis: {
                    type: 'category',
                    data: axis,
                    axisTick: { show: false },
                    axisLine: { show: false },
                    axisLabel: { formatter: (s: string) => s.slice(5) },
                  },
                  yAxis: {
                    type: 'value',
                    name: '分钟',
                    splitLine: { lineStyle: { color: '#eef2ef' } },
                  },
                  series: [
                    {
                      type: 'bar',
                      data: axis.map((d) => known.get(d)?.minutes ?? null),
                      barMaxWidth: 20,
                      itemStyle: { color: '#8cbba5' },
                    },
                  ],
                }}
              />
            </Panel>
            <Panel title="星期偏好" caption="按已返回日期计算平均分钟数，缺失星期不显示为零">
              <Chart
                option={{
                  tooltip: { trigger: 'axis' },
                  grid: { top: 20, left: 50, right: 25, bottom: 35 },
                  xAxis: {
                    type: 'category',
                    data: ['周一', '周二', '周三', '周四', '周五', '周六', '周日'],
                    axisTick: { show: false },
                    axisLine: { show: false },
                  },
                  yAxis: {
                    type: 'value',
                    name: '日均分钟',
                    splitLine: { lineStyle: { color: '#eef2ef' } },
                  },
                  series: [
                    {
                      type: 'bar',
                      data: weekdays.map((d) =>
                        d.count ? Number((d.sum / d.count).toFixed(1)) : null,
                      ),
                      itemStyle: { color: '#b0c9a0' },
                      barMaxWidth: 26,
                    },
                  ],
                }}
              />
            </Panel>
          </div>
          <Panel title="逐日明细" caption="播客和有声书独立保留，不重复加到音乐时长中">
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>日期</th>
                    <th>音乐时长（分钟）</th>
                    <th>播客（分钟）</th>
                    <th>有声书（分钟）</th>
                    <th>接口上限标记</th>
                  </tr>
                </thead>
                <tbody>
                  {[...filtered].reverse().map((d) => (
                    <tr key={d.date}>
                      <td>{d.date}</td>
                      <td>{num(d.minutes)}</td>
                      <td>{num(d.podcast)}</td>
                      <td>{num(d.audiobook)}</td>
                      <td>{d.capped ? 'reachLimit = true' : '—'}</td>
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
