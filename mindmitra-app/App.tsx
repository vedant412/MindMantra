import React, { useEffect } from 'react';
import { Alert, Platform } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import * as SecureStore from 'expo-secure-store';
import { AppNavigator } from './src/navigation/AppNavigator';
import { ScreenTimeTracker } from './src/services/screenTimeTracker';
import { BackgroundSyncService } from './src/services/backgroundSyncService';
import { LocationBackgroundService } from './src/services/locationBackgroundService';
import { LocationTracker } from './src/services/locationTracker';

const askConsent = (title: string, message: string): Promise<boolean> => {
  return new Promise(resolve => {
    Alert.alert(title, message, [
      { text: 'Not now', style: 'cancel', onPress: () => resolve(false) },
      { text: 'Allow', onPress: () => resolve(true) }
    ]);
  });
};

export default function App() {
  useEffect(() => {
    const bootstrapTracking = async () => {
      // 1. Screen Time Tracking Config
      const hasScreenTimeConsent = await ScreenTimeTracker.getConsentStatus();
      if (!hasScreenTimeConsent) {
        const allowed = await askConsent(
          'Enable Screen Time Tracking?',
          'MindMitra uses app-usage data to provide cognitive health insights and recommendations. Data is stored encrypted locally.'
        );
        await ScreenTimeTracker.setConsentStatus(allowed);
        
        if (allowed) {
          await ScreenTimeTracker.setTrackingEnabled(true);
        }
      }

      // Check OS usages permission if consent is given
      if (await ScreenTimeTracker.getConsentStatus() && await ScreenTimeTracker.isTrackingEnabled()) {
        if (Platform.OS === 'android') {
          if (!ScreenTimeTracker.isNativeCollectorAvailable()) {
            console.warn('Screen time data collection requires a native Android build.');
          } else {
            const permitted = await ScreenTimeTracker.hasUsagePermission();
            if (!permitted) {
              Alert.alert('Usage Access Required', 'Please enable Usage Access in Android settings.', [
                { text: 'Not now', style: 'cancel' },
                { text: 'Open Settings', onPress: () => ScreenTimeTracker.requestUsagePermission() }
              ]);
            }
          }
        }
        await ScreenTimeTracker.collectAndStoreSnapshot();
        await BackgroundSyncService.register();
      }

      // 2. Location Tracking Config
      const hasLocationConsent = await LocationTracker.getConsentStatus();
      if (!hasLocationConsent) {
        const allowed = await askConsent(
          'Enable Location Tracking?',
          'Location data helps MindMitra detect visited places and generate movement-based cognitive insights. You can disable this anytime.'
        );
        await LocationTracker.setConsentStatus(allowed);
        
        if (allowed) {
          await LocationTracker.setTrackingEnabled(true);
        }
      }

      // Request actual OS location permission if consent is given
      if (await LocationTracker.getConsentStatus() && await LocationTracker.isTrackingEnabled()) {
        const granted = await LocationTracker.requestLocationPermissions();
        if (!granted && Platform.OS === 'android') {
          Alert.alert('Location Permission Needed', 'Enable precise and background location access in settings.');
        } else if (granted) {
          await LocationTracker.collectCurrentLocation();
          await LocationBackgroundService.start();
        }
      }
    };

    bootstrapTracking();
  }, []);

  return (
    <NavigationContainer>
      <AppNavigator />
    </NavigationContainer>
  );
}
