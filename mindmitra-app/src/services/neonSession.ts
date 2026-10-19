// Native uses the hosted Neon sign-in page. No password, JWT, or provider secret
// travels in a deep link. The return code is single-use and bound to PKCE.
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import * as WebBrowser from 'expo-web-browser';
import { API_BASE_URL, AUTH_WEB_URL, NEON_AUTH_URL, identityKey } from '../config/publicConfig';
import { AppUser, OAuthProvider, publishAuthUser } from './authState';
export { currentAuthUser, subscribeAuth } from './authState';
const storageKey = 'mindmitra.neon.session.v1';
type Session = { token: string; user: AppUser; expires_at: number; issuer: string };
let session: Session | null = null;
let revision = 0;
export const isAuthConfigured = () => NEON_AUTH_URL.startsWith('https://') && !!AUTH_WEB_URL && !NEON_AUTH_URL.includes('REPLACE');
const random = async () => Array.from(await Crypto.getRandomBytesAsync(32), b => b.toString(16).padStart(2, '0')).join('');
export async function endSession() {
  ++revision;
  session = null;
  publishAuthUser(null);
  await SecureStore.deleteItemAsync(storageKey);
}
export async function refreshSession() {
  const version = revision;
  const stored = await SecureStore.getItemAsync(storageKey);
  if (version !== revision) return;
  if (!stored) { publishAuthUser(null); return; }
  try {
    const candidate: Session = JSON.parse(stored);
    if (!candidate.token || !candidate.user?.uid || candidate.issuer !== NEON_AUTH_URL || candidate.expires_at * 1000 <= Date.now() + 15000) {
      await endSession(); return;
    }
    session = candidate;
    publishAuthUser(candidate.user);
  } catch { await endSession(); }
}
export async function getBearerToken() {
  if (!session || session.expires_at * 1000 <= Date.now() + 15000) {
    await endSession(); throw new Error('Your session expired. Please sign in again.');
  }
  return session.token;
}
let signingIn = false;
export async function continueInBrowser(provider?: OAuthProvider) {
  if (signingIn) return;
  if (!isAuthConfigured()) throw new Error('Configure the Neon Auth URL and the hosted sign-in website.');
  const url = new URL(AUTH_WEB_URL);
  if (url.protocol !== 'https:' && !(__DEV__ && ['localhost', '127.0.0.1'].includes(url.hostname))) throw new Error('Sign-in requires an HTTPS website.');
  signingIn = true;
  const version = ++revision;
  try {
    const verifier = await random();
    const state = await random();
    const digest = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, verifier, { encoding: Crypto.CryptoEncoding.BASE64 });
    url.search = '';
    url.searchParams.set('native_challenge', digest.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''));
    url.searchParams.set('native_state', state);
    if (provider) url.searchParams.set('provider', provider);
    const result = await WebBrowser.openAuthSessionAsync(url.toString(), 'mindmitra://auth/callback');
    if (result.type !== 'success') throw new Error('Sign-in was cancelled.');
    const callback = new URL(result.url);
    if (callback.protocol !== 'mindmitra:' || callback.hostname !== 'auth' || callback.pathname !== '/callback' || callback.searchParams.get('state') !== state) throw new Error('Invalid sign-in callback.');
    const code = callback.searchParams.get('code');
    if (!code) throw new Error('The sign-in code is missing.');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    let data;
    try {
      const response = await fetch(`${API_BASE_URL}/auth/native/exchange`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code, verifier }), signal: controller.signal });
      if (!response.ok) throw new Error('Sign-in expired or could not be verified. Please try again.');
      data = await response.json();
    } finally { clearTimeout(timeout); }
    if (version !== revision) throw new Error('Sign-in was cancelled.');
    const user = { ...data.user, uid: identityKey(data.user.uid) };
    session = { token: data.token, user, expires_at: data.expires_at, issuer: NEON_AUTH_URL };
    await SecureStore.setItemAsync(storageKey, JSON.stringify(session));
    publishAuthUser(user);
  } finally { signingIn = false; }
}
export const signInOAuth = (provider: OAuthProvider) => continueInBrowser(provider);
export async function signInEmail(_email: string, _password: string) { await continueInBrowser(); }
export async function signUpEmail(_name: string, _email: string, _password: string) { await continueInBrowser(); return true; }
