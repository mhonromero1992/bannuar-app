import ReactNativeBlobUtil from 'react-native-blob-util';
import {wipeVault} from './vault';

/**
 * iOS keeps keychain items after an app is deleted. On the first launch of a fresh install, anything
 * left from before is wiped, so a reinstalled app never opens a previous guard's session or payslips.
 */
export async function forgetPreviousInstall(): Promise<void> {
  const marker = `${ReactNativeBlobUtil.fs.dirs.DocumentDir}/.bannuar-installed`;
  try {
    if (await ReactNativeBlobUtil.fs.exists(marker)) {
      return;
    }
    await wipeVault();
    await ReactNativeBlobUtil.fs.writeFile(marker, '1', 'utf8');
  } catch {
    // a launch without the marker just checks again next time
  }
}
