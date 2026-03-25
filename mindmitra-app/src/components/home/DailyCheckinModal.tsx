import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, metrics, shadows } from '../../theme/theme';

interface DailyCheckinModalProps {
  visible: boolean;
  onSubmit: (sleepHours: number, mood: string) => void;
  onClose: () => void;
}

export const DailyCheckinModal = ({ visible, onSubmit, onClose }: DailyCheckinModalProps) => {
  const [sleepHours, setSleepHours] = useState('7');
  const [mood, setMood] = useState('Good');

  const handleSubmit = () => {
    const hours = parseFloat(sleepHours) || 0;
    onSubmit(hours, mood);
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.title}>Daily Check-in</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={colors.subText} />
            </TouchableOpacity>
          </View>
          
          <Text style={styles.subtitle}>Complete your daily check-in to boost your Activity Score!</Text>
          
          <Text style={styles.label}>Hours of Sleep</Text>
          <View style={styles.inputContainer}>
            <Ionicons name="moon-outline" size={20} color={colors.subText} style={styles.icon} />
            <TextInput 
              style={styles.input}
              keyboardType="numeric"
              value={sleepHours}
              onChangeText={setSleepHours}
              placeholder="e.g. 7.5"
            />
          </View>

          <Text style={styles.label}>How are you feeling?</Text>
          <View style={styles.moodRow}>
            {['Great', 'Good', 'Okay', 'Stressed'].map(m => (
              <TouchableOpacity 
                key={m} 
                style={[styles.moodBtn, mood === m && styles.moodBtnActive]}
                onPress={() => setMood(m)}
              >
                <Text style={[styles.moodText, mood === m && styles.moodTextActive]}>{m}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit}>
            <Text style={styles.submitText}>Submit Check-in</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: metrics.padding,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 24,
    padding: 24,
    width: '100%',
    ...shadows.medium,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
  },
  subtitle: {
    fontSize: 14,
    color: colors.subText,
    marginBottom: 24,
    lineHeight: 20,
  },
  label: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: 12,
    paddingHorizontal: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  icon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    height: 48,
    fontSize: 16,
    color: colors.text,
    fontWeight: '500',
  },
  moodRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 30,
  },
  moodBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  moodBtnActive: {
    backgroundColor: colors.pastel.lavender,
    borderColor: colors.primary,
  },
  moodText: {
    fontSize: 14,
    color: colors.subText,
    fontWeight: '600',
  },
  moodTextActive: {
    color: colors.primary,
    fontWeight: '700',
  },
  submitBtn: {
    backgroundColor: colors.primary,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  submitText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  }
});
