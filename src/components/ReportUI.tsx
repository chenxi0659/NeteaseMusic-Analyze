import { ArrowDownRight, ArrowUpRight, Info } from 'lucide-react';
import { Panel } from '../App';
import { Chart, barOption, colors } from '../Chart';
import { date, num } from '../api';
import type { Distribution, ReportNote, PeriodReport } from '../../shared/reports';
import { comparisonFor, percentChange, calendarDays } from '../../shared/reports';

export const hours = (minutes: number | null) => (minutes === null ? '—' : num(minutes / 60, 1));
export const percentage = (value: number | null) =>
  value === null ? '—' : `${value > 0 ? '+' : ''}${num(value, 1)}%`;
export function Change({ value, label }: { value: number | null; label?: string }) {
  return (
    <span
      className={`report-change ${value === null ? '' : value >= 0 ? 'change-up' : 'change-down'}`}
    >
      {value !== null && (value >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />)}
      {percentage(value)}
      {label && <small>{label}</small>}
    </span>
  );
}
export function Provenance({ children }: { children: React.ReactNode }) {
  return (
    <div className="source-note">
      <Info size={15} />
      <span>{children}</span>
    </div>
  );
}
export function NoteGrid({ notes }: { notes: ReportNote[] }) {
  return (
    <div className="report-note-grid">
      {notes.map((n, i) => (
        <article key={`${n.label}-${i}`}>
          <span>{n.label}</span>
          <strong>{n.text || n.value || '—'}</strong>
          {n.resource && (
            <a href={n.resource} target="_blank" rel="noreferrer">
              查看歌曲
              <ArrowUpRight size={12} />
            </a>
          )}
        </article>
      ))}
    </div>
  );
}
export function DistributionPanel({
  title,
  data,
  unit = '%',
  caption,
}: {
  title: string;
  data: Distribution[];
  unit?: string;
  caption?: string;
}) {
  return (
    <Panel title={title} caption={caption || '网易云官方分布，仅展示实际返回项'}>
      <Chart height={230} option={barOption(data.slice(0, 10))} />
      {data.length > 10 && <p className="source-note">图中展示前 10 项，明细列出全部返回项。</p>}
      <div className="distribution-table">
        {data.map((d, i) => (
          <div key={`${d.name}-${i}`}>
            <span>
              <i style={{ background: colors[i % colors.length] }} />
              {d.name}
            </span>
            <strong>
              {num(d.value, 1)}
              {unit}
            </strong>
            {d.count != null && <small>官方曲目计数 {num(d.count)}</small>}
          </div>
        ))}
      </div>
    </Panel>
  );
}
export function PeriodContent({
  report: p,
  reports,
}: {
  report: PeriodReport;
  reports: PeriodReport[];
}) {
  const peak = [...p.days].sort((a, b) => b.minutes - a.minutes)[0];
  const comparison = comparisonFor(p, reports);
  const days = calendarDays(p.start, p.end);
  const average = p.minutes === null ? null : p.minutes / days;
  const activity = p.activeDays === null ? null : (p.activeDays / days) * 100;
  const dayparts = [...p.dayparts].sort((a, b) => b.value - a.value);
  return (
    <>
      <div className="report-insight-grid">
        <article>
          <span>周期解读</span>
          <h3>{p.realtime ? '正在积累的音乐时光' : '这一段时间的音乐生活'}</h3>
          <p>
            {p.minutes !== null ? (
              <>
                共收听 <strong>{hours(p.minutes)} 小时</strong>，按报告覆盖的 {days} 天计算，日均{' '}
                <strong>{num(average, 1)} 分钟</strong>。
              </>
            ) : (
              '该报告未返回总时长。'
            )}
            {p.activeDays !== null && (
              <>
                {' '}
                有 {p.activeDays} 天收听，活跃率 {num(activity, 1)}%。
              </>
            )}
          </p>
          {comparison && (
            <Change
              value={percentChange(comparison.currentMinutes, comparison.previousMinutes)}
              label={comparison.label}
            />
          )}
        </article>
        <article>
          <span>收听习惯</span>
          <h3>{peak ? `${peak.date.slice(5)} 是收听高峰` : '等待每日明细'}</h3>
          <p>
            {peak && (
              <>
                当天收听 <strong>{num(peak.minutes)} 分钟</strong>。
              </>
            )}
            {dayparts[0] && (
              <>
                {' '}
                最高时段为 <strong>{dayparts[0].name}</strong>，共 {num(dayparts[0].value)}{' '}
                分钟，占已返回时段时长{' '}
                {num(
                  (dayparts[0].value /
                    Math.max(
                      1,
                      dayparts.reduce((s, d) => s + d.value, 0),
                    )) *
                    100,
                  1,
                )}
                %。
              </>
            )}
          </p>
          {p.achievement && <small>{p.achievement}</small>}
        </article>
      </div>
      {p.days.length > 0 && (
        <Panel
          title="每日收听时长"
          caption="分钟 · 官方每日明细；未返回日期不补零，reachLimit 标记会单独提示"
        >
          <Chart
            option={{
              tooltip: { trigger: 'axis', valueFormatter: (v: number) => `${num(v)} 分钟` },
              grid: { top: 20, left: 50, right: 25, bottom: 35 },
              xAxis: {
                type: 'category',
                data: p.days.map((d) => d.date.slice(5)),
                axisTick: { show: false },
                axisLine: { show: false },
              },
              yAxis: { type: 'value', splitLine: { lineStyle: { color: '#edf2ee' } } },
              series: [
                {
                  type: 'bar',
                  barMaxWidth: 24,
                  data: p.days.map((d) => ({
                    value: d.minutes,
                    itemStyle: {
                      color: d.capped ? '#d2a677' : '#8cbba5',
                      borderRadius: [3, 3, 0, 0],
                    },
                  })),
                },
              ],
            }}
          />
          <div className="summary-strip">
            <span>
              有值日期 <strong>{p.days.length}</strong>
            </span>
            <span>
              明细合计 <strong>{num(p.days.reduce((s, d) => s + d.minutes, 0))} 分钟</strong>
            </span>
            <span>
              报告总时长 <strong>{num(p.minutes)} 分钟</strong>
            </span>
            <span>
              上限标记 <strong>{p.days.filter((d) => d.capped).length} 天</strong>
            </span>
          </div>
          <details className="series-details">
            <summary>查看每日明细</summary>
            <table>
              <thead>
                <tr>
                  <th>日期</th>
                  <th>音乐（分钟）</th>
                  <th>播客</th>
                  <th>有声书</th>
                  <th>上限标记</th>
                </tr>
              </thead>
              <tbody>
                {p.days.map((d) => (
                  <tr key={d.date}>
                    <td>{d.date}</td>
                    <td>{num(d.minutes)}</td>
                    <td>{num(d.podcast)}</td>
                    <td>{num(d.audiobook)}</td>
                    <td>{d.capped ? '已触及上限' : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </Panel>
      )}
      <div className="two-columns">
        {p.dayparts.length > 0 && (
          <DistributionPanel
            title="一天中的收听时段"
            data={p.dayparts}
            unit=" 分钟"
            caption="采用官方时段分组，不推测其具体起止小时"
          />
        )}
        {p.languages.length > 0 && <DistributionPanel title="语言分布" data={p.languages} />}
      </div>
      <div className="two-columns">
        {p.genres.length > 0 && <DistributionPanel title="曲风偏好" data={p.genres} />}{' '}
        {p.ages.length > 0 && (
          <DistributionPanel
            title="音乐年代"
            data={p.ages}
            unit=""
            caption="官方年代与曲目计数，不由歌曲名推测"
          />
        )}
      </div>
      {p.songHighlights.length > 0 && (
        <Panel title="歌曲与循环记忆" caption="年度／周月精选不等于完整曲目清单">
          <NoteGrid notes={p.songHighlights} />
        </Panel>
      )}
      {p.artistHighlights.length > 0 && (
        <Panel title="歌手与心动时刻">
          <NoteGrid notes={p.artistHighlights} />
        </Panel>
      )}
      {p.notes.length > 0 && (
        <Panel title="官方报告摘记">
          <NoteGrid
            notes={p.notes.map((n) => ({
              ...n,
              text:
                n.label === '听歌最久' && n.value ? `${date(Number(n.value))} · ${n.text}` : n.text,
            }))}
          />
        </Panel>
      )}
      <div className="two-columns">
        {p.vip.length > 0 && (
          <Panel title="会员音乐使用">
            <NoteGrid notes={p.vip} />
          </Panel>
        )}
        {(p.lateAt !== null || p.sleepMinutes !== null) && (
          <Panel title="夜间与助眠">
            <NoteGrid
              notes={[
                ...(p.lateAt !== null
                  ? [{ label: '官方最晚收听记录', text: date(p.lateAt, true) }]
                  : []),
                ...(p.sleepMinutes !== null
                  ? [{ label: '助眠收听时长', text: `${num(p.sleepMinutes)} 分钟` }]
                  : []),
                ...(p.sleepDays !== null
                  ? [{ label: '助眠收听天数', text: `${num(p.sleepDays)} 天` }]
                  : []),
              ]}
            />
          </Panel>
        )}
      </div>
      {p.emotion.length > 0 && (
        <Panel title="情绪偏好">
          <NoteGrid notes={p.emotion} />
        </Panel>
      )}
      {p.podcast.length > 0 && (
        <Panel title="播客与声音">
          <NoteGrid notes={p.podcast} />
        </Panel>
      )}
      <Provenance>
        此页使用报告 {p.id}，实际范围 {date(p.start)} 至 {date(p.end)}，采集于{' '}
        {date(p.fetched, true)}。小时数由官方分钟值换算。精选、占比与计数分别沿用原字段口径。
      </Provenance>
    </>
  );
}
