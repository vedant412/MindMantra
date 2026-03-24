import React, { useState, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Animated, KeyboardAvoidingView, Platform } from 'react-native';
import { colors } from '../theme/theme';
import { useAuth } from '../contexts/AuthContext';
import { ApiService } from '../services/api';

type QuestionDef = {
  id: string;
  title: string;
  placeholder?: string;
  options?: string[];
};

const QUESTIONS: QuestionDef[] = [
  { id: 'name', title: 'What should Vani call you?', placeholder: 'Your name' },
  { id: 'age', title: 'How old are you?', placeholder: 'e.g., 24' },
  { id: 'gender', title: 'What is your gender?', options: ['Male', 'Female', 'Non-binary', 'Prefer not to say'] },
  { id: 'stress', title: 'How would you describe your stress level lately?', options: ['Very Low', 'Manageable', 'Quite High', 'Overwhelming'] },
  { id: 'sleep', title: 'How many hours of sleep do you usually get?', options: ['Less than 5 hours', '5-6 hours', '7-8 hours', '9+ hours'] },
  { id: 'goals', title: 'What is your primary wellness goal?', options: ['Reduce anxiety', 'Improve sleep', 'Better focus', 'Emotional balance'] },
  { id: 'triggers', title: 'Are there times you feel most overwhelmed?', options: ['During work/study', 'Late at night', 'Social situations', 'Randomly'] },
];

export const OnboardingScreen = () => {
  const { completeOnboarding } = useAuth();
  
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [currentText, setCurrentText] = useState('');
  const [saving, setSaving] = useState(false);
  
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const handleNext = (overrideAnswer?: string) => {
    const finalAnswer = overrideAnswer || currentText;
    if (!finalAnswer.trim()) return;

    const currentKey = QUESTIONS[step].id;
    const newAnswers = { ...answers, [currentKey]: finalAnswer.trim() };
    setAnswers(newAnswers);

    if (step < QUESTIONS.length - 1) {
      Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
        setStep(step + 1);
        setCurrentText('');
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
        
        {q.options ? (
          <View style={styles.optionsContainer}>
            {q.options.map(opt => (
              <TouchableOpacity 
                key={opt}
                style={[styles.optionCard, currentText === opt && styles.optionCardActive]}
                onPress={() => {
                  setCurrentText(opt);
                  // Optional: Auto-advance after 300ms for MCQ
                  setTimeout(() => handleNext(opt), 300);
                }}
              >
                <Text style={[styles.optionText, currentText === opt && styles.optionTextActive]}>{opt}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <TextInput
            style={styles.input}
            placeholder={q.placeholder}
            placeholderTextColor={colors.subText + '80'}
            value={currentText}
            onChangeText={setCurrentText}
            autoFocus={true}
            returnKeyType={step === QUESTIONS.length - 1 ? 'done' : 'next'}
            onSubmitEditing={() => handleNext()}
          />
        )}
        
        {!q.options && (
          <TouchableOpacity 
            style={[styles.btn, !currentText.trim() && styles.btnDisabled]} 
            onPress={() => handleNext()}
            disabled={!currentText.trim() || saving}
          >
            <Text style={styles.btnText}>
              {saving ? 'Creating Profile...' : (step === QUESTIONS.length - 1 ? 'Get Started' : 'Continue')}
            </Text>
          </TouchableOpacity>
        )}
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
  input: { fontSize: 24, color: colors.primary, borderBottomWidth: 2, borderBottomColor: colors.primary, paddingVertical: 10, marginBottom: 50, fontWeight: '500' },
  optionsContainer: { gap: 12 },
  optionCard: { backgroundColor: colors.card, paddingVertical: 20, paddingHorizontal: 24, borderRadius: 16, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center' },
  optionCardActive: { borderColor: colors.primary, backgroundColor: colors.primary + '10' },
  optionText: { fontSize: 18, color: colors.text, fontWeight: '500' },
  optionTextActive: { color: colors.primary, fontWeight: '700' },
  btn: { backgroundColor: colors.primary, paddingVertical: 18, borderRadius: 16, alignItems: 'center', shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 5 },
  btnDisabled: { backgroundColor: colors.border, shadowOpacity: 0, elevation: 0 },
  btnText: { color: colors.background, fontWeight: '700', fontSize: 18, letterSpacing: 0.5 }
});
