import 'react-native-gesture-handler';
import React, {useEffect} from 'react';
import {StyleSheet, useColorScheme} from 'react-native';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import {enableScreens} from 'react-native-screens';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {ThemeProvider} from 'styled-components/native';
import RootLayout from './src/app/_layout';
import {makeTheme} from './src/config/theme';
import {resolveScheme, useAppearance} from './src/store/appearance';

enableScreens();

/** Light or dark follows the phone unless the guard picks one in Account (src/store/appearance.ts). */
function App(): React.JSX.Element {
  const phone = useColorScheme();
  const appearance = useAppearance(s => s.appearance);
  useEffect(() => {
    useAppearance.getState().load();
  }, []);
  const theme = makeTheme(resolveScheme(appearance, phone));
  return (
    <GestureHandlerRootView style={[styles.root, {backgroundColor: theme.colors.ground}]}>
      <SafeAreaProvider>
        <ThemeProvider theme={theme}>
          <RootLayout />
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({root: {flex: 1}});

export default App;
