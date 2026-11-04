import { test } from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { aggregate, rankChanges } from '../shared/analysis.js';
import { rowsOf, observationsOf } from '../server/normalize.js';
import { Store } from '../server/store.js';
import { historySpecs } from '../server/sync.js';
import { fetchPlaylist, playlistExcel, playlistMarkdown } from '../server/playlists.js';
import type { Upstream } from '../server/upstream.js';

const song = {
  id: 123,
  name: '=一首|歌',
  ar: [
    { id: 1, name: '甲' },
    { id: 2, name: '乙' },
  ],
  al: { id: 5, name: '专辑' },
  dt: 200000,
};
test('排行分数不当作播放次数；最近播放与听歌排行均能解析', () => {
  const [rank] = rowsOf({ allData: [{ song, score: 98 }] });
  assert.equal(rank.value, null);
  assert.equal(rank.score, 98);
  assert.equal(rowsOf({ data: { list: [{ data: song, playTime: 1700000000000 }] } })[0].id, '123');
  assert.equal(rowsOf({ data: { songPlayRank: [{ song, playCount: 0 }] } })[0].value, 0);
  assert.equal(observationsOf({ data: { list: [{ data: song }] } }).length, 0);
});
test('合作歌曲均分权重，缺失计数不进入次数分母', () => {
  const rows = rowsOf({ allData: [{ song, playCount: 10 }, { song: { ...song, id: 124 } }] });
  const artists = aggregate(rows, 'artist', 'plays');
  assert.equal(
    artists.reduce((s, a) => s + a.value, 0),
    10,
  );
  assert.equal(artists[0].value, 5);
  assert.equal(aggregate(rows, 'album', 'tracks')[0].value, 2);
});
test('榜外曲目没有伪造的上期零次播放', () => {
  const rows = rowsOf({ allData: [{ song, playCount: 10 }] });
  const [change] = rankChanges(rows, []);
  assert.equal(change.change, null);
  assert.equal(change.delta, null);
});
test('重复同步不会重复增加观察记录，账号之间隔离，失败保留旧快照', () => {
  const store = new Store(':memory:');
  const rows = rowsOf({ allData: [{ song, playCount: 10 }] });
  const base = {
    source_id: 'recent',
    title: '最近播放',
    period: '今天',
    fetched_at: Date.now(),
    params: { cookie: 'secret' },
    payload: { code: 200, cookie: 'secret' },
    rows,
    error: null,
  };
  store.save('a', base);
  store.save('b', base);
  store.observe('a', '123', 1700000000000, Date.now());
  store.observe('a', '123', 1700000000000, Date.now());
  assert.equal(store.counts('a').observations, 1);
  assert.equal(store.observations('b').length, 0);
  store.save('a', { ...base, rows: [], payload: null, error: '权限不足' });
  assert.equal(store.captures('a').filter((c) => !c.error).length, 1);
  assert.equal(store.captures('a')[1].params.cookie, undefined);
  assert.equal(store.captures('a')[1].payload.cookie, undefined);
  store.db.close();
});
test('历史月份按北京时间上月最后一天零点回填', () => {
  const specs = historySpecs(3);
  assert.equal(specs.length, 6);
  const current = new Date(Date.now() + 8 * 3600000);
  const last = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth(), 0))
    .toISOString()
    .slice(0, 10);
  assert.equal(specs[0].params?.endTime, new Date(`${last}T00:00:00+08:00`).getTime());
});
test('歌单按完整 trackIds 补齐详情，保留缺失条目及时间来源', async () => {
  const fake = {
    call: async (method: string, params: any) => {
      if (method === 'playlist_detail')
        return {
          playlist: {
            name: '我的歌单',
            creator: { nickname: '测试' },
            trackCount: 3,
            trackIds: [{ id: 123, at: 1700000000000 }, { id: 124 }, { id: 125 }],
            tracks: [song],
          },
        };
      assert.equal(params.ids, '124,125');
      return { songs: [{ ...song, id: 124 }] };
    },
  } as unknown as Upstream;
  const p = await fetchPlaylist(fake, '456');
  assert.deepEqual(
    p.rows.map((r) => r.id),
    ['123', '124', '125'],
  );
  assert.equal(p.rows[0].addedAtSource, 'trackIds.at');
  assert.equal(p.rows[1].addedAt, null);
  assert.equal(p.rows[2].track, null);
  assert.equal(p.subscribedAt, null);
  const md = playlistMarkdown(p);
  assert.ok(md.includes('=一首\\|歌'));
  assert.ok(md.includes('收藏歌单时间：未返回'));
  const buffer = await playlistExcel(p);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as any);
  const sheet = workbook.getWorksheet('歌单')!;
  assert.equal(sheet.rowCount, 10);
  assert.equal(sheet.getCell('B8').value, song.name);
  assert.equal(sheet.getCell('F10').value, '125');
  assert.equal(sheet.getCell('H9').value, '');
  assert.ok(sheet.getCell('H8').value instanceof Date);
});
