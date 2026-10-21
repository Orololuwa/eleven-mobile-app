package expo.modules.trackingindicator

import android.app.Notification
import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

private const val LOCATION_TASK_CHANNEL_SUFFIX = ":eleven-location-tracking"

class TrackingIndicatorModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("TrackingIndicator")

    AsyncFunction("updateNotification") { title: String, body: String, color: String ->
      val context =
        appContext.reactContext?.applicationContext
          ?: return@AsyncFunction false
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
        return@AsyncFunction false
      }

      val notificationManager =
        context.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
          ?: return@AsyncFunction false

      val existing =
        notificationManager.activeNotifications.firstOrNull { status ->
          status.notification.channelId?.endsWith(LOCATION_TASK_CHANNEL_SUFFIX) == true
        } ?: return@AsyncFunction false

      val channelId = existing.notification.channelId ?: return@AsyncFunction false
      val builder =
        Notification.Builder(context, channelId)
          .setContentTitle(title)
          .setContentText(body)
          .setSmallIcon(existing.notification.smallIcon)
          .setOngoing(true)
          .setOnlyAlertOnce(true)
          .setCategory(Notification.CATEGORY_SERVICE)

      existing.notification.contentIntent?.let { builder.setContentIntent(it) }

      try {
        builder.setColorized(true).setColor(Color.parseColor(color))
      } catch (_: Exception) {
        if (existing.notification.color != 0) {
          builder.setColorized(true).setColor(existing.notification.color)
        }
      }

      notificationManager.notify(existing.id, builder.build())
      true
    }

    Function("isIgnoringBatteryOptimizations") {
      val context = appContext.reactContext?.applicationContext ?: return@Function true
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return@Function true
      val power = context.getSystemService(Context.POWER_SERVICE) as? PowerManager
        ?: return@Function true
      power.isIgnoringBatteryOptimizations(context.packageName)
    }

    /** System "Let app always run in background?" dialog. */
    AsyncFunction("requestIgnoreBatteryOptimizations") {
      val activity = appContext.currentActivity ?: return@AsyncFunction false
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return@AsyncFunction false
      try {
        activity.startActivity(
          Intent(
            Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS,
            Uri.parse("package:${activity.packageName}"),
          ),
        )
        true
      } catch (_: Exception) {
        false
      }
    }
  }
}
