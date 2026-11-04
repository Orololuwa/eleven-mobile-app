const fs = require('fs');
const path = require('path');
const { createRunOncePlugin, withDangerousMod } = require('expo/config-plugins');

const PLUGIN_NAME = 'with-direct-gps';
const MARKER = 'direct-gps request GPS_PROVIDER';
const WAKE_LOCK_MARKER = 'direct-gps session wake lock';
const WAKE_LOCK_SAFE_MARKER = 'direct-gps wake lock unavailable';
const EVERY_FIX_MARKER = 'direct-gps every chip fix';
const MOTION_MARKER = 'session-motion shared sensors';
const SERVICE_STOP_MARKER = 'direct-gps service stop unbinds';
const DIRECT_DELIVERY_MARKER = 'direct-gps delivers without JobScheduler';

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

/*
 * Stage 4 — a 1000 ms request makes LocationManager drop any fix that lands more than ~10% early
 * (jitter rule), turning some 1 s gaps into 2 s. Nike Run Club asks for 10 ms and so keeps every
 * fix the chip produces (still ~1 Hz). Keep the 1 s power hint, accept every fix.
 */
const EVERY_FIX_BEFORE = `          .setMinUpdateDistanceMeters(0f)
          .build()`;

const EVERY_FIX_AFTER = `          .setMinUpdateDistanceMeters(0f)
          // ${EVERY_FIX_MARKER}
          .setMinUpdateIntervalMillis(0L)
          .build()`;

const EVERY_FIX_LEGACY_BEFORE = `GPS_PROVIDER, 1000L, 0f, intent)`;

const EVERY_FIX_LEGACY_AFTER = `GPS_PROVIDER, 0L, 0f, intent)`;

/*
 * Stage 5 — Amendment 03 C2 / C3 motion sensors, read natively rather than through expo-sensors so
 * they keep counting while JS is frozen under lock (the same reason the GPS renew loop lives here).
 * One shared object, `SessionMotion`, owns the listeners: the step counter (TYPE_STEP_COUNTER, else
 * a TYPE_STEP_DETECTOR tally) and the accelerometer at 25 Hz. The session task starts and stops
 * it; *both* fix streams are stamped from it — the direct GPS task on arrival, and the fused
 * foreground watch as each fix goes to JS (indoors the watch is the only stream: 21 Oct parlour
 * walk, every fix `source: watch`). Each stream keeps its own accelerometer window, so a fix's
 * variance covers the time since that stream's previous fix. Both values ride the location bundle
 * as top-level `steps` / `accelVariance`. Step sensors need ACTIVITY_RECOGNITION on Android 10+ —
 * without it they never report and the key is absent.
 */
const SESSION_MOTION_FILE = [
  'android',
  'src',
  'main',
  'java',
  'expo',
  'modules',
  'location',
  'SessionMotion.kt',
];

const MODULE = [
  'android',
  'src',
  'main',
  'java',
  'expo',
  'modules',
  'location',
  'LocationModule.kt',
];

