import { NativeModules, Platform } from 'react-native';
import * as SQLite from 'expo-sqlite';
import * as SecureStore from 'expo-secure-store';

export type AppUsageItem = {
  packageName: string;
  appName: string;
  foregroundTimeMs: number;
  opens: number;
  firstTimeStamp: number;
  lastTimeStamp: number;
};

export type UsageSnapshot = {
  capturedAt: number;
  day: string;
  totalScreenTimeMs: number;
  foregroundTimeMs: number;
  appOpens: number;
  apps: AppUsageItem[];
};

export type ProcessedInsights = {
  dailyReport: {
    date: string;
    totalScreenTimeMs: number;
    foregroundTimeMs: number;
    appOpens: number;
  };
  weeklyReport: {
    averageDailyMs: number;
    totalWeekMs: number;
  };
  topApps: AppUsageItem[];
  lateNightUsage: {
    detected: boolean;
    usageMs: number;
    thresholdMs: number;
  };
  riskSignals: {
    excessiveScreenTime: boolean;
    unhealthyPattern: boolean;
  };
  recommendations: string[];
};

type NativeScreenTimeModule = {
  hasUsageAccess: () => Promise<boolean>;
  openUsageAccessSettings: () => Promise<void>;
  getUsageStats: (startMs: number, endMs: number) => Promise<AppUsageItem[]>;
};

const DB_NAME = 'screen_time.db';
const CONSENT_KEY = 'screen_time_consent';
const TRACKING_KEY = 'screen_time_tracking_enabled';
const ENCRYPTION_KEY_ALIAS = 'screen_time_encryption_seed';
const INSTALL_TIMESTAMP_KEY = 'app_install_timestamp_ms';
const LATE_NIGHT_THRESHOLD_MS = 45 * 60 * 1000;
const EXCESSIVE_SCREEN_TIME_THRESHOLD_MS = 5 * 60 * 60 * 1000;

const getNativeModule = (): NativeScreenTimeModule | null => {
  return (NativeModules.ScreenTimeModule as NativeScreenTimeModule) ?? null;
};

