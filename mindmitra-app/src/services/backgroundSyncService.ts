import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import { ApiService } from './api';
import { ScreenTimeTracker } from './screenTimeTracker';

const SCREEN_TIME_TASK = 'mindmitra-screen-time-sync-task';
const FIFTEEN_MINUTES = 15 * 60;

TaskManager.defineTask(SCREEN_TIME_TASK, async () => {
  try {
    const hasConsent = await ScreenTimeTracker.getConsentStatus();
    const trackingEnabled = await ScreenTimeTracker.isTrackingEnabled();
    if (!hasConsent || !trackingEnabled) {
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }

    await ScreenTimeTracker.collectAndStoreSnapshot();
    const unsynced = await ScreenTimeTracker.getUnsyncedSnapshots();
    if (!unsynced.length) {
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }

    const payload = unsynced.map((item) => item.snapshot);
    const syncResponse = await ApiService.syncScreenTime(payload);
    if (syncResponse.ok) {
      await ScreenTimeTracker.markSynced(unsynced.map((item) => item.id));
      return BackgroundFetch.BackgroundFetchResult.NewData;
    }
    return BackgroundFetch.BackgroundFetchResult.Failed;
  } catch (error) {
    console.warn('[BackgroundSync] Failed to sync screen-time data', error);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

export const BackgroundSyncService = {
  async register() {
    const status = await BackgroundFetch.getStatusAsync();
    if (status !== BackgroundFetch.BackgroundFetchStatus.Available) {
      return false;
    }

    const isRegistered = await TaskManager.isTaskRegisteredAsync(SCREEN_TIME_TASK);
    if (!isRegistered) {
      await BackgroundFetch.registerTaskAsync(SCREEN_TIME_TASK, {
        minimumInterval: FIFTEEN_MINUTES,
        stopOnTerminate: false,
        startOnBoot: true
      });
    }
    return true;
  },

  async unregister() {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(SCREEN_TIME_TASK);
    if (isRegistered) {
      await BackgroundFetch.unregisterTaskAsync(SCREEN_TIME_TASK);
    }
  }
};
