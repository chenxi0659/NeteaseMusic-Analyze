import type { RankRow, Track } from '../shared/types.js';

export function trackOf(raw: any): Track | null {
  if (!raw || !raw.id || !(raw.name || raw.songName)) return null;
  return {
    id: String(raw.id),
    name: raw.name || raw.songName,
    artists: (raw.ar || raw.artists || raw.artistList || []).map((a: any) => ({
      id: String(a.id ?? a.name),
      name: a.name,
    })),
    album: raw.al?.name || raw.album?.name || '',
    albumId: String(raw.al?.id || raw.album?.id || ''),
    cover: raw.al?.picUrl || raw.album?.picUrl || '',
    duration: finite(raw.dt ?? raw.duration),
    publishTime: finite(raw.publishTime),
    popularity: finite(raw.pop ?? raw.popularity),
  };
}
function finite(value: any): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

// The API uses both song wrappers (user_record) and data wrappers (recent records).
export function rowsOf(payload: any): RankRow[] {
  const root = payload?.weekData ?? payload?.allData ?? payload?.data ?? payload;
  let list: any[] = [];
  if (Array.isArray(root)) list = root;
  else if (root && typeof root === 'object') {
    list =
      root.list ??
      root.songPlayRank ??
      root.songPlayRankList ??
      root.songList ??
      root.songs ??
      root.records ??
      [];
    if (!Array.isArray(list)) list = [];
    if (!list.length) {
      // Find the first song-bearing array; unrecognised reports stay available as raw data.
      const find = (obj: any, depth: number): any[] => {
        if (!obj || typeof obj !== 'object' || depth > 4) return [];
        if (Array.isArray(obj)) {
          if (obj.some((x) => trackOf(x?.song || x?.songInfo || x?.data || x))) return obj;
          for (const x of obj) {
            const found = find(x, depth + 1);
            if (found.length) return found;
          }
        } else
          for (const x of Object.values(obj)) {
            const found = find(x, depth + 1);
            if (found.length) return found;
          }
        return [];
      };
      list = find(root, 0);
    }
  }
  return list.flatMap((entry, index) => {
    const track = trackOf(entry.song || entry.songInfo || entry.data || entry);
    return track
      ? [
          {
            ...track,
            rank: index + 1,
            value: finite(entry.playCount ?? entry.playNum),
            score: finite(entry.score),
          },
        ]
      : [];
  });
}

export function observationsOf(payload: any) {
  const list = payload?.data?.list;
  if (!Array.isArray(list)) return [];
  return list.flatMap((item: any) => {
    const track = trackOf(item.data);
    const time = finite(item.playTime);
    return track && time && time > 946684800000 ? [{ track, time }] : [];
  });
}

// Only remove credential fields; the account's report content must remain available for re-analysis.
export function withoutCredentials(value: any): any {
  if (Array.isArray(value)) return value.map(withoutCredentials);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value)
        .filter(
          ([k]) =>
            !/^(cookie|cookies|token|accessToken|refreshToken|authorization|MUSIC_U|__csrf)$/i.test(
              k,
            ),
        )
        .map(([k, v]) => [k, withoutCredentials(v)]),
    );
  return value;
}
