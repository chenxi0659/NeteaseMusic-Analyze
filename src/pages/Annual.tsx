import { useState } from 'react';
import { CalendarRange, Clock3, FileText, Music2, TrendingUp } from 'lucide-react';
import { Empty, Panel, type PageContext } from '../App';
import { Chart } from '../Chart';
import { Stat } from './Analysis';
import { date, download, num, post } from '../api';
import { durationMinutes, numeric, percentChange, type UnitEvidence } from '../../shared/reports';
import {
  Change,
  DistributionPanel,
  NoteGrid,
  Provenance,
  hours,
  percentage,
} from '../components/ReportUI';
import { adaptAnnual } from '../../shared/annual';
import { AnnualExtras } from './AnnualExtras';
import { AnnualTrendCharts } from '../components/AnnualTrendCharts';

const list = (v: any): any[] => (Array.isArray(v) ? v : []);
const periodNames: Record<string, string> = {
  EARLY_MORNING: '凌晨',
  MORNING: '上午',
  NOON: '中午',
  AFTERNOON: '下午',
  EVENING: '傍晚',
  NIGHT: '夜间',
  LATE_NIGHT: '深夜',
};
const moods: Record<string, string> = {
  PASSION: '热烈',
  CALM: '平静',
  HAPPY: '愉快',
  SAD: '感伤',
  ROMANTIC: '浪漫',
};
export function AnnualPage({ insights, demo, state, reload, notify, index }: PageContext) {
  const years = insights?.years || [];
  const [selection, setSelection] = useState('latest');
  const [unitChoice, setUnit] = useState('auto');
  const unit: UnitEvidence['unit'] =
    unitChoice === 'auto' ? insights?.unit.unit || 'raw' : (unitChoice as UnitEvidence['unit']);
  const selected =
    selection === 'latest' ? years.at(-1) : years.find((y) => y.year === Number(selection));
  const previous = years.find((y) => y.year === (selected?.year || 0) - 1);
  const annual = insights?.annuals.find((a) => a.year === selected?.year);
  const d = annual ? adaptAnnual(annual.data, annual.year) : null;
  const minutes = durationMinutes(selected?.duration ?? null, unit);
  const days = selected
    ? (Date.UTC(selected.year + 1, 0, 1) - Date.UTC(selected.year, 0, 1)) / 86400000
    : 365;
  const peak = [...years]
    .filter((y) => y.duration !== null)
    .sort((a, b) => b.duration! - a.duration!)[0];
  const unitName = unit === 'raw' ? '原始单位' : '小时';
  const trend = years.map((y) => {
    const minutes = durationMinutes(y.duration, unit);
    return unit === 'raw' ? y.duration : minutes === null ? null : minutes / 60;
  });
  function exportSummary() {
    const rows = years.map(
      (y) =>
        `| ${y.year} | ${unit === 'raw' ? num(y.duration) : hours(durationMinutes(y.duration, unit))} | ${num(y.count)} | ${y.sourceId} |`,
    );
    download(
      `# 年度听歌汇总\n\n时长显示：${unitName}。年度计数沿用 API playNum，不解释为独立歌曲数或总播放次数。\n\n${insights?.unit.description}\n\n| 年份 | 时长（${unitName}） | 年度计数 | 数据快照 |\n| --- | --- | --- | --- |\n${rows.join('\n')}\n`,
      '年度听歌汇总.md',
      'text/markdown',
    );
  }
  return (
    <>
      <div className="filterbar">
        <div className="filter-group">
          <span>年度</span>
          <select
            aria-label="分析年份"
            value={selection}
            onChange={(e) => setSelection(e.target.value)}
          >
            <option value="latest">最近可用年份</option>
            {[...years].reverse().map((y) => (
              <option key={y.year} value={y.year}>
                {y.year} 年
              </option>
            ))}
          </select>
          <select
            aria-label="年度时长单位"
            value={unitChoice}
            onChange={(e) => setUnit(e.target.value)}
          >
            <option value="auto">按跨报告校准单位</option>
            <option value="seconds">原始值为秒</option>
            <option value="minutes">原始值为分钟</option>
            <option value="raw">只看原始值</option>
          </select>
        </div>
        <button
          className="button secondary compact"
          disabled={!years.length}
          onClick={exportSummary}
        >
          <FileText size={15} />
          导出年度摘要
        </button>
      </div>
      <Provenance>
        年度足迹提供汇总，年度总结提供精选与更多维度。计数字段 playNum
        沿用官方原值，不当作完整曲目列表或跨年去重歌曲数。
      </Provenance>
      {!!insights?.annuals.length && (
        <div className="available-annuals">
          <span>已取得详细总结</span>
          {[...insights.annuals].reverse().map((a) => (
            <button
              key={a.year}
              className={a.year === selected?.year ? 'active' : ''}
              onClick={() => setSelection(String(a.year))}
            >
              {a.year}
            </button>
          ))}
        </div>
      )}
      {!selected ? (
        <Panel title="年度分析">
          <Empty
            title="还没有年度汇总"
            text="同步年度听歌足迹，或在数据管理中回填已结束年份的年度总结。"
          />
        </Panel>
      ) : (
        <>
          <div className="stats-grid">
            <Stat
              icon={<Clock3 size={20} />}
              label={`${selected.year} 年收听时长`}
              value={unit === 'raw' ? num(selected.duration) : hours(minutes)}
              unit={unit === 'raw' ? '原始值' : '小时'}
              caption={`原始 playDuration：${num(selected.duration)}`}
            />
            <Stat
              icon={<Music2 size={20} />}
              label="年度听歌计数"
              value={num(selected.count)}
              caption="API playNum，保留官方年度统计口径"
            />
            <Stat
              icon={<TrendingUp size={20} />}
              label="时长同比"
              value={percentage(percentChange(selected.duration, previous?.duration ?? null))}
              caption={
                previous ? `与 ${previous.year} 年比较；基数为零时不计算` : '没有紧邻上一年的数据'
              }
            />
            <Stat
              icon={<CalendarRange size={20} />}
              label="按全年计算的日均"
              value={minutes === null ? '—' : num(minutes / days, 1)}
              unit="分钟"
              caption={`按 ${days} 个自然日计算，不等于活跃日均`}
            />
          </div>
          <div className="insight-banner">
            <div>
              <span className="eyebrow">YOUR MUSIC THROUGH THE YEARS</span>
              <h2>
                {peak ? `${peak.year} 年，是已返回年份中的收听高峰。` : '年度音乐档案正在积累。'}
              </h2>
              <p>
                当前覆盖 {years[0]?.year}—{years.at(-1)?.year}，共 {years.length} 年。
                {previous &&
                selected.duration !== null &&
                previous.duration !== null &&
                previous.duration !== 0
                  ? ` ${selected.year} 年相对上一年的时长${selected.duration >= previous.duration ? '增加' : '减少'} ${num(Math.abs(percentChange(selected.duration, previous.duration) ?? 0), 1)}%。`
                  : ''}
              </p>
            </div>
            <CalendarRange size={50} strokeWidth={1} />
          </div>
          <Panel
            title="历年时长与听歌计数"
            caption="上图为时长，下图为官方计数，按同一组年份对齐；每个指标独立标注单位与数值"
          >
            <AnnualTrendCharts
              years={years.map((y) => y.year)}
              durations={trend}
              counts={years.map((y) => y.count)}
              durationUnit={unitName}
            />
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>年份</th>
                    <th>时长（{unitName}）</th>
                    <th>时长同比</th>
                    <th>年度计数</th>
                    <th>计数同比</th>
                  </tr>
                </thead>
                <tbody>
                  {[...years].reverse().map((y) => {
                    const last = years.find((x) => x.year === y.year - 1);
                    return (
                      <tr key={y.year}>
                        <td>
                          <button
                            className="inline-link"
                            onClick={() => setSelection(String(y.year))}
                          >
                            {y.year}
                          </button>
                        </td>
                        <td>
                          {unit === 'raw'
                            ? num(y.duration)
                            : hours(durationMinutes(y.duration, unit))}
                        </td>
                        <td>
                          <Change value={percentChange(y.duration, last?.duration ?? null)} />
                        </td>
                        <td>{num(y.count)}</td>
                        <td>
                          <Change value={percentChange(y.count, last?.count ?? null)} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Panel>
          <details className="unit-evidence">
            <summary>时长单位、换算依据与边界</summary>
            <p>{insights?.unit.description}</p>
            {insights?.unit.annualValue != null && (
              <p>
                校准样本：{insights.unit.year} 年 {insights.unit.month} 月，年度月明细原值{' '}
                {num(insights.unit.annualValue)}，同月月报 {num(insights.unit.monthlyMinutes)}{' '}
                分钟。两套报告的统计截止口径可能存在差异。当前显示方式：{unitName}。
              </p>
            )}
            <p>
              只展示已经返回的年份。单年总结中的时长字段也可能使用不同单位，各卡片分别标注，不统一按同一个系数转换。
            </p>
          </details>
          {!d ? (
            <Panel
              title={`${selected.year} 年度细节`}
              action={
                <button
                  className="button secondary compact"
                  disabled={demo || !state.profile || state.syncing}
                  onClick={async () => {
                    try {
                      await post('/history', { year: selected.year });
                      await reload();
                      notify('年度总结回填已开始，完成后会自动刷新');
                    } catch (e: any) {
                      notify(e.message);
                    }
                  }}
                >
                  回填这个年份
                </button>
              }
            >
              <Empty
                title="这个年份只有汇总，尚无可用的年度总结"
                text={`上方趋势已经使用年度足迹数据。月度曲线、年度歌单等需要另一个年度总结接口；某些年份该接口可能返回 404。${index.some((c) => c.source_id === 'annual' && String(c.params.year) === String(selected.year) && c.error) ? '最近一次回填未成功，请到数据管理查看原因。' : ''}`}
              />
            </Panel>
          ) : (
            <AnnualDetails data={d} year={selected.year} unit={unit} captureId={annual!.id} />
          )}
        </>
      )}
    </>
  );
}
function AnnualDetails({
  data: d,
  year,
  unit,
  captureId,
}: {
  data: any;
  year: number;
  unit: UnitEvidence['unit'];
  captureId: number;
}) {
  const months = list(d.monthListenDTO?.monthListenItemList);
  const discovery = d.newDiscoveryDTO;
  const overview = d.meetTimeOverview;
  const seasons = Object.entries(d.seasonsListen || {}).filter(
    ([, v]) => v && typeof v === 'object',
  );
  const terminals = overview
    ? [
        ['电脑', numeric(overview.pcTerminalPlayTime)],
        ['车载', numeric(overview.carTerminalPlayTime)],
        ['家庭设备', numeric(overview.homeTerminalPlayTime)],
      ].filter((x): x is [string, number] => typeof x[1] === 'number')
    : [];
  const known = terminals.reduce((s, t) => s + t[1], 0),
    total = numeric(overview?.playTime);
  const terminalData = terminals.map(([name, value]) => ({
    name,
    value: durationMinutes(value, unit) ?? value,
  }));
  if (total !== null && total > known)
    terminalData.push({
      name: '其余／未分类设备',
      value: durationMinutes(total - known, unit) ?? total - known,
    });
  const genres = list(d.genrePlayRank?.genreRank).map((x) => ({
    name: x.genreTagName || x.oneGenreTagName,
    value: Number(x.percent),
  }));
  const keywords = Object.values(d.keyWord || {})
    .filter((x: any) => x?.keyword)
    .map((x: any) => ({
      label: x.keyword,
      text:
        numeric(x.lyricCnt) === null ? '官方年度关键词' : `官方计数 ${num(numeric(x.lyricCnt))}`,
    }));
  const contribution: Record<string, string> = {
    commentCreateCount: '发表评论',
    commentLikeCount: '评论点赞计数',
    playlistCreateCount: '创建歌单',
    playlistPlayCount: '歌单播放计数',
    playlistCollectCount: '歌单收藏计数',
    collectSongCnt: '收藏歌曲',
    completeSongsCount: '歌曲完善计数',
    completeSongsEffectUserCount: '歌曲完善影响用户数',
    yuntuigeCount: '云推歌次数',
  };
  const contributionNotes = Object.entries(contribution).flatMap(([key, label]) =>
    numeric(d.yunCunContributeDto?.[key]) === null
      ? []
      : [{ label, text: num(Number(d.yunCunContributeDto[key])) }],
  );
  const fees: Record<string, string> = {
    listenVipSongsCount: '会员歌曲计数',
    vipLevel: '年度会员等级',
    experienceVipDays: '体验会员天数',
    vipInterestCount: '会员权益计数',
    singleSongPurchaseCount: '购买单曲数量',
    purchaseDigitAlbumCount: '购买数字专辑',
    purchaseEntityAlbumCount: '购买实体专辑',
    liveTotalCount: '现场演出次数',
  };
  return (
    <>
      {months.length > 0 && (
        <Panel
          title={`${year} 年的十二个月`}
          caption={`年度总结的月明细 · ${unit === 'raw' ? '原始时长值' : '换算为小时'}，不与另外采集的月报强行合并`}
        >
          <Chart
            option={{
              tooltip: { trigger: 'axis', valueFormatter: (value: number) => num(value, 1) },
              grid: { top: 20, left: 55, right: 25, bottom: 35 },
              xAxis: {
                type: 'category',
                data: months.map((m) => `${m.monthIndex}月`),
                axisTick: { show: false },
                axisLine: { show: false },
              },
              yAxis: { type: 'value', splitLine: { lineStyle: { color: '#eef2ef' } } },
              series: [
                {
                  type: 'line',
                  data: months.map((m) => {
                    const minutes = durationMinutes(numeric(m.playTime), unit);
                    return unit === 'raw'
                      ? numeric(m.playTime)
                      : minutes === null
                        ? null
                        : minutes / 60;
                  }),
                  lineStyle: { color: '#237d6b', width: 3 },
                  itemStyle: { color: '#237d6b' },
                  areaStyle: { color: '#eaf3ed' },
                },
              ],
            }}
          />
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>月份</th>
                  <th>时长（{unit === 'raw' ? '原始值' : '小时'}）</th>
                  <th>代表歌手</th>
                  <th>代表歌曲／专辑</th>
                </tr>
              </thead>
              <tbody>
                {months.map((m) => (
                  <tr key={m.monthIndex}>
                    <td>{m.monthIndex} 月</td>
                    <td>
                      {unit === 'raw'
                        ? num(numeric(m.playTime))
                        : hours(durationMinutes(numeric(m.playTime), unit))}
                    </td>
                    <td>{m.artistName || '—'}</td>
                    <td>{m.songName || m.albumName || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
      <div className="two-columns">
        {discovery && (
          <Panel title="音乐探索">
            <NoteGrid
              notes={[
                { label: '全年涉及歌手', text: num(numeric(discovery.totalArtistCount)) },
                { label: '新发现歌手', text: num(numeric(discovery.newArtistCount)) },
                {
                  label: '新歌手占比',
                  text: numeric(discovery.totalArtistCount)
                    ? `${num((discovery.newArtistCount / discovery.totalArtistCount) * 100, 1)}%`
                    : '—',
                },
                { label: '全年曲风种类', text: num(numeric(discovery.totalGenreCount)) },
                { label: '新发现曲风', text: num(numeric(discovery.newGenreCount)) },
                ...(discovery.newSingerDetailDto?.artistName
                  ? [{ label: '新发现代表歌手', text: discovery.newSingerDetailDto.artistName }]
                  : []),
              ]}
            />
          </Panel>
        )}
        {terminalData.length > 0 && (
          <DistributionPanel
            title="设备上的音乐时间"
            data={terminalData}
            unit={unit === 'raw' ? ' 原始单位' : ' 分钟'}
            caption="互斥设备时长与总时长差额；播客不重复加入设备分布"
          />
        )}
      </div>
      {genres.length > 0 && (
        <DistributionPanel
          title="年度曲风"
          data={genres}
          caption={
            d.genrePlayRank?.musicAge != null
              ? `官方音乐年龄 ${d.genrePlayRank.musicAge} · 占比只覆盖返回的曲风`
              : '官方年度曲风占比'
          }
        />
      )}
      {seasons.length > 0 && (
        <Panel title="四季代表歌曲">
          <NoteGrid
            notes={seasons.map(([key, v]: [string, any]) => ({
              label:
                ({ spring: '春', summer: '夏', autumn: '秋', winter: '冬' } as any)[key] || key,
              text: `${v.songName || '—'} · ${v.artistName || '—'}${numeric(v.playNum) !== null ? ` · ${num(v.playNum)} 次` : ''}`,
              resource: v.songId ? `https://music.163.com/song?id=${v.songId}` : undefined,
            }))}
          />
        </Panel>
      )}
      {d.annualSong && (
        <Panel title="年度歌曲">
          <NoteGrid
            notes={[
              {
                label: '年度歌曲',
                text: `${d.annualSong.songName || '—'} · ${d.annualSong.artistNameList || ''}`,
              },
              { label: '收听次数', text: num(numeric(d.annualSong.playCnt)) },
              { label: '收听天数', text: `${num(numeric(d.annualSong.playDays))} 天` },
              { label: '首次收听', text: date(numeric(d.annualSong.firstDate)) },
            ]}
          />
        </Panel>
      )}
      {list(d.annualPlaylist?.items).length > 0 && (
        <Panel title="官方年度歌单" caption="接口返回的精选清单，不能当作全年所有曲目">
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>歌曲</th>
                  <th>歌手</th>
                  <th>年度次数</th>
                </tr>
              </thead>
              <tbody>
                {list(d.annualPlaylist.items).map((s, i) => (
                  <tr key={`${s.songId}-${i}`}>
                    <td>{i + 1}</td>
                    <td>
                      <a
                        className="inline-link"
                        href={`https://music.163.com/song?id=${s.songId}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {s.songName}
                      </a>
                    </td>
                    <td>{s.artistName || '—'}</td>
                    <td>{num(numeric(s.playCount))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
      {d.annualSinger && (
        <Panel title="年度歌手">
          <NoteGrid
            notes={[
              { label: '年度歌手', text: d.annualSinger.singerName || '—' },
              { label: '收听次数', text: num(numeric(d.annualSinger.playCount)) },
              { label: '陪伴天数', text: `${num(numeric(d.annualSinger.singerPlayDays))} 天` },
            ]}
          />
          {list(d.annualSinger.top5Songs).length > 0 && (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>歌手代表曲目</th>
                    <th>收听次数</th>
                  </tr>
                </thead>
                <tbody>
                  {list(d.annualSinger.top5Songs).map((s, i) => (
                    <tr key={i}>
                      <td>{s.name || s.songName}</td>
                      <td>{num(numeric(s.playCount))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      )}
      <div className="two-columns">
        {d.annualPlaylistAlbum?.favoriteAlbum && (
          <Panel title="年度专辑">
            <NoteGrid
              notes={[
                { label: '专辑', text: d.annualPlaylistAlbum.favoriteAlbum.albumName || '—' },
                { label: '歌手', text: d.annualPlaylistAlbum.favoriteAlbum.artistName || '—' },
                {
                  label: '收听天数',
                  text: `${num(numeric(d.annualPlaylistAlbum.favoriteAlbum.playDays))} 天`,
                },
                {
                  label: '收听次数',
                  text: num(numeric(d.annualPlaylistAlbum.favoriteAlbum.playCount)),
                },
                {
                  label: '时长字段（API 原值）',
                  text: num(numeric(d.annualPlaylistAlbum.favoriteAlbum.playDuration)),
                },
              ]}
            />
          </Panel>
        )}
        {(d.latePlayDTO || d.loopSongDTO) && (
          <Panel title="特别的收听纪录">
            <NoteGrid
              notes={[
                ...(d.latePlayDTO
                  ? [
                      {
                        label: '最晚收听',
                        text: `${date(numeric(d.latePlayDTO.datetime), true)} · ${d.latePlayDTO.songName || ''}`,
                      },
                    ]
                  : []),
                ...(d.loopSongDTO
                  ? [
                      {
                        label: '单日循环纪录',
                        text: `${d.loopSongDTO.songName || ''} · ${num(numeric(d.loopSongDTO.playCount))} 次 · ${date(numeric(d.loopSongDTO.playDate))}`,
                      },
                    ]
                  : []),
                ...(d.listenTimePeriod?.maxTimePeriod
                  ? [
                      {
                        label: '最常收听时段',
                        text:
                          periodNames[d.listenTimePeriod.maxTimePeriod] ||
                          d.listenTimePeriod.maxTimePeriod,
                      },
                    ]
                  : []),
              ]}
            />
          </Panel>
        )}
      </div>
      {list(d.listenTimePeriod?.distributions).length > 0 && (
        <Panel
          title="每月收听时段纪录"
          caption="沿用接口 month / hour / peak；peak 不擅自解释为百分比"
        >
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>月份</th>
                  <th>小时字段</th>
                  <th>峰值字段</th>
                </tr>
              </thead>
              <tbody>
                {list(d.listenTimePeriod.distributions).map((x, i) => (
                  <tr key={i}>
                    <td>{x.month} 月</td>
                    <td>{x.hour}</td>
                    <td>{x.peak}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
      {keywords.length > 0 && (
        <Panel title="年度歌词关键词" caption="只分析官方关键词与计数，不展示整段歌词">
          <NoteGrid notes={keywords} />
        </Panel>
      )}
      {list(d.spiritDto?.spiritItems).length > 0 && (
        <Panel title="每月音乐气质">
          <div className="month-moods">
            {list(d.spiritDto.spiritItems).map((m, i) => (
              <article key={i}>
                <span>{m.playMonth} 月</span>
                <strong>{m.genreTagName || '—'}</strong>
                <small>{moods[m.moodTag] || m.moodTag || '—'}</small>
              </article>
            ))}
          </div>
        </Panel>
      )}
      {d.minorMassDTO && (
        <Panel title="小众与共鸣">
          <NoteGrid
            notes={[
              {
                label: '小众代表',
                text: `${d.minorMassDTO.minoritySongName || ''} · ${d.minorMassDTO.minoritySingerName || ''}`,
              },
              {
                label: '小众代表收听次数',
                text: num(numeric(d.minorMassDTO.minoritySongPlayCount)),
              },
              {
                label: '大众共鸣歌曲',
                text: `${d.minorMassDTO.massSongName || ''} · ${d.minorMassDTO.massSingerName || ''}`,
              },
            ]}
          />
        </Panel>
      )}
      {contributionNotes.length > 0 && (
        <Panel title="云村里的参与">
          <NoteGrid notes={contributionNotes} />
        </Panel>
      )}
      {d.yunCunFeeDto && (
        <Panel title="年度会员与音乐消费" caption="金额字段保持原值，不推测币种或计费单位">
          <NoteGrid
            notes={[
              ...Object.entries(fees).flatMap(([key, label]) =>
                numeric(d.yunCunFeeDto[key]) === null
                  ? []
                  : [{ label, text: num(Number(d.yunCunFeeDto[key])) }],
              ),
              ...(d.yunCunFeeDto.highSoundQualityPlayTime != null
                ? [
                    {
                      label: '高音质时间（API 原值）',
                      text: num(numeric(d.yunCunFeeDto.highSoundQualityPlayTime), 2),
                    },
                  ]
                : []),
              ...(d.yunCunFeeDto.beVipUserLongestTime
                ? [{ label: '会员日期字段', text: d.yunCunFeeDto.beVipUserLongestTime }]
                : []),
            ]}
          />
        </Panel>
      )}
      {list(d.annualSingerComparePage?.singers).length > 0 && (
        <Panel title="历年年度歌手">
          <NoteGrid
            notes={list(d.annualSingerComparePage.singers).map((s) => ({
              label: `${s.year} 年`,
              text: s.singerName || '—',
            }))}
          />
        </Panel>
      )}
      <AnnualExtras data={d} year={year} />
      <Provenance>
        年度细节来自总结快照 #{captureId}
        ；不同年份字段经过分别适配，秒级时间戳转换为北京时间。没有返回的模块不生成虚构分析，原始字段仍可查看。
      </Provenance>
    </>
  );
}
