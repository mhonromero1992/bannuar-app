import type {NavigatorScreenParams} from '@react-navigation/native';

/** The four tabs (a custom bar on @react-navigation/bottom-tabs: src/navigations/TabBar.tsx). */
export type TabParamList = {
  Home: undefined;
  Payslips: undefined;
  Leave: undefined;
  More: undefined;
};

export type RootStackParamList = {
  // signed out
  SignIn: undefined;
  Activate: undefined;
  ForgotPassword: undefined;
  // HR gave a temporary password
  SetPassword: undefined;
  // app lock
  Locked: undefined;
  // signed in
  Main: NavigatorScreenParams<TabParamList> | undefined;
  Notifications: undefined;
  Announcements: undefined;
  AnnouncementDetail: {id: string};
  PayslipDetail: {id: string};
  ReportConcern: {payslipId?: string} | undefined;
  Concerns: {focusId?: string} | undefined;
  FileLeave: undefined;
  LeaveDetail: {id: string};
  Coe: {focusRequestId?: string} | undefined;
  RequestCoe: undefined;
  CertificateDetail: {id: string};
  Records: undefined;
  GovernmentIds: undefined;
  Documents: {focusId?: string} | undefined;
  UploadDocument: {documentTypeId?: string} | undefined;
  ChangeDetails: undefined;
  Attendance: undefined;
  LogAttendance: {kind: 'time_in' | 'time_out'; guardId?: string};
  MyPost: undefined;
  GuardAttendance: {guardId: string};
  ReportIncident: undefined;
  Notices: undefined;
  NoticeDetail: {id: string};
  Endorse: {id: string};
  Account: undefined;
  ChangePassword: undefined;
};

declare global {
  namespace ReactNavigation {
    // typed navigation.navigate() everywhere
    interface RootParamList extends RootStackParamList {}
  }
}
