import { useState } from 'react';
import { CalendarDays, Clock3, Music2, Radio } from 'lucide-react';
import { Empty, Panel, type PageContext } from '../App';
import { Stat } from './Analysis';
import { PeriodContent, Provenance, hours } from '../components/ReportUI';
import { num } from '../api';

export function CycleReports({ insights }: PageContext) {
  const [type, setType] = useState('month');
  const [selected, setSelected] = useState('latest');
  const reports = insights?.periods || [];
  const available = reports.filter((p) => p.type === type);
  const report =
    selected === 'latest'
      ? available.find((p) => p.hasData) || available[0]
      : available.find((p) => `${p.source}:${p.start}` === selected);
  return (
    <>
      <div className="filterbar">
        <div className="filter-group">
          <span>周期</span>
          <select
            aria-label="分析周期类型"
            value={type}
            onChange={(e) => {
              setType(e.target.value);
              setSelected('latest');
            }}
          >
            <option value="month">月度</option>
            <option value="week">周度</option>
            <option value="year">年度报告</option>
          </select>
          <select
            aria-label="分析报告周期"
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
          >
            <option value="latest">最近有统计的周期</option>
            {available.map((p) => (
              <option key={`${p.source}:${p.start}`} value={`${p.source}:${p.start}`}>
                {p.period} · {p.realtime ? '实时' : '完整报告'}
                {!p.hasData ? ' · 无统计内容' : ''}
              </option>
            ))}
          </select>
        </div>
        <span className="tag">按实际响应的起止日期展示</span>
      </div>
      <Provenance>
        报告可能延迟返回，界面使用响应中的实际周期，不把请求月份当作报告月份。实时报告与完整报告分开标记。
      </Provenance>
      {!report ? (
        <Panel title="周期分析">
          <Empty
            title="还没有这个周期的数据"
            text="在数据管理中同步或回填历史报告。年度汇总也可以直接在年度分析页查看。"
          />
        </Panel>
      ) : !report.hasData ? (
        <Panel title="报告没有统计内容">
          <Empty
            title="接口成功，但没有返回可分析的统计"
            text={`已返回 ${report.period} 的时间范围。不会用零填补缺失的时长、天数或歌曲数；可以在原始数据页核对响应。`}
          />
        </Panel>
      ) : (
        <>
          <div className="stats-grid">
            <Stat
              icon={<Clock3 size={20} />}
              label="官方收听时长"
              value={hours(report.minutes)}
              unit="小时"
              caption={`${num(report.minutes)} 分钟 · ${report.realtime ? '实时累计' : '报告汇总'}`}
            />
            <Stat
              icon={<CalendarDays size={20} />}
              label="活跃天数"
              value={num(report.activeDays)}
              unit="天"
              caption="使用官方 listenDays，不按记录条数推算"
            />
            <Stat
              icon={<Music2 size={20} />}
              label="官方曲目计数"
              value={num(report.songCount)}
              caption="沿用报告 songCount，不等于返回的精选条目数"
            />
            <Stat
              icon={<Radio size={20} />}
              label="每日明细覆盖"
              value={num(report.days.length)}
              unit="天"
              caption={report.realtime ? '当前周期仍在进行中' : '按实际返回的 durationDetails 统计'}
            />
          </div>
          <PeriodContent report={report} reports={reports} />
        </>
      )}
    </>
  );
}
