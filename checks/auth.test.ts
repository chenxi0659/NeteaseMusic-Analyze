import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { passwordRequest, passwordLogin } from '../server/auth.js';
import type { Upstream } from '../server/upstream.js';

test('手机号和网易邮箱使用对应接口，密码不进入上游参数，保留密码中的空格', () => {
  const password = ' test-password ';
  const phone = passwordRequest({
    accountType: 'phone',
    account: ' 13800138000 ',
    password,
    countrycode: '+86',
  });
  assert.equal(phone.method, 'login_cellphone');
  assert.equal(phone.params.phone, '13800138000');
  assert.equal(phone.params.countrycode, '86');
  assert.equal(phone.params.md5_password, createHash('md5').update(password).digest('hex'));
  assert.equal('password' in phone.params, false);
  const email = passwordRequest({ accountType: 'email', account: 'test@163.com', password });
  assert.equal(email.method, 'login');
  assert.equal(email.params.email, 'test@163.com');
  assert.throws(
    () => passwordRequest({ accountType: 'phone', account: 'abc', password }),
    /手机号/,
  );
});

test('成功登录先验证新凭证，不提前替换现有账号或持久化密码', async () => {
  const calls: any[] = [];
  const profile = { userId: '123', nickname: '测试', avatarUrl: '' };
  const api = {
    cookie: 'old-cookie',
    call: async (...args: any[]) => {
      calls.push(args);
      return { code: 200, cookie: 'candidate-cookie' };
    },
    profile: async (cookie: string) => {
      assert.equal(cookie, 'candidate-cookie');
      return profile;
    },
  } as unknown as Upstream;
  const result = await passwordLogin(api, {
    accountType: 'phone',
    account: '13800138000',
    password: 'test-password',
  });
  assert.equal(result.cookie, 'candidate-cookie');
  assert.equal(result.profile, profile);
  assert.equal(api.cookie, 'old-cookie');
  assert.equal(calls[0][2], false);
});

test('密码错误或凭证验证失败时保留当前会话，不自动重复登录', async () => {
  let attempts = 0;
  const api = {
    cookie: 'old-cookie',
    call: async () => {
      attempts++;
      throw new Error('502 · 账号或密码错误');
    },
  } as unknown as Upstream;
  const input = { accountType: 'email', account: 'test@163.com', password: 'test-password' };
  await assert.rejects(passwordLogin(api, input), /账号或密码错误/);
  assert.equal(attempts, 1);
  assert.equal(api.cookie, 'old-cookie');
  api.call = async () => ({ code: 200, cookie: 'candidate-cookie' });
  api.profile = async () => {
    throw new Error('需要安全验证');
  };
  await assert.rejects(passwordLogin(api, input), /需要安全验证/);
  assert.equal(api.cookie, 'old-cookie');
});
