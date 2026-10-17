import { auth } from '../config/firebase';

export function authenticatedUid(): string {
  const uid = auth?.currentUser?.uid;
  if (!uid) throw new Error('Sign in before accessing personal data.');
  return uid;
}

export async function bearerToken(): Promise<string> {
  const user = auth?.currentUser;
  if (!user) throw new Error('Sign in to continue.');
  return user.getIdToken();
}
