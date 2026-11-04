import { sources, periodFor, chinaDate } from './catalog.js';
import { rowsOf, observationsOf, trackOf } from './normalize.js';
import type { Settings, Source } from '../shared/types.js';
import { Store } from './store.js';
import { Upstream } from './upstream.js';

export interface RequestSpec {
  sourceId: string;
  params?: Record<string, string | number>;
}
export class Collector {
  running = false;
  timer?: ReturnType<typeof setInterval>;
  constructor(
    public store: Store,
    public upstream: Upstream,
  ) {}
  settings(): Settings {
    return this.store.setting('settings', { intervalMinutes: 30, recentLimit: 300 });
  }
  schedule() {
    clearInterval(this.timer);
    const { intervalMinutes } = this.settings();
    if (intervalMinutes)
      this.timer = setInterval(() => {
        if (this.upstream.cookie && !this.running) {
          const profile = this.store.setting<any>('profile', null);
          if (!profile) return;
          const index = this.store.index(profile.userId);
          const due = sources.filter(
            (s) =>
              s.id !== 'annual' &&
              (s.id === 'recent' ||
                !index.some(
                  (c) =>
                    c.source_id === s.id && !c.error && Date.now() - c.fetched_at < 24 * 3600000,
                )),
          );
          if (due.length) void this.run(due.map((s) => ({ sourceId: s.id }))).catch(console.error);
        }
      }, intervalMinutes * 60_000);
  }
  async run(specs?: RequestSpec[]) {
    if (this.running) throw new Error('已有同步任务正在运行');
    const profile = this.store.setting<any>('profile', null);
    if (!profile || !this.upstream.cookie) throw new Error('请先登录网易云音乐');
    this.running = true;
    const job = this.store.startJob(profile.userId);
    const list: RequestSpec[] =
      specs || sources.filter((s) => s.id !== 'annual').map((s) => ({ sourceId: s.id }));
    let success = 0,
      failed = 0;
    const details = this.store.details(profile.userId);
    try {
      for (const spec of list) {
        const source = sources.find((s) => s.id === spec.sourceId)!;
        const params: Record<string, any> = { ...source.params, ...spec.params };
        if (source.method === 'user_record' || source.method === 'likelist')
          params.uid = profile.userId;
        if (source.id === 'recent') params.limit = this.settings().recentLimit;
        if (source.id === 'report-year' && !params.endTime)
          params.endTime = new Date(
            `${Number(chinaDate().slice(0, 4)) - 1}-12-31T00:00:00+08:00`,
          ).getTime();
        const fetched_at = Date.now();
        const input = {
          source_id: source.id,
          title: source.title,
          period: periodFor(source, params),
          fetched_at,
          params,
        };
        try {
          const payload = await this.upstream.call(source.method, params);
          let rows = source.kind === 'rank' || source.kind === 'recent' ? rowsOf(payload) : [];
          const missing = [...new Set(rows.filter((r) => !details.has(r.id)).map((r) => r.id))];
          for (let offset = 0; offset < missing.length; offset += 200) {
            const ids = missing.slice(offset, offset + 200);
            try {
              const songs = await this.upstream.call('song_detail', { ids: ids.join(',') });
              const tracks = (songs.songs || []).map(trackOf).filter(Boolean);
              for (const track of tracks) details.set(track.id, track);
              this.store.saveDetails(profile.userId, tracks);
            } catch (e: any) {
              failed++;
              // A failed metadata request must not discard an otherwise usable ranking.
              this.store.save(profile.userId, {
                source_id: 'song-detail',
                title: '歌曲元数据补齐',
                period: input.period,
                fetched_at: Date.now(),
                params: { ids: ids.join(',') },
                payload: null,
                rows: [],
                error: e.message,
              });
            }
          }
          rows = rows.map((r) => ({
            ...r,
            ...details.get(r.id),
            rank: r.rank,
            value: r.value,
            score: r.score,
          }));
          this.store.save(profile.userId, { ...input, payload, rows, error: null });
          if (source.kind === 'recent')
            for (const o of observationsOf(payload)) {
              this.store.observe(profile.userId, o.track.id, o.time, fetched_at);
            }
          success++;
        } catch (e: any) {
          failed++;
          this.store.save(profile.userId, { ...input, payload: null, rows: [], error: e.message });
        }
        this.store.updateJob(job, success, failed, source.title);
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
      this.store.updateJob(
        job,
        success,
        failed,
        failed ? '部分接口不可用，已保存其余结果' : '同步完成',
        failed ? 'partial' : 'success',
      );
    } catch (e: any) {
      this.store.updateJob(job, success, failed, e.message, 'failed');
      throw e;
    } finally {
      this.running = false;
    }
  }
}

export function historySpecs(months: number): RequestSpec[] {
  const today = chinaDate();
  const year = Number(today.slice(0, 4)),
    month = Number(today.slice(5, 7));
  const specs: RequestSpec[] = [];
  for (let i = 1; i <= months; i++) {
    // Last day at 00:00 Asia/Shanghai, as required by the upstream documentation.
    const d = new Date(Date.UTC(year, month - i, 0));
    const date = d.toISOString().slice(0, 10);
    const endTime = new Date(`${date}T00:00:00+08:00`).getTime();
    for (const sourceId of ['foot-month', 'report-month'])
      specs.push({ sourceId, params: { endTime } });
  }
  return specs;
}
