-- Las claves compuestas impiden enlazar registros pertenecientes a otro usuario.
alter table public.cards add constraint cards_owner_id_unique unique (user_id, id);
alter table public.categories add constraint categories_owner_id_unique unique (user_id, id);
alter table public.statements add constraint statements_owner_id_unique unique (user_id, id);
alter table public.statements add constraint statements_owner_card_id_unique unique (user_id, card_id, id);
alter table public.subscriptions add constraint subscriptions_owner_id_unique unique (user_id, id);
alter table public.transactions add constraint transactions_owner_id_unique unique (user_id, id);

alter table public.statements add constraint statements_owner_card_fk foreign key (user_id, card_id) references public.cards (user_id, id);
alter table public.subscriptions add constraint subscriptions_owner_card_fk foreign key (user_id, card_id) references public.cards (user_id, id);
alter table public.subscriptions add constraint subscriptions_owner_category_fk foreign key (user_id, category_id) references public.categories (user_id, id);
alter table public.transactions add constraint transactions_owner_card_fk foreign key (user_id, card_id) references public.cards (user_id, id);
alter table public.transactions add constraint transactions_owner_statement_fk foreign key (user_id, card_id, statement_id) references public.statements (user_id, card_id, id);
alter table public.transactions add constraint transactions_owner_category_fk foreign key (user_id, category_id) references public.categories (user_id, id);
alter table public.transactions add constraint transactions_owner_subscription_fk foreign key (user_id, subscription_id) references public.subscriptions (user_id, id);
alter table public.transactions add constraint transactions_owner_parent_fk foreign key (user_id, parent_id) references public.transactions (user_id, id);
alter table public.installments add constraint installments_owner_transaction_fk foreign key (user_id, transaction_id) references public.transactions (user_id, id);
alter table public.installments add constraint installments_owner_statement_fk foreign key (user_id, statement_id) references public.statements (user_id, id);

do $$
declare table_name text;
begin
  foreach table_name in array array['cards', 'categories', 'statements', 'subscriptions', 'transactions', 'installments', 'notification_log'] loop
    execute format('revoke all on public.%I from anon', table_name);
    execute format('grant select, insert, update, delete on public.%I to authenticated', table_name);
    execute format('create policy owner_select on public.%I for select to authenticated using ((select auth.uid()) = user_id)', table_name);
    execute format('create policy owner_insert on public.%I for insert to authenticated with check ((select auth.uid()) = user_id)', table_name);
    execute format('create policy owner_update on public.%I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', table_name);
    execute format('create policy owner_delete on public.%I for delete to authenticated using ((select auth.uid()) = user_id)', table_name);
  end loop;
end;
$$;
revoke all on public.fx_rates from anon, authenticated;
grant select on public.fx_rates to authenticated;
create policy fx_rates_read on public.fx_rates for select to authenticated using (true);
