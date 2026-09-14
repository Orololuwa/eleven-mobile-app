const fs = require('fs');
const path = require('path');
const { createRunOncePlugin, withDangerousMod } = require('expo/config-plugins');

const PLUGIN_NAME = 'with-speed-accuracy';
const MARKER = 'speedAccuracy';

const IOS_SWIFT_BEFORE = `internal func exportLocation(_ location: CLLocation) -> [String: Any] {
  return [
    "coords": [
      "latitude": location.coordinate.latitude,
      "longitude": location.coordinate.longitude,
      "altitude": location.altitude,
      "accuracy": location.horizontalAccuracy,
      "altitudeAccuracy": location.verticalAccuracy,
      "heading": location.course,
      "speed": location.speed
    ],
    "timestamp": location.timestamp.timeIntervalSince1970 * 1000
  ]
}`;

const IOS_SWIFT_AFTER = `internal func exportLocation(_ location: CLLocation) -> [String: Any] {
  // ${MARKER}: include OS speed accuracy when valid (>= 0)
  var coords: [String: Any] = [
    "latitude": location.coordinate.latitude,
    "longitude": location.coordinate.longitude,
    "altitude": location.altitude,
    "accuracy": location.horizontalAccuracy,
    "altitudeAccuracy": location.verticalAccuracy,
    "heading": location.course,
    "speed": location.speed
  ]
  if location.speedAccuracy >= 0 {
    coords["speedAccuracy"] = location.speedAccuracy
  }
  return [
    "coords": coords,
    "timestamp": location.timestamp.timeIntervalSince1970 * 1000
  ]
}`;

const IOS_OBJC_BEFORE = `+ (NSDictionary *)exportLocation:(CLLocation *)location
{
  return @{
    @"coords": @{
        @"latitude": @(location.coordinate.latitude),
        @"longitude": @(location.coordinate.longitude),
        @"altitude": @(location.altitude),
        @"accuracy": @(location.horizontalAccuracy),
        @"altitudeAccuracy": @(location.verticalAccuracy),
        @"heading": @(location.course),
        @"speed": @(location.speed),
        },
    @"timestamp": @([location.timestamp timeIntervalSince1970] * 1000),
    };
}`;

const IOS_OBJC_AFTER = `+ (NSDictionary *)exportLocation:(CLLocation *)location
{
  // ${MARKER}: include OS speed accuracy when valid (>= 0)
  NSMutableDictionary *coords = [@{
    @"latitude": @(location.coordinate.latitude),
    @"longitude": @(location.coordinate.longitude),
    @"altitude": @(location.altitude),
    @"accuracy": @(location.horizontalAccuracy),
    @"altitudeAccuracy": @(location.verticalAccuracy),
    @"heading": @(location.course),
    @"speed": @(location.speed),
  } mutableCopy];
  if (location.speedAccuracy >= 0) {
    coords[@"speedAccuracy"] = @(location.speedAccuracy);
  }
  return @{
    @"coords": coords,
    @"timestamp": @([location.timestamp timeIntervalSince1970] * 1000),
  };
}`;

const ANDROID_CLASS_BEFORE = `internal class LocationObjectCoords(
  @Field var latitude: Double? = null,
  @Field var longitude: Double? = null,
  @Field var altitude: Double? = null,
  @Field var accuracy: Double? = null,
  @Field var altitudeAccuracy: Double? = null,
  @Field var heading: Double? = null,
  @Field var speed: Double? = null
) : Record, Serializable {
  constructor(location: Location) : this(
    latitude = location.latitude,
    longitude = location.longitude,
    altitude = location.altitude,
    accuracy = location.accuracy.toDouble(),
    altitudeAccuracy = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      location.verticalAccuracyMeters.toDouble()
    } else {
      null
    },
    heading = location.bearing.toDouble(),
    speed = location.speed.toDouble()
  )

  internal fun <BundleType : BaseBundle> toBundle(bundleTypeClass: Class<BundleType>): BundleType {
    val bundle: BundleType = when (bundleTypeClass) {
      PersistableBundle::class.java -> PersistableBundle()
      else -> Bundle()
    } as? BundleType
      ?: throw ConversionException(LocationObjectCoords::class.java, bundleTypeClass, "Requested an unsupported bundle type")

    bundle.apply {
      latitude?.let { putDouble("latitude", it) }
      longitude?.let { putDouble("longitude", it) }
      altitude?.let { putDouble("altitude", it) }
      accuracy?.let { putDouble("accuracy", it) }
      altitudeAccuracy?.let { putDouble("altitudeAccuracy", it) }
      heading?.let { putDouble("heading", it) }
      speed?.let { putDouble("speed", it) }
    }
    return bundle
  }
}`;

