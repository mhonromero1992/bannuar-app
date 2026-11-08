package ph.bannuar.employee

import android.os.Bundle
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate
import com.zoontek.rnbootsplash.RNBootSplash

class MainActivity : ReactActivity() {

  override fun getMainComponentName(): String = "Bannuar"

  override fun onCreate(savedInstanceState: Bundle?) {
    // The splash (BootTheme) stays up until JS hides it once the first screen is drawn.
    RNBootSplash.init(this, R.style.BootTheme)
    // null, as react-native-screens asks: Android must not restore screens React Native no longer has.
    super.onCreate(null)
  }

  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)
}
