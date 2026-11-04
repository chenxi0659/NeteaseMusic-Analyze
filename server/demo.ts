import type { Capture, RankRow } from '../shared/types.js';
import { sources } from './catalog.js';

// Entirely synthetic preview data; never written into the user's database.
export function demoData() {
  const now = Date.now();
  const names = [
    '晚风来信',
    '沿海公路',
    '银河漫游',
    '慢慢喜欢',
    '雨后晴天',
    '午夜电台',
    '城市微光',
    '山间回声',
    '未完的夏天',
    '蓝色时刻',
    '昨日电影',
    '晴空',
    '向海',
    '空白诗',
    '凌晨两点',
    '远方的你',
    '花与月',
    '另一种生活',
    '无名岛',
    '漫长旅途',
    '海边散步',
    '日落之前',
    '候鸟',
    '星空下',
  ];
  const artists = [
    '白日旅行家',
    '岛屿来信',
    '陈默',
    '南方公园',
    '林间',
    '月球旅馆',
    '晚安乐队',
    '陈默',
  ];
  const rows: RankRow[] = names.map((name, i) => ({
    id: `demo-${i}`,
    name,
    artists: [{ id: `artist-${i % 8}`, name: artists[i % 8] }],
    album: ['海岸线', '日常浪漫', '夜航日记', '四季来信'][i % 4],
    albumId: `album-${i % 4}`,
    cover: '',
    duration: 170000 + i * 6100,
    publishTime: new Date(`${2010 + (i % 15)}-06-01`).getTime(),
    popularity: 35 + i * 2,
    rank: i + 1,
    value: Math.max(3, 93 - i * 4),
    score: Math.max(1, 100 - i * 4),
  }));
  let id = 1;
  const captures: Capture[] = [];
  const add = (
    source: string,
    period: string,
    time: number,
    data: RankRow[],
    payload: any = {},
  ) => {
    captures.push({
      id: id++,
      source_id: source,
      title: sources.find((s) => s.id === source)!.title,
      period,
      fetched_at: time,
      params: {},
      rows: data,
      payload,
      error: null,
    });
  };
  for (let month = 5; month >= 0; month--) {
    const date = new Date(now);
    date.setMonth(date.getMonth() - month);
    const p = date.toISOString().slice(0, 7);
    const shifted = rows
      .slice(month % 5)
      .concat(rows.slice(0, month % 5))
      .slice(0, 20)
      .map((r, i) => ({ ...r, rank: i + 1, value: 80 - i * 3 + month }));
    add('foot-month', p, now - month * 30 * 86400000, shifted, {
      code: 200,
      data: { songPlayRank: shifted.map((r) => ({ song: r, playCount: r.value })) },
    });
    add('report-month', p, now - month * 30 * 86400000, [], {
      code: 200,
      data: {
        listenDuration: (1200 + (5 - month) * 123) * 60,
        songCount: 170 + month * 12,
        activeDays: 18 + month,
        note: '演示字段，时长单位以实际接口为准',
      },
    });
  }
  for (const s of ['rank-all', 'rank-week', 'foot-week', 'today', 'recent'])
    add(s, s === 'rank-all' ? '累计' : '当前', now, rows.slice(0, s === 'rank-all' ? 24 : 20), {
      code: 200,
      data: { list: rows.map((r) => ({ song: r, playCount: r.value })) },
    });
  add('total', '累计', now, [], {
    code: 200,
    data: { totalListenTime: 825600, unit: 'seconds', description: '合成演示数据' },
  });
  add('style', '当前', now, [], {
    code: 200,
    data: {
      preferences: [
        { name: '独立流行', weight: 42 },
        { name: '民谣', weight: 28 },
        { name: '摇滚', weight: 19 },
        { name: '电子', weight: 11 },
      ],
    },
  });
  add('likes', '当前', now, [], { code: 200, ids: rows.slice(0, 12).map((r) => r.id) });
  const observations = Array.from({ length: 180 }, (_, i) => ({
    playedAt: now - Math.floor(i / 6) * 86400000 - (i % 6) * 3600000,
    firstSeen: now,
    track: rows[(i * 7) % rows.length],
  }));
  return { captures: captures.sort((a, b) => b.id - a.id), observations };
}
