create policy plaid_items_server_only
on public.plaid_items
for all
to anon, authenticated
using (false)
with check (false);

create policy plaid_accounts_server_only
on public.plaid_accounts
for all
to anon, authenticated
using (false)
with check (false);

alter function public.set_updated_at() set search_path = pg_catalog;
alter function public.sync_archived_at() set search_path = pg_catalog;
alter function public.validate_budget_category() set search_path = public, pg_catalog;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
revoke execute on function public.seed_default_categories(uuid) from public, anon, authenticated;
