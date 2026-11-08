import 'react-native-gesture-handler';
import React from 'react';
import {StyleSheet, useColorScheme} from 'react-native';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import {enableScreens} from 'react-native-screens';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {ThemeProvider} from 'styled-components/native';
import RootLayout from './src/app/_layout';
import {makeTheme} from './src/config/theme';

enableScreens();

/** Light or dark follows the phone; both are planned (src/config/theme.ts, DESIGN.md). */
function App(): React.JSX.Element {
  const scheme = useColorScheme();
  const theme = makeTheme(scheme);
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
