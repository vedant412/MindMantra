import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Orb } from '../components/Orb';
import { colors } from '../theme/theme';

// Layout Imports
import { HomeScreen } from '../screens/HomeScreen';
import { ActivitiesScreen } from '../screens/ActivitiesScreen';
import { TalkScreen } from '../screens/TalkScreen';
import { InsightsScreen } from '../screens/InsightsScreen';
import { ProfileScreen } from '../screens/ProfileScreen';

const Tab = createBottomTabNavigator();

const TalkButton = ({ children, onPress }: any) => (
  <TouchableOpacity
    style={styles.talkButtonContainer}
    onPress={onPress}
    activeOpacity={0.9}
  >
    <View style={styles.talkButton}>
      {children}
    </View>
    <Text style={styles.vaniLabel}>Vani</Text>
  </TouchableOpacity>
);

export const AppNavigator = () => {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: true,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.subText,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginBottom: 8,
        },
        tabBarStyle: {
          borderTopWidth: 0,
          elevation: 0,
          backgroundColor: colors.card,
          height: 94,
          paddingTop: 8,
          paddingBottom: 20,
          borderTopLeftRadius: 30,
          borderTopRightRadius: 30,
          position: 'absolute',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.05,
          shadowRadius: 10,
        }
      }}
    >
      <Tab.Screen 
        name="Home" 
        component={HomeScreen} 
        options={{ tabBarIcon: ({ color }) => <Ionicons name="home" size={26} color={color} /> }}
      />
      <Tab.Screen 
        name="Activities" 
        component={ActivitiesScreen} 
        options={{ tabBarIcon: ({ color }) => <Ionicons name="leaf" size={26} color={color} /> }}
      />
      <Tab.Screen 
        name="Talk" 
        component={TalkScreen} 
        options={{
          tabBarLabel: () => null,
          tabBarIcon: () => <Orb size={48} />,
          tabBarButton: (props) => <TalkButton {...props} />
        }}
      />
      <Tab.Screen 
        name="Insights" 
        component={InsightsScreen} 
        options={{ tabBarIcon: ({ color }) => <Ionicons name="stats-chart" size={26} color={color} /> }}
      />
      <Tab.Screen 
        name="Profile" 
        component={ProfileScreen} 
        options={{ tabBarIcon: ({ color }) => <Ionicons name="person" size={26} color={color} /> }}
      />
    </Tab.Navigator>
  );
};

const styles = StyleSheet.create({
  talkButtonContainer: {
    top: -20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  talkButton: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: colors.card,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.orbGlow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  vaniLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
    marginTop: 6,
  }
});
