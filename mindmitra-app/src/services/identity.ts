import { currentAuthUser, getBearerToken } from './neonSession';

export function authenticatedUid(): string {
  const uid = currentAuthUser()?.uid;
  if (!uid) throw new Error('Sign in before accessing personal data.');
  return uid;
}

export async function bearerToken(): Promise<string> {
  return getBearerToken();
}
