import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildInsights,
  periodReport,
  responsePeriod,
  officialDays,
  comparisonFor,
  percentChange,
} from '../shared/reports.js';
import { rowsOf } from '../server/normalize.js';
import { Store } from '../server/store.js';
import type { Capture } from '../shared/types.js';
import { adaptAnnual } from '../shared/annual.js';
const time = (date: string) => new Date(`${date}T00:00:00+08:00`).getTime();
const capture = (source: string, data: any, id = 1, params: any = {}): Capture => ({
  id,
  source_id: source,
  title: source,
  period: '请求标签',
  fetched_at: id * 1000,
  params,
  payload: { code: 200, data },
  rows: [],
  error: null,
});
const month = (yearMonth: string, minutes = 60) => ({
  type: 'month',
  startTime: time(`${yearMonth}-01`),
  endTime: time(`${yearMonth}-28`),
  listenTimeBlock: { playDuration: minutes },
  listenTimeDistributionBlock: {
    playDuration: minutes,
    listenDays: 2,
    durationDetails: [
      { period: `${yearMonth}-01`, duration: 0 },
      { period: `${yearMonth}-02`, duration: minutes, reachLimit: true },
    ],
  },
});

test('解析实际平铺榜单字段 songItems / songDTOs，保留计数和歌手', () => {
  const song = {
    songId: 123,
    songName: '测试歌曲',
    albumName: '专辑',
    artists: [{ artistId: 7, artistName: '测试歌手' }],
    playCount: 4,
  };
  const row = rowsOf({ data: { songItems: [song] } })[0];
  assert.equal(row.id, '123');
  assert.equal(row.artists[0].name, '测试歌手');
  assert.equal(row.album, '专辑');
  assert.equal(row.value, 4);
  assert.equal(rowsOf({ data: { songDTOs: [{ ...song, playCount: undefined }] } })[0].value, null);
});
test('周期以响应起止日期为准，200 空年度报告不被当作零时长', () => {
  assert.equal(responsePeriod({ data: month('2026-10') }, '2026-11'), '2026-10');
  const p = periodReport(
    capture('report-year', {
      type: 'year',
      startTime: time('2025-01-01'),
      endTime: time('2025-12-31'),
      listenTimeBlock: null,
    }),
  )!;
  assert.equal(p.hasData, false);
  assert.equal(p.minutes, null);
});
test('年度旧版本分别处理秒、分钟与毫秒，旧时间戳不落到 1970 年', () => {
  const old = adaptAnnual(
    { yearOverview: { playTime: 100 }, dopamineColor: { playDuration: 6000123 } },
    2023,
  );
  assert.equal(old.meetTimeOverview.playTime, 6000.123);
  const previous = adaptAnnual(
    {
      singlePlay: { playDate: 1609459200, playNum: 7 },
      songPlaySummary: { playDurations: 1234, playNum: 20 },
    },
    2021,
  );
  assert.equal(previous.loopSongDTO.playDate, 1609459200000);
  assert.equal(previous.loopSongDTO.playCount, 7);
  assert.equal(previous.meetTimeOverview.playTime, 1234);
});
test('年度时长通过同月报告校准，重复年快照不重复计入，没证据保留原值', () => {
  const year = capture(
    'year-footprint',
    { yearItems: [{ year: 2024, playDuration: 3600, playNum: 20 }] },
    1,
  );
  const annual = capture(
    'annual',
    {
      meetTimeOverview: { playTime: 3600, playCount: 20 },
      monthListenDTO: { monthListenItemList: [{ monthIndex: 1, playTime: '3600' }] },
    },
    2,
    { year: '2024' },
  );
  const result = buildInsights([
    year,
    { ...year, id: 4 },
    annual,
    capture('report-month', month('2024-01'), 3),
  ]);
  assert.equal(result.years.length, 1);
  assert.equal(result.unit.unit, 'seconds');
  assert.equal(result.years[0].sourceId, 4);
  assert.equal(buildInsights([year]).unit.unit, 'raw');
  assert.equal(percentChange(5, 0), null);
});
test('重叠每日统计只保留一份，零值和上限标记保留，不用空报告覆盖已有统计', () => {
  const good = capture('report-month', month('2026-10', 80), 1);
  const empty = capture(
    'report-month',
    { ...month('2026-10'), listenTimeBlock: null, listenTimeDistributionBlock: null },
    3,
  );
  const week = capture('report-week', { ...month('2026-10', 40), type: 'week' }, 2);
  const result = buildInsights([good, empty, week]);
  const days = officialDays(result.periods);
  assert.equal(days.length, 2);
  assert.equal(days[0].minutes, 0);
  assert.equal(days[1].minutes, 80);
  assert.equal(days[1].capped, true);
  assert.equal(result.periods.find((p) => p.source === 'report-month')!.minutes, 80);
});
test('一月环比正确跨年，实时报告只比较上期相同天数', () => {
  const current = periodReport(capture('realtime-month', month('2024-01', 60)))!;
  const previous = periodReport(
    capture('report-month', {
      ...month('2023-12', 900),
      listenTimeDistributionBlock: {
        playDuration: 900,
        durationDetails: [
          { period: '2023-12-01', duration: 10 },
          { period: '2023-12-02', duration: 20 },
          { period: '2023-12-03', duration: 870 },
        ],
      },
    }),
  )!;
  const compare = comparisonFor(current, [previous])!;
  assert.equal(compare.previousMinutes, 30);
  assert.equal(compare.currentMinutes, 60);
});
test('旧快照无需重新同步就能按实际周期读取，并补解析曾遗漏的榜单', () => {
  const store = new Store(':memory:');
  const c = capture('report-month', month('2026-10'));
  store.save('a', c);
  store.save('b', { ...c, payload: { code: 200, data: month('2025-01') } });
  assert.equal(store.index('a')[0].period, '2026-10');
  assert.equal(store.analysisCaptures('a').length, 1);
  const id = store.save(
    'a',
    capture('foot-month', {
      type: 'month',
      startTime: time('2026-10-01'),
      endTime: time('2026-10-31'),
      songItems: [{ songId: 1, songName: '测试', playCount: 2 }],
    }),
  );
  assert.equal(store.capture('a', id)?.rows.length, 1);
  assert.equal(store.index('a')[0].row_count, 1);
  store.db.close();
});
