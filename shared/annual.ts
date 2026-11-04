// The yearly campaigns changed schemas and units. Keep each version's raw payload intact.
const items = (x: any): any[] => (Array.isArray(x) ? x : []);
const epoch = (v: any) => (typeof v === 'number' && v > 0 && v < 100000000000 ? v * 1000 : v);
export function adaptAnnual(raw: any, year: number): any {
  const d = { ...raw };
  if (year === 2023) {
    d.meetTimeOverview = {
      playTime:
        typeof raw.dopamineColor?.playDuration === 'number'
          ? raw.dopamineColor.playDuration / 1000
          : raw.yearOverview?.playTime != null
            ? raw.yearOverview.playTime * 60
            : null,
      playCount: raw.yearOverview?.playCount,
    };
    d.minorMassDTO = raw.minoritySong;
    if (raw.vipBizPage)
      d.yunCunFeeDto = {
        listenVipSongsCount: raw.vipBizPage.vipPlaySongNum,
        experienceVipDays: raw.vipBizPage.freeVipDayNum,
        highSoundQualityPlayTime: raw.vipBizPage.hqPlayDuration,
      };
  }
  if (year === 2022) {
    d.meetTimeOverview = {
      playTime: raw.yearOverview?.playTime,
      playCount: raw.yearOverview?.playCount,
    };
    d.latePlayDTO = raw.specialDay?.latePlay;
    const loop = raw.specialDay?.maxLoopSong;
    if (loop) d.loopSongDTO = { ...loop, playDate: loop.playdate };
    d.minorMassDTO = raw.minoritySong
      ? { ...raw.minoritySong, minoritySongPlayCount: raw.minoritySong.minoritySongPlayNum }
      : null;
  }
  if (year === 2021) {
    d.meetTimeOverview = {
      playTime: raw.songPlaySummary?.playDurations,
      playCount: raw.songPlaySummary?.playNum,
    };
    d.newDiscoveryDTO = {
      totalArtistCount: raw.genreTransition?.tolSingerUnt,
      newArtistCount: raw.genreTransition?.newSingerUnt,
      totalGenreCount: raw.genreEncounter?.genreNum,
      newGenreCount: raw.genreEncounter?.newGenreNum,
    };
    d.genrePlayRank = {
      musicAge: raw.favouriteGenre?.musicAge,
      genreRank: items(raw.favouriteGenre?.top5genre).map((x) => ({
        genreTagName: x.top5GenreName,
        percent: x.top5GenrePlayRateInt,
      })),
    };
    d.latePlayDTO = raw.latestPlay
      ? { ...raw.latestPlay, datetime: epoch(raw.latestPlay.datetime) }
      : null;
    d.loopSongDTO = raw.singlePlay
      ? {
          ...raw.singlePlay,
          playDate: epoch(raw.singlePlay.playDate),
          playCount: raw.singlePlay.playNum,
        }
      : null;
    d.annualSong = raw.songOf2021y
      ? {
          ...raw.songOf2021y,
          artistNameList: items(raw.songOf2021y.artistnamelist).join(' / '),
          firstDate: epoch(raw.songOf2021y.firstDate),
        }
      : null;
    d.annualPlaylist = {
      items: items(raw.songOf2021y?.playlist).map((x) => ({ ...x, playCount: x.playNum })),
    };
    d.annualSinger = raw.singerOf2021y?.top1Singer
      ? {
          ...raw.singerOf2021y.top1Singer,
          playCount: raw.singerOf2021y.top1Singer.playCnt,
          top5Songs: items(raw.singerOf2021y.songList).map((x) => ({
            ...x,
            name: x.songName,
            playCount: x.playNum,
          })),
        }
      : null;
    d.yunCunContributeDto = {
      commentCreateCount: raw.ugc?.commentNum,
      commentLikeCount: raw.ugc?.commentZanNum,
      playlistCreateCount: raw.ugc?.playlistCreateNum,
      playlistPlayCount: raw.ugc?.playlistPlayNum,
      playlistCollectCount: raw.ugc?.playCollectNum,
    };
    if (raw.vipDjListen) d.yunCunFeeDto = { listenVipSongsCount: raw.vipDjListen.vipSongPlayNum };
  }
  if (year === 2020) {
    d.meetTimeOverview = { playTime: raw.overview?.time, playCount: raw.overview?.songNum };
    d.seasonsListen = Object.fromEntries(
      items(raw.style).map((s) => [s.season, { songName: s.songName, artistName: s.artist }]),
    );
    d.loopSongDTO = raw.single
      ? {
          songName: raw.single.songName,
          singerName: raw.single.artist,
          playDate: epoch(raw.single.date),
          playCount: raw.single.times,
        }
      : null;
    d.latePlayDTO = raw.latest
      ? { songName: raw.latest.songName, datetime: epoch(raw.latest.date) }
      : null;
    d.annualSinger = raw.singer
      ? {
          singerName: raw.singer.artist,
          playCount: raw.singer.playNum,
          top5Songs: items(raw.singer.songList).map((s) => ({
            name: s.songName,
            playCount: s.playNum,
          })),
        }
      : null;
    d.annualPlaylist = { items: items(raw.playList).map((s) => ({ ...s, artistName: s.artist })) };
    d.annualSingerComparePage = {
      singers: items(raw.comparison?.artists).map((s) => ({ year: s.year, singerName: s.artist })),
    };
    d.minorMassDTO = raw.minority
      ? {
          minoritySongName: raw.minority.songName,
          minoritySingerName: raw.minority.artist,
          minoritySongPlayCount: raw.minority.playNum,
        }
      : null;
    d.yunCunContributeDto = {
      commentCreateCount: raw.ugc?.comment?.allNum,
      commentLikeCount: raw.ugc?.comment?.likeNum,
      playlistCreateCount: raw.ugc?.songList?.allNum,
      playlistPlayCount: raw.ugc?.songList?.playNum,
      playlistCollectCount: raw.ugc?.songList?.collectNum,
    };
  }
  if (d.keyWord?.keyword) d.keyWord = { single: d.keyWord };
  if (d.annualSong)
    d.annualSong = {
      ...d.annualSong,
      artistNameList: d.annualSong.artistNameList || d.annualSong.artistnamelist,
    };
  return d;
}