const SESSION_MOTION_SOURCE = `package expo.modules.location

import android.content.Context
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.location.Location
import android.os.BaseBundle
import android.os.Handler
import android.util.Log

/** ${MOTION_MARKER}: written by plugins/with-direct-gps.js (stage 5) — do not edit in node_modules. */
object SessionMotion {
  const val TASK = 0
  const val WATCH = 1
  private const val TAG = "SessionMotion"
  private const val MIN_ACCEL_SAMPLES = 5

  /** Welford accumulator of |a| since the stream's previous fix. */
  private class Window {
    var count = 0
    var mean = 0.0
    var m2 = 0.0
    fun add(value: Double) {
      count += 1
      val delta = value - mean
      mean += delta / count
      m2 += delta * (value - mean)
    }
    fun take(): Double {
      val variance = if (count >= MIN_ACCEL_SAMPLES) m2 / (count - 1) else Double.NaN
      count = 0
      mean = 0.0
      m2 = 0.0
      return variance
    }
  }

  private val lock = Any()
  private var manager: SensorManager? = null
  private var stepTotal: Double? = null
  private var detectorTally = 0.0
  private val windows = arrayOf(Window(), Window())
  private val taskStamps = object : LinkedHashMap<Long, DoubleArray>() {
    override fun removeEldestEntry(eldest: MutableMap.MutableEntry<Long, DoubleArray>?): Boolean =
      size > 2_000
  }

  private val listener = object : SensorEventListener {
    override fun onSensorChanged(event: SensorEvent) {
      synchronized(lock) {
        when (event.sensor.type) {
          Sensor.TYPE_STEP_COUNTER -> stepTotal = event.values[0].toDouble()
          Sensor.TYPE_STEP_DETECTOR -> {
            detectorTally += 1.0
            stepTotal = detectorTally
          }
          Sensor.TYPE_ACCELEROMETER -> {
            val x = event.values[0].toDouble()
            val y = event.values[1].toDouble()
            val z = event.values[2].toDouble()
            val magnitude = Math.sqrt(x * x + y * y + z * z)
            windows.forEach { it.add(magnitude) }
          }
        }
      }
    }

    override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) = Unit
  }

  fun start(context: Context, handler: Handler) {
    synchronized(lock) {
      if (manager != null) return
      val sensors = context.getSystemService(Context.SENSOR_SERVICE) as? SensorManager ?: return
      manager = sensors
      val stepSensor = sensors.getDefaultSensor(Sensor.TYPE_STEP_COUNTER)
        ?: sensors.getDefaultSensor(Sensor.TYPE_STEP_DETECTOR)
      val stepsOn = try {
        stepSensor != null &&
          sensors.registerListener(listener, stepSensor, SensorManager.SENSOR_DELAY_NORMAL, 0, handler)
      } catch (e: SecurityException) {
        Log.w(TAG, "${MOTION_MARKER}: step sensor refused (ACTIVITY_RECOGNITION?)", e)
        false
      }
      val accelerometer = sensors.getDefaultSensor(Sensor.TYPE_ACCELEROMETER)
      val accelOn = accelerometer != null &&
        sensors.registerListener(listener, accelerometer, 40_000, handler)
      Log.i(TAG, "${MOTION_MARKER} started steps=\${if (stepsOn) stepSensor?.name else "off"} accel=$accelOn")
    }
  }

  fun stop() {
    synchronized(lock) {
      manager?.unregisterListener(listener)
      manager = null
      stepTotal = null
      detectorTally = 0.0
      windows.forEach { it.take() }
      taskStamps.clear()
    }
  }

  /** Task stream: snapshot as fixes arrive; they may be reported later (deferred / batched). */
  fun stampTask(locations: List<Location>) {
    synchronized(lock) {
      if (manager == null) return
      val fresh = locations.filter { !taskStamps.containsKey(it.time) }
      if (fresh.isEmpty()) return
      val steps = stepTotal ?: Double.NaN
      val variance = windows[TASK].take()
      for (location in fresh) taskStamps[location.time] = doubleArrayOf(steps, variance)
    }
  }

  fun attachTask(bundle: BaseBundle, location: Location) {
    val stamp = synchronized(lock) { taskStamps.remove(location.time) } ?: return
    put(bundle, stamp[0], stamp[1])
  }

  /** Watch stream: delivered straight to JS, so stamp and attach in one step. */
  fun attachWatch(bundle: BaseBundle) {
    val stamp = synchronized(lock) {
      if (manager == null) return
      doubleArrayOf(stepTotal ?: Double.NaN, windows[WATCH].take())
    }
    put(bundle, stamp[0], stamp[1])
  }

  private fun put(bundle: BaseBundle, steps: Double, variance: Double) {
    if (!steps.isNaN()) bundle.putDouble("steps", steps)
    if (!variance.isNaN()) bundle.putDouble("accelVariance", variance)
  }
}
`;

const MOTION_IMPORT_BEFORE = `import expo.modules.location.LocationHelpers
`;

const MOTION_IMPORT_AFTER = `import expo.modules.location.LocationHelpers
import expo.modules.location.SessionMotion
`;

const MOTION_REGISTER_BEFORE = `    startLocationUpdates()
    startDirectGpsRenew()
  }`;

const MOTION_REGISTER_AFTER = `    startLocationUpdates()
    startDirectGpsRenew()
    // ${MOTION_MARKER}
    context?.let { SessionMotion.start(it.applicationContext, directGpsHandler) }
  }`;

const MOTION_UNREGISTER_BEFORE = `  override fun didUnregister() {
    stopDirectGpsRenew()`;

