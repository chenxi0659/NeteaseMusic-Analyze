import { createHash } from 'node:crypto';
import type { Upstream } from './upstream.js';

export function passwordRequest(input: {
  accountType?: string;
  account?: string;
  password?: string;
  countrycode?: string;
}) {
  const { accountType, password } = input;
  const account = typeof input.account === 'string' ? input.account.trim() : '';
  if (!['phone', 'email'].includes(accountType || '')) throw new Error('请选择手机号或网易邮箱');
  if (!account || typeof password !== 'string' || !password.length)
    throw new Error('请输入账号和密码');

  // The upstream login endpoints expect MD5; plaintext is never passed to the API library.
  const md5_password = createHash('md5').update(password).digest('hex');
  if (accountType === 'email') {
    if (!account.includes('@')) throw new Error('请输入完整的网易邮箱地址');
    return { method: 'login', params: { email: account, md5_password } };
  }
  const countrycode = String(input.countrycode || '86')
    .trim()
    .replace(/^\+/, '');
  if (!/^\d{1,4}$/.test(countrycode) || !/^\d{5,15}$/.test(account))
    throw new Error('请输入有效的国家区号和手机号');
  return { method: 'login_cellphone', params: { phone: account, countrycode, md5_password } };
}

export async function passwordLogin(api: Upstream, input: Parameters<typeof passwordRequest>[0]) {
  const { method, params } = passwordRequest(input);
  const body = await api.call(method, params, false);
  if (typeof body.cookie !== 'string' || !body.cookie)
    throw new Error('登录未返回有效凭证，请重试');
  // Verify the candidate cookie without replacing the currently connected account.
  const profile = await api.profile(body.cookie);
  return { cookie: body.cookie, profile };
}
