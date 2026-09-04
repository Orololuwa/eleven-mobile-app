const { createRunOncePlugin, withMainActivity } = require('expo/config-plugins');

const PLUGIN_NAME = 'with-safe-react-delegate';
const MARKER = 'withAttachedReactDelegate';
const ANCHOR = 'Align the back button behavior with Android S';

const KOTLIN_PATCH = `  /**
   * Expo Dev Client can replace mDelegate before ReactDelegate is attached.
   * RN 0.81 then NPEs in ReactActivityDelegate.onUserLeaveHint / onPause / onResume.
   */
  private inline fun withAttachedReactDelegate(block: () -> Unit) {
    try {
      block()
    } catch (_: NullPointerException) {
    }
  }

  override fun onUserLeaveHint() {
    withAttachedReactDelegate { super.onUserLeaveHint() }
  }

  override fun onPause() {
    withAttachedReactDelegate { super.onPause() }
  }

  override fun onResume() {
    withAttachedReactDelegate { super.onResume() }
  }

`;

/** @type {import('expo/config-plugins').ConfigPlugin} */
const withSafeReactDelegate = (config) =>
  withMainActivity(config, (modConfig) => {
    const src = modConfig.modResults;
    if (src.language !== 'kt') {
      throw new Error(`${PLUGIN_NAME}: MainActivity is ${src.language}, expected Kotlin`);
    }
    if (src.contents.includes(MARKER)) return modConfig;

    const anchorAt = src.contents.indexOf(ANCHOR);
    const kdocStart = anchorAt < 0 ? -1 : src.contents.lastIndexOf('/**', anchorAt);
    if (kdocStart < 0) {
      throw new Error(`${PLUGIN_NAME}: could not find back-button kdoc in MainActivity`);
    }

    src.contents = `${src.contents.slice(0, kdocStart)}${KOTLIN_PATCH}${src.contents.slice(kdocStart)}`;
    return modConfig;
  });

module.exports = createRunOncePlugin(withSafeReactDelegate, PLUGIN_NAME, '1.0.0');
