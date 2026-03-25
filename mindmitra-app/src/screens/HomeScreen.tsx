import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, metrics, shadows } from '../theme/theme';
import { ApiService } from '../services/api';
import { CognitiveCard } from '../components/home/CognitiveCard';
import { QuoteCarousel } from '../components/home/QuoteCarousel';
import { InsightGrid } from '../components/home/InsightGrid';
import { RecommendationsList } from '../components/home/RecommendationsList';
import { DailyCheckinModal } from '../components/home/DailyCheckinModal';
import { useCognitiveScore } from '../contexts/CognitiveScoreContext';

const MOCK_QUOTES = [
  { id: '1', text: 'Patience is the companion of wisdom.', author: 'Saint Augustine' },
  { id: '2', text: 'The greatest wealth is mental health.', author: 'Unknown' },
  { id: '3', text: 'Peace comes from within. Do not seek it without.', author: 'Buddha' },
];

export const HomeScreen = ({ navigation }: any) => {
  const [data, setData] = useState<any>(null);
  const [userName, setUserName] = useState('Friend');
  const [loading, setLoading] = useState(true);
  const { 
    cognitiveScore,
    activityPercent,
    vaniScore,
    screenPercent,
    sleepPercent,
    sleepMinutes,
    mood,
    moodScore,
    dailyInputCompleted,
    submitDailyInput
  } = useCognitiveScore();

  const getCognitiveStatus = (score: number) => {
    if (score >= 80) return "Excellent Health";
    if (score >= 60) return "Good Health";
    if (score >= 40) return "Fair Health";
    if (score >= 20) return "Poor Health";
    return "Bad Health";
  };

  const getDynamicRecommendations = () => {
    if (cognitiveScore < 40) {
      return [
        { id: '1', text: "Do a breathing exercise", icon: "leaf-outline" as any, action: () => navigation.navigate("Activities", { screen: "Exercise" }) },
        { id: '2', text: "Try a memory game", icon: "game-controller-outline" as any, action: () => navigation.navigate("Activities", { screen: "Games" }) },
        { id: '3', text: "Reduce screen time", icon: "moon-outline" as any, action: () => navigation.navigate("Insights") }
      ];
    } else if (cognitiveScore < 70) {
      return [
        { id: '1', text: "Play focus game", icon: "game-controller-outline" as any, action: () => navigation.navigate("Activities", { screen: "Games" }) },
        { id: '2', text: "Complete 1 exercise", icon: "leaf-outline" as any, action: () => navigation.navigate("Activities", { screen: "Exercise" }) },
        { id: '3', text: "Talk with Vani", icon: "chatbubble-outline" as any, action: () => navigation.navigate("Talk") }
      ];
    } else {
      return [
        { id: '1', text: "Maintain streak", icon: "flame-outline" as any, action: () => navigation.navigate("Activities") },
        { id: '2', text: "Try advanced game", icon: "star-outline" as any, action: () => navigation.navigate("Activities", { screen: "Games" }) },
        { id: '3', text: "Keep consistency", icon: "checkmark-circle-outline" as any, action: () => navigation.navigate("Insights") }
      ];
    }
  };

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    const fetchData = async () => {
      try {
        const [result, profile] = await Promise.all([
          ApiService.getDailySummary({ signal: controller.signal }),
          ApiService.getUserProfile({ signal: controller.signal })
        ]);
        if (isMounted) {
          setData(result);
          if (profile?.Name) setUserName(profile.Name);
          setLoading(false);
        }
      } catch (error) {
        if (isMounted) setLoading(false);
      }
    };

    fetchData();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, []);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 18) return 'Good Afternoon';
    return 'Good Evening';
  };

  const formatSleepString = (mins: number) => {
    const hrs = Math.floor(mins / 60);
    const m = mins % 60;
    return `${hrs}h ${m}m`;
  };

  return (
    <>
      <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.headerTextContainer}>
            <Text style={styles.greeting}>{getGreeting()},</Text>
            <Text style={styles.name} numberOfLines={1}>{userName} 👋</Text>
          </View>
          <TouchableOpacity style={styles.iconBtn} activeOpacity={0.7}>
            <Ionicons name="notifications-outline" size={24} color={colors.text} />
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.loaderContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <>
            <CognitiveCard 
              score={cognitiveScore} 
              status={getCognitiveStatus(cognitiveScore)} 
              vaniScore={vaniScore} 
              sleepScore={sleepPercent} 
              screenScore={screenPercent} 
              activityScore={activityPercent} 
            />
            
            <QuoteCarousel quotes={MOCK_QUOTES} />
            
            <InsightGrid 
              sleepHours={dailyInputCompleted ? formatSleepString(sleepMinutes) : "Not recorded"} 
              sleepScore={sleepPercent} 
              moodState={dailyInputCompleted ? mood : "Pending"} 
              moodScore={dailyInputCompleted ? moodScore : 0} 
            />
            
            <RecommendationsList 
              insightsText={data?.insight || "Your mood has been stable recently. Keep up the good work!"}
              recommendations={getDynamicRecommendations()}
            />
          </>
        )}
        
      </ScrollView>

      {!dailyInputCompleted && !loading && (
        <DailyCheckinModal 
          visible={true} 
          onSubmit={(hours, moodString) => submitDailyInput(hours, moodString)} 
          onClose={() => {}} 
        />
      )}
    </>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: metrics.padding, paddingBottom: 150, paddingTop: 60 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 },
  headerTextContainer: { flex: 1 },
  greeting: { fontSize: 24, fontWeight: '700', color: colors.subText, marginBottom: 4 },
  name: { fontSize: 28, fontWeight: '800', color: colors.text },
  iconBtn: { padding: 12, backgroundColor: colors.card, borderRadius: 24, ...shadows.soft },
  loaderContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 100 }
});
