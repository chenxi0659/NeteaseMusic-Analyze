import type { Source } from '../shared/types.js';

export const sources: Source[] = [
  {
    id: 'recent',
    title: '最近播放',
    method: 'record_recent_song',
    path: '/record/recent/song',
    kind: 'recent',
    description: '最近播放列表；时间表示最近播放记录，不能保证保留每一次重复播放。',
  },
  {
    id: 'rank-week',
    title: '一周听歌排行',
    method: 'user_record',
    path: '/user/record',
    kind: 'rank',
    params: { type: 1 },
    description: '官方一周排行；playCount 与 score 分开保存，score 不作为播放次数。',
  },
  {
    id: 'rank-all',
    title: '累计听歌排行',
    method: 'user_record',
    path: '/user/record',
    kind: 'rank',
    params: { type: 0 },
    description: '官方累计排行，仅代表接口返回的曲目，不能还原完整听歌流水。',
  },
  {
    id: 'today',
    title: '今日歌曲排行',
    method: 'listen_data_today_song',
    path: '/listen/data/today/song',
    kind: 'rank',
    description: '听歌足迹今日排行，可能受账号权益限制。',
  },
  {
    id: 'foot-week',
    title: '周歌曲 Top 20',
    method: 'listen_data_song_play_rank',
    path: '/listen/data/song/play/rank',
    kind: 'rank',
    params: { type: 'week' },
    description: '官方周 Top 20，不在榜中不代表播放次数为零。',
  },
  {
    id: 'foot-month',
    title: '月歌曲 Top 20',
    method: 'listen_data_song_play_rank',
    path: '/listen/data/song/play/rank',
    kind: 'rank',
    params: { type: 'month' },
    description: '官方月 Top 20，支持指定历史周期。',
  },
  {
    id: 'total',
    title: '累计收听时长',
    method: 'listen_data_total',
    path: '/listen/data/total',
    kind: 'report',
    description: '官方累计收听数据，字段以实际响应为准。',
  },
  {
    id: 'realtime-week',
    title: '本周收听时长',
    method: 'listen_data_realtime_report',
    path: '/listen/data/realtime/report',
    kind: 'report',
    params: { type: 'week' },
    description: '本周实时统计，不根据歌曲长度推算实际收听时长。',
  },
  {
    id: 'realtime-month',
    title: '本月收听时长',
    method: 'listen_data_realtime_report',
    path: '/listen/data/realtime/report',
    kind: 'report',
    params: { type: 'month' },
    description: '本月实时统计，保留原始字段及数值。',
  },
  {
    id: 'report-week',
    title: '周收听报告',
    method: 'listen_data_report',
    path: '/listen/data/report',
    kind: 'report',
    params: { type: 'week' },
    description: '官方周报告，可指定周期回填。',
  },
  {
    id: 'report-month',
    title: '月收听报告',
    method: 'listen_data_report',
    path: '/listen/data/report',
    kind: 'report',
    params: { type: 'month' },
    description: '官方月报告，可回填历史月份。',
  },
  {
    id: 'report-year',
    title: '年收听报告',
    method: 'listen_data_report',
    path: '/listen/data/report',
    kind: 'report',
    params: { type: 'year' },
    description: '获取已结束年份的报告，本年未结束时不承诺可用。',
  },
  {
    id: 'year-footprint',
    title: '年度听歌足迹',
    method: 'listen_data_year_report',
    path: '/listen/data/year/report',
    kind: 'report',
    description: '年度足迹原始报告，按返回结构浏览。',
  },
  {
    id: 'style',
    title: '官方曲风偏好',
    method: 'style_preference',
    path: '/style/preference',
    kind: 'report',
    description: '直接读取网易云曲风偏好，不根据歌手名称猜测曲风。',
  },
  {
    id: 'recent-list',
    title: '最近听歌补充列表',
    method: 'recent_listen_list',
    path: '/recent/listen/list',
    kind: 'report',
    description: '保留 PC 端补充列表，支持原始字段检索。',
  },
  {
    id: 'likes',
    title: '喜欢的歌曲',
    method: 'likelist',
    path: '/likelist',
    kind: 'likes',
    description: '用于标记分析中的已喜欢歌曲。',
  },
  {
    id: 'annual',
    title: '历年年度总结',
    method: 'summary_annual',
    path: '/summary/annual',
    kind: 'report',
    description: '按年份手动读取；年份支持范围由上游决定。',
  },
];

export function chinaDate(time = Date.now()) {
  return new Date(time + 8 * 3600_000).toISOString().slice(0, 10);
}
export function periodFor(source: Source, params: Record<string, any>, time = Date.now()) {
  if (params.year) return String(params.year);
  if (params.endTime) return `截至 ${chinaDate(Number(params.endTime))}`;
  const day = chinaDate(time);
  if (source.id === 'today') return day;
  const type = params.type;
  if (type === 'month') return day.slice(0, 7);
  if (type === 'week' || source.id === 'rank-week') {
    const d = new Date(`${day}T00:00:00+08:00`);
    const weekday = new Date(d.getTime() + 8 * 3600_000).getUTCDay();
    return `周 ${chinaDate(d.getTime() - ((weekday + 6) % 7) * 86400_000)}`;
  }
  if (type === 'year') return day.slice(0, 4);
  return source.id === 'rank-all' || source.id === 'total' ? `累计 · ${day}` : day;
}