const MOTION_UNREGISTER_AFTER = `  override fun didUnregister() {
    SessionMotion.stop()
    stopDirectGpsRenew()`;

const MOTION_DEFER_BEFORE = `  private fun deferLocations(locations: List<Location>) {
`;

const MOTION_DEFER_AFTER = `  private fun deferLocations(locations: List<Location>) {
    SessionMotion.stampTask(locations)
`;

const MOTION_REPORT_BEFORE = `        val bundle = LocationResponse(location).toBundle(PersistableBundle::class.java)
        data.add(bundle)`;

const MOTION_REPORT_AFTER = `        val bundle = LocationResponse(location).toBundle(PersistableBundle::class.java)
        SessionMotion.attachTask(bundle, location)
        data.add(bundle)`;

const MOTION_WATCH_BEFORE = `    val responseBundle = bundleOf()
    responseBundle.putBundle("location", response.toBundle(Bundle::class.java))`;

const MOTION_WATCH_AFTER = `    val responseBundle = bundleOf()
    // ${MOTION_MARKER}: fused watch fixes carry steps / stillness too (indoors they are all there is).
    val locationBundle = response.toBundle(Bundle::class.java)
    SessionMotion.attachWatch(locationBundle)
    responseBundle.putBundle("location", locationBundle)`;

/*
 * Stage 6 — the location service outlived the session (4 Nov run: foreground, notification up,
 * no GPS, three hours after End). The consumer binds to the service and never unbinds, and
 * `stopSelf()` does not destroy a bound service. When Android later recreated it, the open binding
 * fired `onServiceConnected` again and promoted it back to the foreground. Stop now unbinds and
 * stops the service outright, and a connection that lands after unregister stops instead.
 */
const SERVICE_FIELD_BEFORE = `  private var mService: LocationTaskService? = null`;

const SERVICE_FIELD_AFTER = `  private var mService: LocationTaskService? = null
  /** ${SERVICE_STOP_MARKER}: held so stop can unbind (stopSelf alone leaves it bound). */
  private var mServiceConnection: ServiceConnection? = null`;

const SERVICE_BIND_BEFORE = `      context.bindService(
        serviceIntent,
        object : ServiceConnection {
          override fun onServiceConnected(name: ComponentName, service: IBinder) {
            mService = (service as? ServiceBinder)?.service`;

const SERVICE_BIND_AFTER = `      val connection = object : ServiceConnection {
          override fun onServiceConnected(name: ComponentName, service: IBinder) {
            if (mServiceConnection !== this) {
              // Unregistered before the bind landed (stop already ran), or a newer bind owns the
              // service: let go of this binding and never go foreground from it.
              if (mTask == null) (service as? ServiceBinder)?.service?.stop()
              runCatching { context?.unbindService(this) }
              return
            }
            mService = (service as? ServiceBinder)?.service`;

const SERVICE_BIND_END_BEFORE = `          override fun onServiceDisconnected(name: ComponentName) {
            mService?.stop()
            mService = null
          }
        },
        Context.BIND_AUTO_CREATE
      )`;

const SERVICE_BIND_END_AFTER = `          override fun onServiceDisconnected(name: ComponentName) {
            mService?.stop()
            mService = null
          }
        }
      mServiceConnection = connection
      context.bindService(serviceIntent, connection, Context.BIND_AUTO_CREATE)`;

const SERVICE_STOP_BEFORE = `  private fun stopForegroundService() {
    mService?.stop()
  }`;

const SERVICE_STOP_AFTER = `  private fun stopForegroundService() {
    mService?.stop()
    mService = null
    val connection = mServiceConnection
    mServiceConnection = null
    val appContext = context ?: return
    connection?.let { runCatching { appContext.unbindService(it) } }
    runCatching { appContext.stopService(Intent(appContext, LocationTaskService::class.java)) }
  }`;

/*
 * Stage 7 — upstream hands every fix to JS through JobScheduler: each delivery cancels the pending
 * job and reschedules it with all its earlier fixes plus the new one. When Android holds the job
 * back (an app off the battery whitelist), that bundle grows by a fix a second and every delivery
 * unparcels and re-parcels it on the main thread. On 4 Nov the main thread was inside
 * `TaskManagerUtils.updateOrScheduleJob` when Android raised "No response to onStartJob" and killed
 * the app — twice in one run. The session's foreground service keeps the process alive, so deliver
 * straight to the task instead (`Task.execute` runs it now, or loads the app headless and queues).
 */
