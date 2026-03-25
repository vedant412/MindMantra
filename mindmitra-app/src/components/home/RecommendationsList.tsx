import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, metrics, shadows } from '../../theme/theme';

interface RecommendationListProps {
  insightsText: string;
  recommendations: Array<{ id: string; text: string; icon: any; action?: () => void }>;
}

export const RecommendationsList = ({ insightsText, recommendations }: RecommendationListProps) => {
  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Insights</Text>
      <View style={styles.insightCard}>
        <View style={styles.dot} />
        <Text style={styles.insightText}>{insightsText}</Text>
      </View>

      <Text style={styles.sectionTitle}>Recommendations</Text>
      {recommendations.map(rec => (
        <TouchableOpacity 
          key={rec.id} 
          style={styles.recCard} 
          activeOpacity={0.7}
          onPress={rec.action}
        >
          <View style={styles.recIconContainer}>
            <Ionicons name={rec.icon} size={20} color={colors.accent} />
          </View>
          <Text style={styles.recText}>{rec.text}</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.subText} />
        </TouchableOpacity>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 16,
    marginTop: 10,
  },
  insightCard: {
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 20,
    ...shadows.soft,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
    marginTop: 6,
  },
  insightText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: colors.text,
    lineHeight: 24,
  },
  recCard: {
    backgroundColor: colors.pastel.yellow,
    borderRadius: 20,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  recIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  recText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  }
});