const openDb = async () => {
  const db = await SQLite.openDatabaseAsync(DB_NAME);
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS usage_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      day TEXT NOT NULL,
      captured_at INTEGER NOT NULL,
      encrypted_payload TEXT NOT NULL,
      synced INTEGER DEFAULT 0
    );
  `);
  return db;
};

const getDayKey = (timestamp: number) => {
  const d = new Date(timestamp);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const toBase64 = (value: string) => {
  if (typeof globalThis.btoa === 'function') {
    return globalThis.btoa(value);
  }
  return value;
};

const fromBase64 = (value: string) => {
  if (typeof globalThis.atob === 'function') {
    return globalThis.atob(value);
  }
  return value;
};

const xorCipher = (text: string, seed: string) => {
  if (!seed.length) return text;
  const chars = [...text].map((ch, i) => String.fromCharCode(ch.charCodeAt(0) ^ seed.charCodeAt(i % seed.length)));
  return chars.join('');
};

const getOrCreateEncryptionSeed = async () => {
  const existing = await SecureStore.getItemAsync(ENCRYPTION_KEY_ALIAS);
  if (existing) return existing;
  const seed = `${Date.now()}_${Math.random().toString(36).slice(2, 15)}`;
  await SecureStore.setItemAsync(ENCRYPTION_KEY_ALIAS, seed);
  return seed;
};

const getOrCreateInstallTimestamp = async () => {
  const existing = await SecureStore.getItemAsync(INSTALL_TIMESTAMP_KEY);
  if (existing) {
    const parsed = Number(existing);
    if (!Number.isNaN(parsed) && parsed > 0) return parsed;
  }
  const now = Date.now();
  await SecureStore.setItemAsync(INSTALL_TIMESTAMP_KEY, String(now));
  return now;
};

const encryptPayload = async (snapshot: UsageSnapshot) => {
  const seed = await getOrCreateEncryptionSeed();
  return toBase64(xorCipher(JSON.stringify(snapshot), seed));
};

const decryptPayload = async (encryptedPayload: string): Promise<UsageSnapshot> => {
  const seed = await getOrCreateEncryptionSeed();
  const json = xorCipher(fromBase64(encryptedPayload), seed);
  return JSON.parse(json) as UsageSnapshot;
};

const aggregateSnapshot = (apps: AppUsageItem[], endMs: number): UsageSnapshot => {
  const totals = apps.reduce(
    (acc, app) => {
      acc.totalScreenTimeMs += app.foregroundTimeMs;
      acc.foregroundTimeMs += app.foregroundTimeMs;
      acc.appOpens += app.opens;
      return acc;
    },
    { totalScreenTimeMs: 0, foregroundTimeMs: 0, appOpens: 0 }
  );

  return {
    capturedAt: endMs,
    day: getDayKey(endMs),
    totalScreenTimeMs: totals.totalScreenTimeMs,
    foregroundTimeMs: totals.foregroundTimeMs,
    appOpens: totals.appOpens,
    apps
  };
};

export const ScreenTimeTracker = {
  isNativeCollectorAvailable() {
    const module = getNativeModule();
    return Platform.OS === 'android' && !!module?.getUsageStats;
  },

  async getConsentStatus() {
    const value = await SecureStore.getItemAsync(CONSENT_KEY);
    return value === 'granted';
  },

  async setConsentStatus(granted: boolean) {
    await SecureStore.setItemAsync(CONSENT_KEY, granted ? 'granted' : 'denied');
    if (!granted) {
      await SecureStore.setItemAsync(TRACKING_KEY, 'false');
    }
  },

  async isTrackingEnabled() {
    const value = await SecureStore.getItemAsync(TRACKING_KEY);
    return value !== 'false';
  },

  async setTrackingEnabled(enabled: boolean) {
    await SecureStore.setItemAsync(TRACKING_KEY, enabled ? 'true' : 'false');
  },

  async hasUsagePermission() {
    if (Platform.OS !== 'android') return false;
    const module = getNativeModule();
    if (!module?.hasUsageAccess) return false;
    return module.hasUsageAccess();
  },

  async requestUsagePermission() {
    if (Platform.OS !== 'android') return;
    const module = getNativeModule();
    if (!module?.openUsageAccessSettings) return;
    await module.openUsageAccessSettings();
  },

  async collectAndStoreSnapshot() {
    const hasConsent = await this.getConsentStatus();
    const trackingEnabled = await this.isTrackingEnabled();
    if (!hasConsent || !trackingEnabled) {
      return null;
    }

    const endMs = Date.now();
    const installTs = await getOrCreateInstallTimestamp();
    const startMs = installTs;
    const module = getNativeModule();
    if (Platform.OS === 'android' && !module?.getUsageStats) {
      // Do not create fake data. Real usage stats require the Android native module.
      return null;
    }
    const apps = await (module?.getUsageStats?.(startMs, endMs) ?? Promise.resolve([]));
    if (!apps.length) {
      return null;
    }
    const snapshot = aggregateSnapshot(apps, endMs);
    const encryptedPayload = await encryptPayload(snapshot);
    const db = await openDb();
    await db.runAsync(
      'INSERT INTO usage_snapshots (day, captured_at, encrypted_payload, synced) VALUES (?, ?, ?, 0)',
      [snapshot.day, snapshot.capturedAt, encryptedPayload]
    );
    return snapshot;
  },

  async getLatestSnapshot() {
    const db = await openDb();
    const row = await db.getFirstAsync<{ encrypted_payload: string }>(
      'SELECT encrypted_payload FROM usage_snapshots ORDER BY captured_at DESC LIMIT 1'
    );
    if (!row?.encrypted_payload) return null;
    return decryptPayload(row.encrypted_payload);
  },

  async getUnsyncedSnapshots() {
    const db = await openDb();
    const rows = await db.getAllAsync<{ id: number; encrypted_payload: string }>(
      'SELECT id, encrypted_payload FROM usage_snapshots WHERE synced = 0 ORDER BY captured_at ASC'
    );
    const snapshots = await Promise.all(rows.map(async (row) => ({ id: row.id, snapshot: await decryptPayload(row.encrypted_payload) })));
    return snapshots;
  },

  async markSynced(ids: number[]) {
    if (!ids.length) return;
    const db = await openDb();
    const placeholders = ids.map(() => '?').join(', ');
    await db.runAsync(`UPDATE usage_snapshots SET synced = 1 WHERE id IN (${placeholders})`, ids);
  },

  async getProcessedInsights(): Promise<ProcessedInsights | null> {
    const latest = await this.getLatestSnapshot();
    if (!latest) return null;
    const db = await openDb();
    const currentDayStart = new Date(new Date().setHours(0, 0, 0, 0)).getTime();
    const weekStart = currentDayStart - 6 * 24 * 60 * 60 * 1000;
    const rows = await db.getAllAsync<{ encrypted_payload: string; captured_at: number }>(
      'SELECT encrypted_payload, captured_at FROM usage_snapshots WHERE captured_at >= ? ORDER BY captured_at DESC',
      [weekStart]
    );
    const weekSnapshots = await Promise.all(rows.map(async (row) => decryptPayload(row.encrypted_payload)));
    const weekByDay = new Map<string, UsageSnapshot>();
    weekSnapshots.forEach((item) => {
      if (!weekByDay.has(item.day)) {
        weekByDay.set(item.day, item);
      }
    });
    const weekTotal = [...weekByDay.values()].reduce((acc, item) => acc + item.totalScreenTimeMs, 0);
    const averageDailyMs = weekByDay.size ? Math.round(weekTotal / weekByDay.size) : 0;
    const topApps = [...latest.apps].sort((a, b) => b.foregroundTimeMs - a.foregroundTimeMs).slice(0, 5);
    const lateNightUsage = latest.apps.reduce((acc, app) => {
      const hour = new Date(app.lastTimeStamp).getHours();
      if (hour >= 23 || hour <= 4) {
        return acc + app.foregroundTimeMs;
      }
      return acc;
    }, 0);
    const excessiveScreenTime = latest.totalScreenTimeMs > EXCESSIVE_SCREEN_TIME_THRESHOLD_MS;
    const unhealthyPattern = lateNightUsage > LATE_NIGHT_THRESHOLD_MS || topApps.some((app) => app.opens > 40);
    const recommendations: string[] = [];
    if (excessiveScreenTime) recommendations.push('Try a 20-minute no-screen break every 2 hours.');
    if (lateNightUsage > LATE_NIGHT_THRESHOLD_MS) recommendations.push('Reduce screen use after 11 PM to improve sleep quality.');
    if (topApps[0]?.foregroundTimeMs > 2 * 60 * 60 * 1000) recommendations.push(`Set a daily timer for ${topApps[0].appName}.`);
    if (!recommendations.length) recommendations.push('Your usage is balanced today. Keep this routine.');

    return {
      dailyReport: {
        date: latest.day,
        totalScreenTimeMs: latest.totalScreenTimeMs,
        foregroundTimeMs: latest.foregroundTimeMs,
        appOpens: latest.appOpens
      },
      weeklyReport: {
        averageDailyMs,
        totalWeekMs: weekTotal
      },
      topApps,
      lateNightUsage: {
        detected: lateNightUsage > LATE_NIGHT_THRESHOLD_MS,
        usageMs: lateNightUsage,
        thresholdMs: LATE_NIGHT_THRESHOLD_MS
      },
      riskSignals: {
        excessiveScreenTime,
        unhealthyPattern
      },
      recommendations
    };
  }
};