const ANDROID_CLASS_AFTER = `internal class LocationObjectCoords(
  @Field var latitude: Double? = null,
  @Field var longitude: Double? = null,
  @Field var altitude: Double? = null,
  @Field var accuracy: Double? = null,
  @Field var altitudeAccuracy: Double? = null,
  @Field var heading: Double? = null,
  @Field var speed: Double? = null,
  // ${MARKER}: OS speed accuracy (API 26+)
  @Field var speedAccuracy: Double? = null
) : Record, Serializable {
  constructor(location: Location) : this(
    latitude = location.latitude,
    longitude = location.longitude,
    altitude = location.altitude,
    accuracy = location.accuracy.toDouble(),
    altitudeAccuracy = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      location.verticalAccuracyMeters.toDouble()
    } else {
      null
    },
    heading = location.bearing.toDouble(),
    speed = location.speed.toDouble(),
    speedAccuracy = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && location.hasSpeedAccuracy()) {
      location.speedAccuracyMetersPerSecond.toDouble()
    } else {
      null
    }
  )

  internal fun <BundleType : BaseBundle> toBundle(bundleTypeClass: Class<BundleType>): BundleType {
    val bundle: BundleType = when (bundleTypeClass) {
      PersistableBundle::class.java -> PersistableBundle()
      else -> Bundle()
    } as? BundleType
      ?: throw ConversionException(LocationObjectCoords::class.java, bundleTypeClass, "Requested an unsupported bundle type")

    bundle.apply {
      latitude?.let { putDouble("latitude", it) }
      longitude?.let { putDouble("longitude", it) }
      altitude?.let { putDouble("altitude", it) }
      accuracy?.let { putDouble("accuracy", it) }
      altitudeAccuracy?.let { putDouble("altitudeAccuracy", it) }
      heading?.let { putDouble("heading", it) }
      speed?.let { putDouble("speed", it) }
      speedAccuracy?.let { putDouble("speedAccuracy", it) }
    }
    return bundle
  }
}`;

const replaceOnce = ({ filePath, before, after, label }) => {
  const contents = fs.readFileSync(filePath, 'utf8');
  if (contents.includes(MARKER)) return;
  if (!contents.includes(before)) {
    throw new Error(`${PLUGIN_NAME}: could not find ${label} in ${filePath}`);
  }
  fs.writeFileSync(filePath, contents.replace(before, after));
};

const patchIos = (projectRoot) => {
  const packageRoot = path.join(projectRoot, 'node_modules', 'expo-location');
  replaceOnce({
    filePath: path.join(packageRoot, 'ios', 'LocationUtils.swift'),
    before: IOS_SWIFT_BEFORE,
    after: IOS_SWIFT_AFTER,
    label: 'LocationUtils.swift exportLocation',
  });
  replaceOnce({
    filePath: path.join(packageRoot, 'ios', 'EXLocation.m'),
    before: IOS_OBJC_BEFORE,
    after: IOS_OBJC_AFTER,
    label: 'EXLocation.m exportLocation',
  });
};

const patchAndroid = (projectRoot) => {
  const filePath = path.join(
    projectRoot,
    'node_modules',
    'expo-location',
    'android',
    'src',
    'main',
    'java',
    'expo',
    'modules',
    'location',
    'records',
    'LocationResults.kt',
  );
  replaceOnce({
    filePath,
    before: ANDROID_CLASS_BEFORE,
    after: ANDROID_CLASS_AFTER,
    label: 'LocationObjectCoords',
  });
};

/** @type {import('expo/config-plugins').ConfigPlugin} */
const withSpeedAccuracy = (config) => {
  config = withDangerousMod(config, [
    'ios',
    async (modConfig) => {
      patchIos(modConfig.modRequest.projectRoot);
      return modConfig;
    },
  ]);
  config = withDangerousMod(config, [
    'android',
    async (modConfig) => {
      patchAndroid(modConfig.modRequest.projectRoot);
      return modConfig;
    },
  ]);
  return config;
};

module.exports = createRunOncePlugin(withSpeedAccuracy, PLUGIN_NAME, '1.0.0');
