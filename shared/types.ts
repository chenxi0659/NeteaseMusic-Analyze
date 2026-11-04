export type Json = any;
export interface Track {
  id: string;
  name: string;
  artists: { id: string; name: string }[];
  album: string;
  albumId: string;
  cover: string;
  duration: number | null;
  publishTime: number | null;
  popularity: number | null;
}
export interface RankRow extends Track {
  rank: number;
  value: number | null;
  score: number | null;
}
export interface Source {
  id: string;
  title: string;
  method: string;
  path: string;
  kind: 'rank' | 'recent' | 'report' | 'likes';
  params?: Record<string, string | number>;
  description: string;
}
export interface Capture {
  id: number;
  source_id: string;
  title: string;
  period: string;
  fetched_at: number;
  params: Json;
  payload: Json;
  rows: RankRow[];
  error: string | null;
}
export interface SyncJob {
  id: number;
  started_at: number;
  finished_at: number | null;
  status: string;
  success: number;
  failed: number;
  message: string;
}
export interface Settings {
  intervalMinutes: number;
  recentLimit: number;
}
export interface AppState {
  profile: { userId: string; nickname: string; avatarUrl: string } | null;
  settings: Settings;
  syncing: boolean;
  sources: Source[];
  jobs: SyncJob[];
  sourceStatus: {
    source_id: string;
    title: string;
    fetched_at: number;
    error: string | null;
    row_count: number;
  }[];
  counts: {
    captures: number;
    tracks: number;
    observations: number;
    first: number | null;
    last: number | null;
  };
}
