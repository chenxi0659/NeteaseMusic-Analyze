export class UpstreamError extends Error {
  constructor(
    public code: number | undefined,
    public detail: string,
  ) {
    super(code === undefined ? detail : `${code} · ${detail}`);
    this.name = 'UpstreamError';
  }
}

export function upstreamError(error: any): UpstreamError {
  if (error instanceof UpstreamError) return error;
  const body = error?.body;
  const rawCode = body?.code ?? body?.data?.code ?? error?.status;
  const code = rawCode == null || !Number.isFinite(Number(rawCode)) ? undefined : Number(rawCode);
  const detail = [
    body?.message,
    body?.data?.blockText,
    body?.msg,
    body?.data?.message,
    error?.message,
  ].find((value) => typeof value === 'string' && value.trim());
  return new UpstreamError(code, detail || '接口请求失败');
}
