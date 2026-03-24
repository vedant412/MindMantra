import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { colors } from '../theme/theme';

interface OrbProps {
  size?: number;
  mode?: 'idle' | 'listening' | 'recording' | 'processing' | 'speaking';
}

export const Orb = ({ size = 60, mode = 'idle' }: OrbProps) => {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0.7)).current;
  const loopRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    // Reset any running animation
    if (loopRef.current) {
      loopRef.current.stop();
    }
    scale.setValue(1);
    opacity.setValue(0.7);

    if (mode === 'idle') {
      // Gentle lazy breathe
      loopRef.current = Animated.loop(
        Animated.sequence([
          Animated.parallel([
            Animated.timing(scale, { toValue: 1.05, duration: 4000, useNativeDriver: true }),
            Animated.timing(opacity, { toValue: 0.8, duration: 4000, useNativeDriver: true })
          ]),
          Animated.parallel([
            Animated.timing(scale, { toValue: 1, duration: 4000, useNativeDriver: true }),
            Animated.timing(opacity, { toValue: 0.7, duration: 4000, useNativeDriver: true })
          ])
        ])
      );
      loopRef.current.start();
    } 
    else if (mode === 'recording') {
      // Fast, active listening pulse
      loopRef.current = Animated.loop(
        Animated.sequence([
          Animated.parallel([
            Animated.timing(scale, { toValue: 1.25, duration: 600, useNativeDriver: true }),
            Animated.timing(opacity, { toValue: 1, duration: 600, useNativeDriver: true })
          ]),
          Animated.parallel([
            Animated.timing(scale, { toValue: 1.05, duration: 600, useNativeDriver: true }),
            Animated.timing(opacity, { toValue: 0.8, duration: 600, useNativeDriver: true })
          ])
        ])
      );
      loopRef.current.start();
    }
    else if (mode === 'processing') {
      // Steady glowing without much scale
      loopRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(opacity, { toValue: 1, duration: 1500, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0.5, duration: 1500, useNativeDriver: true })
        ])
      );
      loopRef.current.start();
    }
    else if (mode === 'speaking') {
      // Rhythmic jump bounce imitating syllables
      loopRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(scale, { toValue: 1.15, duration: 300, useNativeDriver: true }),
          Animated.timing(scale, { toValue: 0.95, duration: 300, useNativeDriver: true }),
          Animated.timing(scale, { toValue: 1.05, duration: 400, useNativeDriver: true }),
          Animated.timing(scale, { toValue: 1, duration: 200, useNativeDriver: true })
        ])
      );
      loopRef.current.start();
    }
    else {
      // listening transition
      Animated.timing(scale, { toValue: 1.1, duration: 300, useNativeDriver: true }).start();
      Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    }

    return () => {
      if (loopRef.current) loopRef.current.stop();
    };
  }, [mode]);

  // Determine active color style
  let coreColor = colors.orbGlow;
  if (mode === 'recording') coreColor = '#F28B82'; // Soft warm orange/red for recording
  if (mode === 'speaking') coreColor = colors.accent;
  if (mode === 'processing') coreColor = colors.primary;

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Animated.View 
        style={[
          styles.orb, 
          { 
            backgroundColor: coreColor,
            shadowColor: coreColor,
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
  container: { justifyContent: 'center', alignItems: 'center' },
  orb: { position: 'absolute', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 15, elevation: 10 },
  innerCore: { backgroundColor: '#FFFFFF', opacity: 0.9 }
});
