import type {NotificationLink} from '../types/db';
import type {RootStackParamList} from './types';

export type Route = {[K in keyof RootStackParamList]: {name: K; params?: RootStackParamList[K]}}[keyof RootStackParamList];

/**
 * Where a notification opens. The database writes `link` as {screen, id} (schema.sql: the notify calls
 * in its triggers and functions); any screen the app does not know opens the Notifications list.
 */
export function routeForLink(link?: NotificationLink | null): Route {
  const id = typeof link?.id === 'string' && link.id ? link.id : undefined;
  switch (link?.screen) {
    case 'Payslip':
      return id ? {name: 'PayslipDetail', params: {id}} : {name: 'Main', params: {screen: 'Payslips'}};
    case 'Announcement':
      return id ? {name: 'AnnouncementDetail', params: {id}} : {name: 'Announcements'};
    case 'LeaveRequest':
      return id ? {name: 'LeaveDetail', params: {id}} : {name: 'Main', params: {screen: 'Leave'}};
    case 'CoeRequest':
      return {name: 'Coe', params: id ? {focusRequestId: id} : undefined};
    case 'Certificate':
      return id ? {name: 'CertificateDetail', params: {id}} : {name: 'Coe'};
    case 'PayrollConcern':
      return {name: 'Concerns', params: id ? {focusId: id} : undefined};
    case 'Profile':
      return {name: 'Records'};
    case 'ProfileChange':
      return {name: 'ChangeDetails'};
    case 'Documents':
      return {name: 'Documents', params: id ? {focusId: id} : undefined};
    default:
      return {name: 'Notifications'};
  }
}
