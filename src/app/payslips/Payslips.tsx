import {useNavigation} from '@react-navigation/native';
import React, {useState} from 'react';
import {Pressable, StyleSheet} from 'react-native';
import {useTheme} from 'styled-components/native';
import {Button, Card, Empty, Icon, ResourceView, Row, Screen, Txt} from '../../components/ui';
import {TOUCH} from '../../config/theme';
import {fmtDate, fmtPeso} from '../../lib/format';
import {loadPayslips} from '../../services/payslips';
import {useSecureScreen} from '../../services/secureScreen';
import {KEYS} from '../../store/keys';
import {useResource} from '../../store/resources';
import {useEmployeeId} from '../../store/session';
import {useRefreshOnFocus} from '../../store/useRefreshOnFocus';

/** The guard's published payslips, newest cutoff first. No screenshots here; amounts hidden until asked. */
export default function Payslips() {
  useSecureScreen();
  const nav = useNavigation();
  const {colors} = useTheme();
  const employeeId = useEmployeeId();
  const res = useResource(KEYS.payslips, () => loadPayslips(employeeId));
  useRefreshOnFocus(res);
  const [shown, setShown] = useState(false);
  return (
    <Screen
      title="Payslips"
      refreshing={res.refreshing}
      onRefresh={res.refresh}
      right={
        <Pressable accessibilityRole="button" accessibilityLabel={shown ? 'Hide the amounts' : 'Show the amounts'} onPress={() => setShown(s => !s)} style={styles.eye}>
          <Icon name={shown ? 'eyeOff' : 'eye'} color={colors.text} />
        </Pressable>
      }>
      <ResourceView
        resource={res}
        isEmpty={d => d.length === 0}
        empty={<Empty title="No payslips yet" body="Your payslip shows here once payroll publishes the cutoff. You get a notification when it does." />}>
        {slips => (
          <>
            <Card>
              {slips.map((p, i) => (
                <Row
                  key={p.id}
                  title={p.period?.label ?? 'Payslip'}
                  detail={p.period ? `Pay date ${fmtDate(p.period.pay_date)}` : null}
                  right={<Txt variant="amount">{shown ? fmtPeso(p.net_pay) : '₱ ••••'}</Txt>}
                  onPress={() => nav.navigate('PayslipDetail', {id: p.id})}
                  last={i === slips.length - 1}
                />
              ))}
            </Card>
            <Button title="My payroll concerns" variant="secondary" onPress={() => nav.navigate('Concerns')} />
          </>
        )}
      </ResourceView>
    </Screen>
  );
}

const styles = StyleSheet.create({eye: {width: TOUCH, height: TOUCH, alignItems: 'center', justifyContent: 'center'}});
