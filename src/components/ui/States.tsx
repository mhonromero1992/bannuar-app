import React from 'react';
import {ActivityIndicator, StyleSheet, View} from 'react-native';
import {useTheme} from 'styled-components/native';
import {fmtDateTime} from '../../lib/format';
import type {Resource} from '../../store/resources';
import {Button} from './Button';
import {Beacon, Icon} from './Icon';
import {Txt} from './Txt';

/** Loading: what is coming, not a blank screen. */
export function Loading({label = 'Loading…'}: {label?: string}) {
  const {colors} = useTheme();
  return (
    <View style={styles.center} accessibilityLiveRegion="polite" accessibilityLabel={label}>
      <ActivityIndicator color={colors.text} size="large" />
      <Txt color="muted">{label}</Txt>
    </View>
  );
}

/** Nothing yet: the gold light and a plain line, with the action that fills it when there is one. */
export function Empty({title, body, action}: {title: string; body?: string; action?: React.ReactNode}) {
  const {colors} = useTheme();
  return (
    <View style={styles.center}>
      <Beacon color={colors.beacon} />
      <Txt variant="heading" style={styles.text}>
        {title}
      </Txt>
      {body ? (
        <Txt color="muted" style={styles.text}>
          {body}
        </Txt>
      ) : null}
      {action}
    </View>
  );
}

export function ErrorState({message, onRetry}: {message: string; onRetry?: () => void}) {
  const {colors} = useTheme();
  return (
    <View style={styles.center} accessibilityRole="alert">
      <Icon name="alert" size={32} color={colors.tones.bad.text} />
      <Txt variant="heading" style={styles.text}>
        This did not load
      </Txt>
      <Txt color="muted" style={styles.text}>
        {message}
      </Txt>
      {onRetry ? <Button title="Try again" variant="secondary" icon="refresh" onPress={onRetry} /> : null}
    </View>
  );
}

/** Shown over data loaded earlier when the phone has no connection. */
export function OfflineBanner({updatedAt}: {updatedAt?: number}) {
  const {colors} = useTheme();
  return (
    <View style={[styles.banner, {backgroundColor: colors.tones.warn.bg}]} accessibilityLiveRegion="polite">
      <Icon name="wifiOff" size={20} color={colors.tones.warn.text} />
      <Txt variant="small" color="warn" style={styles.flex}>
        {updatedAt ? `Offline · updated ${fmtDateTime(new Date(updatedAt))}` : 'Offline'}
      </Txt>
    </View>
  );
}

/**
 * The four states of every screen from one resource: loading, error (or offline with nothing saved),
 * empty, and the data, with the offline line over data kept from before.
 */
export function ResourceView<T>({
  resource,
  isEmpty,
  empty,
  children,
}: {
  resource: Resource<T>;
  isEmpty?: (data: T) => boolean;
  empty?: React.ReactNode;
  children: (data: T) => React.ReactNode;
}) {
  const {data, status, error, offline, updatedAt, refresh} = resource;
  if (data === undefined) {
    if (status === 'error') {
      return offline ? (
        <Empty
          title="You are offline"
          body="Nothing from this page is saved on this phone yet. Connect to mobile data or Wi-Fi, then try again."
          action={<Button title="Try again" variant="secondary" icon="refresh" onPress={() => refresh()} />}
        />
      ) : (
        <ErrorState message={error ?? 'Try again in a moment.'} onRetry={() => refresh()} />
      );
    }
    return <Loading />;
  }
  return (
    <>
      {offline ? <OfflineBanner updatedAt={updatedAt} /> : null}
      {!offline && error ? <RefreshProblem message={error} /> : null}
      {isEmpty?.(data) ? empty : children(data)}
    </>
  );
}

function RefreshProblem({message}: {message: string}) {
  const {colors} = useTheme();
  return (
    <View style={[styles.banner, {backgroundColor: colors.tones.bad.bg}]}>
      <Icon name="alert" size={20} color={colors.tones.bad.text} />
      <Txt variant="small" color="bad" style={styles.flex}>
        {`Not refreshed: ${message}`}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {alignItems: 'center', justifyContent: 'center', gap: 12, paddingVertical: 40, paddingHorizontal: 16},
  text: {textAlign: 'center'},
  banner: {flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 10},
  flex: {flex: 1},
});
