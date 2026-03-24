import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, metrics, shadows } from '../theme/theme';
import { MockApi } from '../services/mockApi';

export const ActivitiesScreen = () => {
  const [activeTab, setActiveTab] = useState('Mind');
  const [activities, setActivities] = useState<any[]>([]);

  useEffect(() => {
    MockApi.getActivities().then(setActivities);
  }, []);

  const filtered = activities.filter(a => a.category === activeTab);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mental Health</Text>
        <View style={{ width: 48 }} />
      </View>
      
      <View style={styles.tabs}>
        {['Mind', 'Body', 'Reflect'].map(tab => (
          <TouchableOpacity 
            key={tab} 
            style={[styles.tab, activeTab === tab && styles.activeTab]}
            onPress={() => setActiveTab(tab)}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>{tab}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.sectionTitle}>Things you can do</Text>

      <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        {filtered.map(act => (
          <TouchableOpacity key={act.id} style={styles.card} activeOpacity={0.8}>
            <View style={[styles.iconContainer, { backgroundColor: act.color }]}>
              <Ionicons name={act.icon as any} size={28} color={colors.text} />
            </View>
            <View style={styles.cardContent}>
              <Text style={styles.cardTitle}>{act.title}</Text>
              <Text style={styles.cardSubtitle} numberOfLines={1}>{act.duration} focus exercise.</Text>
            </View>
            <View style={styles.playBtn}>
              <Ionicons name="play" size={18} color={colors.text} style={{ marginLeft: 2 }} />
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingTop: 60 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: metrics.padding, marginBottom: 30 },
  backBtn: { width: 48, height: 48, backgroundColor: '#FFF', borderRadius: 24, justifyContent: 'center', alignItems: 'center', ...shadows.soft },
  headerTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  tabs: { flexDirection: 'row', justifyContent: 'center', marginBottom: 30, paddingHorizontal: 20, gap: 12 },
  tab: { paddingVertical: 14, paddingHorizontal: 26, borderRadius: 28, backgroundColor: '#FFF', ...shadows.soft },
  activeTab: { backgroundColor: colors.pastel.pink },
  tabText: { fontSize: 14, fontWeight: '600', color: colors.subText },
  activeTabText: { color: colors.text },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginHorizontal: metrics.padding, marginBottom: 20 },
  list: { paddingHorizontal: metrics.padding, paddingBottom: 150, gap: 16 },
  card: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    padding: 20, 
    backgroundColor: '#FFF',
    borderRadius: metrics.borderRadius,
    ...shadows.soft
  },
  iconContainer: { width: 64, height: 64, borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginRight: 18 },
  cardContent: { flex: 1, marginRight: 10 },
  cardTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 6 },
  cardSubtitle: { fontSize: 14, color: colors.subText, lineHeight: 20 },
  playBtn: { width: 42, height: 42, borderRadius: 21, borderWidth: 1.5, borderColor: colors.border, justifyContent: 'center', alignItems: 'center' }
});
