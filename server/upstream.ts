import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { upstreamError } from './errors.js';

// Node API calls avoid exposing a second HTTP service or forwarding credentials to the browser.
const require = createRequire(import.meta.url);
const api = require('@neteasecloudmusicapienhanced/api');
export class Upstream {
  cookie = '';
  authPath: string;
  constructor(dataDir: string) {
    this.authPath = join(dataDir, 'session.json');
    if (existsSync(this.authPath))
      this.cookie = JSON.parse(readFileSync(this.authPath, 'utf8')).cookie;
  }
  setCookie(cookie: string) {
    this.cookie = cookie;
    if (cookie) writeFileSync(this.authPath, JSON.stringify({ cookie }), { mode: 0o600 });
    else if (existsSync(this.authPath)) unlinkSync(this.authPath);
  }
  async call(method: string, params: Record<string, any> = {}, authenticated = true) {
    try {
      const result = await api[method]({
        ...params,
        ...(authenticated ? { cookie: this.cookie } : {}),
        timeout: 20000,
        timestamp: Date.now(),
      });
      const body = result.body;
      const code = body?.code ?? body?.data?.code;
      if (typeof code === 'number' && code !== 200 && !(code >= 800 && code <= 803)) {
        throw upstreamError({ body });
      }
      return body;
    } catch (e: any) {
      throw upstreamError(e);
    }
  }
  async profile(cookie = this.cookie) {
    const body = await this.call('login_status', { cookie }, false);
    const data = body.data || body;
    if (!data.profile || !data.account) throw new Error('登录已失效，请重新登录');
    return {
      userId: String(data.profile.userId || data.account.id),
      nickname: data.profile.nickname,
      avatarUrl: data.profile.avatarUrl,
    };
  }
}
