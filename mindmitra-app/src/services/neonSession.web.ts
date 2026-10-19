import { createAuthClient } from '@neondatabase/auth';
import { BetterAuthVanillaAdapter } from '@neondatabase/auth/vanilla/adapters';
import { NEON_AUTH_URL, identityKey } from '../config/publicConfig';
import { currentAuthUser, publishAuthUser, OAuthProvider } from './authState';
export { currentAuthUser, subscribeAuth } from './authState';

export const isAuthConfigured = () => NEON_AUTH_URL.startsWith('https://') && !NEON_AUTH_URL.includes('REPLACE');
const client = isAuthConfigured() ? createAuthClient(NEON_AUTH_URL, {
  adapter: BetterAuthVanillaAdapter({ fetchOptions: { credentials: 'include' } }),
}) : null;
let revision = 0;
let ending = false;
function auth() {
  if (!client) throw new Error('Configure EXPO_PUBLIC_NEON_AUTH_URL with your Neon Auth URL.');
  return client;
}
export async function refreshSession() {
  if (ending) return;
  const version = revision;
  if (!client) { publishAuthUser(null); return; }
  const result = await client.getSession();
  if (version !== revision) return;
  if (result.error) throw new Error(result.error.message || 'Cannot check your sign-in session.');
  const user = result.data?.user;
  publishAuthUser(user ? { uid: identityKey(user.id), email: user.email, name: user.name } : null);
}
export async function getBearerToken() {
  const owner = currentAuthUser();
  if (ending || !owner) throw new Error('Sign in to continue.');
  auth();
  const version = revision;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    // @neondatabase/auth 0.6.0-beta treats /token as /get-session in its
    // response cache. A warm session can therefore replace the JWT response
    // with {session,user}. Fetch only this endpoint outside that cache.
    const response = await fetch(`${NEON_AUTH_URL}/token`, {
      method: 'GET', credentials: 'include', cache: 'no-store',
      headers: { Accept: 'application/json' }, signal: controller.signal,
    });
    if (version !== revision || ending || currentAuthUser()?.uid !== owner.uid) throw new Error('Account changed during sign-in verification.');
    if (response.status === 401) {
      publishAuthUser(null);
      throw new Error('Your session expired. Please sign in again.');
    }
    if (!response.ok) throw new Error('Could not verify your sign-in session. Please try again.');
    const data = await response.json();
    if (version !== revision || ending || currentAuthUser()?.uid !== owner.uid) throw new Error('Account changed during sign-in verification.');
    if (typeof data?.token !== 'string' || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(data.token)) throw new Error('The authentication service did not return a valid access token. Please try again.');
    // This is only an account-switch guard. FastAPI still verifies the JWT's
    // signature, issuer, audience, expiry and subject before accessing data.
    let subject;
    try {
      const payload = data.token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      subject = JSON.parse(atob(payload)).sub;
    } catch { throw new Error('The authentication service returned an invalid access token.'); }
    if (typeof subject !== 'string' || identityKey(subject) !== owner.uid) throw new Error('Your signed-in account changed. Please sign in again.');
    return data.token;
  } finally { clearTimeout(timeout); }
}
export async function signInEmail(email: string, password: string) {
  ++revision;
  const result = await auth().signIn.email({ email, password });
  if (result.error) throw new Error(result.error.message || 'Sign-in failed.');
  await refreshSession();
}
export async function signUpEmail(name: string, email: string, password: string) {
  ++revision;
  const result = await auth().signUp.email({ name, email, password });
  if (result.error) throw new Error(result.error.message || 'Account creation failed.');
  await refreshSession();
  return !!currentAuthUser();
}
export async function signInOAuth(provider: OAuthProvider) {
  const result = await auth().signIn.social({ provider, callbackURL: window.location.href });
  if (result.error) throw new Error(result.error.message || 'OAuth sign-in failed.');
}
export async function continueInBrowser() { throw new Error('Use the sign-in form below.'); }
export async function endSession() {
  ending = true;
  ++revision;
  try {
    const result = await auth().signOut();
    if (result.error) throw new Error(result.error.message || 'Sign-out failed.');
    publishAuthUser(null);
  } finally { ending = false; }
}
