import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import React from 'react';
import * as Screens from './index';
import {TabBar} from './TabBar';
import type {TabParamList} from './types';

const Tab = createBottomTabNavigator<TabParamList>();

const renderTabBar = (props: React.ComponentProps<typeof TabBar>) => <TabBar {...props} />;

export function Tabs() {
  return (
    <Tab.Navigator screenOptions={{headerShown: false, lazy: true}} tabBar={renderTabBar}>
      <Tab.Screen name="Home" component={Screens.Home} options={{title: 'Home'}} />
      <Tab.Screen name="Payslips" component={Screens.Payslips} options={{title: 'Payslips'}} />
      <Tab.Screen name="Leave" component={Screens.Leave} options={{title: 'Leave'}} />
      <Tab.Screen name="More" component={Screens.More} options={{title: 'More'}} />
    </Tab.Navigator>
  );
}
