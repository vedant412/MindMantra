import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, metrics, shadows } from '../theme/theme';

const HARDCODED_INSIGHTS = [
  {
    id: '1',
    title: 'Sleep Regularity',
    description: 'Your sleep schedule has been very consistent this week! Going to bed at similar times improves cognitive recall by up to 20%.',
    icon: 'moon',
    color: colors.pastel.lavender,
    highlight: 'Excellent Pattern'
  },
  {
    id: '2',
    title: 'Digital Wellness',
    description: 'You’ve reduced your late-night screen time by 45 minutes compared to last week. Your brain thanks you for the extra melatonin!',
    icon: 'phone-portrait',
    color: colors.pastel.blue,
    highlight: '-45 mins'
  },
  {
    id: '3',
    title: 'Emotional Health',
    description: 'You\'ve been expressing more positive emotions lately during your chats with Vani. Keep up this great momentum.',
    icon: 'heart',
    color: colors.pastel.pink,
    highlight: 'Trending Up'
  },
  {
    id: '4',
    title: 'Mindfulness Streak',
    description: 'You successfully completed 4 consecutive days of breathing exercises. Consistent mindfulness directly lowers your baseline stress.',
    icon: 'leaf',
    color: colors.pastel.green,
    highlight: '4 Day Streak'
  }
];

export const InsightsScreen = () => {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Cognitive Insights</Text>
        <Text style={styles.subtitle}>Personalized analysis based on your activity</Text>
      </View>
      
      {HARDCODED_INSIGHTS.map((insight) => (
        <View key={insight.id} style={[styles.insightCard, { borderLeftColor: insight.color, borderLeftWidth: 4 }]}>
          <View style={styles.cardHeader}>
            <View style={[styles.iconCircle, { backgroundColor: insight.color }]}>
              <Ionicons name={insight.icon as any} size={20} color={colors.text} />
            </View>
            <View style={styles.badge}>
              <Text style={[styles.badgeText, { color: insight.color === colors.pastel.blue ? colors.primary : colors.text }]}>
                {insight.highlight}
              </Text>
            </View>
          </View>
          <Text style={styles.cardTitle}>{insight.title}</Text>
          <Text style={styles.cardDescription}>{insight.description}</Text>
        </View>
      ))}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: metrics.padding, paddingBottom: 150, paddingTop: 60 },
  header: { marginBottom: 30 },
  headerTitle: { fontSize: 28, fontWeight: '800', color: colors.text, marginBottom: 8 },
  subtitle: { fontSize: 16, color: colors.subText, fontWeight: '500' },
  insightCard: { backgroundColor: '#FFF', padding: 24, borderRadius: metrics.borderRadius, marginBottom: 20, ...shadows.medium },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  iconCircle: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  badge: { backgroundColor: '#F0F0F0', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  badgeText: { fontSize: 12, fontWeight: '700' },
  cardTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 8 },
  cardDescription: { fontSize: 15, color: colors.subText, lineHeight: 22 }
});