const DIRECT_DELIVERY_BEFORE = `      // Schedule new job.
      taskManagerUtils.scheduleJob(context, mTask, data)`;

const DIRECT_DELIVERY_AFTER = `      // ${DIRECT_DELIVERY_MARKER}: O(1) per fix, nothing piles up when jobs are deferred.
      val locationBundles = ArrayList<Bundle>()
      for (persistable in data) {
        val coordsBundle = Bundle()
        persistable.getPersistableBundle("coords")?.let { coordsBundle.putAll(it) }
        val locationBundle = Bundle()
        locationBundle.putAll(persistable)
        locationBundle.putBundle("coords", coordsBundle)
        locationBundles.add(locationBundle)
      }
      executeTaskWithLocationBundles(locationBundles) { }`;

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

const patchEveryFix = (filePath) => {
  if (fs.readFileSync(filePath, 'utf8').includes(EVERY_FIX_MARKER)) return;
  replaceOnce({ filePath, before: EVERY_FIX_BEFORE, after: EVERY_FIX_AFTER, label: 'every fix' });
  replaceOnce({
    filePath,
    before: EVERY_FIX_LEGACY_BEFORE,
    after: EVERY_FIX_LEGACY_AFTER,
    label: 'every fix legacy',
  });
};

const patchMotionSensors = (packageRoot) => {
  // Always rewritten: it is ours, not a patch of upstream code.
  fs.writeFileSync(path.join(packageRoot, ...SESSION_MOTION_FILE), SESSION_MOTION_SOURCE);

  const consumer = path.join(packageRoot, ...CONSUMER);
  if (!fs.readFileSync(consumer, 'utf8').includes(MOTION_MARKER)) {
    [
      [MOTION_IMPORT_BEFORE, MOTION_IMPORT_AFTER, 'motion import'],
      [MOTION_REGISTER_BEFORE, MOTION_REGISTER_AFTER, 'motion register'],
      [MOTION_UNREGISTER_BEFORE, MOTION_UNREGISTER_AFTER, 'motion unregister'],
      [MOTION_DEFER_BEFORE, MOTION_DEFER_AFTER, 'motion stamp'],
      [MOTION_REPORT_BEFORE, MOTION_REPORT_AFTER, 'motion attach'],
    ].forEach(([before, after, label]) =>
      replaceOnce({ filePath: consumer, before, after, label }),
    );
  }

  const module = path.join(packageRoot, ...MODULE);
  if (!fs.readFileSync(module, 'utf8').includes(MOTION_MARKER)) {
    replaceOnce({
      filePath: module,
      before: MOTION_WATCH_BEFORE,
      after: MOTION_WATCH_AFTER,
      label: 'motion watch',
    });
  }
};

const patchServiceStop = (filePath) => {
  if (fs.readFileSync(filePath, 'utf8').includes(SERVICE_STOP_MARKER)) return;
  [
    [SERVICE_FIELD_BEFORE, SERVICE_FIELD_AFTER, 'service field'],
    [SERVICE_BIND_BEFORE, SERVICE_BIND_AFTER, 'service bind'],
    [SERVICE_BIND_END_BEFORE, SERVICE_BIND_END_AFTER, 'service bind end'],
    [SERVICE_STOP_BEFORE, SERVICE_STOP_AFTER, 'service stop'],
  ].forEach(([before, after, label]) => replaceOnce({ filePath, before, after, label }));
};

const patchDirectDelivery = (filePath) => {
  if (fs.readFileSync(filePath, 'utf8').includes(DIRECT_DELIVERY_MARKER)) return;
  replaceOnce({
    filePath,
    before: DIRECT_DELIVERY_BEFORE,
    after: DIRECT_DELIVERY_AFTER,
    label: 'direct delivery',
  });
};

const patchAndroid = (projectRoot) => {
  const packageRoot = path.join(projectRoot, 'node_modules', 'expo-location');
  const filePath = path.join(packageRoot, ...CONSUMER);
  patchDirectGps(filePath);
  patchWakeLock(filePath);
  patchWakeLockSafe(filePath);
  patchEveryFix(filePath);
  patchMotionSensors(packageRoot);
  patchServiceStop(filePath);
  patchDirectDelivery(filePath);
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
