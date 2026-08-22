import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAccounts } from '@/lib/accounts';
import { infoDialog } from '@/lib/dialog';
import {
  createStatementDraft,
  type StatementCategory,
  type StatementDraftTransaction,
  type StatementParseResult,
} from '@/lib/statementImport';
import {
  fetchExistingStatementIds,
  parseStatementFile,
  useImportStatementTransactions,
} from '@/lib/statementImportApi';
import { useCategories } from '@/lib/transactions';
import {
  categoryColor,
  fontSize,
  fontWeight,
  letterSpacing,
  palette,
  radius,
  space,
  themeDark,
  tint,
} from '@/constants/tokens';

const T = themeDark;

interface Props {
  visible: boolean;
  onClose: () => void;
}

function fmtCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

function fmtDate(value: string): string {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    .format(new Date(`${value}T12:00:00`));
}

function displayAccountName(account: { name: string; nickname: string | null }): string {
  return account.nickname ?? account.name;
}

export function StatementImportSheet({ visible, onClose }: Props) {
  const [result, setResult] = useState<StatementParseResult | null>(null);
  const [draft, setDraft] = useState<StatementDraftTransaction[]>([]);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [categoryTarget, setCategoryTarget] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [cacheCleanupFailed, setCacheCleanupFailed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{
    imported: number;
    skippedDuplicates: number;
    snapshotSaved: boolean;
  } | null>(null);

  const { data: accounts = [] } = useAccounts();
  const { data: categories = [] } = useCategories();
  const importMutation = useImportStatementTransactions();

  const statementCategories = useMemo<StatementCategory[]>(
    () => categories.map(category => ({ id: category.id, name: category.name, type: category.type })),
    [categories],
  );
  const selectedCount = draft.filter(transaction => transaction.selected && !transaction.duplicate).length;
  const duplicateCount = draft.filter(transaction => transaction.duplicate).length;
  const snapshotReady = Boolean(result?.snapshot && accountId);
  const hasImportWork = selectedCount > 0 || snapshotReady;

  useEffect(() => {
    if (!visible || accountId || !accounts.length) return;
    const paypal = accounts.find(account =>
      /paypal/i.test(`${account.name} ${account.nickname ?? ''} ${account.institution ?? ''}`),
    );
    if (paypal) setAccountId(paypal.id);
  }, [visible, accountId, accounts]);

  function reset() {
    setResult(null);
    setDraft([]);
    setAccountId(null);
    setCategoryTarget(null);
    setIsParsing(false);
    setCacheCleanupFailed(false);
    setError(null);
    setSuccess(null);
    importMutation.reset();
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function pickStatement() {
    setError(null);
    setSuccess(null);
    setResult(null);
    setDraft([]);
    setCacheCleanupFailed(false);
    setIsParsing(true);
    let nativeCopyUri: string | null = null;
    try {
      const picked = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (picked.canceled) return;

      const asset = picked.assets[0];
      if (Platform.OS !== 'web') nativeCopyUri = asset.uri;
      const parsed = await parseStatementFile({
        uri: asset.uri,
        name: asset.name || 'paypal-statement.pdf',
        mimeType: asset.mimeType,
        webFile: Platform.OS === 'web' ? asset.file : null,
      });
      const existing = await fetchExistingStatementIds(
        parsed.transactions.map(transaction => transaction.externalId),
      );
      setResult(parsed);
      setDraft(createStatementDraft(parsed.transactions, existing, statementCategories));
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setIsParsing(false);
      if (nativeCopyUri) {
        try {
          new File(nativeCopyUri).delete();
        } catch {
          setCacheCleanupFailed(true);
        }
      }
    }
  }

  function toggleTransaction(externalId: string) {
    setDraft(current => current.map(transaction =>
      transaction.externalId === externalId && !transaction.duplicate
        ? { ...transaction, selected: !transaction.selected }
        : transaction,
    ));
  }

  function assignCategory(externalId: string, categoryId: string | null) {
    setDraft(current => current.map(transaction =>
      transaction.externalId === externalId ? { ...transaction, categoryId } : transaction,
    ));
    setCategoryTarget(null);
  }

  function setAllSelected(selected: boolean) {
    setDraft(current => current.map(transaction => ({
      ...transaction,
      selected: transaction.duplicate ? false : selected,
    })));
  }

  async function importSelected() {
    if (!accountId) {
      await infoDialog('Choose an account', 'Link this statement to the Delphi account it belongs to.');
      return;
    }
    if (!hasImportWork) {
      await infoDialog('Nothing to save', 'No new transactions or closing balance are ready to save.');
      return;
    }
    try {
      const imported = await importMutation.mutateAsync({
        draft,
        accountId,
        snapshot: result?.snapshot ?? null,
      });
      setSuccess(imported);
    } catch (caught) {
      setError((caught as Error).message);
    }
  }

  const header = (
    <View style={styles.body}>
      {!result && !success && (
        <View style={styles.dropCard}>
          <Text style={styles.dropIcon}>⇩</Text>
          <Text style={styles.dropTitle}>Drop a PayPal statement</Text>
          <Text style={styles.dropCopy}>
            Choose the monthly PDF from Files. It is parsed privately on Hermes and deleted after extraction.
          </Text>
          <Pressable
            style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
            onPress={pickStatement}
            disabled={isParsing}
          >
            {isParsing
              ? <ActivityIndicator color={T.primaryFg} />
              : <Text style={styles.primaryBtnText}>Choose PayPal PDF</Text>}
          </Pressable>
        </View>
      )}

      {error && (
        <View style={styles.errorCard}>
          <Text style={styles.errorTitle}>Import stopped</Text>
          <Text style={styles.errorText}>{error}</Text>
          {result ? (
            <Pressable style={styles.retryBtn} onPress={() => setError(null)}>
              <Text style={styles.retryText}>Review and retry import</Text>
            </Pressable>
          ) : (
            <Pressable style={styles.retryBtn} onPress={pickStatement} disabled={isParsing}>
              <Text style={styles.retryText}>Choose another PDF</Text>
            </Pressable>
          )}
        </View>
      )}

      {success && (
        <View style={styles.successCard}>
          <Text style={styles.successIcon}>✓</Text>
          <Text style={styles.successTitle}>Statement imported</Text>
          <Text style={styles.successText}>
            {success.imported > 0
              ? `Added ${success.imported} transaction${success.imported === 1 ? '' : 's'}.`
              : 'No new transactions were added.'}
            {success.skippedDuplicates > 0
              ? ` Skipped ${success.skippedDuplicates} duplicate${success.skippedDuplicates === 1 ? '' : 's'}.`
              : ''}
            {success.snapshotSaved ? ' Updated the account balance from the statement.' : ''}
          </Text>
          <Pressable style={styles.primaryBtn} onPress={handleClose}>
            <Text style={styles.primaryBtnText}>Done</Text>
          </Pressable>
        </View>
      )}

      {result && !success && (
        <>
          <View style={styles.summaryCard}>
            <View style={styles.summaryTop}>
              <View>
                <Text style={styles.eyebrow}>PAYPAL PDF</Text>
                <Text style={styles.summaryTitle}>{result.transactionCount} transactions found</Text>
              </View>
              <Text style={styles.summaryDates}>
                {fmtDate(result.dateRange.start)} – {fmtDate(result.dateRange.end)}
              </Text>
            </View>
            <View style={styles.summaryStats}>
              <Text style={styles.statGood}>{selectedCount} ready</Text>
              <Text style={styles.statMuted}>{duplicateCount} duplicates</Text>
            </View>
            {result.snapshot && (
              <View style={styles.snapshotPreview}>
                <View>
                  <Text style={styles.snapshotLabel}>CLOSING BALANCE</Text>
                  <Text style={styles.snapshotDate}>{fmtDate(result.snapshot.snapshotDate)}</Text>
                </View>
                <Text style={styles.snapshotAmount}>{fmtCurrency(result.snapshot.balance)}</Text>
              </View>
            )}
            {result.warnings.map(warning => (
              <Text key={warning} style={styles.warningText}>• {warning}</Text>
            ))}
          </View>

          <Text style={styles.sectionLabel}>LINK TO ACCOUNT</Text>
          <View style={styles.accountPills}>
            <Pressable
              style={[styles.pill, accountId === null && styles.pillActiveNeutral]}
              onPress={() => setAccountId(null)}
            >
              <Text style={[styles.pillText, accountId === null && { color: T.text }]}>None</Text>
            </Pressable>
            {accounts.map(account => {
              const active = account.id === accountId;
              const color = categoryColor[account.category];
              return (
                <Pressable
                  key={account.id}
                  style={[
                    styles.pill,
                    active && { borderColor: color, backgroundColor: tint(color, 0.16) },
                  ]}
                  onPress={() => setAccountId(account.id)}
                >
                  <View style={[styles.accountDot, { backgroundColor: color }]} />
                  <Text style={[styles.pillText, active && { color }]}>{displayAccountName(account)}</Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.reviewHeader}>
            <Text style={styles.sectionLabel}>REVIEW TRANSACTIONS</Text>
            <View style={styles.selectActions}>
              <Pressable onPress={() => setAllSelected(true)}><Text style={styles.actionText}>All</Text></Pressable>
              <Text style={styles.actionDivider}>·</Text>
              <Pressable onPress={() => setAllSelected(false)}><Text style={styles.actionText}>None</Text></Pressable>
            </View>
          </View>
        </>
      )}
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Import statement</Text>
            <Text style={styles.subtitle}>Private preview before anything is saved</Text>
          </View>
          <Pressable onPress={handleClose} hitSlop={12} style={styles.closeBtn}>
            <Text style={styles.closeText}>✕</Text>
          </Pressable>
        </View>

        <FlatList
          data={result && !success ? draft : []}
          keyExtractor={item => item.externalId}
          ListHeaderComponent={header}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const category = categories.find(candidate => candidate.id === item.categoryId);
            const kindColor = item.kind === 'income'
              ? palette.green
              : item.kind === 'expense' ? palette.red : T.textMuted;
            const editableCategories = categories.filter(candidate => candidate.type === item.kind);
            return (
              <View style={[styles.txCard, item.duplicate && styles.txCardDuplicate]}>
                <Pressable
                  style={styles.txMain}
                  onPress={() => toggleTransaction(item.externalId)}
                  disabled={item.duplicate}
                >
                  <View style={[
                    styles.checkbox,
                    item.selected && { backgroundColor: T.primary, borderColor: T.primary },
                    item.duplicate && styles.checkboxDisabled,
                  ]}>
                    {item.selected && <Text style={styles.checkmark}>✓</Text>}
                  </View>
                  <View style={styles.txCopy}>
                    <Text style={styles.txMerchant} numberOfLines={1}>{item.merchant}</Text>
                    <Text style={styles.txMeta} numberOfLines={1}>
                      {fmtDate(item.transactionDate)} · {item.description}
                    </Text>
                  </View>
                  <Text style={[styles.txAmount, { color: item.duplicate ? T.textDim : kindColor }]}>
                    {item.kind === 'income' ? '+' : item.kind === 'expense' ? '-' : '↔ '}{fmtCurrency(item.amount)}
                  </Text>
                </Pressable>

                <View style={styles.txFooter}>
                  {item.duplicate ? (
                    <Text style={styles.duplicateText}>Already in Delphi</Text>
                  ) : item.kind === 'transfer' ? (
                    <Text style={styles.transferCategoryText}>No category needed</Text>
                  ) : (
                    <Pressable onPress={() => setCategoryTarget(
                      categoryTarget === item.externalId ? null : item.externalId,
                    )}>
                      <Text style={[styles.categoryText, !category && { color: T.warning }]}>
                        {category?.icon ? `${category.icon} ` : ''}{category?.name ?? 'Choose category'} ▾
                      </Text>
                    </Pressable>
                  )}
                </View>

                {item.kind !== 'transfer' && categoryTarget === item.externalId && (
                  <View style={styles.categoryPills}>
                    <Pressable style={styles.miniPill} onPress={() => assignCategory(item.externalId, null)}>
                      <Text style={styles.miniPillText}>None</Text>
                    </Pressable>
                    {editableCategories.map(candidate => (
                      <Pressable
                        key={candidate.id}
                        style={[
                          styles.miniPill,
                          item.categoryId === candidate.id && {
                            borderColor: candidate.color ?? kindColor,
                            backgroundColor: tint(candidate.color ?? kindColor, 0.16),
                          },
                        ]}
                        onPress={() => assignCategory(item.externalId, candidate.id)}
                      >
                        <Text style={styles.miniPillText}>{candidate.icon ? `${candidate.icon} ` : ''}{candidate.name}</Text>
                      </Pressable>
                    ))}
                  </View>
                )}
              </View>
            );
          }}
          ListFooterComponent={result && !success ? (
            <View style={styles.footer}>
              <Pressable
                style={({ pressed }) => [
                  styles.primaryBtn,
                  (!hasImportWork || !accountId || importMutation.isPending) && styles.primaryBtnDisabled,
                  pressed && styles.pressed,
                ]}
                onPress={importSelected}
                disabled={!hasImportWork || !accountId || importMutation.isPending}
              >
                {importMutation.isPending
                  ? <ActivityIndicator color={T.primaryFg} />
                  : <Text style={styles.primaryBtnText}>
                    {selectedCount > 0
                      ? `Import ${selectedCount} transaction${selectedCount === 1 ? '' : 's'}${result?.snapshot ? ' + balance' : ''}`
                      : 'Save balance snapshot'}
                  </Text>}
              </Pressable>
              <Text style={[styles.privacyNote, cacheCleanupFailed && { color: T.warning }]}>
                {cacheCleanupFailed
                  ? 'Parser retained nothing, but Android did not confirm removal of its temporary picker copy.'
                  : 'The temporary PDF copy was removed. Only approved transactions and the displayed balance snapshot are saved.'}
              </Text>
            </View>
          ) : <View style={{ height: space['8'] }} />}
        />
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg },
  header: {
    paddingTop: space['4'], paddingHorizontal: space['8'], paddingBottom: space['6'],
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderBottomWidth: 1, borderBottomColor: T.border,
  },
  title: { color: T.text, fontSize: fontSize['2xl'], fontWeight: fontWeight.extrabold, letterSpacing: letterSpacing.tight },
  subtitle: { color: T.textMuted, fontSize: fontSize.sm, marginTop: 2 },
  closeBtn: { padding: space['3'] },
  closeText: { color: T.textMuted, fontSize: fontSize.lg },
  listContent: { paddingBottom: space['12'] },
  body: { paddingHorizontal: space['8'], paddingTop: space['6'], gap: space['4'] },
  dropCard: { alignItems: 'center', backgroundColor: T.card, borderRadius: radius['2xl'], borderWidth: 1, borderColor: T.border, padding: space['8'], gap: space['4'] },
  dropIcon: { color: T.primary, fontSize: 48, fontWeight: fontWeight.bold },
  dropTitle: { color: T.text, fontSize: fontSize.xl, fontWeight: fontWeight.bold },
  dropCopy: { color: T.textMuted, fontSize: fontSize.sm, lineHeight: 20, textAlign: 'center' },
  primaryBtn: { minHeight: 48, borderRadius: radius.lg, backgroundColor: T.primary, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space['6'], paddingVertical: space['4'], alignSelf: 'stretch' },
  primaryBtnDisabled: { opacity: 0.45 },
  primaryBtnText: { color: T.primaryFg, fontSize: fontSize.md, fontWeight: fontWeight.bold },
  pressed: { opacity: 0.74 },
  errorCard: { backgroundColor: tint(T.danger, 0.1), borderColor: tint(T.danger, 0.45), borderWidth: 1, borderRadius: radius.xl, padding: space['6'], gap: space['3'] },
  errorTitle: { color: T.danger, fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  errorText: { color: T.text, fontSize: fontSize.sm, lineHeight: 20 },
  retryBtn: { paddingVertical: space['2'], alignSelf: 'flex-start' },
  retryText: { color: T.primary, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  successCard: { alignItems: 'center', backgroundColor: tint(T.primary, 0.1), borderColor: tint(T.primary, 0.45), borderWidth: 1, borderRadius: radius['2xl'], padding: space['8'], gap: space['4'] },
  successIcon: { color: T.primary, fontSize: 44, fontWeight: fontWeight.bold },
  successTitle: { color: T.text, fontSize: fontSize.xl, fontWeight: fontWeight.bold },
  successText: { color: T.textMuted, fontSize: fontSize.sm, textAlign: 'center', lineHeight: 20 },
  summaryCard: { backgroundColor: T.card, borderRadius: radius.xl, borderWidth: 1, borderColor: T.border, padding: space['5'], gap: space['3'] },
  summaryTop: { flexDirection: 'row', justifyContent: 'space-between', gap: space['4'] },
  eyebrow: { color: T.primary, fontSize: fontSize.xs, fontWeight: fontWeight.bold, letterSpacing: letterSpacing.wide },
  summaryTitle: { color: T.text, fontSize: fontSize.lg, fontWeight: fontWeight.bold, marginTop: 2 },
  summaryDates: { color: T.textMuted, fontSize: fontSize.xs, textAlign: 'right', maxWidth: 140 },
  summaryStats: { flexDirection: 'row', gap: space['4'] },
  snapshotPreview: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: T.border, paddingTop: space['3'] },
  snapshotLabel: { color: T.textMuted, fontSize: fontSize.xs, fontWeight: fontWeight.bold, letterSpacing: letterSpacing.wide },
  snapshotDate: { color: T.textMuted, fontSize: fontSize.xs, marginTop: 2 },
  snapshotAmount: { color: T.danger, fontSize: fontSize.lg, fontWeight: fontWeight.bold, fontVariant: ['tabular-nums'] },
  statGood: { color: T.primary, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  statMuted: { color: T.textMuted, fontSize: fontSize.sm },
  warningText: { color: T.warning, fontSize: fontSize.xs, lineHeight: 17 },
  sectionLabel: { color: T.textMuted, fontSize: fontSize.xs, fontWeight: fontWeight.bold, letterSpacing: letterSpacing.wide },
  accountPills: { flexDirection: 'row', flexWrap: 'wrap', gap: space['2'] },
  pill: { minHeight: 36, borderRadius: radius.pill, borderWidth: 1, borderColor: T.border, flexDirection: 'row', alignItems: 'center', paddingHorizontal: space['4'], gap: space['2'] },
  pillActiveNeutral: { borderColor: T.textMuted, backgroundColor: tint(T.textMuted, 0.14) },
  pillText: { color: T.textMuted, fontSize: fontSize.sm, fontWeight: fontWeight.medium },
  accountDot: { width: 7, height: 7, borderRadius: 4 },
  reviewHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: space['2'] },
  selectActions: { flexDirection: 'row', alignItems: 'center', gap: space['2'] },
  actionText: { color: T.primary, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  actionDivider: { color: T.textDim },
  txCard: { marginHorizontal: space['8'], marginTop: space['3'], backgroundColor: T.card, borderWidth: 1, borderColor: T.border, borderRadius: radius.lg, overflow: 'hidden' },
  txCardDuplicate: { opacity: 0.62 },
  txMain: { minHeight: 64, flexDirection: 'row', alignItems: 'center', paddingHorizontal: space['4'], paddingVertical: space['3'], gap: space['3'] },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 1, borderColor: T.textDim, alignItems: 'center', justifyContent: 'center' },
  checkboxDisabled: { backgroundColor: T.bgSoft, borderColor: T.border },
  checkmark: { color: T.primaryFg, fontSize: fontSize.sm, fontWeight: fontWeight.bold },
  txCopy: { flex: 1, minWidth: 0 },
  txMerchant: { color: T.text, fontSize: fontSize.md, fontWeight: fontWeight.semibold },
  txMeta: { color: T.textMuted, fontSize: fontSize.xs, marginTop: 3 },
  txAmount: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, fontVariant: ['tabular-nums'] },
  txFooter: { minHeight: 34, paddingHorizontal: space['4'], paddingBottom: space['3'], paddingLeft: 56 },
  duplicateText: { color: T.textDim, fontSize: fontSize.xs },
  transferCategoryText: { color: T.textDim, fontSize: fontSize.xs },
  categoryText: { color: T.primary, fontSize: fontSize.xs, fontWeight: fontWeight.semibold },
  categoryPills: { flexDirection: 'row', flexWrap: 'wrap', gap: space['2'], paddingHorizontal: space['4'], paddingBottom: space['4'], paddingLeft: 56 },
  miniPill: { minHeight: 30, borderRadius: radius.pill, borderWidth: 1, borderColor: T.border, justifyContent: 'center', paddingHorizontal: space['3'] },
  miniPillText: { color: T.textMuted, fontSize: fontSize.xs },
  footer: { paddingHorizontal: space['8'], paddingTop: space['6'], gap: space['3'] },
  privacyNote: { color: T.textDim, fontSize: fontSize.xs, textAlign: 'center' },
});
