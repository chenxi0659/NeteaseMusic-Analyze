import type { Capture } from './types.js';
import { chinaParts } from './analysis.js';
import { adaptAnnual } from './annual.js';

export const numeric = (value: unknown): number | null =>
  (typeof value === 'number' || (typeof value === 'string' && value.trim() !== '')) &&
  Number.isFinite(Number(value))
    ? Number(value)
    : null;
const array = (value: any): any[] => (Array.isArray(value) ? value : []);
export const dayString = (time: number) => chinaParts(time).date;
export function responsePeriod(payload: any, fallback: string) {
  const data = payload?.data;
  if (!numeric(data?.startTime) || !numeric(data?.endTime)) return fallback;
  const start = dayString(data.startTime),
    end = dayString(data.endTime);
  return data.type === 'month' && start.slice(0, 7) === end.slice(0, 7)
    ? start.slice(0, 7)
    : data.type === 'year'
      ? start.slice(0, 4)
      : `${start} — ${end}`;
}
export interface Distribution {
  name: string;
  value: number;
  count?: number | null;
}
export interface ReportNote {
  label: string;
  text: string;
  value?: string;
  resource?: string;
}
export interface DailyDuration {
  date: string;
  minutes: number;
  podcast: number | null;
  audiobook: number | null;
  capped: boolean;
}
export interface PeriodReport {
  id: number;
  source: string;
  period: string;
  type: string;
  realtime: boolean;
  start: number;
  end: number;
  fetched: number;
  minutes: number | null;
  activeDays: number | null;
  songCount: number | null;
  days: DailyDuration[];
  dayparts: Distribution[];
  genres: Distribution[];
  languages: Distribution[];
  ages: Distribution[];
  songHighlights: ReportNote[];
  artistHighlights: ReportNote[];
  notes: ReportNote[];
  vip: ReportNote[];
  emotion: ReportNote[];
  podcast: ReportNote[];
  lateAt: number | null;
  sleepMinutes: number | null;
  sleepDays: number | null;
  achievement: string;
  hasData: boolean;
}
const dayparts: Record<string, string> = {
  early_morning: '凌晨',
  morning: '上午',
  noon: '中午',
  afternoon: '下午',
  evening: '傍晚',
  night: '夜间',
  late_night: '深夜',
};
function notesOf(block: any): ReportNote[] {
  return [...array(block?.sections), ...array(block?.items)].flatMap((item) => {
    const label = item.field || item.title || item.type || '';
    const text = [
      item.songName,
      item.artistName,
      item.mainText,
      item.text,
      item.subText,
      item.textB,
    ]
      .filter((v) => typeof v === 'string' && v)
      .join(' · ');
    if (!label && !text) return [];
    return [
      {
        label,
        text,
        value: item.valueA == null ? undefined : String(item.valueA),
        resource: item.songId ? `https://music.163.com/song?id=${item.songId}` : undefined,
      },
    ];
  });
}
export function periodReport(capture: Capture): PeriodReport | null {
  if (
    !['report-week', 'report-month', 'report-year', 'realtime-week', 'realtime-month'].includes(
      capture.source_id,
    )
  )
    return null;
  const d = capture.payload?.data;
  if (!d || !numeric(d.startTime) || !numeric(d.endTime)) return null;
  const distribution = d.listenTimeDistributionBlock,
    listening = d.listenTimeBlock;
  const days = array(distribution?.durationDetails).flatMap((day) => {
    const minutes = numeric(day.duration);
    return typeof day.period === 'string' &&
      /^\d{4}-\d{2}-\d{2}$/.test(day.period) &&
      minutes !== null
      ? [
          {
            date: day.period,
            minutes,
            podcast: numeric(day.podcastDuration),
            audiobook: numeric(day.audiobookDuration),
            capped: day.reachLimit === true,
          },
        ]
      : [];
  });
  const minutes = numeric(distribution?.playDuration ?? listening?.playDuration);
  return {
    id: capture.id,
    source: capture.source_id,
    period: responsePeriod(capture.payload, capture.period),
    type: d.type,
    realtime: capture.source_id.startsWith('realtime-'),
    start: d.startTime,
    end: d.endTime,
    fetched: capture.fetched_at,
    minutes,
    activeDays: numeric(distribution?.listenDays),
    songCount: numeric(d.wallpaperBlock?.songCount ?? d.weekTodayListenBlock?.songCount),
    days,
    dayparts: array(listening?.circleTimePeriodDurations).flatMap((x) =>
      numeric(x.duration) === null
        ? []
        : [{ name: dayparts[x.period] || x.period, value: Number(x.duration) }],
    ),
    genres: array(d.topStyleBlock?.sections).flatMap((x) =>
      x.genreName && numeric(x.percent) !== null
        ? [{ name: x.genreName, value: Number(x.percent) }]
        : [],
    ),
    languages: array(d.topLanguageBlock?.sections).flatMap((x) =>
      x.language && numeric(x.percent) !== null
        ? [{ name: x.language, value: Number(x.percent), count: numeric(x.playSongNum) }]
        : [],
    ),
    ages: array(d.topAgeBlock?.sections).flatMap((x) =>
      x.age != null && numeric(x.playSongNum) !== null
        ? [{ name: `${x.age} 年代`, value: Number(x.playSongNum) }]
        : [],
    ),
    songHighlights: [
      ...(d.topSongBlock?.songName
        ? [
            {
              label: '最常听的歌曲',
              text: d.topSongBlock.songName,
              resource: `https://music.163.com/song?id=${d.topSongBlock.songId}`,
            },
          ]
        : []),
      ...notesOf(d.topSongBlock),
    ],
    artistHighlights: [
      ...(d.topArtistBlock?.artistName
        ? [{ label: '最常听的歌手', text: d.topArtistBlock.artistName }]
        : []),
      ...notesOf(d.topArtistBlock),
    ],
    notes: notesOf(listening),
    vip: notesOf(d.vipBlock),
    emotion: notesOf(d.topEmotionBlock),
    podcast: notesOf(d.djListenDataBlock),
    lateAt: numeric(array(distribution?.sections).find((x) => x.type === 'lateSleep')?.value),
    sleepMinutes: numeric(distribution?.sleepTdBlock?.sleepPlayDuration),
    sleepDays: numeric(distribution?.sleepTdBlock?.sleepListenDays),
    achievement: [distribution?.achievementTitle?.mainTitle, listening?.playDurationText]
      .filter(Boolean)
      .join(' · '),
    hasData:
      minutes !== null ||
      days.length > 0 ||
      d.wallpaperBlock?.songCount != null ||
      !!d.topSongBlock ||
      !!d.topLanguageBlock,
  };
}
export interface YearSummary {
  year: number;
  duration: number | null;
  count: number | null;
  sourceId: number;
}
export interface AnnualReport {
  year: number;
  id: number;
  data: any;
  fetched: number;
}
export interface UnitEvidence {
  unit: 'seconds' | 'minutes' | 'raw';
  description: string;
  year?: number;
  month?: number;
  annualValue?: number;
  monthlyMinutes?: number;
}
export interface Insights {
  years: YearSummary[];
  annuals: AnnualReport[];
  periods: PeriodReport[];
  style: Distribution[];
  styleTree: any[];
  totalRaw: number | null;
  recentResources: { name: string; tag: string; time: number | null }[];
  unit: UnitEvidence;
  likesCount: number | null;
  coverage: {
    id: number;
    source: string;
    title: string;
    period: string;
    hasData: boolean;
    note: string;
  }[];
}
export function buildInsights(captures: Capture[]): Insights {
  const successful = captures
    .filter((c) => !c.error)
    .sort((a, b) => b.fetched_at - a.fetched_at || b.id - a.id);
  const latest = (source: string) => successful.find((c) => c.source_id === source);
  const annualMap = new Map<number, AnnualReport>();
  for (const c of successful.filter((c) => c.source_id === 'annual')) {
    const year = Number(c.params.year || c.period);
    if (
      Number.isInteger(year) &&
      !annualMap.has(year) &&
      c.payload?.data &&
      Object.values(c.payload.data).some((v) => v != null)
    )
      annualMap.set(year, { year, id: c.id, data: c.payload.data, fetched: c.fetched_at });
  }
  const annuals = [...annualMap.values()].sort((a, b) => a.year - b.year);
  const yearMap = new Map<number, YearSummary>();
  for (const c of successful.filter((c) => c.source_id === 'year-footprint'))
    for (const item of array(c.payload?.data?.yearItems)) {
      if (!yearMap.has(Number(item.year)))
        yearMap.set(Number(item.year), {
          year: Number(item.year),
          duration: numeric(item.playDuration),
          count: numeric(item.playNum),
          sourceId: c.id,
        });
    }
  for (const annual of annuals) {
    const overview = adaptAnnual(annual.data, annual.year).meetTimeOverview;
    if (!yearMap.has(annual.year) && overview)
      yearMap.set(annual.year, {
        year: annual.year,
        duration: numeric(overview.playTime),
        count: numeric(overview.playCount),
        sourceId: annual.id,
      });
  }
  const periodMap = new Map<string, PeriodReport>();
  for (const c of successful) {
    const p = periodReport(c);
    if (!p) continue;
    const key = `${p.source}:${p.start}:${dayString(p.end)}`;
    if (!periodMap.has(key) || (!periodMap.get(key)!.hasData && p.hasData)) periodMap.set(key, p);
  }
  const periods = [...periodMap.values()].sort(
    (a, b) => b.start - a.start || Number(a.realtime) - Number(b.realtime),
  );
  let unit: UnitEvidence = {
    unit: 'raw',
    description: '年度时长尚无同月报告可校准，先展示原始值；可在年度分析中选择已确认的单位。',
  };
  outer: for (const annual of annuals)
    for (const month of array(annual.data.monthListenDTO?.monthListenItemList)) {
      const monthly = periods.find(
        (p) =>
          p.type === 'month' &&
          !p.realtime &&
          dayString(p.start).slice(0, 7) ===
            `${annual.year}-${String(month.monthIndex).padStart(2, '0')}`,
      );
      const value = numeric(month.playTime);
      if (!monthly?.minutes || !value) continue;
      const ratio = value / monthly.minutes;
      const detected =
        Math.abs(ratio - 60) / 60 < 0.03
          ? 'seconds'
          : Math.abs(ratio - 1) < 0.03
            ? 'minutes'
            : null;
      if (detected) {
        unit = {
          unit: detected,
          year: annual.year,
          month: month.monthIndex,
          annualValue: value,
          monthlyMinutes: monthly.minutes,
          description: `按 ${annual.year} 年 ${month.monthIndex} 月的年度总结与月报校准为${detected === 'seconds' ? '秒' : '分钟'}（允许官方汇总口径差异）。换算依据和原值可展开查看，也可手动调整。`,
        };
        break outer;
      }
    }
  const styleCapture = latest('style');
  const style = array(styleCapture?.payload?.data?.tagPreferenceVos).flatMap((x) =>
    numeric(x.ratio) !== null ? [{ name: x.tagName, value: Number(x.ratio) }] : [],
  );
  return {
    recentResources: array(latest('recent-list')?.payload?.data?.resources).map((x) => ({
      name: x.title || '未命名资源',
      tag: x.tag || x.resourceType || '',
      time: numeric(x.playOrUpdateTime),
    })),
    years: [...yearMap.values()].sort((a, b) => a.year - b.year),
    annuals,
    periods,
    style,
    styleTree: array(styleCapture?.payload?.data?.tags),
    totalRaw: numeric(latest('total')?.payload?.data?.totalDuration),
    unit,
    likesCount: latest('likes') ? array(latest('likes')?.payload?.ids).length : null,
    coverage: successful
      .filter((c) =>
        [
          'year-footprint',
          'annual',
          'report-year',
          'report-month',
          'report-week',
          'realtime-week',
          'realtime-month',
          'style',
          'total',
        ].includes(c.source_id),
      )
      .map((c) => {
        const p = periodReport(c);
        const hasData = p
          ? p.hasData
          : c.source_id === 'year-footprint'
            ? array(c.payload?.data?.yearItems).length > 0
            : c.source_id === 'annual'
              ? Object.keys(c.payload?.data || {}).some((k) => c.payload.data[k] != null)
              : c.source_id === 'style'
                ? array(c.payload?.data?.tagPreferenceVos).length > 0
                : c.source_id === 'total'
                  ? numeric(c.payload?.data?.totalDuration) !== null
                  : true;
        return {
          id: c.id,
          source: c.source_id,
          title: c.title,
          period: responsePeriod(c.payload, c.period),
          hasData,
          note: hasData ? '有可分析的内容' : '接口成功，但只返回时间范围或空内容',
        };
      }),
  };
}
export function percentChange(current: number | null, previous: number | null) {
  return current === null || previous === null || previous === 0
    ? null
    : ((current - previous) / previous) * 100;
}
export function calendarDays(start: number, end: number) {
  return Math.round((Date.parse(dayString(end)) - Date.parse(dayString(start))) / 86400000) + 1;
}
export function durationMinutes(value: number | null, unit: UnitEvidence['unit']): number | null {
  return value === null || unit === 'raw' ? null : unit === 'seconds' ? value / 60 : value;
}
export function comparisonFor(current: PeriodReport, reports: PeriodReport[]) {
  const previousDate =
    current.type === 'month'
      ? new Date(
          Date.UTC(
            Number(dayString(current.start).slice(0, 4)),
            Number(dayString(current.start).slice(5, 7)) - 2,
            1,
          ),
        )
          .toISOString()
          .slice(0, 7)
      : dayString(current.start - 7 * 86400000);
  const previous = reports.find(
    (p) =>
      p.type === current.type &&
      !p.realtime &&
      (current.type === 'month'
        ? dayString(p.start).slice(0, 7) === previousDate
        : dayString(p.start) === previousDate) &&
      p.hasData,
  );
  if (!previous) return null;
  if (current.realtime) {
    const count = current.days.length;
    const before = previous.days.slice(0, count);
    if (!count || before.length !== count) return null;
    return {
      previous,
      previousMinutes: before.reduce((s, d) => s + d.minutes, 0),
      currentMinutes: current.days.reduce((s, d) => s + d.minutes, 0),
      label: `与上一周期前 ${count} 天对比（当日可能尚未结束）`,
    };
  }
  return {
    previous,
    previousMinutes: previous.minutes,
    currentMinutes: current.minutes,
    label: '完整周期环比',
  };
}
export function officialDays(reports: PeriodReport[]) {
  const result = new Map<string, DailyDuration>();
  const ordered = [...reports].sort(
    (a, b) =>
      Number(a.realtime) - Number(b.realtime) ||
      Number(b.type === 'month') - Number(a.type === 'month') ||
      b.fetched - a.fetched,
  );
  for (const p of ordered) for (const d of p.days) if (!result.has(d.date)) result.set(d.date, d);
  return [...result.values()].sort((a, b) => a.date.localeCompare(b.date));
}
