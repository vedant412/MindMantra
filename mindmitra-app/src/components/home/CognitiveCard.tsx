import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { colors, metrics, shadows } from '../../theme/theme';

interface CognitiveCardProps {
  score: number;
  status: string;
  vaniScore: number;
  sleepScore: number;
  screenScore: number;
  activityScore: number;
}

const ProgressBar = ({ label, value, color }: { label: string, value: number, color: string }) => {
  const animatedWidth = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(animatedWidth, {
      toValue: value,
      duration: 1000,
      useNativeDriver: false,
    }).start();
  }, [value]);

  return (
    <View style={styles.barContainer}>
      <View style={styles.barLabelRow}>
        <Text style={styles.barLabel}>{label}</Text>
        <Text style={styles.barValue}>{value}/100</Text>
      </View>
      <View style={styles.barTrack}>
        <Animated.View 
          style={[
            styles.barFill, 
            { backgroundColor: color, width: animatedWidth.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }) }
          ]} 
        />
      </View>
    </View>
  );
};

export const CognitiveCard = ({ score, status, vaniScore, sleepScore, screenScore, activityScore }: CognitiveCardProps) => {
  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.title}>Cognitive Score</Text>
          <Text style={styles.status}>{status}</Text>
        </View>
        <Text style={styles.scoreText}>{score} <Text style={styles.scoreMax}>/ 100</Text></Text>
      </View>
      
      <View style={styles.barsWrapper}>
        <ProgressBar label="Vani Interaction" value={vaniScore} color={colors.primary} />
        <ProgressBar label="Sleep" value={sleepScore} color={colors.pastel.pink} />
        <ProgressBar label="Screen Time" value={screenScore} color={colors.pastel.blue} />
        <ProgressBar label="Activities" value={activityScore} color={colors.pastel.tealDark} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: metrics.borderRadius,
    padding: metrics.padding,
    marginBottom: 20,
    ...shadows.soft,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  status: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.subText,
  },
  scoreText: {
    fontSize: 36,
    fontWeight: '800',
    color: '#D4AF37', 
  },
  scoreMax: {
    fontSize: 16,
    color: colors.subText,
    fontWeight: '600'
  },
  barsWrapper: {
    gap: 16,
  },
  barContainer: {
    width: '100%',
  },
  barLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  barLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.subText,
  },
  barValue: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  barTrack: {
    height: 10,
    backgroundColor: colors.border,
    borderRadius: 5,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 5,
  }
});
