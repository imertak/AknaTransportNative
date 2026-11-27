package com.akna.smsconsent

import android.app.Activity
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import androidx.core.content.ContextCompat
import com.google.android.gms.auth.api.phone.SmsRetriever
import com.google.android.gms.common.api.CommonStatusCodes
import com.google.android.gms.common.api.Status
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Google SMS User Consent API ile gelen tek SMS'i (ör. GİB e-Arşiv imza kodu) okur.
 *
 * - READ_SMS / RECEIVE_SMS izni istemez. SMS gelince Android kullanıcıya "Bu mesajı uygulamaya ver?"
 *   penceresini gösterir; "İzin ver" denirse yalnızca o mesajın metni uygulamaya gelir.
 * - Dinleme 5 dakika sürer (Play Services sınırı). Rehberde kayıtlı numaralardan gelen SMS'ler yakalanmaz.
 */
class SmsUserConsentModule : Module() {
  private var receiver: BroadcastReceiver? = null

  private val context: Context
    get() = requireNotNull(appContext.reactContext) { "React context yok" }

  override fun definition() = ModuleDefinition {
    Name("SmsUserConsent")

    Events(EVENT_SMS, EVENT_ERROR)

    AsyncFunction("startListening") {
      stop()
      register()
      SmsRetriever.getClient(context)
        .startSmsUserConsent(null)
        .addOnFailureListener { e ->
          stop()
          sendEvent(EVENT_ERROR, mapOf("reason" to "start_failed", "message" to (e.message ?: "")))
        }
      Unit
    }

    Function("stopListening") { stop() }

    OnActivityResult { _, payload ->
      if (payload.requestCode != CONSENT_REQUEST) return@OnActivityResult
      if (payload.resultCode == Activity.RESULT_OK) {
        val message = payload.data?.getStringExtra(SmsRetriever.EXTRA_SMS_MESSAGE)
        if (message != null) sendEvent(EVENT_SMS, mapOf("message" to message))
      } else {
        sendEvent(EVENT_ERROR, mapOf("reason" to "denied"))
      }
    }

    OnDestroy { stop() }
  }

  private fun register() {
    val r = object : BroadcastReceiver() {
      override fun onReceive(ctx: Context, intent: Intent) {
        if (intent.action != SmsRetriever.SMS_RETRIEVED_ACTION) return
        val extras = intent.extras ?: return
        @Suppress("DEPRECATION")
        val status = extras.get(SmsRetriever.EXTRA_STATUS) as? Status ?: return
        // Tek mesaj için dinlenir: alındıktan veya süre dolduktan sonra alıcı kaldırılır.
        stop()
        when (status.statusCode) {
          CommonStatusCodes.SUCCESS -> {
            @Suppress("DEPRECATION")
            val consent = extras.getParcelable<Intent>(SmsRetriever.EXTRA_CONSENT_INTENT) ?: return
            // Intent yönlendirme koruması: yalnızca Play Services'in onay ekranı açılır.
            val target = consent.resolveActivity(ctx.packageManager)
            val grants = Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION
            if (target?.packageName != "com.google.android.gms" || consent.flags and grants != 0) return
            val activity = appContext.currentActivity
            if (activity == null) {
              sendEvent(EVENT_ERROR, mapOf("reason" to "no_activity"))
              return
            }
            try {
              activity.startActivityForResult(consent, CONSENT_REQUEST)
            } catch (e: Exception) {
              sendEvent(EVENT_ERROR, mapOf("reason" to "start_failed", "message" to (e.message ?: "")))
            }
          }
          CommonStatusCodes.TIMEOUT -> sendEvent(EVENT_ERROR, mapOf("reason" to "timeout"))
        }
      }
    }
    ContextCompat.registerReceiver(
      context,
      r,
      IntentFilter(SmsRetriever.SMS_RETRIEVED_ACTION),
      SmsRetriever.SEND_PERMISSION,
      null,
      ContextCompat.RECEIVER_EXPORTED,
    )
    receiver = r
  }

  private fun stop() {
    val r = receiver ?: return
    receiver = null
    try {
      appContext.reactContext?.unregisterReceiver(r)
    } catch (_: IllegalArgumentException) {
    }
  }

  companion object {
    private const val CONSENT_REQUEST = 7461
    private const val EVENT_SMS = "onSms"
    private const val EVENT_ERROR = "onError"
  }
}
