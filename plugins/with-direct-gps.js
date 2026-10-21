const fs = require('fs');
const path = require('path');
const { createRunOncePlugin, withDangerousMod } = require('expo/config-plugins');

const PLUGIN_NAME = 'with-direct-gps';
const MARKER = 'direct-gps request GPS_PROVIDER';
const WAKE_LOCK_MARKER = 'direct-gps session wake lock';
const WAKE_LOCK_SAFE_MARKER = 'direct-gps wake lock unavailable';

const CONSUMER = [
  'android',
  'src',
  'main',
  'java',
  'expo',
  'modules',
  'location',
  'taskConsumers',
  'LocationTaskConsumer.kt',
];

const IMPORT_BEFORE = `import android.location.Location
import android.os.Build
import android.os.Bundle
import android.os.IBinder`;

const IMPORT_AFTER = `import android.location.Location
import android.location.LocationManager
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.IBinder
import android.os.Looper`;

const FIELDS_BEFORE = `  private var mIsHostPaused = true
  private val mLocationClient: FusedLocationProviderClient by lazy {
    LocationServices.getFusedLocationProviderClient(context)
  }`;

const FIELDS_AFTER = `  private var mIsHostPaused = true
  private val mLocationClient: FusedLocationProviderClient by lazy {
    LocationServices.getFusedLocationProviderClient(context)
  }
  /** direct-gps: native renew so a locked screen (JS frozen) can re-subscribe. */
  private val directGpsHandler = Handler(Looper.getMainLooper())
  private var directGpsRenewArmed = false
  private var lastDirectFixAtMs = 0L
  private val directGpsRenew = object : Runnable {
    override fun run() {
      val stale = System.currentTimeMillis() - lastDirectFixAtMs > 10_000L
      if (stale && mPendingIntent != null) {
        Log.i(TAG, "direct-gps renew — no fix within 10s")
        requestDirectGps()
      }
      if (directGpsRenewArmed) {
        directGpsHandler.postDelayed(this, 5_000L)
      }
    }
  }`;

const REGISTER_BEFORE = `  override fun didRegister(task: TaskInterface) {
    mTask = task
    startLocationUpdates()
    maybeStartForegroundService()
  }

  override fun didUnregister() {
    stopLocationUpdates()
    stopForegroundService()
    mTask = null
    mPendingIntent = null
    mLocationRequest = null
  }`;

const REGISTER_AFTER = `  override fun didRegister(task: TaskInterface) {
    mTask = task
    maybeStartForegroundService()
    startLocationUpdates()
    startDirectGpsRenew()
  }

  override fun didUnregister() {
    stopDirectGpsRenew()
    stopLocationUpdates()
    stopForegroundService()
    mTask = null
    mPendingIntent = null
    mLocationRequest = null
  }`;

const BROADCAST_BEFORE = `  override fun didReceiveBroadcast(intent: Intent) {
    mTask ?: return
    val result = LocationResult.extractResult(intent)
    if (result != null) {
      val locations = result.locations
      deferLocations(locations)
      maybeReportDeferredLocations()
    } else {`;

const BROADCAST_AFTER = `  override fun didReceiveBroadcast(intent: Intent) {
    mTask ?: return
    @Suppress("DEPRECATION")
    val direct = intent.getParcelableExtra<Location>(LocationManager.KEY_LOCATION_CHANGED)
    if (direct != null) {
      lastDirectFixAtMs = System.currentTimeMillis()
      deferLocations(listOf(direct))
      maybeReportDeferredLocations()
      return
    }
    val result = LocationResult.extractResult(intent)
    if (result != null) {
      lastDirectFixAtMs = System.currentTimeMillis()
      val locations = result.locations
      deferLocations(locations)
      maybeReportDeferredLocations()
    } else {`;

const START_BEFORE = `  private fun startLocationUpdates() {
    val context = context ?: run {
      Log.w(TAG, "The context has been abandoned")
      return
    }

    if (!LocationHelpers.isAnyProviderAvailable(context)) {
      Log.w(TAG, "There is no location provider available")
      return
    }
    val task = mTask ?: run {
      Log.w(TAG, "Could not find a location task for the location update")
      return
    }
    mLocationRequest = LocationHelpers.prepareLocationRequest(LocationOptions(task.options))
    mPendingIntent = preparePendingIntent()

    val locationRequest = mLocationRequest ?: run {
      Log.w(TAG, "Could not find a location request for the location update")
      return
    }
    val intent = mPendingIntent ?: run {
      Log.w(TAG, "Could not find intent for the location update")
      return
    }

    try {
      mLocationClient.requestLocationUpdates(locationRequest, intent)
    } catch (e: SecurityException) {
      Log.w(TAG, "Location request has been rejected.", e)
    }
  }

  private fun stopLocationUpdates() {
    mPendingIntent?.let {
      mLocationClient.removeLocationUpdates(it)
      it.cancel()
    }
  }`;

