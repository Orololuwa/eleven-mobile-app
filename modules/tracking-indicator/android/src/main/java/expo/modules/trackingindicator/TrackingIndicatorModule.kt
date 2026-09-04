package expo.modules.trackingindicator

import android.app.Notification
import android.app.NotificationManager
import android.content.Context
import android.graphics.Color
import android.os.Build
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
  }
}
