import React, { useState } from 'react';
import { Platform, View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { getBearerToken } from '../services/neonSession';
import { API_BASE_URL } from '../config/publicConfig';
import { LoginScreen } from './LoginScreen';
import { colors } from '../theme/theme';

export function isNativeBridge() {
  return Platform.OS === 'web' && new URLSearchParams(window.location.search).has('native_challenge');
}
export function NativeAuthBridge() {
  const { user, loading, signOut } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (Platform.OS !== 'web') return null;
  const params = new URLSearchParams(window.location.search);
  const challenge = params.get('native_challenge') || '';
  const state = params.get('native_state') || '';
  if (!/^[A-Za-z0-9_-]{43}$/.test(challenge) || !/^[a-f0-9]{64}$/.test(state)) return <Text>Invalid mobile sign-in request. Restart sign-in from the app.</Text>;
  if (loading) return <ActivityIndicator />;
  if (!user) return <LoginScreen />;
  const complete = async () => {
    if (busy) return;
    setBusy(true); setError('');
    try {
      const token = await getBearerToken();
      const response = await fetch(`${API_BASE_URL}/auth/native/handoff`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ challenge }), signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) throw new Error('Cannot complete mobile sign-in. Check the server configuration and try again.');
      const { code } = await response.json();
      // Fixed destination; never accept a redirect supplied in the URL.
      window.location.replace(`mindmitra://auth/callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`);
    } catch (e: any) { setError(e.message || 'Mobile sign-in failed.'); }
    finally { setBusy(false); }
  };
  return <View style={{ flex: 1, justifyContent: 'center', padding: 32, backgroundColor: colors.background }}>
    <Text style={{ fontSize: 24, marginBottom: 20 }}>Continue to MindMitra as {user.email}?</Text>
    <Text style={{ marginBottom: 20 }}>Continue only if you started this sign-in from the MindMitra app.</Text>
    {!!error && <Text accessibilityRole="alert" style={{ color: '#b00020', marginBottom: 20 }}>{error}</Text>}
    <TouchableOpacity disabled={busy} onPress={complete} style={{ padding: 20, backgroundColor: colors.accent, borderRadius: 16 }}><Text>{busy ? 'Completing sign-in…' : 'Continue to the app'}</Text></TouchableOpacity>
    <TouchableOpacity disabled={busy} onPress={() => { void signOut().catch(() => setError('Could not sign out. Try again.')); }} style={{ padding: 20 }}><Text>Use another account</Text></TouchableOpacity>
  </View>;
}