const START_AFTER = `  private fun startLocationUpdates() {
    val context = context ?: run {
      Log.w(TAG, "The context has been abandoned")
      return
    }

    if (!LocationHelpers.isAnyProviderAvailable(context)) {
      Log.w(TAG, "There is no location provider available")
      return
    }
    val task = mTask ?: run {
      Log.w(TAG, "Could not find a location task for the location update")
      return
    }
    mLocationRequest = LocationHelpers.prepareLocationRequest(LocationOptions(task.options))
    mPendingIntent = preparePendingIntent()
    requestDirectGps()
  }

  /** Session GPS is owned by this app (LocationManager), not Play Services fused. */
  private fun requestDirectGps() {
    val appContext = context ?: return
    val intent = mPendingIntent ?: return
    val manager = appContext.getSystemService(Context.LOCATION_SERVICE) as LocationManager
    if (!manager.isProviderEnabled(LocationManager.GPS_PROVIDER)) {
      Log.w(TAG, "direct-gps GPS provider disabled")
      return
    }
    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        val request = android.location.LocationRequest.Builder(1000L)
          .setQuality(android.location.LocationRequest.QUALITY_HIGH_ACCURACY)
          .setMinUpdateDistanceMeters(0f)
          .build()
        manager.requestLocationUpdates(LocationManager.GPS_PROVIDER, request, intent)
      } else {
        @Suppress("DEPRECATION")
        manager.requestLocationUpdates(LocationManager.GPS_PROVIDER, 1000L, 0f, intent)
      }
      lastDirectFixAtMs = System.currentTimeMillis()
      Log.i(TAG, "${MARKER}")
    } catch (e: SecurityException) {
      Log.w(TAG, "direct-gps request rejected", e)
    }
  }

  private fun startDirectGpsRenew() {
    if (directGpsRenewArmed) return
    directGpsRenewArmed = true
    directGpsHandler.postDelayed(directGpsRenew, 5_000L)
  }

  private fun stopDirectGpsRenew() {
    directGpsRenewArmed = false
    directGpsHandler.removeCallbacks(directGpsRenew)
  }

  private fun stopLocationUpdates() {
    val appContext = context
    mPendingIntent?.let {
      if (appContext != null) {
        val manager = appContext.getSystemService(Context.LOCATION_SERVICE) as LocationManager
        manager.removeUpdates(it)
      }
      mLocationClient.removeLocationUpdates(it)
      it.cancel()
    }
  }`;

/*
 * Stage 2 — applied on top of stage 1's output (also to trees patched before this stage existed).
 * Without a wake lock the renew Handler does not run while the CPU sleeps: once the GPS listener is
 * gone nothing wakes the process, so a locked phone never re-subscribes until the screen comes on.
 * The lock is re-armed on every renew tick with a timeout, so it lapses if the loop ever stops.
 */
const WAKE_IMPORT_BEFORE = `import android.os.Looper`;

const WAKE_IMPORT_AFTER = `import android.os.Looper
import android.os.PowerManager`;

const WAKE_FIELDS_BEFORE = `  private var lastDirectFixAtMs = 0L
  private val directGpsRenew = object : Runnable {
    override fun run() {`;

const WAKE_FIELDS_AFTER = `  private var lastDirectFixAtMs = 0L
  /** ${WAKE_LOCK_MARKER}: keeps the renew loop running under lock. */
  private var sessionWakeLock: PowerManager.WakeLock? = null
  private fun holdSessionWakeLock() {
    val appContext = context ?: return
    val lock = sessionWakeLock ?: (appContext.getSystemService(Context.POWER_SERVICE) as PowerManager)
      .newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "eleven:session-gps")
      .also {
        it.setReferenceCounted(false)
        sessionWakeLock = it
      }
    lock.acquire(10 * 60 * 1000L)
  }
  private fun releaseSessionWakeLock() {
    sessionWakeLock?.let { if (it.isHeld) it.release() }
    sessionWakeLock = null
  }
  private val directGpsRenew = object : Runnable {
    override fun run() {
      if (directGpsRenewArmed) holdSessionWakeLock()`;

const WAKE_START_BEFORE = `    directGpsRenewArmed = true
    directGpsHandler.postDelayed(directGpsRenew, 5_000L)`;

const WAKE_START_AFTER = `    directGpsRenewArmed = true
    holdSessionWakeLock()
    directGpsHandler.postDelayed(directGpsRenew, 5_000L)`;

