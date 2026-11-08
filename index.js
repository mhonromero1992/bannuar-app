/**
 * @format
 */
import 'react-native-gesture-handler';
import {AppRegistry} from 'react-native';
import App from './App';
import {name as appName} from './app.json';
import {registerBackgroundPush} from './src/services/pushBackground';

// Firebase needs its background handler before the app renders (only when push is set up).
registerBackgroundPush();

AppRegistry.registerComponent(appName, () => App);
