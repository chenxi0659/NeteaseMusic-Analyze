import { Chart } from '../Chart';
import { num } from '../api';

export function AnnualTrendCharts({
  years,
  durations,
  counts,
  durationUnit,
}: {
  years: number[];
  durations: (number | null)[];
  counts: (number | null)[];
  durationUnit: string;
}) {
  function option(values: (number | null)[], type: 'bar' | 'line', color: string, unit: string) {
    const digits = type === 'bar' ? 1 : 0;
    return {
      tooltip: {
        trigger: 'axis',
        valueFormatter: (value: number) => `${num(value, digits)} ${unit}`,
      },
      grid: { top: 40, left: 82, right: 38, bottom: 35 },
      xAxis: {
        type: 'category',
        data: years.map(String),
        boundaryGap: true,
        axisTick: { show: false },
        axisLine: { show: false },
        axisLabel: { interval: 0 },
      },
      yAxis: {
        type: 'value',
        min: 0,
        minInterval: type === 'line' ? 1 : undefined,
        axisLabel: { formatter: (value: number) => num(value, digits) },
        splitLine: { lineStyle: { color: '#eef2ef' } },
      },
      series: [
        {
          name: type === 'bar' ? `收听时长（${unit}）` : '官方年度计数',
          type,
          data: values,
          barMaxWidth: 38,
          symbol: 'circle',
          symbolSize: 7,
          connectNulls: false,
          label: {
            show: true,
            position: 'top',
            distance: 9,
            color: type === 'bar' ? '#537764' : '#a7824f',
            fontSize: 11,
            formatter: (point: { value: number | null }) =>
              point.value === null ? '' : num(point.value, digits),
          },
          itemStyle: { color, ...(type === 'bar' ? { borderRadius: [4, 4, 0, 0] } : {}) },
          lineStyle: { width: 2 },
        },
      ],
    };
  }
  return (
    <div className="annual-trend-scroll">
      <div style={{ minWidth: Math.max(560, years.length * 65 + 120) }}>
        <section className="annual-trend-block">
          <div className="annual-trend-heading">
            <span>
              <i />
              历年收听时长
            </span>
            <small>单位：{durationUnit}</small>
          </div>
          <Chart
            height={250}
            label={`历年收听时长，单位${durationUnit}`}
            option={option(durations, 'bar', '#83b39d', durationUnit)}
          />
        </section>
        <section className="annual-trend-block">
          <div className="annual-trend-heading">
            <span>
              <i className="count-dot" />
              历年官方听歌计数
            </span>
            <small>单位：官方计数</small>
          </div>
          <Chart
            height={250}
            label="历年官方听歌计数"
            option={option(counts, 'line', '#cfaa77', '官方计数')}
          />
        </section>
      </div>
    </div>
  );
}
