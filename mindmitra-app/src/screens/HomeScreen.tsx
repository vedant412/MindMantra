import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, metrics, shadows } from '../theme/theme';
import { ApiService } from '../services/api';

export const HomeScreen = ({ navigation }: any) => {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    ApiService.getDailySummary().then(setData);
  }, []);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 18) return 'Good Afternoon';
    return 'Good Evening';
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <View style={styles.headerTextContainer}>
          <Text style={styles.greeting}>{getGreeting()},</Text>
          <Text style={styles.name}>Vedant 👋</Text>
        </View>
        <TouchableOpacity style={styles.iconBtn} activeOpacity={0.7}>
          <Ionicons name="notifications-outline" size={24} color={colors.text} />
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={[styles.card, styles.adviceCard]} activeOpacity={0.9}>
        <Text style={styles.quote}>"Patience is the companion of wisdom."</Text>
        <Text style={styles.quoteAuthor}>— Saint Augustine</Text>
        <View style={styles.lotusIcon}>
          <Ionicons name="flower-outline" size={60} color={colors.secondary} />
        </View>
      </TouchableOpacity>

      <Text style={styles.sectionTitle}>Select what you want more for now</Text>

      <View style={styles.row}>
        <TouchableOpacity style={[styles.card, styles.squareCard, { backgroundColor: colors.pastel.pink }]} activeOpacity={0.8}>
          <Ionicons name="happy-outline" size={48} color={colors.text} style={styles.cardIconTop} />
          <View style={styles.cardBottomRow}>
            <Text style={styles.cardTitle}>Hang out</Text>
            <View style={styles.arrowCircle}>
              <Ionicons name="arrow-forward" size={16} color={colors.text} />
            </View>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.card, styles.squareCard, { backgroundColor: colors.pastel.tealDark }]} activeOpacity={0.8}>
          <Ionicons name="color-palette-outline" size={48} color="#FFF" style={styles.cardIconTop} />
          <View style={styles.cardBottomRow}>
            <Text style={[styles.cardTitle, { color: '#FFF' }]}>Laugh</Text>
            <View style={[styles.arrowCircle, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
              <Ionicons name="arrow-forward" size={16} color="#FFF" />
            </View>
          </View>
        </TouchableOpacity>
      </View>

      {/* Stress Indicator Card */}
      <TouchableOpacity style={[styles.card, styles.stressCard]} activeOpacity={0.9}>
        <View style={styles.stressHeader}>
          <View style={styles.stressTitleRow}>
            <Ionicons name="sad" size={20} color={colors.primary} />
            <Text style={styles.stressLabel}>Stress indicator</Text>
          </View>
          <View style={styles.tag}>
            <Text style={styles.tagText}>Low</Text>
          </View>
        </View>
        <View style={styles.graphRow}>
          {/* Simple Mock Bars */}
          {[3,5,4,8,7,9,4,3,6,4,5].map((h, i) => (
            <View key={i} style={[styles.bar, { height: h * 6, backgroundColor: i > 5 ? colors.pastel.blue : colors.primary, opacity: i === 5 ? 1 : 0.4 }]} />
          ))}
        </View>
      </TouchableOpacity>

      
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: metrics.padding, paddingBottom: 150, paddingTop: 60 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 30 },
  headerTextContainer: { flex: 1 },
  greeting: { fontSize: 26, fontWeight: '700', color: colors.text, marginBottom: 4 },
  name: { fontSize: 24, fontWeight: '500', color: colors.text },
  iconBtn: { padding: 12, backgroundColor: colors.card, borderRadius: 24, ...shadows.soft },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: colors.text, marginBottom: 20, width: '60%', lineHeight: 26 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  card: {
    borderRadius: metrics.borderRadius,
    ...shadows.soft,
  },
  squareCard: {
    width: '47%',
    aspectRatio: 1,
    padding: 20,
    justifyContent: 'space-between'
  },
  cardIconTop: {
    alignSelf: 'flex-start'
  },
  cardBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  cardTitle: { fontSize: 16, fontWeight: '600', color: colors.text },
  arrowCircle: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.6)', justifyContent: 'center', alignItems: 'center' },
  stressCard: { backgroundColor: colors.card, padding: 24, marginBottom: 20 },
  stressHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  stressTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stressLabel: { fontSize: 15, fontWeight: '600', color: colors.text },
  tag: { backgroundColor: colors.background, paddingHorizontal: 16, paddingVertical: 6, borderRadius: 16 },
  tagText: { fontSize: 13, fontWeight: '600', color: colors.text },
  graphRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: 60 },
  bar: { width: 14, borderRadius: 7 },
  adviceCard: { backgroundColor: colors.card, padding: 24, paddingBottom: 30, marginBottom: 20, overflow: 'hidden' },
  quote: { fontSize: 26, fontWeight: '700', color: colors.text, lineHeight: 36, marginTop: 0, marginBottom: 15, width: '85%' },
  quoteAuthor: { fontSize: 15, color: colors.subText, fontWeight: '500' },
  lotusIcon: { position: 'absolute', bottom: -10, right: -10, opacity: 0.5 }
});
