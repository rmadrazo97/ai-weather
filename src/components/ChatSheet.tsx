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
  Keyboard,
  Platform,
  Modal,
} from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { WeatherScenario, City } from '../data/weatherData';
import { useWeatherChat } from '../hooks/useWeatherChat';
import { useLiveClock } from '../utils/liveClock';
import { stripMarkdown } from '../utils/stripMarkdown';
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
// Header icons
// ---------------------------------------------------------------------------

const HistoryIcon: React.FC<{ size?: number; color?: string }> = ({
  size = 18,
  color = INK,
}) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Circle cx={12} cy={12} r={9} stroke={color} strokeWidth={2} />
    <Path
      d="M12 7v5l3.5 2"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

const NewChatIcon: React.FC<{ size?: number; color?: string }> = ({
  size = 18,
  color = INK,
}) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M12 5v14M5 12h14"
      stroke={color}
      strokeWidth={2.2}
      strokeLinecap="round"
    />
  </Svg>
);

// ---------------------------------------------------------------------------
// Session time formatting
// ---------------------------------------------------------------------------

function fmtSessionTime(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

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
  const insets = useSafeAreaInsets();
  const liveTime = useLiveClock(wx?.utcOffsetSeconds, wx?.time);
  const slideAnim = useRef(new Animated.Value(SCREEN_H)).current;
  const sheetHeight = useRef(new Animated.Value(COLLAPSED_H)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const keyboardOffset = useRef(new Animated.Value(0)).current;
  const currentHeight = useRef(COLLAPSED_H);
  // Height to restore the sheet to once the keyboard dismisses.
  const heightBeforeKeyboard = useRef<number | null>(null);
  // Current keyboard lift (0 when hidden) so the expand-on-send can stay clamped.
  const keyboardLift = useRef(0);
  const scrollRef = useRef<ScrollView>(null);

  const {
    messages,
    isTyping,
    sendMessage: sendChat,
    stop,
    sessions,
    activeSessionId,
    newChat,
    openSession,
    deleteSession,
  } = useWeatherChat({ wx, unit, city });
  const [inputText, setInputText] = useState('');
  const [showHistory, setShowHistory] = useState(false);

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

  // Keyboard avoidance. The sheet is absolutely positioned at bottom:0 with a
  // fixed height, so the composer sits behind the keyboard. We lift the whole
  // sheet by (keyboardHeight − safe-area inset) and, if needed, shrink it so
  // the header never slides above the safe area at the top.
  useEffect(() => {
    if (!visible) return;
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const onShow = (e: any) => {
      const kbHeight = e?.endCoordinates?.height ?? 0;
      const duration = e?.duration ?? 250;
      const lift = Math.max(0, kbHeight - insets.bottom);
      keyboardLift.current = lift;
      // Largest height that keeps the lifted sheet's top at/below the safe area.
      const maxHeight = SCREEN_H - lift - insets.top - 8;
      if (heightBeforeKeyboard.current === null) {
        heightBeforeKeyboard.current = currentHeight.current;
      }
      const targetHeight = Math.min(heightBeforeKeyboard.current, maxHeight);
      Animated.parallel([
        Animated.timing(keyboardOffset, {
          toValue: -lift,
          duration,
          useNativeDriver: false,
        }),
        Animated.timing(sheetHeight, {
          toValue: targetHeight,
          duration,
          useNativeDriver: false,
        }),
      ]).start();
    };

    const onHide = (e: any) => {
      const duration = e?.duration ?? 250;
      const restore = heightBeforeKeyboard.current ?? COLLAPSED_H;
      heightBeforeKeyboard.current = null;
      keyboardLift.current = 0;
      Animated.parallel([
        Animated.timing(keyboardOffset, {
          toValue: 0,
          duration,
          useNativeDriver: false,
        }),
        Animated.timing(sheetHeight, {
          toValue: restore,
          duration,
          useNativeDriver: false,
        }),
      ]).start();
    };

    const showSub = Keyboard.addListener(showEvt, onShow);
    const hideSub = Keyboard.addListener(hideEvt, onHide);
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [visible, insets.bottom, insets.top, keyboardOffset, sheetHeight]);

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

      // Expand sheet when sending. If the keyboard is up, cap the height so the
      // header stays on screen, and remember to restore to expanded on dismiss.
      const lift = keyboardLift.current;
      const target =
        lift > 0 ? Math.min(EXPANDED_H, SCREEN_H - lift - insets.top - 8) : EXPANDED_H;
      if (lift > 0) heightBeforeKeyboard.current = EXPANDED_H;
      Animated.spring(sheetHeight, {
        toValue: target,
        useNativeDriver: false,
        tension: 65,
        friction: 11,
      }).start();

      sendChat(text);
    },
    [wx, sendChat, sheetHeight, insets.top],
  );

  // Auto-scroll when messages change or the sheet reopens onto a restored
  // conversation (the ScrollView remounts at the top).
  useEffect(() => {
    if (visible && (messages.length > 0 || isTyping)) {
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [visible, messages, isTyping]);

  // On close: abort any in-flight stream. The conversation itself is kept
  // (persisted per city) so reopening restores it.
  useEffect(() => {
    if (!visible) {
      keyboardOffset.setValue(0);
      keyboardLift.current = 0;
      heightBeforeKeyboard.current = null;
      const timer = setTimeout(() => {
        stop();
        setInputText('');
        setShowHistory(false);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [visible, stop, keyboardOffset]);

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
            transform: [{ translateY: Animated.add(slideAnim, keyboardOffset) }],
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
                  {wx.location} · {liveTime}
                </Text>
              )}
            </View>
          </View>
          <View style={styles.headerRight}>
            {messages.length > 0 && !showHistory && (
              <TouchableOpacity
                onPress={newChat}
                style={styles.iconBtn}
                hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                accessibilityRole="button"
                accessibilityLabel="New conversation"
              >
                <NewChatIcon color={MUTED} />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={() => setShowHistory((v) => !v)}
              style={[styles.iconBtn, showHistory && styles.iconBtnActive]}
              hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
              accessibilityRole="button"
              accessibilityLabel={showHistory ? 'Back to conversation' : 'Past conversations'}
              accessibilityState={{ selected: showHistory }}
            >
              <HistoryIcon color={showHistory ? INK : MUTED} />
            </TouchableOpacity>
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
        </View>

        <View style={styles.divider} />

        {showHistory ? (
          /* Past conversations (location scoped) */
          <ScrollView style={styles.flex} contentContainerStyle={styles.historyContent}>
            <Text style={styles.historyTitle}>
              Past conversations{wx ? ` · ${wx.location}` : ''}
            </Text>

            <TouchableOpacity
              style={styles.historyNewRow}
              onPress={() => {
                newChat();
                setShowHistory(false);
              }}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Start a new conversation"
            >
              <NewChatIcon size={16} color={INK} />
              <Text style={styles.historyNewText}>New conversation</Text>
            </TouchableOpacity>

            {sessions.length === 0 && (
              <Text style={styles.historyEmpty}>
                No past conversations here yet.
              </Text>
            )}

            {sessions.map((s) => (
              <View
                key={s.id}
                style={[
                  styles.historyRow,
                  s.id === activeSessionId && styles.historyRowActive,
                ]}
              >
                <TouchableOpacity
                  style={styles.historyRowMain}
                  onPress={() => {
                    openSession(s.id);
                    setShowHistory(false);
                  }}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel={`Open conversation: ${s.title}`}
                >
                  <Text style={styles.historyRowTitle} numberOfLines={1}>
                    {s.title}
                  </Text>
                  <Text style={styles.historyRowMeta}>
                    {fmtSessionTime(s.updatedAt)} · {s.messages.length} messages
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => deleteSession(s.id)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  accessibilityRole="button"
                  accessibilityLabel={`Delete conversation: ${s.title}`}
                >
                  <Text style={styles.historyDeleteText}>{'✕'}</Text>
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        ) : (
        /* Messages */
        <View style={styles.flex}>
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
                    {msg.role === 'assistant' ? stripMarkdown(msg.text) : msg.text}
                  </Text>
                </View>
              </View>
            ))}

            {isTyping && <TypingIndicator />}
          </ScrollView>

          {/* Composer */}
          <View style={[styles.composer, { paddingBottom: Math.max(10, insets.bottom) }]}>
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
        </View>
        )}
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

  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },

  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },

  iconBtnActive: {
    backgroundColor: HAIR,
  },

  historyContent: {
    padding: 20,
    paddingBottom: 32,
  },

  historyTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: MUTED,
    letterSpacing: 0.4,
    marginBottom: 14,
  },

  historyNewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: HAIR,
    marginBottom: 16,
  },

  historyNewText: {
    fontSize: 15,
    fontWeight: '600',
    color: INK,
  },

  historyEmpty: {
    fontSize: 14,
    color: MUTED,
    textAlign: 'center',
    paddingVertical: 24,
  },

  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    marginBottom: 6,
  },

  historyRowActive: {
    backgroundColor: '#f5f4f7',
  },

  historyRowMain: {
    flex: 1,
    gap: 3,
  },

  historyRowTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: INK,
  },

  historyRowMeta: {
    fontSize: 12,
    color: MUTED,
    fontWeight: '500',
  },

  historyDeleteText: {
    fontSize: 13,
    color: MUTED,
    fontWeight: '600',
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
