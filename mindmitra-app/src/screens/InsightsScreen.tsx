import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, metrics, shadows } from '../theme/theme';
import { ApiService } from '../services/api';
import { ProcessedInsights, ScreenTimeTracker } from '../services/screenTimeTracker';
import { LocationInsight, LocationTracker } from '../services/locationTracker';

export const InsightsScreen = () => {
  const [data, setData] = useState<any>(null);
  const [screenInsights, setScreenInsights] = useState<ProcessedInsights | null>(null);
  const [locationInsights, setLocationInsights] = useState<LocationInsight | null>(null);
  const [screenTimeStatus, setScreenTimeStatus] = useState<string>('');

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    const loadData = async () => {
      try {
        // Execute API calls safely using Promise.allSettled to prevent race conditions
        const [insightsRes, screenTimeRes, locationRes] = await Promise.allSettled([
          ApiService.getInsights({ signal: controller.signal }),
          ScreenTimeTracker.getProcessedInsights(),
          ApiService.getLocationInsights({ signal: controller.signal })
        ]);

        if (!isMounted) return;

        // 1. Set general insights
        if (insightsRes.status === 'fulfilled') {
          setData(insightsRes.value);
        }

        // 2. Set screen time insights
        if (screenTimeRes.status === 'fulfilled') {
          const insights = screenTimeRes.value;
          setScreenInsights(insights);
          if (insights) {
            setScreenTimeStatus('');
          } else {
            if (!ScreenTimeTracker.isNativeCollectorAvailable()) {
              setScreenTimeStatus('Real screen-time data requires Android native collector (Dev Build), not Expo Go.');
            } else {
              ScreenTimeTracker.hasUsagePermission().then(permission => {
                if (isMounted) {
                  setScreenTimeStatus(permission ? 'No usage data captured yet. Keep tracking enabled for at least 15 minutes.' : 'Usage access permission is missing.');
                }
              });
            }
          }
        }

        // 3. Set location insights
        if (locationRes.status === 'fulfilled') {
          const backend = locationRes.value;
          if (backend?.timeline?.length || backend?.frequent_places?.length) {
            const mapped: LocationInsight = {
              timeline: (backend.timeline || []).map((t: any) => ({
                time: t.time ? new Date(t.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--',
                place: t.place || 'Unknown Place',
                distance: t.distance
              })),
              frequentPlaces: (backend.frequent_places || []).map((f: any) => ({
                placeName: f.place_name || 'Unknown Place',
                category: f.category || 'other',
                visits: f.visits || 0
              })),
              patterns: {
                lackOfOutdoorActivity: !!backend?.patterns?.lack_of_outdoor_activity,
                irregularMovement: !!backend?.patterns?.irregular_movement,
                stressCorrelationHint: backend?.patterns?.stress_correlation_hint || ''
              }
            };
            setLocationInsights(mapped);
          } else {
            const local = await LocationTracker.getMovementInsights();
            if (isMounted) setLocationInsights(local);
          }
        }
      } catch (e) {
        // Handled within specific promises effectively thanks to allSettled
      }
    };

    loadData();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, []);

  const toHoursAndMinutes = (ms: number) => {
    const totalMinutes = Math.round(ms / (60 * 1000));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours}h ${minutes}m`;
  };

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
        <Text style={styles.largeData}>
          {screenInsights ? toHoursAndMinutes(screenInsights.dailyReport.totalScreenTimeMs) : '--'}
        </Text>
        <Text style={styles.smallText}>
          Weekly avg: {screenInsights ? toHoursAndMinutes(screenInsights.weeklyReport.averageDailyMs) : '--'}
        </Text>
        {!screenInsights && !!screenTimeStatus && <Text style={styles.smallText}>{screenTimeStatus}</Text>}
      </View>

      {screenInsights && (
        <View style={styles.graphCard}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Top Used Apps</Text>
            <Ionicons name="phone-portrait" size={18} color={colors.primary} />
          </View>
          {screenInsights.topApps.map((app) => (
            <View key={app.packageName} style={styles.appRow}>
              <Text style={styles.appName}>{app.appName}</Text>
              <Text style={styles.appUsage}>{toHoursAndMinutes(app.foregroundTimeMs)} · {app.opens} opens</Text>
            </View>
          ))}
          <Text style={styles.flagText}>
            Late-night usage: {screenInsights.lateNightUsage.detected ? 'Detected' : 'Not detected'}
          </Text>
        </View>
      )}

      {locationInsights && (
        <View style={styles.graphCard}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Visited Places Timeline</Text>
            <Ionicons name="location" size={18} color={colors.primary} />
          </View>
          {locationInsights.timeline.length === 0 ? (
            <Text style={styles.smallText}>No visit data yet. Keep tracking enabled.</Text>
          ) : (
            locationInsights.timeline.map((t, idx) => (
              <View key={`${t.time}_${idx}`} style={styles.appRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.appName}>{t.time}</Text>
                  {t.distance && (
                    <Text style={[styles.appUsage, { color: colors.primary, fontSize: 12, marginTop: 4, fontWeight: '500' }]}>
                      {t.distance}
                    </Text>
                  )}
                </View>
                <Text style={[styles.appUsage, { flex: 2, textAlign: 'right' }]}>{t.place}</Text>
              </View>
            ))
          )}
          <Text style={styles.flagText}>
            Outdoor activity low: {locationInsights.patterns.lackOfOutdoorActivity ? 'Yes' : 'No'}
          </Text>
        </View>
      )}

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
  pillText: { fontSize: 14, fontWeight: '600', color: colors.text },
  smallText: { marginTop: 8, fontSize: 13, color: colors.subText, fontWeight: '500' },
  appRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10, gap: 12 },
  appName: { fontSize: 14, color: colors.text, fontWeight: '600' },
  appUsage: { fontSize: 13, color: colors.subText },
  flagText: { marginTop: 8, fontSize: 13, fontWeight: '600', color: colors.primary }
});
