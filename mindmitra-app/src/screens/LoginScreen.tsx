import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Platform, ScrollView } from 'react-native';
import { signInEmail, signUpEmail, signInOAuth, continueInBrowser, isAuthConfigured } from '../services/neonSession';
import { OAuthProvider } from '../services/authState';
import { colors } from '../theme/theme';

export const LoginScreen = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const run = async (action: () => Promise<unknown>) => {
    if (loading) return;
    setLoading(true); setError(''); setNotice('');
    try { await action(); } catch (e: any) { setError(e.message || 'Sign-in failed. Please try again.'); }
    finally { setLoading(false); }
  };
  const emailAuth = () => run(async () => {
    if (Platform.OS !== 'web') { await continueInBrowser(); return; }
    if (!email.trim() || !password || (!isLogin && !name.trim())) throw new Error('Complete all fields.');
    if (isLogin) await signInEmail(email.trim(), password);
    else if (!await signUpEmail(name.trim(), email.trim(), password)) setNotice('Check your email to verify your account, then sign in.');
    setPassword('');
  });
  const oauth = (provider: OAuthProvider) => run(() => signInOAuth(provider));
  return <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
    <Text style={styles.title}>MindMitra.</Text>
    <Text style={styles.subtitle}>Your AI companion for cognitive wellness.</Text>
    <View style={styles.card}>
      <Text style={{ color: colors.text, fontSize: 24, fontWeight: '700', marginBottom: 16 }}>{isLogin ? 'Welcome back' : 'Create your account'}</Text>
      {!isAuthConfigured() && <Text style={styles.errorText}>Neon Auth setup is required. Configure the public Neon Auth URL{Platform.OS !== 'web' ? ' and hosted sign-in website' : ''}.</Text>}
      {!!error && <Text accessibilityRole="alert" style={styles.errorText}>{error}</Text>}
      {!!notice && <Text style={styles.mockText}>{notice}</Text>}
      {Platform.OS === 'web' && <>
        {!isLogin && <TextInput style={styles.input} placeholder="Name" value={name} onChangeText={setName} autoComplete="name" />}
        <TextInput style={styles.input} placeholder="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
        <TextInput style={styles.input} placeholder="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete={isLogin ? 'current-password' : 'new-password'} onSubmitEditing={emailAuth} />
      </>}
      <TouchableOpacity style={[styles.authButton, loading && styles.authButtonDisabled]} onPress={emailAuth} disabled={loading || !isAuthConfigured()}>
        {loading ? <ActivityIndicator color={colors.background} /> : <Text style={styles.authButtonText}>{Platform.OS !== 'web' ? 'Continue with email in browser' : isLogin ? 'Sign In' : 'Create Account'}</Text>}
      </TouchableOpacity>
      {(['google', 'github'] as OAuthProvider[]).map(provider => <TouchableOpacity key={provider} style={styles.toggleBtn} disabled={loading || !isAuthConfigured()} onPress={() => oauth(provider)}><Text style={styles.toggleText}>Continue with {provider === 'google' ? 'Google' : 'GitHub'}</Text></TouchableOpacity>)}
      {Platform.OS === 'web' && <TouchableOpacity disabled={loading} onPress={() => { setIsLogin(!isLogin); setError(''); }} style={styles.toggleBtn}><Text style={styles.toggleText}>{isLogin ? 'New here? Create an account' : 'Already have an account? Sign in'}</Text></TouchableOpacity>}
    </View>
  </ScrollView>;
};

const styles = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: colors.background, padding: 32, justifyContent: 'center' },
  title: { fontSize: 40, fontWeight: '800', color: colors.primary, marginBottom: 8, letterSpacing: -0.5 },
  subtitle: { fontSize: 16, color: colors.subText, marginBottom: 40, lineHeight: 24, fontWeight: '400', paddingRight: 20 },
  card: { backgroundColor: colors.card, padding: 28, borderRadius: 28, elevation: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 24 },
  input: { borderBottomWidth: 1.5, borderBottomColor: colors.border, paddingVertical: 16, fontSize: 17, color: colors.text, marginBottom: 24, fontWeight: '500' },
  authButton: { backgroundColor: colors.accent, paddingVertical: 18, borderRadius: 16, alignItems: 'center', marginTop: 12, shadowColor: colors.accent, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 6 },
  authButtonDisabled: { opacity: 0.6 },
  authButtonText: { color: colors.background, fontWeight: '800', fontSize: 17, letterSpacing: 0.5 },
  toggleBtn: { marginTop: 28, alignItems: 'center' },
  toggleText: { color: colors.primary, fontSize: 15, fontWeight: '600' },
  errorText: { color: '#FF3B30', marginBottom: 16, fontSize: 14, textAlign: 'center', fontWeight: '500', backgroundColor: '#FF3B3015', padding: 10, borderRadius: 8 },
  mockContainer: { marginTop: 24, alignItems: 'center', paddingTop: 20, borderTopWidth: 1, borderTopColor: colors.border },
  mockText: { color: colors.subText, fontSize: 13, textAlign: 'center', lineHeight: 20 },
});
