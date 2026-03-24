import { Platform } from 'react-native';
import * as SQLite from 'expo-sqlite';
import * as SecureStore from 'expo-secure-store';
import * as Location from 'expo-location';

export type RawLocationPoint = {
  latitude: number;
  longitude: number;
  timestamp: number;
};

export type VisitedPlace = {
  placeName: string;
  category: string;
  latitude: number;
  longitude: number;
  entryTime: number;
  exitTime: number;
  durationMs: number;
};

export type LocationInsight = {
  timeline: { time: string; place: string; distance?: string }[];
  frequentPlaces: { placeName: string; category: string; visits: number }[];
  patterns: {
    lackOfOutdoorActivity: boolean;
    irregularMovement: boolean;
    stressCorrelationHint: string;
  };
};

type ReverseGeocodeResult = {
  placeName: string;
  category: string;
};

const LOCATION_DB_NAME = 'location_history.db';
const LOCATION_CONSENT_KEY = 'location_tracking_consent';
const LOCATION_ENABLED_KEY = 'location_tracking_enabled';
const LOCATION_ENCRYPTION_KEY = 'location_encryption_seed';
const LOCATION_INSTALL_TIMESTAMP_KEY = 'location_install_timestamp_ms';
const LOCATION_TASK_NAME = 'mindmitra-location-task';
const STAY_THRESHOLD_MS = 10 * 60 * 1000;
const CLUSTER_RADIUS_METERS = 150;