const WAKE_STOP_BEFORE = `    directGpsRenewArmed = false
    directGpsHandler.removeCallbacks(directGpsRenew)`;

const WAKE_STOP_AFTER = `    directGpsRenewArmed = false
    directGpsHandler.removeCallbacks(directGpsRenew)
    releaseSessionWakeLock()`;

/*
 * Stage 3 — a missing WAKE_LOCK permission (stale prebuild manifest) made acquire() throw inside
 * didRegister, rejecting startLocationUpdatesAsync and leaving the renew loop unarmed (20 Oct dev
 * build). The lock is best-effort; the renew loop must arm regardless.
 */
const WAKE_SAFE_BEFORE = `    lock.acquire(10 * 60 * 1000L)
  }`;

const WAKE_SAFE_AFTER = `    try {
      lock.acquire(10 * 60 * 1000L)
    } catch (e: SecurityException) {
      Log.w(TAG, "${WAKE_LOCK_SAFE_MARKER} — renew runs only while the CPU is awake", e)
    }
  }`;

const WAKE_SAFE_START_BEFORE = `    directGpsRenewArmed = true
    holdSessionWakeLock()
    directGpsHandler.postDelayed(directGpsRenew, 5_000L)`;

const WAKE_SAFE_START_AFTER = `    directGpsRenewArmed = true
    directGpsHandler.postDelayed(directGpsRenew, 5_000L)
    holdSessionWakeLock()`;

const replaceOnce = ({ filePath, before, after, label }) => {
  const contents = fs.readFileSync(filePath, 'utf8');
  if (!contents.includes(before)) {
    throw new Error(`${PLUGIN_NAME}: could not find ${label} in ${filePath}`);
  }
  fs.writeFileSync(filePath, contents.replace(before, after));
};

const patchDirectGps = (filePath) => {
  if (fs.readFileSync(filePath, 'utf8').includes(MARKER)) return;
  replaceOnce({ filePath, before: IMPORT_BEFORE, after: IMPORT_AFTER, label: 'imports' });
  replaceOnce({ filePath, before: FIELDS_BEFORE, after: FIELDS_AFTER, label: 'fields' });
  replaceOnce({ filePath, before: REGISTER_BEFORE, after: REGISTER_AFTER, label: 'register' });
  replaceOnce({ filePath, before: BROADCAST_BEFORE, after: BROADCAST_AFTER, label: 'broadcast' });
  replaceOnce({ filePath, before: START_BEFORE, after: START_AFTER, label: 'start/stop' });
};

const patchWakeLock = (filePath) => {
  if (fs.readFileSync(filePath, 'utf8').includes(WAKE_LOCK_MARKER)) return;
  replaceOnce({
    filePath,
    before: WAKE_IMPORT_BEFORE,
    after: WAKE_IMPORT_AFTER,
    label: 'wake imports',
  });
  replaceOnce({
    filePath,
    before: WAKE_FIELDS_BEFORE,
    after: WAKE_FIELDS_AFTER,
    label: 'wake fields',
  });
  replaceOnce({
    filePath,
    before: WAKE_START_BEFORE,
    after: WAKE_START_AFTER,
    label: 'wake start',
  });
  replaceOnce({ filePath, before: WAKE_STOP_BEFORE, after: WAKE_STOP_AFTER, label: 'wake stop' });
};

const patchWakeLockSafe = (filePath) => {
  if (fs.readFileSync(filePath, 'utf8').includes(WAKE_LOCK_SAFE_MARKER)) return;
  replaceOnce({ filePath, before: WAKE_SAFE_BEFORE, after: WAKE_SAFE_AFTER, label: 'wake safe' });
  replaceOnce({
    filePath,
    before: WAKE_SAFE_START_BEFORE,
    after: WAKE_SAFE_START_AFTER,
    label: 'wake safe start',
  });
};

const patchAndroid = (projectRoot) => {
  const filePath = path.join(projectRoot, 'node_modules', 'expo-location', ...CONSUMER);
  patchDirectGps(filePath);
  patchWakeLock(filePath);
  patchWakeLockSafe(filePath);
};

/** @type {import('expo/config-plugins').ConfigPlugin} */
const withDirectGps = (config) =>
  withDangerousMod(config, [
    'android',
    async (modConfig) => {
      patchAndroid(modConfig.modRequest.projectRoot);
      return modConfig;
    },
  ]);

const plugin = createRunOncePlugin(withDirectGps, PLUGIN_NAME, '1.0.0');
plugin.patchAndroid = patchAndroid;
module.exports = plugin;
