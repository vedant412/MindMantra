import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, metrics } from '../theme/theme';

export const ProfileScreen = () => {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>V</Text>
        </View>
        <Text style={styles.name}>Vedant</Text>
        <Text style={styles.email}>vedant@mindmitra.app</Text>
      </View>

      <View style={styles.menu}>
        {['Account Settings', 'Voice & AI Preferences', 'Privacy & Data', 'Help Center'].map(item => (
          <View key={item} style={styles.menuItem}>
            <Text style={styles.menuText}>{item}</Text>
            <Ionicons name="chevron-forward" size={20} color="#888" />
          </View>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingTop: 80, paddingHorizontal: metrics.padding },
  header: { alignItems: 'center', marginBottom: 40 },
  avatar: { width: 100, height: 100, borderRadius: 50, backgroundColor: colors.pastel.pink, justifyContent: 'center', alignItems: 'center', marginBottom: 15 },
  avatarText: { fontSize: 40, fontWeight: '700', color: colors.text },
  name: { fontSize: 28, fontWeight: '700', color: colors.text, marginBottom: 5 },
  email: { fontSize: 16, color: colors.subText },
  menu: { backgroundColor: '#FFF', borderRadius: metrics.borderRadius, padding: 10, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 },
  menuItem: { flexDirection: 'row', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, borderBottomColor: colors.border },
  menuText: { fontSize: 16, fontWeight: '500', color: colors.text }
});
