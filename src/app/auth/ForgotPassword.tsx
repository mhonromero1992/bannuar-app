import {useNavigation} from '@react-navigation/native';
import React from 'react';
import {Button, Card, Txt} from '../../components/ui';
import {AuthFrame} from './AuthFrame';

/**
 * There is no email reset: guards have no company email. HR gives a temporary password from the portal
 * (employee page > App account), which signs out every session and makes the app ask for a new one.
 * No HR phone number or email is printed until Bannuar confirms one (README: To confirm with Bannuar).
 */
export default function ForgotPassword() {
  const nav = useNavigation();
  return (
    <AuthFrame title="Forgot your password?" back>
      <Card>
        <Txt variant="heading">Ask HR for a temporary password</Txt>
        <Txt>HR sets a temporary password for you in the HR portal.</Txt>
        <Txt>Sign in with it. The app then asks you to choose your own new password right away.</Txt>
      </Card>
      <Button title="Back to sign in" variant="secondary" onPress={() => nav.goBack()} />
    </AuthFrame>
  );
}
