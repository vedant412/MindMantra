import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, metrics, shadows } from '../../theme/theme';

interface InsightGridProps {
  sleepHours: string;
  sleepScore: number;
  moodState: string;
  moodScore: number;
}

export const InsightGrid = ({ sleepHours, sleepScore, moodState, moodScore }: InsightGridProps) => {
  return (
    <View style={styles.row}>
      <View style={[styles.card, { backgroundColor: colors.card }]}>
        <View style={styles.iconContainer}>
          <Ionicons name="moon" size={24} color={colors.primary} />
        </View>
        <Text style={styles.value}>{sleepHours}</Text>
        <Text style={styles.label}>Sleep</Text>
        <View style={styles.scoreRow}>
          <Text style={styles.scoreText}>Score: {sleepScore}</Text>
        </View>
      </View>

      <View style={[styles.card, { backgroundColor: colors.card }]}>
        <View style={[styles.iconContainer, { backgroundColor: colors.pastel.pink + '40' }]}>
          <Ionicons name="happy" size={24} color={colors.text} />
        </View>
        <Text style={styles.value}>{moodState}</Text>
        <Text style={styles.label}>Mood</Text>
        <View style={styles.scoreRow}>
          <Text style={styles.scoreText}>Score: {moodScore}</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  card: {
    width: '48%',
    borderRadius: metrics.borderRadius,
    padding: 20,
    ...shadows.soft,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  value: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 4,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.subText,
    marginBottom: 12,
  },
  scoreRow: {
    backgroundColor: colors.background,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  scoreText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
  }
});
