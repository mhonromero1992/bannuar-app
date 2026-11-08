import {create} from 'zustand';
import type {Tone} from '../config/labels';

interface Toast {
  id: number;
  message: string;
  tone: Tone;
  /** A screen to open when the toast is tapped. */
  onPress?: () => void;
}

interface UiState {
  toast: Toast | null;
  showToast: (message: string, tone?: Tone, onPress?: () => void) => void;
  hideToast: () => void;
  /** A payslip or government number screen is open (iOS covers the app when it leaves the foreground). */
  secureScreen: boolean;
  setSecureScreen: (on: boolean) => void;
  /** Unread notifications (the bell and the app icon badge). */
  unread: number;
  setUnread: (n: number) => void;
  reset: () => void;
}

let toastId = 0;

export const useUi = create<UiState>(set => ({
  toast: null,
  showToast: (message, tone = 'ok', onPress) => set({toast: {id: ++toastId, message, tone, onPress}}),
  hideToast: () => set({toast: null}),
  secureScreen: false,
  setSecureScreen: on => set({secureScreen: on}),
  unread: 0,
  setUnread: n => set({unread: Math.max(0, n)}),
  reset: () => set({toast: null, secureScreen: false, unread: 0}),
}));

export const toast = (message: string, tone?: Tone, onPress?: () => void) => useUi.getState().showToast(message, tone, onPress);
