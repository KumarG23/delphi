import { useEffect, useState } from 'react';
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

import { useEvents, useCreateEvent, useDeleteEvent } from '@/lib/events';
import { confirmDialog, infoDialog } from '@/lib/dialog';
import { fmtTooltipDate } from '@/lib/format';
import {
  components,
  fontSize,
  fontWeight,
  letterSpacing,
  radius,
  space,
  themeDark,
} from '@/constants/tokens';
import type { Event } from '@/types/database';

const T = themeDark;

interface Props {
  visible: boolean;
  onClose: () => void;
}

export function EventsSheet({ visible, onClose }: Props) {
  const { data: events = [] } = useEvents();
  const createEvent = useCreateEvent();
  const deleteEvent = useDeleteEvent();
  const isBusy = createEvent.isPending || deleteEvent.isPending;

  const [dateStr, setDateStr] = useState('');
  const [label, setLabel] = useState('');
  const [note, setNote] = useState('');

  // Reset form + defaults when sheet opens
  useEffect(() => {
    if (visible) {
      const today = new Date().toISOString().split('T')[0];
      setDateStr(today);
      setLabel('');
      setNote('');
    }
  }, [visible]);

  function handleClose() {
    setDateStr('');
    setLabel('');
    setNote('');
    onClose();
  }

  async function handleAdd() {
    const trimmedLabel = label.trim();
    if (!trimmedLabel) {
      await infoDialog('Label required', 'Please enter a short label for the event.');
      return;
    }
    if (!dateStr) {
      await infoDialog('Date required', 'Please enter an event date (YYYY-MM-DD).');
      return;
    }

    try {
      await createEvent.mutateAsync({
        event_date: dateStr,
        label: trimmedLabel,
        note: note.trim() || null,
      });
      // Clear add form (list will refresh via invalidate)
      setLabel('');
      setNote('');
      const today = new Date().toISOString().split('T')[0];
      setDateStr(today);
    } catch (e) {
      await infoDialog('Error', (e as Error).message);
    }
  }

  async function handleDelete(ev: Event) {
    const confirmed = await confirmDialog(
      'Delete event',
      `Delete "${ev.label}" on ${fmtTooltipDate(ev.event_date)}?`,
      { confirmLabel: 'Delete', destructive: true },
    );
    if (!confirmed) return;
    try {
      await deleteEvent.mutateAsync(ev.id);
    } catch (e) {
      await infoDialog('Error', (e as Error).message);
    }
  }

  // Newest first for the list (per spec)
  const sortedEvents = [...events].sort((a, b) =>
    b.event_date.localeCompare(a.event_date)
  );

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
              <Text style={styles.sheetTitle}>Events</Text>
              <Pressable onPress={handleClose} style={styles.closeBtn} hitSlop={12}>
                <Text style={styles.closeBtnText}>✕</Text>
              </Pressable>
            </View>

            <ScrollView
              contentContainerStyle={styles.body}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {/* List (newest first) */}
              {sortedEvents.length === 0 ? (
                <View style={styles.empty}>
                  <Text style={styles.emptyText}>Mark a milestone on your timeline.</Text>
                </View>
              ) : (
                <View style={styles.list}>
                  {sortedEvents.map((ev, idx) => (
                    <View
                      key={ev.id}
                      style={[
                        styles.eventRow,
                        idx < sortedEvents.length - 1 && styles.eventRowDivider,
                      ]}
                    >
                      <View style={styles.eventMeta}>
                        <Text style={styles.eventDate}>
                          {fmtTooltipDate(ev.event_date)}
                        </Text>
                        <Text style={styles.eventLabel} numberOfLines={1}>
                          {ev.label}
                        </Text>
                        {ev.note ? (
                          <Text style={styles.eventNote} numberOfLines={2}>
                            {ev.note}
                          </Text>
                        ) : null}
                      </View>
                      <Pressable
                        onPress={() => handleDelete(ev)}
                        disabled={isBusy}
                        hitSlop={10}
                        style={styles.deleteBtn}
                      >
                        <Text style={styles.deleteText}>✕</Text>
                      </Pressable>
                    </View>
                  ))}
                </View>
              )}

              {/* Add form */}
              <View style={styles.addSection}>
                <Text style={styles.sectionLabel}>Add milestone</Text>

                <View style={styles.field}>
                  <Text style={styles.label}>Date</Text>
                  <TextInput
                    style={styles.input}
                    value={dateStr}
                    onChangeText={setDateStr}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={T.textDim}
                    keyboardType="numbers-and-punctuation"
                    returnKeyType="next"
                  />
                </View>

                <View style={styles.field}>
                  <Text style={styles.label}>Label *</Text>
                  <TextInput
                    style={styles.input}
                    value={label}
                    onChangeText={setLabel}
                    placeholder="e.g. Started debt snowball"
                    placeholderTextColor={T.textDim}
                    autoCapitalize="sentences"
                    returnKeyType="next"
                  />
                </View>

                <View style={styles.field}>
                  <Text style={styles.label}>Note (optional)</Text>
                  <TextInput
                    style={[styles.input, styles.noteInput]}
                    value={note}
                    onChangeText={setNote}
                    placeholder="Any extra context..."
                    placeholderTextColor={T.textDim}
                    autoCapitalize="sentences"
                    multiline
                    numberOfLines={2}
                    returnKeyType="done"
                  />
                </View>

                <Pressable
                  style={({ pressed }) => [
                    styles.addBtn,
                    (pressed || isBusy) && styles.pressed,
                  ]}
                  onPress={handleAdd}
                  disabled={isBusy}
                >
                  {createEvent.isPending ? (
                    <ActivityIndicator color={T.primaryFg} />
                  ) : (
                    <Text style={styles.addBtnText}>Add event</Text>
                  )}
                </Pressable>
              </View>
            </ScrollView>
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
    paddingBottom: space['4'],
  },
  sheetTitle: {
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.bold,
    color: T.text,
    letterSpacing: letterSpacing.tight,
  },
  closeBtn: { padding: space['4'] },
  closeBtnText: {
    fontSize: fontSize.md,
    color: T.textMuted,
  },
  body: {
    paddingHorizontal: space['8'],
    paddingBottom: space['8'],
  },
  empty: {
    paddingVertical: space['6'],
    alignItems: 'center',
  },
  emptyText: {
    fontSize: fontSize.sm,
    color: T.textDim,
    fontStyle: 'italic',
  },
  list: {
    backgroundColor: T.cardSoft,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: T.border,
    overflow: 'hidden',
    marginBottom: space['6'],
  },
  eventRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: space['4'],
    paddingVertical: space['3'],
    gap: space['3'],
  },
  eventRowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: T.border,
  },
  eventMeta: {
    flex: 1,
    gap: space['1'],
  },
  eventDate: {
    fontSize: fontSize.xs,
    color: T.textMuted,
    fontWeight: fontWeight.medium,
  },
  eventLabel: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: T.text,
  },
  eventNote: {
    fontSize: fontSize.xs,
    color: T.textDim,
  },
  deleteBtn: {
    padding: space['1'],
  },
  deleteText: {
    fontSize: fontSize.md,
    color: T.danger,
  },
  addSection: {
    marginTop: space['2'],
  },
  sectionLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: T.textMuted,
    marginBottom: space['3'],
  },
  field: {
    gap: space['1'],
    marginBottom: space['3'],
  },
  label: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    color: T.textMuted,
    textTransform: 'uppercase',
    letterSpacing: letterSpacing.widest,
  },
  input: {
    height: components.inputHeight,
    backgroundColor: T.bg,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: radius.md,
    paddingHorizontal: space['4'],
    fontSize: fontSize.md,
    color: T.text,
  },
  noteInput: {
    height: 60,
    textAlignVertical: 'top',
    paddingTop: space['3'],
  },
  addBtn: {
    height: 44,
    borderRadius: radius.md,
    backgroundColor: T.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: space['2'],
  },
  addBtnText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.extrabold,
    color: T.primaryFg,
    letterSpacing: letterSpacing.wide,
  },
  pressed: { opacity: 0.7 },
});
