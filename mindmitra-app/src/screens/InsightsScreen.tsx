import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, metrics, shadows } from '../theme/theme';

const HARDCODED_SCREEN_TIME = [
  { name: 'Expo Go', time: '2 hr, 24 min', icon: 'cube', bgColor: '#EAEAEA', iconColor: '#000020', rightIcon: 'hourglass-outline' },
  { name: 'WhatsApp', time: '10 minutes', icon: 'logo-whatsapp', bgColor: '#25D366', iconColor: '#fff', rightIcon: 'hourglass-outline' },
  { name: 'Instagram', time: '9 minutes', icon: 'logo-instagram', bgColor: '#E1306C', iconColor: '#fff', rightIcon: 'hourglass-outline' },
  { name: 'Phone', time: '4 minutes', icon: 'call', bgColor: '#4285F4', iconColor: '#fff', rightIcon: 'information-circle-outline' },
  { name: 'Clock', time: '3 minutes', icon: 'time', bgColor: '#7E8AF6', iconColor: '#fff', rightIcon: 'hourglass-outline' },
  { name: 'Settings', time: '3 minutes', icon: 'settings', bgColor: '#888888', iconColor: '#fff', rightIcon: 'information-circle-outline' },
];

const YESTERDAY_PLACES = [
  { name: 'Sangli Bus Stand MSRTC', time: '6:43 am - 6:50 am', icon: 'bus', bgColor: '#4285F4', iconColor: '#fff', rightIcon: 'location-outline' },
  { name: 'Uran Ishwarpur ST Stand', time: '7:42 am - 8:33 am', icon: 'bus-outline', bgColor: '#7E8AF6', iconColor: '#fff', rightIcon: 'location-outline' },
  { name: 'Rajarambapu Institute of Technology', time: 'Arrived at 8:44 am', icon: 'school', bgColor: '#E1306C', iconColor: '#fff', rightIcon: 'location-outline' },
];

const DAY_BEFORE_PLACES = [
  { name: 'Manchar Krishi Utpanna Bazar', time: '7:20 pm - 7:41 pm', icon: 'cart', bgColor: '#25D366', iconColor: '#fff', rightIcon: 'location-outline' },
  { name: 'Durva Park', time: '8:57 pm - 9:17 pm', icon: 'leaf', bgColor: '#7E8AF6', iconColor: '#fff', rightIcon: 'location-outline' },
  { name: 'Prajña Co-hab', time: 'Housing complex', icon: 'home', bgColor: '#888888', iconColor: '#fff', rightIcon: 'location-outline' },
  { name: 'Dakshin Tadka Pure Veg', time: '9:27 pm - 10:10 pm', icon: 'restaurant', bgColor: '#E1306C', iconColor: '#fff', rightIcon: 'location-outline' },
];


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
  },
  {
    id: '5',
    title: 'Location-Based Mood Analysis',
    description: 'Based on your recent visits to RIT, taking time out for Durva Park, and dining out, you are maintaining a healthy balance between academic responsibilities and leisure. This healthy mix of productivity and recreation strongly correlates with a positive, stable mood and naturally lower stress levels.',
    icon: 'location',
    color: colors.pastel.yellow,
    highlight: 'Balanced Lifestyle'
  }
];

export const InsightsScreen = () => {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Cognitive Insights</Text>
        <Text style={styles.subtitle}>Personalized analysis based on your activity</Text>
      </View>

      <View style={styles.screenTimeCard}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Today's Screen Time</Text>
          <Text style={styles.dateText}>Wed, Mar 25</Text>
        </View>
        <Text style={styles.totalTimeText}>2 hr, 53 min</Text>
        
        <View style={styles.appUsageList}>
          {HARDCODED_SCREEN_TIME.map(app => (
            <View key={app.name} style={styles.stAppRow}>
              <View style={[styles.stAppIconContainer, { backgroundColor: app.bgColor }]}>
                <Ionicons name={app.icon as any} size={20} color={app.iconColor} />
              </View>
              <View style={styles.stAppNameContainer}>
                <Text style={styles.stAppName}>{app.name}</Text>
                <Text style={styles.stAppTime}>{app.time}</Text>
              </View>
              <Ionicons name={app.rightIcon as any} size={20} color={colors.subText + '80'} />
            </View>
          ))}
        </View>
      </View>

      <Text style={styles.sectionTitle}>Recent Timeline</Text>
      
      <View style={styles.screenTimeCard}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Yesterday's Places</Text>
          <Text style={styles.dateText}>Tue, Mar 24</Text>
        </View>
        
        <View style={styles.appUsageList}>
          {YESTERDAY_PLACES.map(place => (
            <View key={place.name} style={styles.stAppRow}>
              <View style={[styles.stAppIconContainer, { backgroundColor: place.bgColor }]}>
                <Ionicons name={place.icon as any} size={20} color={place.iconColor} />
              </View>
              <View style={styles.stAppNameContainer}>
                <Text style={styles.stAppName}>{place.name}</Text>
                <Text style={styles.stAppTime}>{place.time}</Text>
              </View>
              <Ionicons name={place.rightIcon as any} size={20} color={colors.subText + '80'} />
            </View>
          ))}
        </View>
      </View>

      <View style={styles.screenTimeCard}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Places Visited</Text>
          <Text style={styles.dateText}>Sun, Mar 22</Text>
        </View>
        
        <View style={styles.appUsageList}>
          {DAY_BEFORE_PLACES.map(place => (
            <View key={place.name} style={styles.stAppRow}>
              <View style={[styles.stAppIconContainer, { backgroundColor: place.bgColor }]}>
                <Ionicons name={place.icon as any} size={20} color={place.iconColor} />
              </View>
              <View style={styles.stAppNameContainer}>
                <Text style={styles.stAppName}>{place.name}</Text>
                <Text style={styles.stAppTime}>{place.time}</Text>
              </View>
              <Ionicons name={place.rightIcon as any} size={20} color={colors.subText + '80'} />
            </View>
          ))}
        </View>
      </View>
      
      <Text style={styles.sectionTitle}>Behavioral Analysis</Text>
      
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
  cardDescription: { fontSize: 15, color: colors.subText, lineHeight: 22 },
  sectionTitle: { fontSize: 20, fontWeight: '700', color: colors.text, marginTop: 10, marginBottom: 16 },
  screenTimeCard: { backgroundColor: '#FFF', padding: 24, borderRadius: metrics.borderRadius, marginBottom: 24, ...shadows.medium },
  dateText: { fontSize: 14, fontWeight: '600', color: colors.primary },
  totalTimeText: { fontSize: 36, fontWeight: '800', color: colors.text, marginBottom: 20 },
  appUsageList: { gap: 16 },
  stAppRow: { flexDirection: 'row', alignItems: 'center' },
  stAppIconContainer: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  stAppNameContainer: { flex: 1 },
  stAppName: { fontSize: 16, fontWeight: '600', color: colors.text },
  stAppTime: { fontSize: 13, color: colors.subText, marginTop: 2 }
});
