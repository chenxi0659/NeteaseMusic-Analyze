import type { Capture } from '../shared/types';
export type CaptureIndex = Omit<Capture, 'rows' | 'payload'> & { row_count: number };
export interface Observation {
  playedAt: number;
  firstSeen: number;
  track: Capture['rows'][number];
}
export async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const result = await fetch(`/api${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options?.headers },
  });
  const body = await result.json();
  if (!result.ok) throw Object.assign(new Error(body.error || '请求失败'), { code: body.code });
  return body;
}
export const post = <T = any>(path: string, body: unknown = {}) =>
  request<T>(path, { method: 'POST', body: JSON.stringify(body) });
export function download(data: string, name: string, mime = 'text/plain') {
  const url = URL.createObjectURL(new Blob([data], { type: mime }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
export function date(time: number | null | undefined, full = false) {
  if (!time) return '—';
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    ...(full ? ({ hour: '2-digit', minute: '2-digit' } as const) : {}),
  }).format(time);
}
export const num = (n: number | null | undefined, digits = 0) =>
  n == null ? '—' : new Intl.NumberFormat('zh-CN', { maximumFractionDigits: digits }).format(n);
export const duration = (ms: number | null) =>
  ms == null
    ? '—'
    : `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`;
