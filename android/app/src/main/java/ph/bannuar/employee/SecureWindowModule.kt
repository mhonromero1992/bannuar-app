package ph.bannuar.employee

import android.view.WindowManager
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

/**
 * FLAG_SECURE for the screens that show pay and government numbers: Android then blocks screenshots
 * and screen recording of the window and shows it blank in the recent-apps list.
 * JS: NativeModules.BannuarSecureWindow.setSecure(true | false), from src/services/secureScreen.ts.
 */
class SecureWindowModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = NAME

  @ReactMethod
  fun setSecure(secure: Boolean) {
    val activity = reactApplicationContext.currentActivity ?: return
    activity.runOnUiThread {
      if (secure) {
        activity.window.addFlags(WindowManager.LayoutParams.FLAG_SECURE)
      } else {
        activity.window.clearFlags(WindowManager.LayoutParams.FLAG_SECURE)
      }
    }
  }

  companion object {
    const val NAME = "BannuarSecureWindow"
  }
}
