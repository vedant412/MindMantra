import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
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

    setLoading(true);
    setError('');

    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth!, email, password);
      } else {
        await createUserWithEmailAndPassword(auth!, email, password);
      }
    } catch (err: any) {
      setError(err.message.replace('Firebase: ', ''));
    } finally {
      setLoading(false);
    }
  };

  const handleMockLogin = async () => {
    // Generate a random mock UID
    const randomUid = 'mock_' + Math.random().toString(36).substring(2, 10);
    await mockLogin(randomUid);
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
          style={styles.authButton} 
          onPress={handleAuth} 
          disabled={loading || isMockMode}
        >
          {loading ? (
            <ActivityIndicator color={colors.background} />
          ) : (
            <Text style={styles.authButtonText}>{isLogin ? 'Sign In' : 'Create Account'}</Text>
          )}
        </TouchableOpacity>

        {!isMockMode && (
          <TouchableOpacity onPress={() => setIsLogin(!isLogin)} style={styles.toggleBtn}>
            <Text style={styles.toggleText}>
              {isLogin ? "Don't have an account? Sign Up" : "Already have an account? Sign In"}
            </Text>
          </TouchableOpacity>
        )}

        {isMockMode && (
          <View style={styles.mockContainer}>
            <Text style={styles.mockText}>Firebase API keys not configured.</Text>
            <TouchableOpacity onPress={handleMockLogin} style={styles.mockButton}>
              <Text style={styles.mockButtonText}>Continue in Mock Mode</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: 30, justifyContent: 'center' },
  title: { fontSize: 36, fontWeight: '800', color: colors.primary, marginBottom: 10 },
  subtitle: { fontSize: 16, color: colors.subText, marginBottom: 50, lineHeight: 24 },
  card: { backgroundColor: colors.card, padding: 25, borderRadius: 24, elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 10 },
  input: { borderBottomWidth: 1, borderBottomColor: colors.border, paddingVertical: 15, fontSize: 16, color: colors.text, marginBottom: 20 },
  authButton: { backgroundColor: colors.accent, paddingVertical: 16, borderRadius: 12, alignItems: 'center', marginTop: 10 },
  authButtonText: { color: colors.background, fontWeight: '700', fontSize: 16 },
  toggleBtn: { marginTop: 25, alignItems: 'center' },
  toggleText: { color: colors.subText, fontSize: 14, fontWeight: '500' },
  errorText: { color: '#E57373', marginBottom: 15, fontSize: 14, textAlign: 'center' },
  mockContainer: { marginTop: 30, alignItems: 'center', paddingTop: 20, borderTopWidth: 1, borderTopColor: colors.border },
  mockText: { color: colors.subText, marginBottom: 10, fontStyle: 'italic' },
  mockButton: { backgroundColor: colors.pastel.yellow, paddingVertical: 12, paddingHorizontal: 20, borderRadius: 12 },
  mockButtonText: { color: colors.text, fontWeight: '600' }
});
