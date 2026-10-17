import { deleteLocalAccountData } from '../services/localDatabase';
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Switch, TouchableOpacity, Platform, Alert, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, metrics } from '../theme/theme';
import { ScreenTimeTracker } from '../services/screenTimeTracker';
import { BackgroundSyncService } from '../services/backgroundSyncService';
import { LocationTracker } from '../services/locationTracker';
import { LocationBackgroundService } from '../services/locationBackgroundService';
import { ApiService } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

export const ProfileScreen = () => {
  const [memoryEnabled, setMemoryEnabled] = useState(false);
  const [transcriptsEnabled, setTranscriptsEnabled] = useState(false);
  const [retentionDays, setRetentionDays] = useState(90);
  const [trackingEnabled, setTrackingEnabled] = useState(false);
  const [usagePermission, setUsagePermission] = useState(false);
  const [locationEnabled, setLocationEnabled] = useState(false);
  const [locationPermission, setLocationPermission] = useState(false);
  const [userName, setUserName] = useState('My Profile');
  const [userEmail, setUserEmail] = useState('mindmitra_user');
  const { user, signOut } = useAuth(); // Import useAuth from contexts if needed, else we rely on mock

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
      setMemoryEnabled(profile.memory_enabled);
      setTranscriptsEnabled(profile.transcript_storage_enabled);
      setRetentionDays(profile.retention_days);
      if (profile?.Name) setUserName(profile.Name);
    };
    loadState().catch(() => Alert.alert('Unavailable', 'Could not load privacy preferences.'));
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
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 160 }}>
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
      <View style={styles.privacyCard}>
        <Text style={styles.privacyTitle}>Conversation privacy</Text>
        <Text style={styles.helperText}>Audio is never saved. Transcripts and memory expire after {retentionDays} days.</Text>
        <View style={styles.row}><Text>Save transcripts</Text><Switch value={transcriptsEnabled} onValueChange={async enabled => {
          try { await ApiService.updatePreferences({ transcript_storage_enabled: enabled, memory_enabled: enabled && memoryEnabled }); setTranscriptsEnabled(enabled); if (!enabled) setMemoryEnabled(false); }
          catch { Alert.alert('Not saved', 'Please try again.'); }
        }} /></View>
        <View style={styles.row}><Text>Remember conversations</Text><Switch value={memoryEnabled} disabled={!transcriptsEnabled} onValueChange={async enabled => {
          try { await ApiService.updatePreferences({ memory_enabled: enabled }); setMemoryEnabled(enabled); }
          catch { Alert.alert('Not saved', 'Please try again.'); }
        }} /></View>
        <View style={styles.row}>{[30, 90, 365].map(days => <TouchableOpacity key={days} style={styles.permissionBtn} onPress={async () => {
          try { await ApiService.updatePreferences({ retention_days: days }); setRetentionDays(days); } catch { Alert.alert('Not saved', 'Please try again.'); }
        }}><Text>{days} days</Text></TouchableOpacity>)}</View>
        <TouchableOpacity style={styles.permissionBtn} onPress={() => Alert.alert('Forget memory?', 'Saved facts and semantic memory will be deleted.', [
          { text: 'Cancel', style: 'cancel' }, { text: 'Forget', style: 'destructive', onPress: () => { void ApiService.forgetMemory().then(() => setMemoryEnabled(false)).catch(() => Alert.alert('Could not delete', 'Please try again.')); } }
        ])}><Text>Forget conversation memory</Text></TouchableOpacity>
        <TouchableOpacity style={styles.permissionBtn} onPress={() => Alert.alert('Delete all app data?', 'Your server data will be deleted and this account will no longer be able to create app data. Existing backups expire according to the service policy.', [
          { text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => { void ApiService.deleteAccountData().then(async () => { await BackgroundSyncService.unregister(); await LocationBackgroundService.stop(); await deleteLocalAccountData(); await signOut(); }).catch(() => Alert.alert('Could not delete', 'Please try again.')); } }
        ])}><Text style={{ color: '#B42318' }}>Delete all app data</Text></TouchableOpacity>
        <TouchableOpacity style={styles.permissionBtn} onPress={() => void signOut()}><Text>Sign out</Text></TouchableOpacity>
      </View>
    </ScrollView>
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
