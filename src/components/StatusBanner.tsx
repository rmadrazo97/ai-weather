import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { INK, MUTED } from '../utils/colors';

interface StatusBannerProps {
  message: string;
  onRetry: () => void;
}

/**
 * Slim banner shown under the status bar when a refresh failed and we are
 * displaying cached data, e.g. "Couldn't refresh · showing 5:12 PM data".
 */
const StatusBanner: React.FC<StatusBannerProps> = ({ message, onRetry }) => {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.wrap, { top: insets.top + 6 }]} pointerEvents="box-none">
      <View style={styles.banner}>
        <Text style={styles.message} numberOfLines={1}>
          {message}
        </Text>
        <TouchableOpacity
          onPress={onRetry}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
          accessibilityLabel="Retry refreshing weather"
        >
          <Text style={styles.retry}>Retry</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 20,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
    maxWidth: '90%',
  },
  message: {
    fontSize: 13,
    color: MUTED,
    fontWeight: '500',
    flexShrink: 1,
  },
  retry: {
    fontSize: 13,
    color: INK,
    fontWeight: '700',
  },
});

export default StatusBanner;
