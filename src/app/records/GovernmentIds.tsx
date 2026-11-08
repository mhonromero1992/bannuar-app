import React, {useCallback, useEffect, useState} from 'react';
import {Pressable, StyleSheet, View} from 'react-native';
import {Card, ErrorState, Loading, Notice, Screen, Txt} from '../../components/ui';
import {TOUCH} from '../../config/theme';
import {errorText} from '../../lib/errors';
import {fmtDate, mask} from '../../lib/format';
import {loadGovernmentIds} from '../../services/records';
import {useSecureScreen} from '../../services/secureScreen';
import {useEmployeeId} from '../../store/session';
import type {GovernmentIds as Ids} from '../../types/db';

const FIELDS: Array<[keyof Ids, string]> = [
  ['sss_no', 'SSS'],
  ['philhealth_no', 'PhilHealth'],
  ['pagibig_no', 'Pag-IBIG'],
  ['tin', 'TIN'],
];

/**
 * SSS, PhilHealth, Pag-IBIG and TIN through get_government_ids(): each masked until tapped, no
 * screenshots, and never saved on the phone (they load again each time).
 */
export default function GovernmentIds() {
  useSecureScreen();
  const employeeId = useEmployeeId();
  const [ids, setIds] = useState<Ids | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [shown, setShown] = useState<Record<string, boolean>>({});

  const load = useCallback(() => {
    setError(null);
    loadGovernmentIds(employeeId)
      .then(setIds)
      .catch(e => setError(errorText(e)));
  }, [employeeId]);
  useEffect(load, [load]);

  return (
    <Screen title="Government numbers" back>
      <Txt color="muted">Tap a number to show it. These numbers are not saved on this phone, and screenshots are blocked here.</Txt>
      {ids === undefined ? (
        error ? (
          <ErrorState message={error} onRetry={load} />
        ) : (
          <Loading />
        )
      ) : ids === null ? (
        <Notice tone="info">HR has no government numbers on file for you yet. Bring your IDs to the HR office.</Notice>
      ) : (
        <Card>
          {FIELDS.map(([key, name]) => {
            const value = ids[key];
            const open = shown[key];
            return (
              <Pressable
                key={key}
                accessibilityRole="button"
                disabled={!value}
                accessibilityLabel={value ? (open ? `${name} number ${value.split('').join(' ')}. Double tap to hide.` : `${name} number, hidden. Double tap to show.`) : `${name}: not on file`}
                onPress={() => setShown(s => ({...s, [key]: !s[key]}))}
                style={styles.row}>
                <View style={styles.flex}>
                  <Txt variant="small" color="muted">
                    {name}
                  </Txt>
                  <Txt variant="amount">{value ? (open ? value : mask(value, 3)) : 'Not on file'}</Txt>
                </View>
                {value ? (
                  <Txt variant="small" color="link">
                    {open ? 'Hide' : 'Show'}
                  </Txt>
                ) : null}
              </Pressable>
            );
          })}
          {ids.updated_at ? (
            <Txt variant="small" color="muted">
              {`Updated by HR ${fmtDate(ids.updated_at)}`}
            </Txt>
          ) : null}
        </Card>
      )}
      <Txt variant="small" color="muted">
        To correct a number, bring the ID to the HR office.
      </Txt>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: TOUCH + 8},
  flex: {flex: 1, gap: 2},
});
