import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { Capture, RankRow, SyncJob } from '../shared/types.js';
import { withoutCredentials } from './normalize.js';

export class Store {
  db: DatabaseSync;
  constructor(path: string) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS captures (
        id INTEGER PRIMARY KEY, user_id TEXT NOT NULL, source_id TEXT NOT NULL, title TEXT NOT NULL,
        period TEXT NOT NULL, fetched_at INTEGER NOT NULL, params TEXT NOT NULL,
        payload TEXT NOT NULL, rows_json TEXT NOT NULL, error TEXT
      );
      CREATE INDEX IF NOT EXISTS captures_user_source ON captures(user_id, source_id, fetched_at);
      CREATE TABLE IF NOT EXISTS tracks (user_id TEXT NOT NULL, id TEXT NOT NULL, data TEXT NOT NULL, PRIMARY KEY(user_id,id));
      CREATE TABLE IF NOT EXISTS track_details (user_id TEXT NOT NULL, id TEXT NOT NULL, fetched_at INTEGER NOT NULL, data TEXT NOT NULL, PRIMARY KEY(user_id,id));
      CREATE TABLE IF NOT EXISTS observations (
        user_id TEXT NOT NULL, track_id TEXT NOT NULL, played_at INTEGER NOT NULL,
        first_seen INTEGER NOT NULL, PRIMARY KEY(user_id,track_id,played_at)
      );
      CREATE TABLE IF NOT EXISTS jobs (
        id INTEGER PRIMARY KEY, user_id TEXT NOT NULL, started_at INTEGER NOT NULL, finished_at INTEGER,
        status TEXT NOT NULL, success INTEGER NOT NULL DEFAULT 0, failed INTEGER NOT NULL DEFAULT 0, message TEXT NOT NULL DEFAULT ''
      );
      UPDATE jobs SET status='interrupted', message='服务停止时同步尚未完成' WHERE status='running';
    `);
  }
  setting<T>(key: string, fallback: T): T {
    const row = this.db.prepare('SELECT value FROM settings WHERE key=?').get(key) as any;
    return row ? JSON.parse(row.value) : fallback;
  }
  set(key: string, value: unknown) {
    this.db.prepare('INSERT OR REPLACE INTO settings VALUES (?,?)').run(key, JSON.stringify(value));
  }
  save(userId: string, input: Omit<Capture, 'id'>) {
    const c = {
      ...input,
      params: withoutCredentials(input.params),
      payload: withoutCredentials(input.payload),
    };
    const result = this.db
      .prepare(
        'INSERT INTO captures(user_id,source_id,title,period,fetched_at,params,payload,rows_json,error) VALUES (?,?,?,?,?,?,?,?,?)',
      )
      .run(
        userId,
        c.source_id,
        c.title,
        c.period,
        c.fetched_at,
        JSON.stringify(c.params),
        JSON.stringify(c.payload),
        JSON.stringify(c.rows),
        c.error,
      );
    this.upsertTracks(userId, c.rows);
    return Number(result.lastInsertRowid);
  }
  upsertTracks(userId: string, tracks: RankRow[] | any[]) {
    const stmt = this.db.prepare('INSERT OR REPLACE INTO tracks VALUES (?,?,?)');
    this.db.exec('BEGIN');
    try {
      for (const t of tracks) stmt.run(userId, t.id, JSON.stringify(t));
      this.db.exec('COMMIT');
    } catch (e) {
      this.db.exec('ROLLBACK');
      throw e;
    }
  }
  observe(userId: string, trackId: string, time: number, now: number) {
    this.db
      .prepare('INSERT OR IGNORE INTO observations VALUES (?,?,?,?)')
      .run(userId, trackId, time, now);
  }
  details(userId: string) {
    return new Map(
      this.db
        .prepare('SELECT id,data FROM track_details WHERE user_id=?')
        .all(userId)
        .map((r: any) => [r.id as string, JSON.parse(r.data)]),
    );
  }
  saveDetails(userId: string, tracks: any[]) {
    const statement = this.db.prepare('INSERT OR REPLACE INTO track_details VALUES (?,?,?,?)');
    for (const t of tracks) statement.run(userId, t.id, Date.now(), JSON.stringify(t));
  }
  captures(userId: string, source?: string): Capture[] {
    const query = source
      ? this.db.prepare('SELECT * FROM captures WHERE user_id=? AND source_id=? ORDER BY id DESC')
      : this.db.prepare('SELECT * FROM captures WHERE user_id=? ORDER BY id DESC');
    return (source ? query.all(userId, source) : query.all(userId)).map((r: any) => ({
      id: r.id,
      source_id: r.source_id,
      title: r.title,
      period: r.period,
      fetched_at: r.fetched_at,
      params: JSON.parse(r.params),
      payload: JSON.parse(r.payload),
      rows: JSON.parse(r.rows_json),
      error: r.error,
    }));
  }
  capture(userId: string, id: number): Capture | undefined {
    const r: any = this.db
      .prepare('SELECT * FROM captures WHERE user_id=? AND id=?')
      .get(userId, id);
    return r
      ? {
          id: r.id,
          source_id: r.source_id,
          title: r.title,
          period: r.period,
          fetched_at: r.fetched_at,
          params: JSON.parse(r.params),
          payload: JSON.parse(r.payload),
          rows: JSON.parse(r.rows_json),
          error: r.error,
        }
      : undefined;
  }
  index(userId: string) {
    return this.db
      .prepare(
        `WITH indexed AS (
      SELECT *,ROW_NUMBER() OVER (PARTITION BY source_id,period,error IS NULL ORDER BY id DESC) AS n
      FROM captures WHERE user_id=?
    ) SELECT id,source_id,title,period,fetched_at,params,error,json_array_length(rows_json) AS row_count
      FROM indexed WHERE n=1 OR fetched_at>=? ORDER BY id DESC`,
      )
      .all(userId, Date.now() - 2 * 86400000)
      .map((r: any) => ({ ...r, params: JSON.parse(r.params) }));
  }
  observations(userId: string) {
    return this.db
      .prepare(
        'SELECT o.played_at, o.first_seen, t.data FROM observations o JOIN tracks t ON t.user_id=o.user_id AND t.id=o.track_id WHERE o.user_id=? ORDER BY played_at DESC',
      )
      .all(userId)
      .map((r: any) => ({
        playedAt: r.played_at,
        firstSeen: r.first_seen,
        track: JSON.parse(r.data),
      }));
  }
  jobs(userId: string): SyncJob[] {
    return this.db
      .prepare(
        'SELECT id,started_at,finished_at,status,success,failed,message FROM jobs WHERE user_id=? ORDER BY id DESC LIMIT 30',
      )
      .all(userId) as any;
  }
  startJob(userId: string) {
    return Number(
      this.db
        .prepare("INSERT INTO jobs(user_id,started_at,status) VALUES (?,?,'running')")
        .run(userId, Date.now()).lastInsertRowid,
    );
  }
  updateJob(id: number, success: number, failed: number, message: string, status = 'running') {
    this.db
      .prepare('UPDATE jobs SET success=?,failed=?,message=?,status=?,finished_at=? WHERE id=?')
      .run(success, failed, message, status, status === 'running' ? null : Date.now(), id);
  }
  counts(userId: string) {
    const capture = this.db
      .prepare(
        'SELECT count(*) AS captures,min(fetched_at) AS first,max(fetched_at) AS last FROM captures WHERE user_id=? AND error IS NULL',
      )
      .get(userId) as any;
    return {
      ...capture,
      tracks: (
        this.db.prepare('SELECT count(*) AS n FROM tracks WHERE user_id=?').get(userId) as any
      ).n,
      observations: (
        this.db.prepare('SELECT count(*) AS n FROM observations WHERE user_id=?').get(userId) as any
      ).n,
    };
  }
}
