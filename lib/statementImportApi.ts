import { useMutation, useQueryClient } from '@tanstack/react-query';
import { fetch as expoFetch } from 'expo/fetch';
import { File as ExpoFile } from 'expo-file-system';

import { NET_WORTH_KEY } from './dashboard';
import { ACCOUNTS_KEY } from './accounts';
import { SNAPSHOTS_KEY } from './snapshots';
import { CASHFLOW_KEY } from './spending';
import { supabase } from './supabase';
import { TRANSACTIONS_KEY } from './transactions';
import {
  buildStatementImportPayload,
  type StatementDraftTransaction,
  type StatementParseResult,
  type StatementSnapshot,
} from './statementImport';
import type { Json } from '@/types/database';

const STATEMENT_IMPORT_URL = process.env.EXPO_PUBLIC_STATEMENT_IMPORT_URL?.replace(/\/$/, '');
const ID_QUERY_CHUNK_SIZE = 100;

export interface PickedStatementFile {
  uri: string;
  name: string;
  mimeType?: string | null;
  webFile?: File | null;
}

export interface ImportStatementInput {
  draft: StatementDraftTransaction[];
  accountId: string;
  snapshot: StatementSnapshot | null;
}

interface StatementImportRpcResult {
  imported: number;
  skippedDuplicates: number;
  snapshotSaved: boolean;
}

export async function parseStatementFile(file: PickedStatementFile): Promise<StatementParseResult> {
  if (!STATEMENT_IMPORT_URL) {
    throw new Error('Statement import is not configured in this build.');
  }
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Your Delphi session has expired. Sign in again.');

  const pdf = file.webFile ?? new ExpoFile(file.uri);

  const response = await expoFetch(`${STATEMENT_IMPORT_URL}/v1/statements/parse`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/pdf',
    },
    body: pdf,
  });
  const payload = await response.json().catch(() => null) as { detail?: string } | StatementParseResult | null;
  if (!response.ok) {
    throw new Error(payload && 'detail' in payload && payload.detail
      ? payload.detail
      : `Statement parser error (${response.status}).`);
  }
  return payload as StatementParseResult;
}

function chunk<T>(values: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

export async function fetchExistingStatementIds(externalIds: string[]): Promise<Set<string>> {
  const existing = new Set<string>();
  for (const ids of chunk([...new Set(externalIds)], ID_QUERY_CHUNK_SIZE)) {
    if (!ids.length) continue;
    const { data, error } = await supabase
      .from('transactions')
      .select('external_id')
      .eq('source', 'csv_import')
      .in('external_id', ids);
    if (error) throw error;
    for (const row of data) {
      if (row.external_id) existing.add(row.external_id);
    }
  }
  return existing;
}

export function useImportStatementTransactions() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ draft, accountId, snapshot }: ImportStatementInput) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Your Delphi session has expired. Sign in again.');

      const selected = draft.filter(transaction => transaction.selected && !transaction.duplicate);
      const existing = await fetchExistingStatementIds(selected.map(transaction => transaction.externalId));
      const freshDraft = selected.map(transaction => ({
        ...transaction,
        duplicate: existing.has(transaction.externalId),
        selected: !existing.has(transaction.externalId),
      }));
      const payload = buildStatementImportPayload(freshDraft, session.user.id, accountId, snapshot);
      if (!payload.transactions.length && !payload.snapshot) {
        return { imported: 0, skippedDuplicates: selected.length, snapshotSaved: false };
      }

      const { data, error } = await supabase.rpc('import_statement_batch', {
        p_account_id: accountId,
        p_transactions: payload.transactions as Json,
        p_snapshot: payload.snapshot as unknown as Json | null,
      });
      if (error) throw error;
      const result = data as unknown as StatementImportRpcResult;
      if (
        typeof result?.imported !== 'number'
        || typeof result?.skippedDuplicates !== 'number'
        || typeof result?.snapshotSaved !== 'boolean'
      ) {
        throw new Error('Statement import returned an invalid result.');
      }
      return result;
    },
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: TRANSACTIONS_KEY });
      queryClient.invalidateQueries({ queryKey: CASHFLOW_KEY });
      queryClient.invalidateQueries({ queryKey: ['spending'] });
      queryClient.invalidateQueries({ queryKey: ACCOUNTS_KEY });
      queryClient.invalidateQueries({ queryKey: SNAPSHOTS_KEY(variables.accountId) });
      queryClient.invalidateQueries({ queryKey: NET_WORTH_KEY });
    },
  });
}
