import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import { ApiService } from './api';
import { LOCATION_BACKGROUND_TASK, LocationTracker } from './locationTracker';

TaskManager.defineTask(LOCATION_BACKGROUND_TASK, async ({ data, error }) => {
  if (error) {
    console.warn('[LocationBackground] Task error', error);
    return;
  }
  const locations = (data as { locations?: Location.LocationObject[] } | undefined)?.locations ?? [];
  try {
    await LocationTracker.handleBackgroundBatch(locations);
    await LocationTracker.detectVisitedPlaces();
    const unsynced = await LocationTracker.getUnsyncedPayload();
    const response = await ApiService.syncLocationData({
      points: unsynced.points.map((p) => p.point),
      visits: unsynced.visits.map((v) => v.visit)
    });
    if (response.ok) {
      await LocationTracker.markSynced(
        unsynced.points.map((p) => p.id),
        unsynced.visits.map((v) => v.id)
      );
    }
  } catch (taskError) {
    console.warn('[LocationBackground] Processing failed', taskError);
  }
});

export const LocationBackgroundService = {
  async start() {
    return LocationTracker.startBackgroundLocationUpdates();
  },
  async stop() {
    await LocationTracker.stopBackgroundLocationUpdates();
  }
};
