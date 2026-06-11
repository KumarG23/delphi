import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useAccounts } from '@/lib/accounts';
import { useAskDelphi, type ChatMessage } from '@/lib/askDelphi';
import { buildFinancialContext } from '@/lib/askDelphi/context';
import { DELPHI_PERSONA } from '@/lib/askDelphi/persona';
import { computeGoalProgress, useGoals } from '@/lib/goals';
import { useCurrentCashflow } from '@/lib/spending';
import { useNetWorthHistory } from '@/lib/dashboard';
import DelphiAvatar from '@/components/DelphiAvatar';
import {
  fontSize,
  fontWeight,
  letterSpacing,
  radius,
  space,
  themeDark,
  tint,
} from '@/constants/tokens';
import { palette } from '@/constants/tokens';

const T = themeDark;

const GREETING = "Hi, I'm Delphi! 🐾 Ask me anything about your money.";

const IN_CHAR_ERROR =
  "Meow — I can't reach my brain right now. Is the Z420 awake and on Tailscale?";

interface Props {
  visible: boolean;
  onClose: () => void;
}

interface UIMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  isGreeting?: boolean;
}

function getCurrentMonth(): string {
  return new Date().toISOString().slice(0, 7); // 'YYYY-MM'
}

function makeId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function AskDelphiSheet({ visible, onClose }: Props) {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<UIMessage[]>([
    { id: 'greeting', role: 'assistant', content: GREETING, isGreeting: true },
  ]);

  const { data: accounts } = useAccounts();
  const { data: netWorthHistory } = useNetWorthHistory();
  const { data: goalsRaw = [] } = useGoals();
  const currentMonth = getCurrentMonth();
  const { data: cashflow } = useCurrentCashflow(currentMonth);

  const ask = useAskDelphi();
  const isPending = ask.isPending;

  const scrollRef = useRef<ScrollView>(null);
  const inputRef = useRef<TextInput>(null);

  // Reset conversation (local only) when sheet opens
  useEffect(() => {
    if (visible) {
      setMessages([
        { id: 'greeting', role: 'assistant', content: GREETING, isGreeting: true },
      ]);
      setInput('');
      // Focus input shortly after open on platforms that support it
      const t = setTimeout(() => {
        inputRef.current?.focus();
      }, 300);
      return () => clearTimeout(t);
    }
  }, [visible]);

  // Auto-scroll to bottom when messages or pending state change
  useEffect(() => {
    if (visible) {
      const t = setTimeout(() => {
        scrollRef.current?.scrollToEnd({ animated: true });
      }, 50);
      return () => clearTimeout(t);
    }
  }, [messages, isPending, visible]);

  // Full system message: persona FIRST (Ollama's request system message replaces
  // the Modelfile SYSTEM), then the live financial snapshot (now including goals).
  function buildSystemMessage(): string {
    const goalProgresses = goalsRaw.map((goal) => ({
      goal,
      progress: computeGoalProgress(goal, { accounts, netWorthHistory }),
    }));
    const snapshot = buildFinancialContext({ accounts, netWorthHistory, cashflow, goals: goalProgresses });
    return `${DELPHI_PERSONA}\n\n## The user's current financial snapshot\n${snapshot}`;
  }

  function getPriorTurns(): ChatMessage[] {
    // Only real (non-greeting) turns, as user/assistant. Cap to last 10.
    const real = messages.filter(m => !m.isGreeting);
    const capped = real.slice(-10);
    return capped.map((m) => ({
      role: m.role,
      content: m.content,
    }));
  }

  async function handleSend() {
    const trimmed = input.trim();
    if (!trimmed || isPending) return;

    // Add the user message to UI immediately
    const userMsg: UIMessage = { id: makeId(), role: 'user', content: trimmed };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInput('');

    // Build payload: fresh context + prior real turns + new user turn
    const contextMsg: ChatMessage = {
      role: 'system',
      content: buildSystemMessage(),
    };
    const prior = getPriorTurns();
    const payload: ChatMessage[] = [contextMsg, ...prior, { role: 'user', content: trimmed }];

    try {
      const replyText = await ask.mutateAsync(payload);
      const assistantMsg: UIMessage = {
        id: makeId(),
        role: 'assistant',
        content: replyText || "Meow. (The model came back empty — try again?)",
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (e) {
      // Surface in-character error as an assistant bubble (never raw crash)
      const assistantErr: UIMessage = {
        id: makeId(),
        role: 'assistant',
        content: IN_CHAR_ERROR,
      };
      setMessages((prev) => [...prev, assistantErr]);
    }
  }

  function handleClose() {
    // Do not persist; conversation is ephemeral to the open sheet (per spec)
    onClose();
  }

  const canSend = input.trim().length > 0 && !isPending;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.kvContainer}
        >
          <View style={styles.sheet}>
            <View style={styles.handle} />

            {/* Header */}
            <View style={styles.sheetHeader}>
              <View style={styles.titleRow}>
                <DelphiAvatar size={28} />
                <Text style={styles.sheetTitle}>Ask Delphi</Text>
              </View>
              <Pressable onPress={handleClose} style={styles.closeBtn} hitSlop={12}>
                <Text style={styles.closeBtnText}>✕</Text>
              </Pressable>
            </View>

            {/* Messages */}
            <ScrollView
              ref={scrollRef}
              style={styles.messagesScroll}
              contentContainerStyle={styles.messagesContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {messages.map((m) => {
                const isUser = m.role === 'user';
                return (
                  <View
                    key={m.id}
                    style={[
                      styles.bubbleRow,
                      isUser ? styles.bubbleRowUser : styles.bubbleRowAssistant,
                    ]}
                  >
                    {!isUser && (
                      <View style={styles.avatarWrap}>
                        <DelphiAvatar size={28} />
                      </View>
                    )}
                    <View
                      style={[
                        styles.bubble,
                        isUser ? styles.bubbleUser : styles.bubbleAssistant,
                      ]}
                    >
                      <Text
                        style={[
                          styles.bubbleText,
                          isUser ? styles.bubbleTextUser : styles.bubbleTextAssistant,
                        ]}
                      >
                        {m.content}
                      </Text>
                    </View>
                  </View>
                );
              })}

              {/* Typing indicator */}
              {isPending && (
                <View style={[styles.bubbleRow, styles.bubbleRowAssistant]}>
                  <View style={styles.avatarWrap}>
                    <DelphiAvatar size={28} />
                  </View>
                  <View style={[styles.bubble, styles.bubbleAssistant, styles.typingBubble]}>
                    <Text style={[styles.bubbleText, styles.bubbleTextAssistant]}>
                      Delphi is thinking…
                    </Text>
                  </View>
                </View>
              )}
            </ScrollView>

            {/* Input row (pinned bottom) */}
            <View style={styles.inputBar}>
              <TextInput
                ref={inputRef}
                style={styles.input}
                value={input}
                onChangeText={setInput}
                placeholder="Ask about your money…"
                placeholderTextColor={T.textDim}
                multiline
                maxLength={2000}
                editable={!isPending}
                returnKeyType="send"
                onSubmitEditing={handleSend}
                blurOnSubmit={false}
                // Web: Enter sends, Shift+Enter inserts a newline (standard chat UX).
                onKeyPress={(e: any) => {
                  if (
                    Platform.OS === 'web' &&
                    e.nativeEvent?.key === 'Enter' &&
                    !e.nativeEvent?.shiftKey
                  ) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
              />
              <Pressable
                onPress={handleSend}
                disabled={!canSend}
                style={({ pressed }) => [
                  styles.sendBtn,
                  (!canSend || pressed) && styles.sendBtnDisabled,
                ]}
                hitSlop={8}
              >
                {isPending ? (
                  <ActivityIndicator color={T.primaryFg} size="small" />
                ) : (
                  <Text style={styles.sendBtnText}>↑</Text>
                )}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  kvContainer: {
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: T.card,
    borderTopLeftRadius: radius['3xl'],
    borderTopRightRadius: radius['3xl'],
    paddingBottom: space['12'],
    maxHeight: '88%',
    minHeight: 420,
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: T.border,
    borderRadius: radius.pill,
    alignSelf: 'center',
    marginTop: space['6'],
    marginBottom: space['4'],
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space['8'],
    paddingBottom: space['6'],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: T.border,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space['3'],
  },
  sheetTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: palette.gold,
    letterSpacing: letterSpacing.tight,
  },
  closeBtn: { padding: space['4'] },
  closeBtnText: {
    fontSize: fontSize.md,
    color: T.textMuted,
  },

  messagesScroll: {
    flex: 1,
  },
  messagesContent: {
    paddingHorizontal: space['8'],
    paddingVertical: space['8'],
    gap: space['6'],
    paddingBottom: space['10'],
  },

  bubbleRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: space['2'],
  },
  bubbleRowAssistant: {
    justifyContent: 'flex-start',
  },
  bubbleRowUser: {
    justifyContent: 'flex-end',
  },

  avatarWrap: {
    width: 28,
    height: 28,
    borderRadius: radius.pill,
    overflow: 'hidden',
    marginBottom: 2,
  },

  bubble: {
    maxWidth: '78%',
    borderRadius: radius.xl,
    paddingHorizontal: space['4'],
    paddingVertical: space['3'],
  },
  bubbleAssistant: {
    backgroundColor: T.cardSoft,
    borderWidth: 1,
    borderColor: T.border,
  },
  bubbleUser: {
    backgroundColor: tint(palette.gold, 0.18),
    borderWidth: 1,
    borderColor: tint(palette.gold, 0.35),
  },
  bubbleText: {
    fontSize: fontSize.md,
    lineHeight: 20,
  },
  bubbleTextAssistant: {
    color: T.text,
  },
  bubbleTextUser: {
    color: T.text,
  },
  typingBubble: {
    opacity: 0.9,
  },

  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: space['2'],
    paddingHorizontal: space['8'],
    paddingTop: space['4'],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: T.border,
    backgroundColor: T.card,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    backgroundColor: T.bg,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: radius.lg,
    paddingHorizontal: space['4'],
    paddingVertical: space['3'],
    fontSize: fontSize.md,
    color: T.text,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.lg,
    backgroundColor: palette.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    opacity: 0.5,
  },
  sendBtnText: {
    fontSize: 22,
    color: T.bg,
    fontWeight: fontWeight.extrabold,
    lineHeight: 22,
    marginTop: -2,
  },
});
