import React, { useState, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Animated, KeyboardAvoidingView, Platform } from 'react-native';
import { colors } from '../theme/theme';
import { useAuth } from '../contexts/AuthContext';
import { ApiService } from '../services/api';

const QUESTIONS = [
  { id: 'name', title: 'What should Vani call you?', placeholder: 'Your name' },
  { id: 'stress', title: 'How would you describe your stress level lately?', placeholder: 'e.g., quite high, mostly relaxed...' },
  { id: 'sleep', title: 'How many hours of sleep do you usually get?', placeholder: 'e.g., 6 hours' },
  { id: 'goals', title: 'What is your primary wellness goal?', placeholder: 'e.g., reduce anxiety, sleep better' },
  { id: 'triggers', title: 'Are there times you feel most overwhelmed?', placeholder: 'e.g., at work, late at night' },
];

export const OnboardingScreen = () => {
  const { completeOnboarding } = useAuth();
  
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [currentText, setCurrentText] = useState('');
  const [saving, setSaving] = useState(false);
  
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const handleNext = () => {
    if (!currentText.trim()) return;

    const currentKey = QUESTIONS[step].id;
    const newAnswers = { ...answers, [currentKey]: currentText.trim() };
    setAnswers(newAnswers);

    if (step < QUESTIONS.length - 1) {
      // Fade out
      Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
        setStep(step + 1);
        setCurrentText('');
        // Fade in
        Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
      });
    } else {
      finishOnboarding(newAnswers);
    }
  };

  const finishOnboarding = async (finalAnswers: any) => {
    setSaving(true);
    // Send to backend endpoint
    await ApiService.submitUserProfile(finalAnswers);
    // Persist local state
    await completeOnboarding();
  };

  const q = QUESTIONS[step];

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
      
      <View style={styles.progressContainer}>
        {QUESTIONS.map((_, i) => (
          <View key={i} style={[styles.progressDot, i <= step && styles.progressDotActive]} />
        ))}
      </View>

      <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
        <Text style={styles.title}>{q.title}</Text>
        <TextInput
          style={styles.input}
          placeholder={q.placeholder}
          placeholderTextColor={colors.subText + '80'}
          value={currentText}
          onChangeText={setCurrentText}
          autoFocus={true}
          returnKeyType={step === QUESTIONS.length - 1 ? 'done' : 'next'}
          onSubmitEditing={handleNext}
        />
        
        <TouchableOpacity 
          style={[styles.btn, !currentText.trim() && styles.btnDisabled]} 
          onPress={handleNext}
          disabled={!currentText.trim() || saving}
        >
          <Text style={styles.btnText}>
            {saving ? 'Creating Profile...' : (step === QUESTIONS.length - 1 ? 'Get Started' : 'Continue')}
          </Text>
        </TouchableOpacity>
      </Animated.View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: 30, justifyContent: 'center' },
  progressContainer: { flexDirection: 'row', justifyContent: 'center', marginBottom: 60, gap: 8 },
  progressDot: { height: 6, width: 30, borderRadius: 3, backgroundColor: colors.border },
  progressDotActive: { backgroundColor: colors.accent },
  content: { flex: 1, justifyContent: 'center' },
  title: { fontSize: 28, fontWeight: '700', color: colors.text, marginBottom: 40, lineHeight: 38 },
  input: { fontSize: 22, color: colors.primary, borderBottomWidth: 2, borderBottomColor: colors.primary, paddingVertical: 10, marginBottom: 50 },
  btn: { backgroundColor: colors.primary, paddingVertical: 18, borderRadius: 16, alignItems: 'center' },
  btnDisabled: { backgroundColor: colors.border },
  btnText: { color: colors.background, fontWeight: '700', fontSize: 18 }
});
