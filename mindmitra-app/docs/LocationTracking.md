# Automatic GPS Tracking + Place Insights

## Implementation Steps

1. Ask explicit user consent for location tracking before collecting GPS.
2. Request runtime location permissions:
   - Foreground (`ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION`)
   - Background (`ACCESS_BACKGROUND_LOCATION`)
3. Start continuous location updates in background every 5-10 minutes.
4. Store encrypted location points locally (lat, lon, timestamp).
5. Reverse geocode coordinates into real places (Nominatim/Google Geocoding).
6. Detect stays longer than threshold (10-15 min) and create visited-place entries.
7. Cluster nearby points (~100-150m) to avoid duplicate places.
8. Build daily timeline + frequent places + movement patterns.
9. Sync processed points and visits to FastAPI backend.
10. Allow pause/disable anytime from privacy settings.

## Required APIs and Permissions

### Android APIs

- `FusedLocationProviderClient` (native Android efficient GPS stream)
- `LocationRequest` + `LocationCallback`
- `Geocoder` or external geocoding API
- `ForegroundService` / `WorkManager` for robust background handling

### Permissions

```xml
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION" />
```

## Kotlin Sample (FusedLocationProviderClient + RN Bridge)

```kotlin
package com.mindmitra.location

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.location.Location
import com.facebook.react.bridge.*
import com.google.android.gms.location.*

class LocationTrackingModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  private val fusedClient = LocationServices.getFusedLocationProviderClient(reactContext)
  private var callback: LocationCallback? = null

  override fun getName(): String = "LocationTrackingModule"

  @SuppressLint("MissingPermission")
  @ReactMethod
  fun startTracking(intervalMs: Double, promise: Promise) {
    val request = LocationRequest.Builder(
      Priority.PRIORITY_BALANCED_POWER_ACCURACY,
      intervalMs.toLong()
    ).setMinUpdateIntervalMillis((intervalMs / 2).toLong()).build()

    callback = object : LocationCallback() {
      override fun onLocationResult(result: LocationResult) {
        val arr = Arguments.createArray()
        for (loc in result.locations) {
          val map = Arguments.createMap()
          map.putDouble("latitude", loc.latitude)
          map.putDouble("longitude", loc.longitude)
          map.putDouble("timestamp", loc.time.toDouble())
          arr.pushMap(map)
        }
        reactContext
          .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
          .emit("onLocationBatch", arr)
      }
    }

    fusedClient.requestLocationUpdates(request, callback!!, reactContext.mainLooper)
    promise.resolve(true)
  }

  @ReactMethod
  fun stopTracking(promise: Promise) {
    callback?.let { fusedClient.removeLocationUpdates(it) }
    callback = null
    promise.resolve(true)
  }
}
```

## React Native Bridge Usage

```ts
import { NativeModules, NativeEventEmitter } from 'react-native';

const { LocationTrackingModule } = NativeModules;
const emitter = new NativeEventEmitter(LocationTrackingModule);

await LocationTrackingModule.startTracking(5 * 60 * 1000);
const sub = emitter.addListener('onLocationBatch', (batch) => {
  // Save, cluster, reverse geocode, detect visits
});
```

## FastAPI + PostgreSQL Data Schema

### SQL

```sql
CREATE TABLE location_points (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  ts TIMESTAMPTZ NOT NULL,
  source TEXT DEFAULT 'mobile',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE visited_places (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  place_name TEXT NOT NULL,
  category TEXT NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  entry_time TIMESTAMPTZ NOT NULL,
  exit_time TIMESTAMPTZ NOT NULL,
  duration_seconds INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_location_points_user_ts ON location_points (user_id, ts DESC);
CREATE INDEX idx_visited_places_user_entry ON visited_places (user_id, entry_time DESC);
```

### FastAPI Models

```python
from pydantic import BaseModel
from typing import List

class LocationPointIn(BaseModel):
    latitude: float
    longitude: float
    timestamp: int

class VisitedPlaceIn(BaseModel):
    placeName: str
    category: str
    latitude: float
    longitude: float
    entryTime: int
    exitTime: int
    durationMs: int

class LocationSyncIn(BaseModel):
    user_id: str
    session_id: str
    points: List[LocationPointIn]
    visits: List[VisitedPlaceIn]
```
