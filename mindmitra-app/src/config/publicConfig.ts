import { Platform } from 'react-native';
const configured = process.env.EXPO_PUBLIC_API_BASE_URL?.trim().replace(/['"]/g, '').replace(/\/$/, '');
export const API_BASE_URL = configured || (__DEV__ ? (Platform.OS === 'android' ? 'http://10.0.2.2:8000' : 'http://localhost:8000') : '');
if (!__DEV__ && !API_BASE_URL.startsWith('https://')) throw new Error('Configure an HTTPS backend URL.');
export const NEON_AUTH_URL = process.env.EXPO_PUBLIC_NEON_AUTH_URL?.trim().replace(/\/$/, '') || '';
export const AUTH_WEB_URL = process.env.EXPO_PUBLIC_AUTH_WEB_URL?.trim() || '';
export function identityKey(subject: string) { return `${new URL(NEON_AUTH_URL).origin}|${subject}`; }
