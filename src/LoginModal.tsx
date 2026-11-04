import { useEffect, useState, type FormEvent } from 'react';
import { Disc3, LockKeyhole, X } from 'lucide-react';
import type { AppState } from '../shared/types';
import { post } from './api';
import './login.css';

export function LoginModal({
  onClose,
  onSuccess,
  notify,
  profile,
}: {
  onClose: () => void;
  onSuccess: () => void;
  notify: (message: string) => void;
  profile: AppState['profile'] | undefined;
}) {
  const [method, setMethod] = useState<'password' | 'qr'>('password');
  const [accountType, setAccountType] = useState('phone');
  const [account, setAccount] = useState('');
  const [countrycode, setCountrycode] = useState('86');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [qr, setQr] = useState<{ key: string; image: string } | null>(null);
  const [message, setMessage] = useState('点击生成二维码，使用网易云音乐 App 扫码');
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    if (method !== 'qr' || !qr || expired) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const result = await post('/auth/check', { key: qr.key });
        if (stopped) return;
        if (result.code === 803) {
          onSuccess();
          return;
        }
        if (result.code === 800) {
          setExpired(true);
          setMessage('二维码已过期，请重新生成');
          return;
        }
        setMessage(
          result.code === 802 ? '已扫码，请在手机上确认登录' : '等待扫码，请使用网易云音乐 App',
        );
      } catch (e: any) {
        if (!stopped) {
          setMessage(e.message);
          setExpired(true);
          return;
        }
      }
      if (!stopped) timer = setTimeout(poll, 4000);
    };
    timer = setTimeout(poll, 4000);
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [method, qr, expired]);

  async function createQr() {
    setBusy(true);
    try {
      setQr(await post('/auth/qr'));
      setExpired(false);
      setMessage('等待扫码，请使用网易云音乐 App');
    } catch (e: any) {
      setMessage(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function submitPassword(event: FormEvent) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      await post('/auth/password', { accountType, account, password, countrycode });
      onSuccess();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setPassword('');
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={busy ? undefined : onClose}>
      <section
        className="modal login-modal"
        role="dialog"
        aria-modal="true"
        aria-label="账号连接"
        onClick={(e) => e.stopPropagation()}
      >
        <button className="modal-close" aria-label="关闭" disabled={busy} onClick={onClose}>
          <X size={20} />
        </button>
        <div className="eyebrow">CONNECT YOUR MUSIC</div>
        <h2>{profile ? `你好，${profile.nickname}` : '连接你的网易云'}</h2>
        <p>仅保存登录后的会话凭证，不保存账号密码。</p>
        {profile && (
          <div className="button-row">
            <button
              className="button secondary"
              disabled={busy}
              onClick={async () => {
                try {
                  await post('/auth/verify');
                  notify('登录状态有效');
                } catch (e: any) {
                  notify(e.message);
                }
              }}
            >
              验证登录状态
            </button>
            <button
              className="button secondary"
              disabled={busy}
              onClick={async () => {
                try {
                  await post('/auth/logout');
                  onSuccess();
                } catch (e: any) {
                  notify(e.message);
                }
              }}
            >
              退出登录
            </button>
          </div>
        )}
        <div className="login-tabs" role="tablist" aria-label="登录方式">
          <button
            role="tab"
            aria-selected={method === 'password'}
            disabled={busy}
            className={method === 'password' ? 'active' : ''}
            onClick={() => setMethod('password')}
          >
            账号密码
          </button>
          <button
            role="tab"
            aria-selected={method === 'qr'}
            disabled={busy}
            className={method === 'qr' ? 'active' : ''}
            onClick={() => setMethod('qr')}
          >
            扫码登录
          </button>
        </div>
        {method === 'password' ? (
          <form className="login-form" onSubmit={submitPassword}>
            <fieldset disabled={busy}>
              <label htmlFor="account-type">账号类型</label>
              <select
                id="account-type"
                value={accountType}
                onChange={(e) => {
                  setAccountType(e.target.value);
                  setAccount('');
                  setError('');
                }}
              >
                <option value="phone">手机号</option>
                <option value="email">网易邮箱</option>
              </select>
              <label htmlFor="login-account">
                {accountType === 'phone' ? '手机号' : '网易邮箱'}
              </label>
              <div className="login-account-row">
                {accountType === 'phone' && (
                  <input
                    aria-label="国家区号"
                    className="country-code"
                    inputMode="numeric"
                    value={countrycode}
                    onChange={(e) => setCountrycode(e.target.value)}
                    placeholder="86"
                    required
                  />
                )}
                <input
                  id="login-account"
                  type={accountType === 'phone' ? 'tel' : 'email'}
                  autoComplete="username"
                  value={account}
                  onChange={(e) => setAccount(e.target.value)}
                  placeholder={
                    accountType === 'phone' ? '输入网易云绑定的手机号' : '例如 name@163.com'
                  }
                  required
                />
              </div>
              <label htmlFor="login-password">密码</label>
              <input
                id="login-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="输入网易云音乐密码"
                required
              />
              {error && (
                <div className="login-error" role="alert">
                  {error}
                </div>
              )}
              <button
                className="button primary login-submit"
                type="submit"
                disabled={busy || !account.trim() || !password}
              >
                <LockKeyhole size={15} />
                {busy ? '正在登录…' : '登录网易云'}
              </button>
            </fieldset>
            <p className="login-hint">
              密码登录仍可能触发网易云安全验证。若提示风险或验证码，请先在官方客户端完成验证后再重试。
            </p>
          </form>
        ) : (
          <>
            <div className="qr-box">
              {qr && !expired ? (
                <img src={qr.image} alt="网易云音乐登录二维码" />
              ) : (
                <Disc3 size={55} strokeWidth={1} />
              )}
            </div>
            <p className="qr-message">{message}</p>
            <button className="button primary" disabled={busy} onClick={createQr}>
              {busy ? '生成中…' : qr ? '重新生成二维码' : '生成登录二维码'}
            </button>
          </>
        )}
      </section>
    </div>
  );
}
