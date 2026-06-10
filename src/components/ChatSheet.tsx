import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Animated,
  PanResponder,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  Modal,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import type { WeatherScenario, City } from '../data/weatherData';
import { useWeatherChat } from '../hooks/useWeatherChat';
import { INK, MUTED, HAIR } from '../utils/colors';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const { height: SCREEN_H } = Dimensions.get('window');
const COLLAPSED_H = SCREEN_H * 0.6;
const EXPANDED_H = SCREEN_H * 0.94;

// ---------------------------------------------------------------------------
// SparkIcon
// ---------------------------------------------------------------------------

interface SparkIconProps {
  size?: number;
  color?: string;
}

const SparkIcon: React.FC<SparkIconProps> = ({ size = 20, color = INK }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path
      d="M12 2.5l1.9 5.6 5.6 1.9-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.9L12 2.5z"
      fill={color}
    />
    <Path
      d="M19 14.5l.8 2.3 2.3.8-2.3.8-.8 2.3-.8-2.3-2.3-.8 2.3-.8.8-2.3z"
      fill={color}
      opacity={0.55}
    />
  </Svg>
);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ChatSheetProps {
  wx: WeatherScenario;
  unit: 'C' | 'F';
  visible: boolean;
  onClose: () => void;
  /** Active city (for chat context coords); falls back to wx.location if absent. */
  city?: Pick<City, 'name' | 'lat' | 'lon'> | null;
}

// ---------------------------------------------------------------------------
// Suggestion chips
// ---------------------------------------------------------------------------

const SUGGESTIONS = [
  'Do I need an umbrella?',
  'What should I wear?',
  'Best time to go outside?',
  'Will it rain later?',
];

// ---------------------------------------------------------------------------
// TypingIndicator
// ---------------------------------------------------------------------------

const TypingIndicator: React.FC = () => {
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const bounce = (anim: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, { toValue: -6, duration: 250, useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0, duration: 250, useNativeDriver: true }),
        ]),
      );
    const a1 = bounce(dot1, 0);
    const a2 = bounce(dot2, 150);
    const a3 = bounce(dot3, 300);
    a1.start();
    a2.start();
    a3.start();
    return () => { a1.stop(); a2.stop(); a3.stop(); };
  }, [dot1, dot2, dot3]);

  return (
    <View style={styles.typingRow}>
      <View style={styles.typingBubble}>
        {[dot1, dot2, dot3].map((d, i) => (
          <Animated.View
            key={i}
            style={[styles.typingDot, { transform: [{ translateY: d }] }]}
          />
        ))}
      </View>
    </View>
  );
};

// ---------------------------------------------------------------------------
// ChatSheet component
// ---------------------------------------------------------------------------

