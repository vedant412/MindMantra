import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Switch, TouchableOpacity, Platform, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, metrics } from '../theme/theme';
import { ScreenTimeTracker } from '../services/screenTimeTracker';
import { BackgroundSyncService } from '../services/backgroundSyncService';
import { LocationTracker } from '../services/locationTracker';
import { LocationBackgroundService } from '../services/locationBackgroundService';
import { ApiService } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

export const ProfileScreen = () => {
  const [trackingEnabled, setTrackingEnabled] = useState(false);
  const [usagePermission, setUsagePermission] = useState(false);
  const [locationEnabled, setLocationEnabled] = useState(false);
  const [locationPermission, setLocationPermission] = useState(false);
  const [userName, setUserName] = useState('My Profile');
  const [userEmail, setUserEmail] = useState('mindmitra_user');
  const { user } = useAuth(); // Import useAuth from contexts if needed, else we rely on mock

  useEffect(() => {
    const loadState = async () => {
      const enabled = await ScreenTimeTracker.isTrackingEnabled();
      const consent = await ScreenTimeTracker.getConsentStatus();
      const permission = await ScreenTimeTracker.hasUsagePermission();
      const locEnabled = await LocationTracker.isTrackingEnabled();
      const locConsent = await LocationTracker.getConsentStatus();
      const locPermission = await LocationTracker.hasLocationPermissions();
      const profile = await ApiService.getUserProfile();
      
      setTrackingEnabled(enabled && consent);
      setUsagePermission(permission);
      setLocationEnabled(locEnabled && locConsent);
      setLocationPermission(locPermission);
      if (profile?.Name) setUserName(profile.Name);
    };
    loadState();
  }, []);

  const onToggleTracking = async (enabled: boolean) => {
    if (enabled) {
      const hasConsent = await ScreenTimeTracker.getConsentStatus();
      if (!hasConsent) {
        Alert.alert('Consent Needed', 'Please grant consent first from app startup prompt.');
        return;
      }
      await ScreenTimeTracker.setTrackingEnabled(true);
      await BackgroundSyncService.register();
      setTrackingEnabled(true);
      return;
    }

    await ScreenTimeTracker.setTrackingEnabled(false);
    await BackgroundSyncService.unregister();
    setTrackingEnabled(false);
  };

  const onToggleLocationTracking = async (enabled: boolean) => {
    if (enabled) {
      const hasConsent = await LocationTracker.getConsentStatus();
      if (!hasConsent) {
        Alert.alert('Consent Needed', 'Enable location tracking consent from startup prompt.');
        return;
      }
      const granted = await LocationTracker.requestLocationPermissions();
      if (!granted) {
        Alert.alert('Permission Needed', 'Please allow fine + background location access.');
        return;
      }
      await LocationTracker.setTrackingEnabled(true);
      await LocationBackgroundService.start();
      setLocationEnabled(true);
      setLocationPermission(true);
      return;
    }
    await LocationTracker.setTrackingEnabled(false);
    await LocationBackgroundService.stop();
    setLocationEnabled(false);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{userName.charAt(0).toUpperCase()}</Text>
        </View>
        <Text style={styles.name}>{userName}</Text>
        <Text style={styles.email}>{(user as any)?.email || 'Signed in'}</Text>
      </View>

      <View style={styles.menu}>
        {['Account Settings', 'Voice & AI Preferences', 'Privacy & Data', 'Help Center'].map(item => (
          <View key={item} style={styles.menuItem}>
            <Text style={styles.menuText}>{item}</Text>
            <Ionicons name="chevron-forward" size={20} color="#888" />
          </View>
        ))}
      </View>

      <View style={styles.privacyCard}>
        <Text style={styles.privacyTitle}>Screen Time Tracking</Text>
        <View style={styles.row}>
          <Text style={styles.helperText}>Enable background tracking</Text>
          <Switch value={trackingEnabled} onValueChange={onToggleTracking} />
        </View>
        {Platform.OS === 'android' && (
          <TouchableOpacity style={styles.permissionBtn} onPress={async () => {
            await ScreenTimeTracker.requestUsagePermission();
            const permission = await ScreenTimeTracker.hasUsagePermission();
            setUsagePermission(permission);
          }}>
            <Text style={styles.permissionText}>
              {usagePermission ? 'Usage access granted' : 'Grant Usage Access'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.privacyCard}>
        <Text style={styles.privacyTitle}>Location Tracking</Text>
        <View style={styles.row}>
          <Text style={styles.helperText}>Enable GPS tracking in background</Text>
          <Switch value={locationEnabled} onValueChange={onToggleLocationTracking} />
        </View>
        <TouchableOpacity style={styles.permissionBtn} onPress={async () => {
          const granted = await LocationTracker.requestLocationPermissions();
          setLocationPermission(granted);
        }}>
          <Text style={styles.permissionText}>
            {locationPermission ? 'Location permissions granted' : 'Grant location permissions'}
          </Text>
        </TouchableOpacity>
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
  menuText: { fontSize: 16, fontWeight: '500', color: colors.text },
  privacyCard: { marginTop: 20, backgroundColor: '#FFF', borderRadius: metrics.borderRadius, padding: 20, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 },
  privacyTitle: { fontSize: 17, fontWeight: '700', color: colors.text, marginBottom: 14 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  helperText: { fontSize: 14, color: colors.subText },
  permissionBtn: { marginTop: 14, alignSelf: 'flex-start', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, backgroundColor: colors.pastel.blue },
  permissionText: { fontSize: 13, fontWeight: '600', color: colors.text }
});
