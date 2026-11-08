import React, {useState} from 'react';
import {StyleSheet, View} from 'react-native';
import {Button, Card, Icon, Txt} from '../../components/ui';
import {errorText} from '../../lib/errors';
import {choosePhoto, chooseDocument, fileProblem, type PickedFile, takePhoto} from '../../services/files';
import {useTheme} from 'styled-components/native';

/** Three plain ways to attach a document: a photo now, a photo from the phone, or a PDF. */
export function FilePicker({label, file, onChange, error}: {label: string; file: PickedFile | null; onChange: (f: PickedFile | null) => void; error?: string | null}) {
  const {colors} = useTheme();
  const [problem, setProblem] = useState<string | null>(null);
  const take = async (fn: () => Promise<PickedFile | null>) => {
    setProblem(null);
    try {
      const f = await fn();
      if (f) {
        const p = fileProblem(f);
        if (p) {
          setProblem(p);
          return;
        }
        onChange(f);
      }
    } catch (e) {
      setProblem(errorText(e));
    }
  };
  const shown = problem ?? error;
  return (
    <View style={styles.wrap}>
      <Txt variant="bodyStrong">{label}</Txt>
      {file ? (
        <Card>
          <View style={styles.row}>
            <Icon name={file.type === 'application/pdf' ? 'file' : 'image'} color={colors.textMuted} />
            <Txt style={styles.flex} numberOfLines={2}>
              {file.name}
            </Txt>
          </View>
          <Button title="Remove this file" variant="ghost" onPress={() => onChange(null)} />
        </Card>
      ) : (
        <View style={styles.buttons}>
          <Button title="Take a photo" variant="secondary" icon="camera" onPress={() => take(takePhoto)} />
          <Button title="Choose a photo" variant="secondary" icon="image" onPress={() => take(choosePhoto)} />
          <Button title="Choose a PDF" variant="secondary" icon="file" onPress={() => take(chooseDocument)} />
        </View>
      )}
      {shown ? (
        <Txt variant="small" color="bad" accessibilityLiveRegion="polite">
          {shown}
        </Txt>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {gap: 8},
  buttons: {gap: 8},
  row: {flexDirection: 'row', alignItems: 'center', gap: 10},
  flex: {flex: 1},
});
