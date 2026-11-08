import 'styled-components/native';
import type {AppTheme} from '../config/theme';

declare module 'styled-components/native' {
  // the app's theme (src/config/theme.ts) is what styled components receive
  export interface DefaultTheme extends AppTheme {}
}
