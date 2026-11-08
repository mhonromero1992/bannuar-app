import {routeForLink} from '../src/navigations/linking';
import {linkFromPush} from '../src/services/push';

describe('notification links open the right screen', () => {
  // every {screen} the database writes for employees (schema.sql: notify calls in triggers and functions)
  it.each([
    [{screen: 'Payslip', id: 'ps1'}, {name: 'PayslipDetail', params: {id: 'ps1'}}],
    [{screen: 'Announcement', id: 'a1'}, {name: 'AnnouncementDetail', params: {id: 'a1'}}],
    [{screen: 'LeaveRequest', id: 'lr1'}, {name: 'LeaveDetail', params: {id: 'lr1'}}],
    [{screen: 'CoeRequest', id: 'cr1'}, {name: 'Coe', params: {focusRequestId: 'cr1'}}],
    [{screen: 'Certificate', id: 'c1'}, {name: 'CertificateDetail', params: {id: 'c1'}}],
    [{screen: 'PayrollConcern', id: 'pq1'}, {name: 'Concerns', params: {focusId: 'pq1'}}],
    [{screen: 'Profile'}, {name: 'Records'}],
    [{screen: 'ProfileChange', id: 'pc1'}, {name: 'ChangeDetails'}],
    [{screen: 'Documents', id: 'd1'}, {name: 'Documents', params: {focusId: 'd1'}}],
  ])('%j', (link, route) => {
    expect(routeForLink(link)).toEqual(route);
  });
  it('without an id, the list; unknown or staff-only screens, the notifications', () => {
    expect(routeForLink({screen: 'Payslip'})).toEqual({name: 'Main', params: {screen: 'Payslips'}});
    expect(routeForLink({screen: 'LeaveRequest'})).toEqual({name: 'Main', params: {screen: 'Leave'}});
    expect(routeForLink({screen: 'Application', id: 'x'})).toEqual({name: 'Notifications'});
    expect(routeForLink(null)).toEqual({name: 'Notifications'});
  });
  it('reads the link a push carries (send-push puts it in data as JSON)', () => {
    expect(linkFromPush({link: '{"screen":"Payslip","id":"ps1"}', notification_id: 'n1'})).toEqual({link: {screen: 'Payslip', id: 'ps1'}, notificationId: 'n1'});
    expect(linkFromPush({link: '', notification_id: ''})).toEqual({link: null, notificationId: null});
    expect(linkFromPush({link: 'not json'})).toEqual({link: null, notificationId: null});
    expect(linkFromPush(null)).toEqual({link: null, notificationId: null});
  });
});
