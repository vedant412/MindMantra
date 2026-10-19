export type AppUser = { uid: string; email: string; name?: string };
export type OAuthProvider = 'google' | 'github';
let user: AppUser | null = null;
const listeners = new Set<(user: AppUser | null) => void>();
export const currentAuthUser = () => user;
export function publishAuthUser(next: AppUser | null) {
  if (JSON.stringify(next) === JSON.stringify(user)) return;
  user = next;
  listeners.forEach(listener => listener(next));
}
export function subscribeAuth(listener: (user: AppUser | null) => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
