import type { Capture, RankRow } from '../shared/types.js';
import { sources } from './catalog.js';

function demoPeriod(period: string, rows: RankRow[], days?: number) {
  const year = Number(period.slice(0, 4)),
    month = Number(period.slice(5, 7));
  const length = days || new Date(Date.UTC(year, month, 0)).getUTCDate();
  const durationDetails = Array.from({ length }, (_, i) => ({
    period: `${period}-${String(i + 1).padStart(2, '0')}`,
    duration: i % 8 === 0 ? 0 : 60 + ((i * 31 + month * 17) % 220),
    podcastDuration: 0,
    audiobookDuration: 0,
    reachLimit: false,
  }));
  const minutes = durationDetails.reduce((s, d) => s + d.duration, 0);
  return {
    code: 200,
    data: {
      type: 'month',
      startTime: new Date(`${period}-01T00:00:00+08:00`).getTime(),
      endTime: new Date(`${period}-${String(length).padStart(2, '0')}T00:00:00+08:00`).getTime(),
      listenTimeBlock: {
        playDuration: minutes,
        playDurationText: '合成演示报告',
        circleTimePeriodDurations: [
          { period: 'early_morning', duration: minutes * 0.03 },
          { period: 'morning', duration: minutes * 0.12 },
          { period: 'noon', duration: minutes * 0.11 },
          { period: 'afternoon', duration: minutes * 0.28 },
          { period: 'evening', duration: minutes * 0.25 },
          { period: 'night', duration: minutes * 0.21 },
        ],
        sections: [
          {
            type: 'totalPlayMonth',
            field: '本月共听',
            valueA: String(durationDetails.filter((d) => d.duration > 0).length),
            textB: '保持自己的音乐节奏',
          },
        ],
      },
      listenTimeDistributionBlock: {
        playDuration: minutes,
        listenDays: durationDetails.filter((d) => d.duration > 0).length,
        durationDetails,
        achievementTitle: { mainTitle: '音乐漫游者' },
        sleepTdBlock: { sleepPlayDuration: 0, sleepListenDays: 0 },
      },
      wallpaperBlock: { songCount: 260 + month * 13 },
      topSongBlock: {
        songId: rows[0].id,
        songName: rows[0].name,
        playCount: 32,
        items: [{ field: '收听次数', mainText: '32次', subText: '累计播放108分钟' }],
        sections: [{ field: '收听TOP2', songName: rows[1].name, text: '21次收听' }],
      },
      topArtistBlock: {
        artistName: rows[0].artists[0].name,
        items: [{ field: '本月共收听', mainText: '17首', subText: '累计播放92次' }],
      },
      topStyleBlock: {
        sections: [
          { genreName: '独立流行', percent: '45' },
          { genreName: '民谣', percent: '28' },
          { genreName: '摇滚', percent: '18' },
        ],
      },
      topLanguageBlock: {
        sections: [
          { language: '华语', percent: '57', playSongNum: 170 },
          { language: '英语', percent: '29', playSongNum: 85 },
          { language: '日语', percent: '14', playSongNum: 40 },
        ],
      },
      topAgeBlock: {
        sections: [
          { age: '2020', playSongNum: 150 },
          { age: '2010', playSongNum: 110 },
          { age: '2000', playSongNum: 35 },
        ],
      },
      vipBlock: { sections: [{ field: '畅听', mainText: '126首', subText: '会员歌曲' }] },
    },
  };
}

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
  for (let month = 6; month >= 1; month--) {
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
    add('report-month', p, now - month * 30 * 86400000, [], demoPeriod(p, rows));
  }
  const current = new Date(now + 8 * 3600000).toISOString().slice(0, 7);
  add(
    'realtime-month',
    current,
    now,
    [],
    demoPeriod(current, rows, new Date(now + 8 * 3600000).getUTCDate()),
  );
  for (const s of ['rank-all', 'rank-week', 'foot-week', 'today', 'recent'])
    add(s, s === 'rank-all' ? '累计' : '当前', now, rows.slice(0, s === 'rank-all' ? 24 : 20), {
      code: 200,
      data: { list: rows.map((r) => ({ song: r, playCount: r.value })) },
    });
  add('total', '累计', now, [], {
    code: 200,
    data: { totalDuration: 825600 },
  });
  add('style', '当前', now, [], {
    code: 200,
    data: {
      tagPreferenceVos: [
        { tagName: '独立流行', ratio: '42' },
        { tagName: '民谣', ratio: '28' },
        { tagName: '摇滚', ratio: '19' },
        { tagName: '电子', ratio: '11' },
      ],
      tags: [
        {
          tagId: 1,
          tagName: '流行',
          enName: 'Pop',
          childrenTags: [
            { tagId: 2, tagName: '独立流行', childrenTags: [{ tagName: '卧室流行' }] },
          ],
        },
      ],
    },
  });
  add('likes', '当前', now, [], { code: 200, ids: rows.slice(0, 12).map((r) => r.id) });
  const annualYear = Number(current.slice(0, 4)) - 1;
  const calibration = demoPeriod(`${annualYear}-01`, rows);
  const annualMonths = Array.from({ length: 12 }, (_, i) => ({
    monthIndex: i + 1,
    playTime: String(
      (i === 0 ? calibration.data.listenTimeBlock.playDuration : 1900 + i * 95 + (i % 3) * 200) *
        60,
    ),
    artistName: artists[i % artists.length],
  }));
  const yearlyDuration = annualMonths.reduce((s, m) => s + Number(m.playTime), 0);
  const annualData = {
    meetTimeOverview: {
      playTime: yearlyDuration,
      playCount: 4230,
      pcTerminalPlayTime: yearlyDuration * 0.63,
      carTerminalPlayTime: 0,
      homeTerminalPlayTime: yearlyDuration * 0.08,
    },
    monthListenDTO: { monthListenItemList: annualMonths },
    newDiscoveryDTO: {
      totalArtistCount: 820,
      newArtistCount: 237,
      totalGenreCount: 42,
      newGenreCount: 8,
      newSingerDetailDto: { artistName: artists[1] },
    },
    genrePlayRank: {
      genreRank: [
        { genreTagName: '独立流行', percent: 42 },
        { genreTagName: '民谣', percent: 28 },
        { genreTagName: '摇滚', percent: 19 },
      ],
      musicAge: 15,
    },
    seasonsListen: Object.fromEntries(
      ['spring', 'summer', 'autumn', 'winter'].map((key, i) => [
        key,
        {
          songId: rows[i].id,
          songName: rows[i].name,
          artistName: rows[i].artists[0].name,
          playNum: 40 + i * 5,
        },
      ]),
    ),
    annualSong: {
      songId: rows[0].id,
      songName: rows[0].name,
      artistNameList: artists[0],
      playCnt: 132,
      playDays: 40,
      firstDate: new Date(`${annualYear}-02-03T00:00:00+08:00`).getTime(),
    },
    annualPlaylist: {
      items: rows
        .slice(0, 10)
        .map((r) => ({
          songId: r.id,
          songName: r.name,
          artistName: r.artists[0].name,
          playCount: r.value,
        })),
    },
    annualSinger: {
      singerName: artists[0],
      playCount: 324,
      singerPlayDays: 126,
      top5Songs: rows.slice(0, 5).map((r) => ({ name: r.name, playCount: r.value })),
    },
    listenTimePeriod: {
      maxTimePeriod: 'AFTERNOON',
      distributions: annualMonths.map((m) => ({ month: m.monthIndex, hour: 19, peak: 24 })),
    },
    spiritDto: {
      spiritItems: annualMonths.map((m) => ({
        playMonth: m.monthIndex,
        genreTagName: '独立流行',
        moodTag: m.monthIndex % 2 ? 'CALM' : 'PASSION',
      })),
    },
    keyWord: {
      first: { keyword: '远方', lyricCnt: 241 },
      second: { keyword: '明天', lyricCnt: 158 },
    },
    yunCunContributeDto: {
      commentCreateCount: 12,
      commentLikeCount: 8,
      playlistCreateCount: 3,
      collectSongCnt: 69,
    },
    yunCunFeeDto: { listenVipSongsCount: 289, vipLevel: '5', purchaseDigitAlbumCount: 0 },
  };
  add('annual', String(annualYear), now, [], { code: 200, data: annualData });
  add('report-month', `${annualYear}-01`, now, [], calibration);
  add('year-footprint', '年度足迹', now, [], {
    code: 200,
    data: {
      displayYear: annualYear,
      yearItems: Array.from({ length: 8 }, (_, i) => ({
        year: annualYear - i,
        playNum: Math.max(100, 4230 - i * 480),
        playDuration: Math.max(20000, yearlyDuration - i * 170000),
      })),
    },
  });
  add('report-year', String(annualYear), now, [], {
    code: 200,
    data: {
      type: 'year',
      startTime: new Date(`${annualYear}-01-01T00:00:00+08:00`).getTime(),
      endTime: new Date(`${annualYear}-12-31T00:00:00+08:00`).getTime(),
      listenTimeBlock: null,
    },
  });
  const observations = Array.from({ length: 180 }, (_, i) => ({
    playedAt: now - Math.floor(i / 6) * 86400000 - (i % 6) * 3600000,
    firstSeen: now,
    track: rows[(i * 7) % rows.length],
  }));
  return { captures: captures.sort((a, b) => b.id - a.id), observations };
}
