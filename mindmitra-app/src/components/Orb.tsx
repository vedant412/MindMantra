import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { colors } from '../theme/theme';

interface OrbProps {
  size?: number;
  isActive?: boolean;
}

export const Orb = ({ size = 60, isActive = false }: OrbProps) => {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0.7)).current;

  useEffect(() => {
    const breathe = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(scale, { toValue: 1.15, duration: 2000, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 1, duration: 2000, useNativeDriver: true })
        ]),
        Animated.parallel([
          Animated.timing(scale, { toValue: 1, duration: 2000, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0.7, duration: 2000, useNativeDriver: true })
        ])
      ])
    );
    
    breathe.start();
    return () => breathe.stop();
  }, [isActive]);

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Animated.View 
        style={[
          styles.orb, 
          { 
            backgroundColor: isActive ? '#FF6B6B' : colors.orbGlow,
            shadowColor: isActive ? '#FF6B6B' : colors.orbGlow,
            transform: [{ scale }], 
            opacity,
            width: size, 
            height: size,
            borderRadius: size / 2
          }
        ]} 
      />
      <View style={[styles.innerCore, { width: size * 0.4, height: size * 0.4, borderRadius: size * 0.2 }]} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  orb: {
    position: 'absolute',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 15,
    elevation: 10,
  },
  innerCore: {
    backgroundColor: '#FFFFFF',
    opacity: 0.9,
  }
});
