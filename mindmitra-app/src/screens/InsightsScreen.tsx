import React, { useState } from 'react';
import { ScrollView, Text, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { ApiService } from '../services/api';
import { colors } from '../theme/theme';
export const InsightsScreen = () => {
  const [summary, setSummary] = useState<any>(null);
  const [insights, setInsights] = useState<string[]>([]);
  const [error, setError] = useState('');
  useFocusEffect(React.useCallback(() => {
    let active = true;
    Promise.all([ApiService.getDailySummary(), ApiService.getInsights()]).then(([s, i]) => {
      if (active) { setSummary(s); setInsights(i.insights); setError(''); }
    }).catch(() => { if (active) setError('Measurements unavailable. Check your connection.'); });
    return () => { active = false; };
  }, []));
  return <ScrollView style={styles.page} contentContainerStyle={{ padding: 24, paddingTop: 70, paddingBottom: 140 }}>
    <Text style={styles.title}>Your measurements</Text>
    {!!error && <Text style={styles.text}>{error}</Text>}
    <Text style={styles.text}>Games completed today: {summary?.game_count ?? 'Unavailable'}</Text>
    <Text style={styles.text}>Exercises completed today: {summary?.exercise_count ?? 'Unavailable'}</Text>
    <Text style={styles.text}>Sleep: {summary?.sleep_minutes == null ? 'Not recorded' : `${summary.sleep_minutes / 60} hours`}</Text>
    <Text style={styles.text}>Screen time: {summary?.screen_time_ms == null ? 'Not recorded' : `${Math.round(summary.screen_time_ms / 60000)} minutes`}</Text>
    <Text style={styles.text}>Composite score: {summary?.composite_score ?? 'Not enough validated measurements'}</Text>
    {insights.map((text, index) => <Text key={index} style={styles.text}>{text}</Text>)}
    <Text style={styles.note}>These are wellness activity measurements, not a clinical assessment.</Text>
  </ScrollView>;
};
const styles = StyleSheet.create({ page: { flex: 1, backgroundColor: colors.background }, title: { fontSize: 28, fontWeight: '700', color: colors.text }, text: { color: colors.text, fontSize: 17, marginTop: 24 }, note: { color: colors.subText, marginTop: 30 } });
