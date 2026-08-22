begin;

-- Snapshot ownership must include the referenced account, not only snapshots.user_id.
drop policy if exists "snapshots: insert own" on public.balance_snapshots;
create policy "snapshots: insert own"
on public.balance_snapshots
for insert
with check (
  auth.uid() = user_id
  and exists (
    select 1
    from public.accounts a
    where a.id = account_id
      and a.user_id = auth.uid()
  )
);

drop policy if exists "snapshots: update own" on public.balance_snapshots;
create policy "snapshots: update own"
on public.balance_snapshots
for update
using (auth.uid() = user_id)
with check (
  auth.uid() = user_id
  and exists (
    select 1
    from public.accounts a
    where a.id = account_id
      and a.user_id = auth.uid()
  )
);

-- One approval writes new transaction rows and the statement balance snapshot in
-- a single database transaction. Duplicate transactions are ignored by the
-- deployed (user_id, source, external_id) uniqueness constraint.
create or replace function public.import_statement_batch(
  p_account_id uuid,
  p_transactions jsonb default '[]'::jsonb,
  p_snapshot jsonb default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_requested integer := 0;
  v_imported integer := 0;
  v_snapshot_saved boolean := false;
  v_snapshot_date date;
  v_balance numeric(14, 2);
  v_min_payment numeric(12, 2);
  v_payment_due_date date;
  v_snapshot_rows integer := 0;
begin
  if v_user_id is null then
    raise exception 'Authentication required.';
  end if;

  if p_account_id is null or not exists (
    select 1
    from public.accounts a
    where a.id = p_account_id
      and a.user_id = v_user_id
      and a.is_active
  ) then
    raise exception 'Choose an active account you own.';
  end if;

  p_transactions := coalesce(p_transactions, '[]'::jsonb);
  if jsonb_typeof(p_transactions) <> 'array' then
    raise exception 'Transactions must be a JSON array.';
  end if;
  v_requested := jsonb_array_length(p_transactions);

  if exists (
    select 1
    from jsonb_to_recordset(p_transactions) as candidate(
      amount numeric,
      external_id text
    )
    where candidate.amount is null
      or candidate.amount < 0
      or candidate.amount::text in ('NaN', 'Infinity', '-Infinity')
      or candidate.external_id is null
      or candidate.external_id = ''
  ) then
    raise exception 'Transaction amounts must be finite nonnegative numbers with external IDs.';
  end if;

  insert into public.transactions (
    user_id,
    account_id,
    category_id,
    transaction_date,
    amount,
    kind,
    merchant,
    description,
    notes,
    source,
    external_id
  )
  select
    v_user_id,
    p_account_id,
    nullif(t.category_id, '')::uuid,
    t.transaction_date::date,
    t.amount,
    t.kind::public.transaction_kind,
    left(nullif(t.merchant, ''), 160),
    left(nullif(t.description, ''), 240),
    null,
    'csv_import'::public.transaction_source,
    t.external_id
  from jsonb_to_recordset(p_transactions) as t(
    category_id text,
    transaction_date text,
    amount numeric,
    kind text,
    merchant text,
    description text,
    external_id text
  )
  on conflict (user_id, source, external_id) do nothing;

  get diagnostics v_imported = row_count;

  if p_snapshot is not null and p_snapshot <> 'null'::jsonb then
    if jsonb_typeof(p_snapshot) <> 'object' then
      raise exception 'Snapshot must be a JSON object.';
    end if;

    v_snapshot_date := (p_snapshot ->> 'snapshotDate')::date;
    v_balance := (p_snapshot ->> 'balance')::numeric;
    v_min_payment := nullif(p_snapshot ->> 'minPayment', '')::numeric;
    v_payment_due_date := nullif(p_snapshot ->> 'paymentDueDate', '')::date;

    if v_snapshot_date is null
      or v_balance is null
      or v_balance::text in ('NaN', 'Infinity', '-Infinity')
      or v_min_payment::text in ('NaN', 'Infinity', '-Infinity')
      or v_min_payment < 0
    then
      raise exception 'Snapshot values must be finite and valid.';
    end if;

    insert into public.balance_snapshots (
      account_id,
      user_id,
      snapshot_date,
      balance,
      min_payment,
      payment_due_date,
      notes,
      is_active
    ) values (
      p_account_id,
      v_user_id,
      v_snapshot_date,
      v_balance,
      v_min_payment,
      v_payment_due_date,
      'Imported from PayPal statement',
      true
    )
    on conflict on constraint uq_snapshot_account_date do update
    set balance = excluded.balance,
        min_payment = coalesce(excluded.min_payment, public.balance_snapshots.min_payment),
        payment_due_date = coalesce(excluded.payment_due_date, public.balance_snapshots.payment_due_date),
        notes = excluded.notes,
        is_active = true,
        entered_at = now()
    where public.balance_snapshots.user_id = v_user_id;

    get diagnostics v_snapshot_rows = row_count;
    if v_snapshot_rows <> 1 then
      raise exception 'The balance snapshot could not be saved for this account.';
    end if;
    v_snapshot_saved := true;
  end if;

  return jsonb_build_object(
    'imported', v_imported,
    'skippedDuplicates', v_requested - v_imported,
    'snapshotSaved', v_snapshot_saved
  );
end;
$$;

revoke all on function public.import_statement_batch(uuid, jsonb, jsonb) from public;
grant execute on function public.import_statement_batch(uuid, jsonb, jsonb) to authenticated;

commit;

select
  to_regprocedure('public.import_statement_batch(uuid,jsonb,jsonb)') is not null as import_rpc_ready,
  exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'balance_snapshots'
      and policyname = 'snapshots: insert own'
  ) as snapshot_insert_policy_ready,
  exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'balance_snapshots'
      and policyname = 'snapshots: update own'
  ) as snapshot_update_policy_ready;
