# Screen Time Tracking Integration (Android + React Native)

## Required Android APIs

- `UsageStatsManager` for usage duration and app opens
- `UsageEvents` for foreground and open-event analysis
- `AppOpsManager` to verify usage-access state
- `WorkManager` (optional native alternative) for periodic sync in fully native builds

## Required Permissions

In `AndroidManifest.xml`:

```xml
<uses-permission android:name="android.permission.PACKAGE_USAGE_STATS" tools:ignore="ProtectedPermissions" />
<uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />
```

In Expo config (`app.json`), include:

- `android.permission.PACKAGE_USAGE_STATS`
- `android.permission.RECEIVE_BOOT_COMPLETED`

## Kotlin Native Module Example

```kotlin
package com.mindmitra.screentime

import android.app.AppOpsManager
import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.os.Process
import android.provider.Settings
import com.facebook.react.bridge.*
import java.util.concurrent.TimeUnit

class ScreenTimeModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "ScreenTimeModule"

  @ReactMethod
  fun hasUsageAccess(promise: Promise) {
    val appOps = reactContext.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
    val mode = appOps.checkOpNoThrow(
      AppOpsManager.OPSTR_GET_USAGE_STATS,
      Process.myUid(),
      reactContext.packageName
    )
    promise.resolve(mode == AppOpsManager.MODE_ALLOWED)
  }

  @ReactMethod
  fun openUsageAccessSettings(promise: Promise) {
    val intent = Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS).apply {
      addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    }
    reactContext.startActivity(intent)
    promise.resolve(true)
  }

  @ReactMethod
  fun getUsageStats(startMs: Double, endMs: Double, promise: Promise) {
    try {
      val usageStatsManager = reactContext.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
      val stats = usageStatsManager.queryAndAggregateUsageStats(startMs.toLong(), endMs.toLong())
      val events = usageStatsManager.queryEvents(startMs.toLong(), endMs.toLong())

      val openCounts = mutableMapOf<String, Int>()
      val event = UsageEvents.Event()
      while (events.hasNextEvent()) {
        events.getNextEvent(event)
        if (event.eventType == UsageEvents.Event.ACTIVITY_RESUMED ||
            event.eventType == UsageEvents.Event.MOVE_TO_FOREGROUND) {
          val pkg = event.packageName ?: continue
          openCounts[pkg] = (openCounts[pkg] ?: 0) + 1
        }
      }

      val arr = Arguments.createArray()
      stats.forEach { (pkg, stat) ->
        val item = Arguments.createMap()
        item.putString("packageName", pkg)
        item.putString("appName", pkg)
        item.putDouble("foregroundTimeMs", stat.totalTimeInForeground.toDouble())
        item.putInt("opens", openCounts[pkg] ?: 0)
        item.putDouble("firstTimeStamp", stat.firstTimeStamp.toDouble())
        item.putDouble("lastTimeStamp", stat.lastTimeStamp.toDouble())
        arr.pushMap(item)
      }
      promise.resolve(arr)
    } catch (e: Exception) {
      promise.reject("USAGE_STATS_ERROR", e)
    }
  }
}
```

## React Native Bridge Usage

```ts
import { NativeModules } from 'react-native';

const { ScreenTimeModule } = NativeModules;

const hasAccess = await ScreenTimeModule.hasUsageAccess();
if (!hasAccess) {
  await ScreenTimeModule.openUsageAccessSettings();
}

const now = Date.now();
const startOfDay = new Date(new Date(now).setHours(0, 0, 0, 0)).getTime();
const stats = await ScreenTimeModule.getUsageStats(startOfDay, now);
```

## Data Model Collected

- Total daily screen time (sum foreground)
- Individual app usage duration
- App opens count
- Foreground usage time
- Daily + weekly derived metrics
- Late-night usage pattern flags

## Privacy + Security Checklist

- Show explicit consent prompt before first tracking
- Allow runtime disable from profile/privacy settings
- Keep local data encrypted before persistence
- Sync only consented data to backend (`/screen-time/sync`)
