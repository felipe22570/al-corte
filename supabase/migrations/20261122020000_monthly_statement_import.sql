-- Step 38 (H11, F22, D55): monthly import of a statement file, in a single transaction, with a preview that undoes itself.
-- The file never reaches the database: the server sends only the movements the owner accepted, already built.

create function public.import_statement_file(p_payload jsonb, p_dry_run boolean)
returns jsonb language plpgsql volatile security invoker set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_item jsonb;
  v_balance jsonb;
  v_id uuid;
  v_statement uuid;
  v_created integer := 0;
  v_linked integer := 0;
  v_results jsonb := '[]'::jsonb;
  v_result jsonb;
begin
  if v_user is null then raise exception 'No autorizado' using errcode = '42501'; end if;
  if jsonb_typeof(p_payload->'create') is distinct from 'array' or jsonb_typeof(p_payload->'link') is distinct from 'array'
     or jsonb_typeof(p_payload->'statements') is distinct from 'array' then
    raise exception 'Importación inválida' using errcode = '22023';
  end if;

  -- The preview runs exactly the same code and undoes it at the end; variables survive the rollback of the block.
  begin
    -- New movements go through the registration RPC, so they are validated as any other one. Importing the same file
    -- twice does not duplicate them: the file key is unique per owner (D36).
    for v_item in select value from jsonb_array_elements(p_payload->'create') loop
      if char_length(v_item->>'key') not between 1 and 100 then raise exception 'Importación inválida' using errcode = '22023'; end if;
      continue when exists (select 1 from public.transactions where user_id = v_user and import_key = v_item->>'key');
      begin
        v_id := public.create_transaction_with_installments(v_item->'payload');
      exception when others then
        raise exception '%: %', v_item->>'key', sqlerrm using errcode = sqlstate;
      end;
      update public.transactions set import_key = v_item->>'key', source = 'import' where id = v_id and user_id = v_user;
      -- D41: the fee of a new advance comes with it and keeps the bank's line as its key.
      if v_item->'fee' is not null and jsonb_typeof(v_item->'fee') = 'object' then
        update public.transactions set import_key = v_item->'fee'->>'key', source = 'import', merchant = nullif(v_item->'fee'->>'merchant', '')
        where parent_id = v_id and user_id = v_user and type = 'advance_fee';
      end if;
      v_created := v_created + 1;
    end loop;

    -- "Es el mismo" only stores the file key on the existing movement; nothing else changes (D55).
    for v_item in select value from jsonb_array_elements(p_payload->'link') loop
      if char_length(v_item->>'key') not between 1 and 100 then raise exception 'Importación inválida' using errcode = '22023'; end if;
      continue when exists (select 1 from public.transactions where user_id = v_user and import_key = v_item->>'key');
      update public.transactions set import_key = v_item->>'key'
      where id = (v_item->>'transaction_id')::uuid and user_id = v_user and import_key is null and type <> 'payment';
      if found then v_linked := v_linked + 1; end if;
    end loop;

    -- Bank values of the statement, only where empty: never over values the owner already has, nor its reconciliation.
    for v_item in select value from jsonb_array_elements(p_payload->'statements') loop
      if not exists (select 1 from public.cards where id = (v_item->>'card_id')::uuid and user_id = v_user and archived_at is null) then
        raise exception 'Tarjeta no disponible' using errcode = '42501';
      end if;
      v_statement := public.ensure_statement((v_item->>'card_id')::uuid, (v_item->>'cutoff_date')::date);
      for v_balance in select value from jsonb_array_elements(v_item->'balances') loop
        if v_balance->>'currency' not in ('COP', 'USD') then raise exception 'Importación inválida' using errcode = '22023'; end if;
        insert into public.statement_balances (user_id, statement_id, currency, real_minimum, real_total)
        values (v_user, v_statement, (v_balance->>'currency')::public.currency_code, nullif(v_balance->>'real_minimum', '')::numeric, nullif(v_balance->>'real_total', '')::numeric)
        on conflict (statement_id, currency) do update set
          real_minimum = coalesce(public.statement_balances.real_minimum, excluded.real_minimum),
          real_total = coalesce(public.statement_balances.real_total, excluded.real_total);
        -- Verification: the calculated values next to the bank's, as the statement shows them.
        select jsonb_build_object(
          'card_id', v_item->>'card_id', 'cutoff_date', v_item->>'cutoff_date', 'currency', v_balance->>'currency',
          'minimum', coalesce(t.total_calculated, 0)::text, 'debt', coalesce(t.total_debt, 0)::text,
          'real_minimum', b.real_minimum::text, 'real_total', b.real_total::text,
          'available', (select available::text from public.card_balances where card_id = (v_item->>'card_id')::uuid))
        into v_result
        from public.statement_balances b
        left join public.statement_currency_totals t on t.statement_id = b.statement_id and t.currency = b.currency
        where b.statement_id = v_statement and b.currency = (v_balance->>'currency')::public.currency_code;
        v_results := v_results || jsonb_build_array(v_result);
      end loop;
    end loop;

    if p_dry_run then raise exception 'Vista previa' using errcode = 'P0D01'; end if;
  exception when sqlstate 'P0D01' then
    null;
  end;
  return jsonb_build_object('created', v_created, 'linked', v_linked, 'statements', v_results, 'dry_run', p_dry_run);
end;
$$;
revoke all on function public.import_statement_file(jsonb, boolean) from public, anon;
grant execute on function public.import_statement_file(jsonb, boolean) to authenticated;