const openLocationDb = async () => {
  const db = await SQLite.openDatabaseAsync(LOCATION_DB_NAME);
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS location_points (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp INTEGER NOT NULL,
      encrypted_payload TEXT NOT NULL,
      synced INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS visited_places (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      place_name TEXT NOT NULL,
      category TEXT NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      entry_time INTEGER NOT NULL,
      exit_time INTEGER NOT NULL,
      duration_ms INTEGER NOT NULL,
      synced INTEGER DEFAULT 0
    );
  `);
  return db;
};

const encode = (value: string) => {
  if (typeof globalThis.btoa === 'function') return globalThis.btoa(value);
  return value;
};

const decode = (value: string) => {
  if (typeof globalThis.atob === 'function') return globalThis.atob(value);
  return value;
};

const xorText = (text: string, seed: string) => {
  if (!seed) return text;
  return [...text].map((ch, i) => String.fromCharCode(ch.charCodeAt(0) ^ seed.charCodeAt(i % seed.length))).join('');
};

const getOrCreateSeed = async () => {
  const existing = await SecureStore.getItemAsync(LOCATION_ENCRYPTION_KEY);
  if (existing) return existing;
  const seed = `${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
  await SecureStore.setItemAsync(LOCATION_ENCRYPTION_KEY, seed);
  return seed;
};

const getOrCreateInstallTimestamp = async () => {
  const existing = await SecureStore.getItemAsync(LOCATION_INSTALL_TIMESTAMP_KEY);
  if (existing) {
    const parsed = Number(existing);
    if (!Number.isNaN(parsed) && parsed > 0) return parsed;
  }
  const now = Date.now();
  await SecureStore.setItemAsync(LOCATION_INSTALL_TIMESTAMP_KEY, String(now));
  return now;
};

const encryptPoint = async (point: RawLocationPoint) => {
  const seed = await getOrCreateSeed();
  return encode(xorText(JSON.stringify(point), seed));
};

const decryptPoint = async (payload: string): Promise<RawLocationPoint> => {
  const seed = await getOrCreateSeed();
  return JSON.parse(xorText(decode(payload), seed)) as RawLocationPoint;
};

const toRadians = (deg: number) => (deg * Math.PI) / 180;

const distanceMeters = (a: RawLocationPoint, b: RawLocationPoint) => {
  const earthRadius = 6371000;
  const dLat = toRadians(b.latitude - a.latitude);
  const dLon = toRadians(b.longitude - a.longitude);
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);
  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return 2 * earthRadius * Math.asin(Math.sqrt(h));
};

const classifyCategory = (name: string) => {
  const n = name.toLowerCase();
  if (n.includes('park') || n.includes('garden') || n.includes('lake')) return 'park';
  if (n.includes('hospital') || n.includes('clinic')) return 'hospital';
  if (n.includes('mall') || n.includes('market') || n.includes('store')) return 'mall';
  if (n.includes('office') || n.includes('tech') || n.includes('tower')) return 'work';
  if (n.includes('gym') || n.includes('fitness') || n.includes('sports')) return 'gym';
  return 'other';
};

const reverseGeocodeOpenStreetMap = async (lat: number, lon: number): Promise<ReverseGeocodeResult> => {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`;
    const res = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'mindmitra-app'
      }
    });
    const data = await res.json();
    const placeName = data?.name || data?.display_name || 'Unknown Place';
    return { placeName, category: classifyCategory(placeName) };
  } catch {
    return { placeName: 'Unknown Place', category: 'other' };
  }
};

const toTimeLabel = (ts: number) => {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

export const LOCATION_BACKGROUND_TASK = LOCATION_TASK_NAME;

export const LocationTracker = {
  async getConsentStatus() {
    return (await SecureStore.getItemAsync(LOCATION_CONSENT_KEY)) === 'granted';
  },

  async setConsentStatus(granted: boolean) {
    await SecureStore.setItemAsync(LOCATION_CONSENT_KEY, granted ? 'granted' : 'denied');
    if (!granted) await SecureStore.setItemAsync(LOCATION_ENABLED_KEY, 'false');
  },

  async isTrackingEnabled() {
    return (await SecureStore.getItemAsync(LOCATION_ENABLED_KEY)) !== 'false';
  },

  async setTrackingEnabled(enabled: boolean) {
    await SecureStore.setItemAsync(LOCATION_ENABLED_KEY, enabled ? 'true' : 'false');
  },

  async requestLocationPermissions() {
    const fg = await Location.requestForegroundPermissionsAsync();
    if (fg.status !== 'granted') return false;
    const bg = await Location.requestBackgroundPermissionsAsync();
    return bg.status === 'granted';
  },

  async hasLocationPermissions() {
    const fg = await Location.getForegroundPermissionsAsync();
    const bg = await Location.getBackgroundPermissionsAsync();
    return fg.status === 'granted' && bg.status === 'granted';
  },

  async collectCurrentLocation() {
    const enabled = await this.isTrackingEnabled();
    const consent = await this.getConsentStatus();
    if (!enabled || !consent) return null;
    const permission = await this.hasLocationPermissions();
    if (!permission) return null;

    const current = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced
    });
    const point: RawLocationPoint = {
      latitude: current.coords.latitude,
      longitude: current.coords.longitude,
      timestamp: current.timestamp || Date.now()
    };

    const payload = await encryptPoint(point);
    const db = await openLocationDb();
    await db.runAsync('INSERT INTO location_points (timestamp, encrypted_payload, synced) VALUES (?, ?, 0)', [
      point.timestamp,
      payload
    ]);
    return point;
  },

  async startBackgroundLocationUpdates() {
    const consent = await this.getConsentStatus();
    const enabled = await this.isTrackingEnabled();
    if (!consent || !enabled) return false;
    if (!(await this.hasLocationPermissions())) return false;

    const started = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
    if (started) return true;

    await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
      accuracy: Location.Accuracy.Balanced,
      timeInterval: 5 * 60 * 1000,
      distanceInterval: 100,
      showsBackgroundLocationIndicator: true,
      foregroundService: Platform.OS === 'android'
        ? {
            notificationTitle: 'MindMitra Location Tracking',
            notificationBody: 'Tracking location for cognitive health insights.'
          }
        : undefined
    });
    return true;
  },

  async stopBackgroundLocationUpdates() {
    const started = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
    if (started) {
      await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
    }
  },

  async handleBackgroundBatch(locations: Location.LocationObject[]) {
    if (!locations.length) return;
    const db = await openLocationDb();
    for (const loc of locations) {
      const point: RawLocationPoint = {
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        timestamp: loc.timestamp || Date.now()
      };
      const payload = await encryptPoint(point);
      await db.runAsync('INSERT INTO location_points (timestamp, encrypted_payload, synced) VALUES (?, ?, 0)', [
        point.timestamp,
        payload
      ]);
    }
  },

  async getRecentPoints(hours = 24) {
    const installTs = await getOrCreateInstallTimestamp();
    const rollingWindowStart = Date.now() - hours * 60 * 60 * 1000;
    const since = Math.max(installTs, rollingWindowStart);
    const db = await openLocationDb();
    const rows = await db.getAllAsync<{ id: number; encrypted_payload: string; timestamp: number }>(
      'SELECT id, encrypted_payload, timestamp FROM location_points WHERE timestamp >= ? ORDER BY timestamp ASC',
      [since]
    );
    const points = await Promise.all(
      rows.map(async (row) => ({
        id: row.id,
        point: await decryptPoint(row.encrypted_payload),
        timestamp: row.timestamp
      }))
    );
    return points;
  },

  async detectVisitedPlaces() {
    const points = await this.getRecentPoints(24);
    if (points.length < 2) return [];

    const clusters: RawLocationPoint[][] = [];
    for (const item of points) {
      const point = item.point;
      const cluster = clusters.find((c) => distanceMeters(c[0], point) <= CLUSTER_RADIUS_METERS);
      if (cluster) cluster.push(point);
      else clusters.push([point]);
    }

    const visits: VisitedPlace[] = [];
    for (const cluster of clusters) {
      const entry = cluster[0].timestamp;
      const exit = cluster[cluster.length - 1].timestamp;
      const durationMs = exit - entry;
      if (durationMs < STAY_THRESHOLD_MS) continue;

      const centroid = cluster.reduce(
        (acc, p) => ({ latitude: acc.latitude + p.latitude, longitude: acc.longitude + p.longitude }),
        { latitude: 0, longitude: 0 }
      );
      const latitude = centroid.latitude / cluster.length;
      const longitude = centroid.longitude / cluster.length;
      const geo = await reverseGeocodeOpenStreetMap(latitude, longitude);
      visits.push({
        placeName: geo.placeName,
        category: geo.category,
        latitude,
        longitude,
        entryTime: entry,
        exitTime: exit,
        durationMs
      });
    }

    const db = await openLocationDb();
    for (const visit of visits) {
      await db.runAsync(
        `INSERT INTO visited_places
         (place_name, category, latitude, longitude, entry_time, exit_time, duration_ms, synced)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
        [visit.placeName, visit.category, visit.latitude, visit.longitude, visit.entryTime, visit.exitTime, visit.durationMs]
      );
    }
    return visits;
  },

  async getUnsyncedPayload() {
    const db = await openLocationDb();
    const pointRows = await db.getAllAsync<{ id: number; encrypted_payload: string }>(
      'SELECT id, encrypted_payload FROM location_points WHERE synced = 0 ORDER BY timestamp ASC'
    );
    const visitRows = await db.getAllAsync<{
      id: number;
      place_name: string;
      category: string;
      latitude: number;
      longitude: number;
      entry_time: number;
      exit_time: number;
      duration_ms: number;
    }>('SELECT id, place_name, category, latitude, longitude, entry_time, exit_time, duration_ms FROM visited_places WHERE synced = 0');

    const points = await Promise.all(pointRows.map(async (row) => ({ id: row.id, point: await decryptPoint(row.encrypted_payload) })));
    const visits = visitRows.map((v) => ({
      id: v.id,
      visit: {
        placeName: v.place_name,
        category: v.category,
        latitude: v.latitude,
        longitude: v.longitude,
        entryTime: v.entry_time,
        exitTime: v.exit_time,
        durationMs: v.duration_ms
      } as VisitedPlace
    }));
    return { points, visits };
  },

  async markSynced(pointIds: number[], visitIds: number[]) {
    const db = await openLocationDb();
    if (pointIds.length) {
      const p = pointIds.map(() => '?').join(', ');
      await db.runAsync(`UPDATE location_points SET synced = 1 WHERE id IN (${p})`, pointIds);
    }
    if (visitIds.length) {
      const v = visitIds.map(() => '?').join(', ');
      await db.runAsync(`UPDATE visited_places SET synced = 1 WHERE id IN (${v})`, visitIds);
    }
  },

  async getMovementInsights(): Promise<LocationInsight> {
    const db = await openLocationDb();
    const installTs = await getOrCreateInstallTimestamp();
    const rows = await db.getAllAsync<{
      place_name: string;
      category: string;
      entry_time: number;
      exit_time: number;
    }>(
      'SELECT place_name, category, entry_time, exit_time FROM visited_places WHERE entry_time >= ? ORDER BY entry_time ASC LIMIT 200',
      [installTs]
    );

    let timeline: LocationInsight['timeline'] = rows.slice(-8).map((r) => ({
      time: toTimeLabel(r.entry_time),
      place: r.place_name
    }));

    // If no real data is loaded, gracefully inject mock data as requested
    if (timeline.length === 0) {
      timeline = [
        { time: '09:00 AM', place: 'Home' },
        { time: '10:30 AM', place: 'Rajarambapu College of Engineering', distance: '1.2 km walked' },
        { time: '05:15 PM', place: 'Central Park', distance: '2.4 km walked' }
      ];
    }

    const freqMap = new Map<string, { placeName: string; category: string; visits: number }>();
    rows.forEach((r) => {
      const key = `${r.place_name}_${r.category}`;
      const existing = freqMap.get(key);
      if (existing) existing.visits += 1;
      else freqMap.set(key, { placeName: r.place_name, category: r.category, visits: 1 });
    });
    const frequentPlaces = [...freqMap.values()].sort((a, b) => b.visits - a.visits).slice(0, 5);

    const outdoorVisits = rows.filter((r) => r.category === 'park').length;
    const hours = rows.map((r) => new Date(r.entry_time).getHours());
    const irregularMovement = hours.some((h) => h <= 5) && hours.some((h) => h >= 23);

    return {
      timeline,
      frequentPlaces,
      patterns: {
        lackOfOutdoorActivity: outdoorVisits < 2,
        irregularMovement,
        stressCorrelationHint:
          'Frequent mall/hospital visits may correlate with elevated stress. Compare with mood logs for stronger confidence.'
      }
    };
  }
};
