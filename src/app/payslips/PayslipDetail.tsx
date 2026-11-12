import {type RouteProp, useNavigation, useRoute} from '@react-navigation/native';
import React, {useEffect, useState} from 'react';
import {Pressable, StyleSheet, View} from 'react-native';
import {useTheme} from 'styled-components/native';
import {AmountLine, Button, Card, Empty, ErrorState, HiddenAmount, Icon, KeyValue, Loading, Notice, Screen, SectionLabel, Txt} from '../../components/ui';
import {TOUCH} from '../../config/theme';
import {errorText} from '../../lib/errors';
import {fmtDate, fmtDateRange, fmtNumber} from '../../lib/format';
import type {RootStackParamList} from '../../navigations/types';
import {loadPayslip, openPayslipPdf, payslipLines} from '../../services/payslips';
import {useSecureScreen} from '../../services/secureScreen';
import {KEYS} from '../../store/keys';
import {useResources} from '../../store/resources';
import type {Payslip} from '../../types/db';

/** One payslip: earnings, deductions, totals, days and hours. FLAG_SECURE; amounts hidden until tapped. */
export default function PayslipDetail() {
  useSecureScreen();
  const {id} = useRoute<RouteProp<RootStackParamList, 'PayslipDetail'>>().params;
  const nav = useNavigation();
  const {colors} = useTheme();
  const fromList = useResources(s => (s.entries[KEYS.payslips]?.data as Payslip[] | undefined)?.find(p => p.id === id));
  const [slip, setSlip] = useState<Payslip | null | undefined>(fromList);
  const [error, setError] = useState<string | null>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (fromList) {
      return;
    }
    loadPayslip(id)
      .then(setSlip)
      .catch(e => setError(errorText(e)));
  }, [id, fromList]);

  const p = fromList ?? slip;
  return (
    <Screen
      title="Payslip"
      back
      right={
        <Pressable accessibilityRole="button" accessibilityLabel={shown ? 'Hide the amounts' : 'Show the amounts'} onPress={() => setShown(s => !s)} style={styles.eye}>
          <Icon name={shown ? 'eyeOff' : 'eye'} color={colors.text} />
        </Pressable>
      }>
      {p === undefined ? (
        error ? <ErrorState message={error} /> : <Loading />
      ) : p === null ? (
        <Empty title="Payslip not found" body="It may belong to a cutoff payroll has taken back to check." />
      ) : (
        <PayslipBody p={p} shown={shown} onReport={() => nav.navigate('ReportConcern', {payslipId: p.id})} />
      )}
    </Screen>
  );
}

function PayslipBody({p, shown, onReport}: {p: Payslip; shown: boolean; onReport: () => void}) {
  const lines = payslipLines(p);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const openPdf = async () => {
    setPdfBusy(true);
    setPdfError(null);
    try {
      await openPayslipPdf(p);
    } catch (e) {
      setPdfError(errorText(e));
    } finally {
      setPdfBusy(false);
    }
  };
  return (
    <>
      <View>
        <Txt variant="display" accessibilityRole="header">
          {p.period?.label ?? 'Payslip'}
        </Txt>
        {p.period ? <Txt color="muted">{`${fmtDateRange(p.period.period_start, p.period.period_end)} · pay date ${fmtDate(p.period.pay_date)}`}</Txt> : null}
      </View>
      <Card>
        {shown ? <AmountLine label="Net pay" amount={p.net_pay} strong /> : <HiddenAmount label="Net pay" amount={p.net_pay} big />}
      </Card>
      {shown ? (
        <>
          <Card>
            <SectionLabel>Earnings</SectionLabel>
            {lines.earnings.map(l => (
              <AmountLine key={`e-${l.label}`} label={l.label} amount={l.amount} />
            ))}
            <AmountLine label="Gross pay" amount={p.gross_pay} strong />
          </Card>
          <Card>
            <SectionLabel>Deductions</SectionLabel>
            {lines.deductions.length ? lines.deductions.map(l => <AmountLine key={`d-${l.label}`} label={l.label} amount={l.amount} />) : <Txt color="muted">No deductions</Txt>}
            <AmountLine label="Total deductions" amount={p.total_deductions} strong />
          </Card>
        </>
      ) : (
        <Txt color="muted">Tap the eye at the top to see every amount. Screenshots are blocked on this screen.</Txt>
      )}
      <Card>
        <SectionLabel>Work</SectionLabel>
        <View style={styles.grid}>
          <KeyValue label="Post" value={p.site_name} />
          <KeyValue label="Days worked" value={fmtNumber(p.days_worked)} />
          <KeyValue label="Hours worked" value={fmtNumber(p.hours_worked)} />
          <KeyValue label="Overtime hours" value={fmtNumber(p.overtime_hours)} />
          <KeyValue label="Night differential hours" value={fmtNumber(p.night_diff_hours)} />
        </View>
        {p.remarks ? <KeyValue label="Remarks" value={p.remarks} /> : null}
      </Card>
      {pdfError ? <Notice tone="bad">{pdfError}</Notice> : null}
      <Button
        title="Download PDF"
        variant="secondary"
        icon="file"
        busy={pdfBusy}
        onPress={openPdf}
        accessibilityHint="Makes this payslip as a PDF and opens it in your PDF viewer, where you can save, share or print it"
      />
      <Button title="Report a concern" variant="secondary" onPress={onReport} />
    </>
  );
}

const styles = StyleSheet.create({
  eye: {width: TOUCH, height: TOUCH, alignItems: 'center', justifyContent: 'center'},
  grid: {gap: 12},
});
