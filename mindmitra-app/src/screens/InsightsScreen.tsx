import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, metrics, shadows } from '../theme/theme';
import { MockApi } from '../services/mockApi';

export const InsightsScreen = () => {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    MockApi.getInsights().then(setData);
  }, []);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mental Health</Text>
        <View style={{ width: 48 }} />
      </View>
      
      <View style={styles.graphCard}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Sleep Duration</Text>
          <View style={styles.iconCircle}>
            <Ionicons name="moon" size={16} color={colors.primary} />
          </View>
        </View>
        <View style={styles.placeholderGraph}>
          {/* Mock Step Bar Graph */}
          {[6,7,5,8,7,9,6].map((h, i) => (
            <View key={i} style={[styles.stepBar, { height: h * 8, backgroundColor: i % 2 === 0 ? colors.pastel.lavender : colors.pastel.green }]} />
          ))}
        </View>
        <Text style={styles.largeData}>7h 32m</Text>
      </View>

      <View style={[styles.graphCard, { backgroundColor: colors.pastel.pink }]} >
        <View style={styles.cardHeader}>
          <View style={styles.quizHeaderTitle}>
            <Ionicons name="help-circle" size={22} color={colors.text} />
            <Text style={styles.subText}>Yes or No Quiz</Text>
          </View>
          <Text style={styles.pageIndicator}>Question 1 of 10</Text>
        </View>
        
        <Text style={styles.quizTitle}>What helps you sleep better?</Text>
        
        <TouchableOpacity style={styles.inputMock} activeOpacity={0.9}>
          <Text style={styles.inputText}>Write an answer</Text>
          <View style={styles.micBtn}>
            <Ionicons name="mic" size={16} color="#FFF" />
          </View>
        </TouchableOpacity>
        
        <View style={styles.pillRow}>
          {['Activity', 'Tea', 'Meditation', 'Pray'].map(pill => (
            <View key={pill} style={styles.pill}><Text style={styles.pillText}>{pill}</Text></View>
          ))}
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: metrics.padding, paddingBottom: 150, paddingTop: 60 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 40 },
  backBtn: { width: 48, height: 48, backgroundColor: '#FFF', borderRadius: 24, justifyContent: 'center', alignItems: 'center', ...shadows.soft },
  headerTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  graphCard: { backgroundColor: '#FFF', padding: 28, borderRadius: metrics.borderRadius, marginBottom: 20, ...shadows.medium },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 },
  cardTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  quizHeaderTitle: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  iconCircle: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.pastel.blue, justifyContent: 'center', alignItems: 'center' },
  placeholderGraph: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: 80, marginBottom: 20 },
  stepBar: { width: 30, borderTopLeftRadius: 6, borderTopRightRadius: 6 },
  largeData: { fontSize: 36, fontWeight: '700', color: colors.text },
  subText: { fontSize: 14, fontWeight: '600', color: colors.text },
  pageIndicator: { fontSize: 13, color: colors.subText, fontWeight: '500' },
  quizTitle: { fontSize: 24, fontWeight: '700', color: colors.text, marginBottom: 24, lineHeight: 32 },
  inputMock: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.6)', paddingHorizontal: 24, paddingVertical: 14, borderRadius: 36, marginBottom: 24 },
  inputText: { fontSize: 16, color: '#555', fontWeight: '500' },
  micBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.text, justifyContent: 'center', alignItems: 'center' },
  pillRow: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  pill: { backgroundColor: 'rgba(255,255,255,0.3)', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 24 },
  pillText: { fontSize: 14, fontWeight: '600', color: colors.text }
});
