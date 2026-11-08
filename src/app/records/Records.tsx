import {useNavigation} from '@react-navigation/native';
import React from 'react';
import {Badge, Button, Card, KeyValue, ResourceView, Screen, SectionLabel} from '../../components/ui';
import {CIVIL_STATUS, EMPLOYEE_STATUS, EMPLOYMENT_TYPE, label, SEX, tone} from '../../config/labels';
import {fmtDate, fmtMobile, fullName} from '../../lib/format';
import {loadMe} from '../../services/profile';
import {KEYS} from '../../store/keys';
import {useResource} from '../../store/resources';
import {useEmployeeId} from '../../store/session';
import {useRefreshOnFocus} from '../../store/useRefreshOnFocus';

/** The guard's 201 file, read-only. Changes go to HR through "Change my details". */
export default function Records() {
  const nav = useNavigation();
  const employeeId = useEmployeeId();
  const res = useResource(KEYS.me, () => loadMe(employeeId));
  useRefreshOnFocus(res);
  return (
    <Screen title="My records" back refreshing={res.refreshing} onRefresh={res.refresh}>
      <ResourceView resource={res}>
        {me => (
          <>
            <Card>
              <SectionLabel>Employment</SectionLabel>
              <KeyValue label="Name" value={fullName(me)} />
              <KeyValue label="Employee number" value={me.employee_no} mono />
              <KeyValue label="Position" value={me.position} />
              <KeyValue label="Employment" value={label(EMPLOYMENT_TYPE, me.employment_type)} />
              <Badge tone={tone(EMPLOYEE_STATUS, me.status)}>{label(EMPLOYEE_STATUS, me.status)}</Badge>
              <KeyValue label="Date hired" value={fmtDate(me.date_hired)} />
              {me.date_regularized ? <KeyValue label="Regular since" value={fmtDate(me.date_regularized)} /> : null}
            </Card>
            <Card>
              <SectionLabel>Post</SectionLabel>
              {me.status === 'floating' ? (
                <KeyValue label="Post" value={me.floating_since ? `Floating since ${fmtDate(me.floating_since)}` : 'Floating'} />
              ) : (
                <KeyValue label="Post" value={me.site ? [me.site.name, me.site.city].filter(Boolean).join(', ') : null} />
              )}
              <KeyValue label="Area" value={me.area?.name} />
            </Card>
            <Card>
              <SectionLabel>Personal</SectionLabel>
              <KeyValue label="Birthdate" value={fmtDate(me.birthdate)} />
              <KeyValue label="Sex" value={label(SEX, me.sex)} />
              <KeyValue label="Civil status" value={label(CIVIL_STATUS, me.civil_status)} />
              <KeyValue label="Mobile number" value={fmtMobile(me.mobile_no)} />
              <KeyValue label="Email" value={me.email} />
              <KeyValue label="Present address" value={me.present_address} />
              <KeyValue label="Provincial address" value={me.provincial_address} />
            </Card>
            <Card>
              <SectionLabel>Emergency contact</SectionLabel>
              <KeyValue label="Name" value={me.emergency_contact_name} />
              <KeyValue label="Relation" value={me.emergency_contact_relation} />
              <KeyValue label="Phone" value={fmtMobile(me.emergency_contact_phone)} />
            </Card>
            <Button title="Change my details" onPress={() => nav.navigate('ChangeDetails')} />
            <Button title="Government numbers" variant="secondary" icon="shield" onPress={() => nav.navigate('GovernmentIds')} />
            <Button title="Licenses and documents" variant="secondary" icon="file" onPress={() => nav.navigate('Documents')} />
          </>
        )}
      </ResourceView>
    </Screen>
  );
}
