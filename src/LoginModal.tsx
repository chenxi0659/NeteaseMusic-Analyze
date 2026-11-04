import { useEffect, useState, type FormEvent } from 'react';
import { Disc3, LockKeyhole, ExternalLink, X } from 'lucide-react';
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
  const [method, setMethod] = useState<'password' | 'qr' | 'session'>('password');
  const [accountType, setAccountType] = useState('phone');
  const [account, setAccount] = useState('');
  const [countrycode, setCountrycode] = useState('86');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [errorCode, setErrorCode] = useState<number>();
  const [cookie, setCookie] = useState('');
  const [busy, setBusy] = useState(false);
  const [qr, setQr] = useState<{ key: string; image: string } | null>(null);
  const [message, setMessage] = useState('点击生成二维码，使用网易云音乐 App 扫码');
  const [expired, setExpired] = useState(false);

  function switchMethod(next: typeof method) {
    setMethod(next);
    setError('');
    setErrorCode(undefined);
    setPassword('');
    setCookie('');
  }

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
          setErrorCode(e.code);
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
      setErrorCode(e.code);
    } finally {
      setBusy(false);
    }
  }

  async function submitPassword(event: FormEvent) {
    event.preventDefault();
    setError('');
    setErrorCode(undefined);
    setBusy(true);
    try {
      await post('/auth/password', { accountType, account, password, countrycode });
      onSuccess();
    } catch (e: any) {
      setError(e.message);
      setErrorCode(e.code);
    } finally {
      setPassword('');
      setBusy(false);
    }
  }

  async function submitSession(event: FormEvent) {
    event.preventDefault();
    setError('');
    setErrorCode(undefined);
    setBusy(true);
    try {
      await post('/auth/session', { cookie });
      onSuccess();
    } catch (e: any) {
      setError(e.message);
      setErrorCode(e.code);
    } finally {
      setCookie('');
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
            onClick={() => switchMethod('password')}
          >
            账号密码
          </button>
          <button
            role="tab"
            aria-selected={method === 'qr'}
            disabled={busy}
            className={method === 'qr' ? 'active' : ''}
            onClick={() => switchMethod('qr')}
          >
            扫码登录
          </button>
          <button
            role="tab"
            aria-selected={method === 'session'}
            disabled={busy}
            className={method === 'session' ? 'active' : ''}
            onClick={() => switchMethod('session')}
          >
            网页登录会话
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
                  setErrorCode(undefined);
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
        ) : method === 'session' ? (
          <form className="login-form session-form" onSubmit={submitSession}>
            <div className="session-instructions">
              <h3>复用你在官网登录的会话</h3>
              <ol>
                <li>在浏览器打开网易云官网，正常登录并完成它要求的安全验证。</li>
                <li>
                  按 F12，打开「应用 / Application」→「存储 / Storage」→「Cookies」，选择
                  music.163.com。
                </li>
                <li>
                  找到 <code>MUSIC_U</code>，复制它的「值 / Value」，粘贴到下方。
                </li>
              </ol>
              <a href="https://music.163.com/" target="_blank" rel="noreferrer">
                打开网易云官网
                <ExternalLink size={13} />
              </a>
            </div>
            <fieldset disabled={busy}>
              <label htmlFor="login-cookie">MUSIC_U 值或包含 MUSIC_U 的 Cookie</label>
              <input
                id="login-cookie"
                type="password"
                autoComplete="off"
                value={cookie}
                onChange={(e) => setCookie(e.target.value)}
                placeholder="只粘贴到本机工具，不要发送到聊天中"
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
                disabled={busy || !cookie.trim()}
              >
                <LockKeyhole size={15} />
                {busy ? '正在验证会话…' : '验证并连接'}
              </button>
            </fieldset>
            <p className="login-hint">
              Cookie
              等同登录凭证，验证成功后保存在本机。这个入口复用已登录会话，不保证消除数据接口自身的风控限制。
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
        {errorCode === -462 && method !== 'session' && (
          <div className="login-risk-help" role="status">
            <p>
              网易云限制了本次请求（-462），可能需要安全验证或稍后重试。可以先在官网登录并完成验证，再复用网页登录会话。
            </p>
            <button className="button secondary" onClick={() => switchMethod('session')}>
              使用网页登录会话
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