const ChatSheet: React.FC<ChatSheetProps> = ({ wx, unit, visible, onClose, city }) => {
  const slideAnim = useRef(new Animated.Value(SCREEN_H)).current;
  const sheetHeight = useRef(new Animated.Value(COLLAPSED_H)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const currentHeight = useRef(COLLAPSED_H);
  const scrollRef = useRef<ScrollView>(null);

  const { messages, isTyping, sendMessage: sendChat, reset } = useWeatherChat({ wx, unit, city });
  const [inputText, setInputText] = useState('');

  // Track sheetHeight for panresponder
  useEffect(() => {
    const id = sheetHeight.addListener(({ value }) => {
      currentHeight.current = value;
    });
    return () => sheetHeight.removeListener(id);
  }, [sheetHeight]);

  // Slide in/out animation
  useEffect(() => {
    if (visible) {
      sheetHeight.setValue(COLLAPSED_H);
      currentHeight.current = COLLAPSED_H;
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          // JS driver: this view also animates `height`, which the native
          // animated module can't drive — mixing drivers on one style throws.
          useNativeDriver: false,
          tension: 65,
          friction: 11,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: SCREEN_H,
          duration: 280,
          useNativeDriver: false,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: 280,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, slideAnim, backdropOpacity, sheetHeight]);

  // PanResponder for drag
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dy) > 4,
      onPanResponderMove: (_, gs) => {
        const newH = Math.min(EXPANDED_H, Math.max(COLLAPSED_H * 0.5, currentHeight.current - gs.dy));
        sheetHeight.setValue(newH);
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dy > 80) {
          // Swipe down => close
          onClose();
        } else if (gs.dy < -50) {
          // Swipe up => expand
          Animated.spring(sheetHeight, {
            toValue: EXPANDED_H,
            useNativeDriver: false,
            tension: 65,
            friction: 11,
          }).start();
        } else {
          // Snap to nearest
          const mid = (COLLAPSED_H + EXPANDED_H) / 2;
          const target = currentHeight.current > mid ? EXPANDED_H : COLLAPSED_H;
          Animated.spring(sheetHeight, {
            toValue: target,
            useNativeDriver: false,
            tension: 65,
            friction: 11,
          }).start();
        }
      },
    }),
  ).current;

  const sendMessage = useCallback(
    (text: string) => {
      if (!text.trim() || !wx) return;
      setInputText('');

      // Expand sheet when sending a message
      Animated.spring(sheetHeight, {
        toValue: EXPANDED_H,
        useNativeDriver: false,
        tension: 65,
        friction: 11,
      }).start();

      sendChat(text);
    },
    [wx, sendChat, sheetHeight],
  );

  // Auto-scroll when messages change
  useEffect(() => {
    if (messages.length > 0 || isTyping) {
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages, isTyping]);

  // Reset on close: abort any in-flight stream and clear chat state once the
  // slide-out animation has finished.
  useEffect(() => {
    if (!visible) {
      const timer = setTimeout(() => {
        reset();
        setInputText('');
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [visible, reset]);

  if (!visible) return null;

  return (
    <Modal transparent visible={visible} animationType="none" statusBarTranslucent>
      {/* Backdrop */}
      <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Dismiss chat"
        />
      </Animated.View>

      {/* Sheet */}
      <Animated.View
        style={[
          styles.sheet,
          {
            height: sheetHeight,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        {/* Drag handle */}
        <View {...panResponder.panHandlers} style={styles.handleArea}>
          <View style={styles.grabber} />
        </View>

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <SparkIcon size={22} color={INK} />
            <View style={styles.headerTitles}>
              <Text style={styles.headerTitle}>WeatherAI</Text>
              {wx && (
                <Text style={styles.headerSubtitle}>
                  {wx.location} · {wx.time}
                </Text>
              )}
            </View>
          </View>
          <TouchableOpacity
            onPress={onClose}
            style={styles.closeBtn}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityRole="button"
            accessibilityLabel="Close chat"
          >
            <Text style={styles.closeBtnText}>{'\u2715'}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.divider} />

        {/* Messages */}
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={20}
        >
          <ScrollView
            ref={scrollRef}
            style={styles.flex}
            contentContainerStyle={styles.messagesContent}
            keyboardShouldPersistTaps="handled"
          >
            {messages.length === 0 && !isTyping && (
              <View style={styles.suggestionsContainer}>
                <Text style={styles.suggestionsLabel}>Try asking</Text>
                <View style={styles.chipsWrap}>
                  {SUGGESTIONS.map((s) => (
                    <TouchableOpacity
                      key={s}
                      style={styles.chip}
                      onPress={() => sendMessage(s)}
                      activeOpacity={0.7}
                      accessibilityRole="button"
                      accessibilityLabel={`Ask: ${s}`}
                    >
                      <Text style={styles.chipText}>{s}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {messages.map((msg) => (
              <View
                key={msg.id}
                style={[
                  styles.bubbleRow,
                  msg.role === 'user' ? styles.bubbleRowRight : styles.bubbleRowLeft,
                ]}
              >
                <View
                  style={[
                    styles.bubble,
                    msg.role === 'user' ? styles.bubbleUser : styles.bubbleAssistant,
                  ]}
                >
                  <Text
                    style={[
                      styles.bubbleText,
                      msg.role === 'user' ? styles.bubbleTextUser : styles.bubbleTextAssistant,
                    ]}
                  >
                    {msg.text}
                  </Text>
                </View>
              </View>
            ))}

            {isTyping && <TypingIndicator />}
          </ScrollView>

          {/* Composer */}
          <View style={styles.composer}>
            <TextInput
              style={styles.input}
              placeholder="Ask about the weather..."
              placeholderTextColor={MUTED}
              value={inputText}
              onChangeText={setInputText}
              onSubmitEditing={() => sendMessage(inputText)}
              returnKeyType="send"
              multiline={false}
              accessibilityLabel="Message input"
              accessibilityHint="Type a question about the weather"
            />
            <TouchableOpacity
              style={[styles.sendBtn, !inputText.trim() && styles.sendBtnDisabled]}
              onPress={() => sendMessage(inputText)}
              disabled={!inputText.trim()}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Send message"
              accessibilityState={{ disabled: !inputText.trim() }}
            >
              <Text style={styles.sendBtnText}>{'\u2191'}</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Animated.View>
    </Modal>
  );
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  flex: { flex: 1 },

  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },

  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
  },

  handleArea: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 4,
  },

  grabber: {
    width: 38,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: HAIR,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },

  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  headerTitles: {
    gap: 1,
  },

  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: INK,
  },

  headerSubtitle: {
    fontSize: 12,
    color: MUTED,
    fontWeight: '500',
  },

  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: HAIR,
    alignItems: 'center',
    justifyContent: 'center',
  },

  closeBtnText: {
    fontSize: 14,
    color: MUTED,
    fontWeight: '600',
  },

  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: HAIR,
    marginHorizontal: 20,
  },

  messagesContent: {
    padding: 20,
    paddingBottom: 8,
    flexGrow: 1,
  },

  suggestionsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },

  suggestionsLabel: {
    fontSize: 14,
    color: MUTED,
    fontWeight: '600',
    marginBottom: 16,
  },

  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
    maxWidth: 320,
  },

  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#f5f4f7',
    borderWidth: 1,
    borderColor: HAIR,
  },

  chipText: {
    fontSize: 14,
    color: INK,
    fontWeight: '500',
  },

  bubbleRow: {
    marginBottom: 12,
    flexDirection: 'row',
  },

  bubbleRowRight: {
    justifyContent: 'flex-end',
  },

  bubbleRowLeft: {
    justifyContent: 'flex-start',
  },

  bubble: {
    maxWidth: '80%',
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 20,
  },

  bubbleUser: {
    backgroundColor: INK,
    borderBottomRightRadius: 6,
  },

  bubbleAssistant: {
    backgroundColor: '#f5f4f7',
    borderBottomLeftRadius: 6,
  },

  bubbleText: {
    fontSize: 15,
    lineHeight: 21,
  },

  bubbleTextUser: {
    color: '#fff',
  },

  bubbleTextAssistant: {
    color: INK,
  },

  typingRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    marginBottom: 12,
  },

  typingBubble: {
    flexDirection: 'row',
    gap: 5,
    backgroundColor: '#f5f4f7',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 20,
    borderBottomLeftRadius: 6,
  },

  typingDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: MUTED,
  },

  composer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: HAIR,
    gap: 10,
  },

  input: {
    flex: 1,
    fontSize: 15,
    color: INK,
    backgroundColor: '#f5f4f7',
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingVertical: 10,
    maxHeight: 44,
  },

  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: INK,
    alignItems: 'center',
    justifyContent: 'center',
  },

  sendBtnDisabled: {
    opacity: 0.3,
  },

  sendBtnText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginTop: -1,
  },
});

export default ChatSheet;
