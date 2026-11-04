import { Panel } from '../App';
import { NoteGrid, DistributionPanel } from '../components/ReportUI';
import { numeric } from '../../shared/reports';
import { scalarFields } from '../../shared/analysis';
import { date, num } from '../api';
const list = (v: any): any[] => (Array.isArray(v) ? v : []);
const counts = (obj: any, labels: Record<string, string>) =>
  Object.entries(labels).flatMap(([key, label]) =>
    numeric(obj?.[key]) === null ? [] : [{ label, text: num(Number(obj[key]), 2) }],
  );
export function AnnualExtras({ data: d, year }: { data: any; year: number }) {
  const interactions = [
    ...counts(d.commentBizPage?.commentPublish, {
      count: '发表评论',
      bePraisedCount: '收到的评论赞',
    }),
    ...counts(d.commentBizPage?.commentSocial, { praiseCommentCount: '给评论点赞' }),
    ...counts(d.playlistBizPage, {
      createCount: '创建歌单',
      bePlayedCount: '歌单被播放',
      beSubscribedCount: '歌单被收藏',
    }),
  ];
  const egg = counts(d.eggStatistics, {
    activeDaysThisYear: '本年度活跃天数',
    loginDays: '累计登录天数',
    dailyRcmdViewDays: '查看每日推荐的天数',
    starSongCount: '红心歌曲计数',
    latePlayDays: '深夜收听天数',
    artistPlayCount: '歌手计数',
    songPlayCount: '歌曲计数',
    genrePlayCount: '曲风计数',
    songShareCount: '分享歌曲计数',
    djPlayHours: '电台收听小时数',
  });
  const voice = counts(d.voicePlayBizPage, {
    activateDays: '声音收听活跃天数',
    voiceListPlayHours: '声音收听小时数',
    repeatPlayCount: '重复收听计数',
  });
  const moreVip = counts(d.vipDjListen, {
    vipSongPlayCnt: '会员歌曲收听次数',
    djPlayDays: '电台收听天数',
    djPlayDuration: '电台时长字段（原值）',
  });
  const amounts = counts(d.yunCunFeeDto, {
    singleSongPurchaseAmt: '单曲金额（原值）',
    purchaseDigitAlbumAmt: '数字专辑金额（原值）',
    purchaseEntityAlbumAmt: '实体专辑金额（原值）',
    liveTotalAmt: '现场演出金额（原值）',
    privilegeTradeAmt: '权益金额（原值）',
  });
  const numericRaw =
    year < 2020
      ? scalarFields(d).filter(
          (f) => !/(^|\.)(uid|ouid|nkn|aul|userId|encUserId)$/.test(f.path) && f.value !== null,
        )
      : [];
  return (
    <>
      {list(d.newDiscoveryDTO?.top5SingerDetails).length > 0 && (
        <Panel title="新发现的代表歌手">
          <NoteGrid
            notes={list(d.newDiscoveryDTO.top5SingerDetails).map((s, i) => ({
              label: `TOP ${i + 1}`,
              text: s.singerName || s.artistName || '—',
            }))}
          />
        </Panel>
      )}
      {list(d.artistEncounter?.top3singer).length > 0 && (
        <Panel title="年度新遇见的歌手">
          <NoteGrid
            notes={list(d.artistEncounter.top3singer).map((s) => ({
              label: s.newArtistName || '—',
              text: `收听 ${num(numeric(s.newArtistPlayCnt))} 次`,
            }))}
          />
        </Panel>
      )}
      {list(d.listenYears?.pies).length > 0 && (
        <DistributionPanel
          title="年度音乐年代分布"
          data={list(d.listenYears.pies).map((x) => ({
            name: `${x.name} 年代`,
            value: Number(x.count),
          }))}
          unit=""
          caption="采用这个年份报告的年代计数，不与其他年份不同口径混加"
        />
      )}
      {list(d.genrePlayRanks).map((g, i) => (
        <DistributionPanel
          key={i}
          title={`年度曲风计数 · 类型 ${g.genreType || i + 1}`}
          data={list(g.genreRank)
            .filter((x) => numeric(x.genrePlayCnt) !== null)
            .map((x) => ({ name: x.genreTagName, value: Number(x.genrePlayCnt) }))}
          unit=""
          caption="该版本返回计数，保留为计数，不擅自当作百分比"
        />
      ))}
      {egg.length > 0 && (
        <Panel title="年度附加统计" caption="逐项沿用官方命名；累计项与本年度项分开标注">
          <NoteGrid notes={egg} />
        </Panel>
      )}
      {interactions.length > 0 && (
        <Panel title="评论与歌单互动">
          <NoteGrid notes={interactions} />
        </Panel>
      )}
      {(voice.length > 0 || moreVip.length > 0) && (
        <Panel title="声音、电台与会员收听">
          <NoteGrid
            notes={[
              ...voice,
              ...moreVip,
              ...(d.voicePlayBizPage?.voiceListName
                ? [{ label: '常听声音列表', text: d.voicePlayBizPage.voiceListName }]
                : []),
            ]}
          />
        </Panel>
      )}
      {d.consumeBizPage && (
        <Panel title="数字音乐消费" caption="金额沿用接口原值，币种和计费单位未另行推测">
          <NoteGrid
            notes={[
              ...counts(d.consumeBizPage, { tradeTotalAmount: '消费金额（原值）' }),
              ...(d.consumeBizPage.tradeMaxResourceName
                ? [{ label: '消费代表资源', text: d.consumeBizPage.tradeMaxResourceName }]
                : []),
            ]}
          />
        </Panel>
      )}
      {amounts.length > 0 && (
        <Panel title="音乐消费金额字段" caption="未确认单位，因此只展示原值，不做金额合计">
          <NoteGrid notes={amounts} />
        </Panel>
      )}
      {d.listenTogetherBizPage && (
        <Panel title="一起听记录">
          <NoteGrid
            notes={[
              ...counts(d.listenTogetherBizPage, {
                listenTogetherDuration: '一起听时长（API 原值）',
              }),
              ...(numeric(d.listenTogetherBizPage.listenTogetherLongestCreateDate)
                ? [
                    {
                      label: '一起听日期字段',
                      text: date(Number(d.listenTogetherBizPage.listenTogetherLongestCreateDate)),
                    },
                  ]
                : []),
            ]}
          />
        </Panel>
      )}
      {(d.specialDay?.songArtistDTO ||
        d.specialMemory?.song ||
        d.forgottenSong?.songArtistDTO ||
        d.forget?.songName) && (
        <Panel title="特别的音乐记忆">
          <NoteGrid
            notes={[
              ...(d.specialDay?.songArtistDTO
                ? [
                    {
                      label: d.specialDay.specialDay || '特别的一天',
                      text: `${d.specialDay.songArtistDTO.songName} · ${d.specialDay.songArtistDTO.artistName || ''}`,
                    },
                  ]
                : []),
              ...(d.specialMemory?.song
                ? [
                    {
                      label: '特别记忆',
                      text: `${d.specialMemory.song.songName} · ${date(d.specialMemory.datetime)}`,
                    },
                  ]
                : []),
              ...(d.forgottenSong?.songArtistDTO
                ? [{ label: '再次想起的歌', text: d.forgottenSong.songArtistDTO.songName }]
                : []),
              ...(d.forget?.songName
                ? [
                    {
                      label: '往年的音乐记忆',
                      text: `${d.forget.songName} · ${d.forget.artist || ''}`,
                    },
                  ]
                : []),
            ]}
          />
        </Panel>
      )}
      {list(d.yuncunFootprintPage?.footprintItems).length > 0 && (
        <Panel title="历年代表歌曲足迹">
          <NoteGrid
            notes={list(d.yuncunFootprintPage.footprintItems).map((x) => ({
              label: `${x.year} 年`,
              text: `${x.song?.songName || '—'} · ${x.song?.artistName || ''}`,
            }))}
          />
        </Panel>
      )}
      {numericRaw.length > 0 && (
        <Panel
          title="早期年度总结的原始明细"
          caption="这个版本使用大量缩写，无法确认的字段不生成含义猜测；上方年度足迹仍可正常比较"
        >
          <details className="series-details">
            <summary>查看 {numericRaw.length} 个未释义字段</summary>
            <div className="table-scroll field-table">
              <table>
                <thead>
                  <tr>
                    <th>接口字段</th>
                    <th>返回值</th>
                  </tr>
                </thead>
                <tbody>
                  {numericRaw.map((f) => (
                    <tr key={f.path}>
                      <td>
                        <code>{f.path}</code>
                      </td>
                      <td>{String(f.value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </Panel>
      )}
    </>
  );
}
