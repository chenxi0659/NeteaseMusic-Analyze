import { useEffect, useRef } from 'react';
import * as echarts from 'echarts/core';
import { BarChart, LineChart, PieChart, HeatmapChart } from 'echarts/charts';
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  CalendarComponent,
  VisualMapComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
echarts.use([
  BarChart,
  LineChart,
  PieChart,
  HeatmapChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  CalendarComponent,
  VisualMapComponent,
  CanvasRenderer,
]);
export function Chart({
  option,
  height = 260,
  label = '统计图表，可通过对应列表查看详细数据',
}: {
  option: any;
  height?: number;
  label?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const chart = echarts.init(ref.current!);
    chart.setOption({
      textStyle: { fontFamily: '"Segoe UI", "Microsoft YaHei", sans-serif', color: '#7d878a' },
      ...option,
    });
    const observer = new ResizeObserver(() => chart.resize());
    observer.observe(ref.current!);
    return () => {
      observer.disconnect();
      chart.dispose();
    };
  }, [option]);
  return <div ref={ref} style={{ height, width: '100%' }} role="img" aria-label={label} />;
}
export const colors = ['#238574', '#87b9a3', '#f0b576', '#8a9eb5', '#b6acd4', '#c7d3c8'];
export function barOption(data: { name: string; value: number }[], horizontal = true) {
  return {
    tooltip: {
      trigger: 'axis',
      valueFormatter: (v: number) => Number(v.toFixed(2)).toLocaleString(),
    },
    grid: { left: horizontal ? 95 : 40, right: 25, bottom: 25, top: 12 },
    xAxis: horizontal
      ? { type: 'value', splitLine: { lineStyle: { color: '#f0f2f2' } } }
      : {
          type: 'category',
          data: data.map((d) => d.name),
          axisTick: { show: false },
          axisLine: { show: false },
        },
    yAxis: horizontal
      ? {
          type: 'category',
          inverse: true,
          data: data.map((d) => d.name),
          axisLine: { show: false },
          axisTick: { show: false },
          axisLabel: { width: 80, overflow: 'truncate' },
        }
      : { type: 'value', minInterval: 1, splitLine: { lineStyle: { color: '#f0f2f2' } } },
    series: [
      {
        type: 'bar',
        data: data.map((d, i) => ({
          value: Number(d.value.toFixed(2)),
          itemStyle: {
            color: horizontal && i === 0 ? '#238574' : horizontal ? '#b3d4c9' : '#238574',
            borderRadius: horizontal ? [0, 4, 4, 0] : [3, 3, 0, 0],
          },
        })),
        barMaxWidth: horizontal ? 18 : 26,
      },
    ],
  };
}
