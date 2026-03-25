import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, Dimensions } from 'react-native';
import { colors, metrics, shadows } from '../../theme/theme';

const { width } = Dimensions.get('window');
const ITEM_WIDTH = width - (metrics.padding * 2);

export interface Quote {
  id: string;
  text: string;
  author: string;
}

interface QuoteCarouselProps {
  quotes: Quote[];
}

export const QuoteCarousel = ({ quotes }: QuoteCarouselProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    if (!quotes || quotes.length === 0) return;
    const interval = setInterval(() => {
      const nextIndex = (currentIndex + 1) % quotes.length;
      setCurrentIndex(nextIndex);
      flatListRef.current?.scrollToIndex({ index: nextIndex, animated: true });
    }, 6000); 
    return () => clearInterval(interval);
  }, [currentIndex, quotes]);

  const renderItem = ({ item }: { item: Quote }) => (
    <View style={styles.card}>
      <Text style={styles.quoteText}>"{item.text}"</Text>
      <Text style={styles.author}>— {item.author}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        ref={flatListRef}
        data={quotes}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        horizontal
        showsHorizontalScrollIndicator={false}
        pagingEnabled
        onScrollToIndexFailed={() => {}} 
        contentContainerStyle={{ alignSelf: 'flex-start' }}
      />
      <View style={styles.dotsContainer}>
        {quotes.map((_, index) => (
          <View 
            key={index} 
            style={[styles.dot, currentIndex === index && styles.dotActive]} 
          />
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  card: {
    width: ITEM_WIDTH,
    backgroundColor: colors.pastel.lavender,
    borderRadius: metrics.borderRadius,
    padding: metrics.padding,
    ...shadows.soft,
    justifyContent: 'center',
  },
  quoteText: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.primary,
    lineHeight: 28,
    marginBottom: 12,
    fontStyle: 'italic'
  },
  author: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.accent,
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
    gap: 8,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.border,
  },
  dotActive: {
    width: 20,
    backgroundColor: colors.primary,
  }
});
