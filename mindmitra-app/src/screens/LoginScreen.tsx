import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { auth, isMockMode } from '../config/firebase';
import { useAuth } from '../contexts/AuthContext';
import { colors } from '../theme/theme';

export const LoginScreen = () => {
  const { mockLogin } = useAuth();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleAuth = async () => {
    if (!email || !password) {
      setError('Please enter both email and password.');
      return;
    }

    if (isMockMode || !auth) {
      // If Firebase isn't configured, use mock login with email as identifier
      const mockUid = 'mock_' + email.replace(/[^a-zA-Z0-9]/g, '_');
      await mockLogin(mockUid);
      return;
    }

    setLoading(true);
    setError('');

    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }
    } catch (err: any) {
      const msg = err.message || 'Authentication failed.';
      setError(msg.replace('Firebase: ', '').replace(/\(auth\/.*\)/, '').trim());
    } finally {
      setLoading(false);
    }
  };

  const handleMockLogin = async () => {
    try {
      setLoading(true);
      const randomUid = 'mock_' + Math.random().toString(36).substring(2, 10);
      await mockLogin(randomUid);
    } catch (e: any) {
      console.warn("Mock Login Error:", e);
      setError(`Login Failed: ${e.message}`);
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>MindMitra.</Text>
      <Text style={styles.subtitle}>Your AI companion for cognitive wellness.</Text>

      <View style={styles.card}>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor={colors.subText}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />

        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor={colors.subText}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <TouchableOpacity 
          style={[styles.authButton, loading && styles.authButtonDisabled]} 
          onPress={handleAuth} 
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={colors.background} />
          ) : (
            <Text style={styles.authButtonText}>{isLogin ? 'Sign In' : 'Create Account'}</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => setIsLogin(!isLogin)} style={styles.toggleBtn}>
          <Text style={styles.toggleText}>
            {isLogin ? "Don't have an account? Sign Up" : "Already have an account? Sign In"}
          </Text>
        </TouchableOpacity>

        {isMockMode && (
          <View style={styles.mockContainer}>
            <Text style={styles.mockText}>Firebase keys not configured. You can still sign in — it will use Mock Mode.</Text>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: 32, justifyContent: 'center' },
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
