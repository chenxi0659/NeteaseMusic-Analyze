import type { RankRow } from './types.js';
export type Metric = 'tracks' | 'plays' | 'score';
export function weight(row: RankRow, metric: Metric) {
  return metric === 'tracks' ? 1 : metric === 'plays' ? row.value : row.score;
}
export function aggregate(rows: RankRow[], by: 'artist' | 'album', metric: Metric) {
  const result = new Map<string, { name: string; value: number; tracks: number }>();
  for (const row of rows) {
    const w = weight(row, metric);
    if (w === null) continue;
    const keys =
      by === 'artist'
        ? row.artists.length
          ? row.artists.map((a) => ({ id: a.id, name: a.name }))
          : [{ id: 'unknown', name: '未知歌手' }]
        : [{ id: row.albumId || row.album || 'unknown', name: row.album || '未知专辑' }];
    for (const key of keys) {
      const entry = result.get(key.id) || { name: key.name, value: 0, tracks: 0 };
      entry.value += w / keys.length;
      entry.tracks++;
      result.set(key.id, entry);
    }
  }
  return [...result.values()].sort((a, b) => b.value - a.value);
}
export function rankChanges(current: RankRow[], previous: RankRow[]) {
  const baseline = new Map(previous.map((r) => [r.id, r]));
  return current.map((r) => {
    const old = baseline.get(r.id);
    return {
      ...r,
      change: old ? old.rank - r.rank : null,
      previousValue: old?.value ?? null,
      delta: old?.value != null && r.value != null ? r.value - old.value : null,
    };
  });
}
export function scalarFields(
  value: any,
  prefix = '',
): { path: string; value: string | number | boolean | null }[] {
  if (value === null || typeof value !== 'object') return [{ path: prefix || '$', value }];
  return Object.entries(value).flatMap(([key, child]) =>
    scalarFields(child, prefix ? `${prefix}.${key}` : key),
  );
}
export function chinaParts(time: number) {
  const iso = new Date(time + 8 * 3600_000).toISOString();
  return {
    date: iso.slice(0, 10),
    hour: Number(iso.slice(11, 13)),
    weekday: new Date(time + 8 * 3600_000).getUTCDay(),
  };
}
