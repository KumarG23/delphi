begin;

-- Abort rather than silently choosing a winner if legacy imports already contain duplicates.
do $$
begin
  if exists (
    select 1
    from public.transactions
    where external_id is not null
    group by user_id, source, external_id
    having count(*) > 1
  ) then
    raise exception 'Duplicate transaction external IDs must be resolved before applying this migration.';
  end if;
end $$;

-- Multiple NULL external IDs remain allowed for ordinary manual transactions.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'transactions_user_source_external_unique'
      and conrelid = 'public.transactions'::regclass
  ) then
    alter table public.transactions
      add constraint transactions_user_source_external_unique
      unique (user_id, source, external_id);
  end if;
end $$;

-- Transaction ownership includes every referenced row, not only transactions.user_id.
drop policy if exists "transactions: insert own" on public.transactions;
create policy "transactions: insert own"
on public.transactions
for insert
with check (
  auth.uid() = user_id
  and (
    account_id is null
    or exists (
      select 1 from public.accounts a
      where a.id = account_id and a.user_id = auth.uid()
    )
  )
  and (
    category_id is null
    or exists (
      select 1 from public.categories c
      where c.id = category_id and c.user_id = auth.uid()
    )
  )
);

drop policy if exists "transactions: update own" on public.transactions;
create policy "transactions: update own"
on public.transactions
for update
using (auth.uid() = user_id)
with check (
  auth.uid() = user_id
  and (
    account_id is null
    or exists (
      select 1 from public.accounts a
      where a.id = account_id and a.user_id = auth.uid()
    )
  )
  and (
    category_id is null
    or exists (
      select 1 from public.categories c
      where c.id = category_id and c.user_id = auth.uid()
    )
  )
);

commit;

select
  exists (
    select 1 from pg_constraint
    where conname = 'transactions_user_source_external_unique'
      and conrelid = 'public.transactions'::regclass
  ) as unique_constraint_ready,
  exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'transactions'
      and policyname = 'transactions: insert own'
  ) as insert_policy_ready,
  exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'transactions'
      and policyname = 'transactions: update own'
  ) as update_policy_ready;
