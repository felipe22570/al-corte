-- Step 35 (H10): import of the real bank statements (D30, D36). Generic: the data never enters the repository.

-- D30: movements on the border of Bancolombia's variable cutoff keep the statement the bank billed them in.
-- import_key identifies an imported movement so running the import again does not duplicate it (D36).
alter table public.transactions
  add column statement_override boolean not null default false,
  add column import_key text check (char_length(import_key) between 1 and 100);
create unique index transactions_import_key_unique on public.transactions (user_id, import_key) where import_key is not null;
comment on column public.transactions.statement_override is 'Kept in the statement the bank billed it in instead of the one R1 gives its date (D30).';
comment on column public.transactions.import_key is 'Key of the movement in an al-corte-import file; unique per user (D36).';

-- Registration and edit RPCs: same as steps 32 and 34, with the statement override ------------------------------

create or replace function public.create_transaction_with_installments(p_payload jsonb)
returns uuid language plpgsql volatile security invoker set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_card public.cards%rowtype;
  v_card_id uuid;
  v_type text := p_payload->>'type';
  v_currency text := p_payload->>'currency';
  v_date date;
  v_amount numeric;
  v_amount_cop numeric;
  v_fx_rate numeric;
  v_count integer;
  v_interest_free boolean;
  v_rate numeric;
  v_prior integer;
  v_prior_paid numeric;
  v_original integer;
  v_tracked_from date;
  v_first_cutoff date;
  v_cutoff date;
  v_expected_month date;
  v_row jsonb;
  v_index integer := 0;
  v_before boolean;
  v_principal numeric;
  v_interest numeric;
  v_total numeric;
  v_balance numeric;
  v_principal_cop numeric;
  v_interest_cop numeric;
  v_total_cop numeric;
  v_sum_principal_cop numeric := 0;
  v_prior_sum numeric := 0;
  v_statement_id uuid;
  v_transaction_id uuid;
  v_category_id uuid;
  v_is_international boolean;
  v_fee numeric;
  v_override date;
begin
  if v_user is null then raise exception 'No autorizado' using errcode = '42501'; end if;
  v_card_id := (p_payload->>'card_id')::uuid;
  select * into v_card from public.cards where id = v_card_id and user_id = v_user and archived_at is null for share;
  if not found then raise exception 'Tarjeta no disponible' using errcode = '42501'; end if;

  if v_type is null or v_type not in ('purchase', 'cash_advance', 'payment', 'handling_fee', 'interest', 'insurance', 'refund', 'adjustment') then
    raise exception 'Tipo inválido' using errcode = '22023';
  end if;
  if v_currency is null or v_currency not in ('COP', 'USD') then raise exception 'Moneda inválida' using errcode = '22023'; end if;
  v_date := (p_payload->>'date')::date;
  v_amount := (p_payload->>'amount')::numeric;
  v_amount_cop := (p_payload->>'amount_cop')::numeric;
  v_fx_rate := nullif(p_payload->>'fx_rate', '')::numeric;
  v_count := (p_payload->>'installments_count')::integer;
  v_interest_free := (p_payload->>'interest_free')::boolean;
  v_rate := nullif(p_payload->>'rate_ea_applied', '')::numeric;
  v_category_id := nullif(p_payload->>'category_id', '')::uuid;
  v_prior := coalesce(nullif(p_payload->>'prior_installments', '')::integer, 0);
  v_prior_paid := coalesce(nullif(p_payload->>'prior_principal_paid', '')::numeric, 0);
  v_original := nullif(p_payload->>'original_installments_count', '')::integer;
  v_tracked_from := nullif(p_payload->>'tracked_from_cutoff', '')::date;
  -- R9: classification for Bancolombia's prepayment order; dollar purchases and advances are international by default.
  v_is_international := coalesce(nullif(p_payload->>'is_international', '')::boolean, v_currency = 'USD' and v_type in ('purchase', 'cash_advance'));

  if v_date is null or v_amount is null or v_amount_cop is null or v_amount::text in ('NaN','Infinity','-Infinity')
     or v_amount_cop::text in ('NaN','Infinity','-Infinity') or v_amount <= 0 or v_amount_cop <= 0
     or v_amount > 999999999999.99 or v_amount_cop > 999999999999.99
     or v_amount <> round(v_amount, 2) or v_amount_cop <> round(v_amount_cop, 2)
     or v_count is null or v_count not between 1 and 72 or v_interest_free is null then
    raise exception 'Datos del movimiento inválidos' using errcode = '22023';
  end if;
  if v_type not in ('purchase', 'cash_advance') and v_count <> 1 then
    raise exception 'El movimiento no admite cuotas' using errcode = '22023';
  end if;
  -- D41: each advance keeps its own fee; the card's is only the default. An in-progress advance already paid it.
  v_fee := coalesce(nullif(p_payload->>'advance_fee', '')::numeric, case when v_type = 'cash_advance' and v_prior = 0 then v_card.advance_fee else 0 end);
  if v_fee::text in ('NaN', 'Infinity', '-Infinity') or v_fee < 0 or v_fee > 999999999999.99 or v_fee <> round(v_fee, 2)
     or (v_fee > 0 and (v_type <> 'cash_advance' or v_prior > 0)) then
    raise exception 'Comisión de avance inválida' using errcode = '22023';
  end if;
  if v_type not in ('purchase', 'cash_advance') and v_is_international then
    raise exception 'Solo las compras y los avances pueden ser internacionales' using errcode = '22023';
  end if;
  -- D15: new plans up to 36 installments. D50: effective in-progress plans up to 72, original N up to 36.
  if v_prior = 0 then
    if v_count > 36 or v_prior_paid <> 0 or v_original is not null or v_tracked_from is not null then
      raise exception 'Datos del movimiento inválidos' using errcode = '22023';
    end if;
  else
    if v_type not in ('purchase', 'cash_advance') or v_prior < 1 or v_prior >= v_count
       or v_prior_paid::text in ('NaN','Infinity','-Infinity') or v_prior_paid < 0 or v_prior_paid >= v_amount
       or v_prior_paid <> round(v_prior_paid, 2)
       or (v_original is null and v_count > 36)
       or (v_original is not null and (v_original not between 2 and 36 or v_original = v_count))
       or v_tracked_from is null then
      raise exception 'Compra en curso inválida' using errcode = '22023';
    end if;
    -- Installment k sits on a real cutoff of the card, not before the purchase and not after the open statement.
    if v_tracked_from <> public.cutoff_date_for_month(v_card.cutoff_day, extract(year from v_tracked_from)::integer, extract(month from v_tracked_from)::integer)
       or v_tracked_from < public.statement_cutoff_for(v_card.cutoff_day, v_date)
       or v_tracked_from > public.statement_cutoff_for(v_card.cutoff_day, (now() at time zone 'America/Bogota')::date) then
      raise exception 'El corte de la cuota actual no es válido' using errcode = '22023';
    end if;
  end if;
  if (v_currency = 'COP' and (v_fx_rate is not null or v_amount_cop <> v_amount)) or
     (v_currency = 'USD' and (v_fx_rate is null or v_fx_rate::text in ('NaN','Infinity','-Infinity') or v_fx_rate <= 0 or v_fx_rate > 99999999.9999 or v_fx_rate <> round(v_fx_rate, 4) or v_amount_cop <> round(v_amount * v_fx_rate, 2))) then
    raise exception 'Moneda o TRM inconsistentes' using errcode = '22023';
  end if;
  if (v_type = 'purchase' and v_rate is distinct from v_card.purchase_rate_ea) or
     (v_type = 'cash_advance' and v_rate is distinct from v_card.advance_rate_ea) or
     (v_type not in ('purchase', 'cash_advance') and v_rate is not null) then
    raise exception 'La tasa de la tarjeta cambió. Revisa el movimiento.' using errcode = '22023';
  end if;
  if v_category_id is not null and not exists (select 1 from public.categories where id = v_category_id and user_id = v_user and archived_at is null) then
    raise exception 'Categoría no disponible' using errcode = '22023';
  end if;
  if jsonb_typeof(p_payload->'installments') is distinct from 'array' or
     jsonb_array_length(p_payload->'installments') <> (case when v_count > 1 then v_count else 0 end) then
    raise exception 'Número de cuotas inconsistente' using errcode = '22023';
  end if;

  -- With prior installments the movement belongs to the statement of installment k (D49), not to R1 by its date.
  v_first_cutoff := case when v_prior > 0 then v_tracked_from else public.statement_cutoff_for(v_card.cutoff_day, v_date) end;
  -- D30: a single-installment charge on the border of a variable bank cutoff keeps the statement the bank billed it in,
  -- the previous or the next one by R1.
  v_override := nullif(p_payload->>'statement_cutoff_override', '')::date;
  if v_override is not null then
    if v_count <> 1 or v_prior > 0
       or v_override <> public.cutoff_date_for_month(v_card.cutoff_day, extract(year from v_override)::integer, extract(month from v_override)::integer)
       or v_override not in (
         v_first_cutoff,
         public.statement_cutoff_for(v_card.cutoff_day, v_first_cutoff + 1),
         public.cutoff_date_for_month(v_card.cutoff_day, extract(year from v_first_cutoff - interval '1 month')::integer, extract(month from v_first_cutoff - interval '1 month')::integer)
       ) then
      raise exception 'Extracto forzado inválido' using errcode = '22023';
    end if;
    v_first_cutoff := v_override;
  end if;
  v_balance := v_amount;
  for v_row in select value from jsonb_array_elements(p_payload->'installments') loop
    v_index := v_index + 1;
    v_before := coalesce((v_row->>'before_tracking')::boolean, false);
    v_principal := (v_row->>'principal')::numeric;
    v_interest := (v_row->>'interest')::numeric;
    v_total := (v_row->>'total')::numeric;
    v_principal_cop := (v_row->>'principal_cop')::numeric;
    v_interest_cop := (v_row->>'interest_cop')::numeric;
    v_total_cop := (v_row->>'total_cop')::numeric;
    if v_index <= v_prior then
      if not v_before or (v_row->>'cutoff_date') is not null or v_interest is distinct from 0 or v_interest_cop is distinct from 0 then
        raise exception 'Cuota previa inconsistente' using errcode = '22023';
      end if;
      v_prior_sum := v_prior_sum + v_principal;
    else
      v_expected_month := (date_trunc('month', v_first_cutoff::timestamp) + make_interval(months => v_index - v_prior - 1))::date;
      v_cutoff := public.cutoff_date_for_month(v_card.cutoff_day, extract(year from v_expected_month)::integer, extract(month from v_expected_month)::integer);
      if v_before or (v_row->>'cutoff_date')::date is distinct from v_cutoff then
        raise exception 'Cuota inconsistente' using errcode = '22023';
      end if;
    end if;
    if (v_row->>'number')::integer is distinct from v_index
       or v_principal is null or v_interest is null or v_total is null or v_principal_cop is null or v_interest_cop is null or v_total_cop is null
       or v_principal < 0 or v_interest < 0 or v_principal_cop < 0 or v_interest_cop < 0
       or v_principal::text in ('NaN','Infinity','-Infinity') or v_interest::text in ('NaN','Infinity','-Infinity')
       or v_principal_cop::text in ('NaN','Infinity','-Infinity') or v_interest_cop::text in ('NaN','Infinity','-Infinity')
       or v_principal <> round(v_principal, 2) or v_interest <> round(v_interest, 2)
       or v_principal_cop <> round(v_principal_cop, 2) or v_interest_cop <> round(v_interest_cop, 2)
       or v_total <> v_principal + v_interest or v_total_cop <> v_principal_cop + v_interest_cop
       or (v_interest_free and v_interest <> 0) then
      raise exception 'Cuota inconsistente' using errcode = '22023';
    end if;
    -- D32: on-balance cards bill interest once per statement, so installments are principal only.
    if v_card.interest_mode = 'on_balance' and (v_interest <> 0 or v_interest_cop <> 0) then
      raise exception 'Las cuotas de esta tarjeta son solo de capital' using errcode = '22023';
    end if;
    v_balance := v_balance - v_principal;
    if v_balance < 0 or (v_row->>'balance_after')::numeric is distinct from v_balance then
      raise exception 'Saldo de cuota inconsistente' using errcode = '22023';
    end if;
    if (v_currency = 'COP' and (v_principal_cop <> v_principal or v_interest_cop <> v_interest)) or
       (v_currency = 'USD' and (v_interest_cop <> round(v_interest * v_fx_rate, 2) or v_principal_cop <> (case when v_index = v_count then v_amount_cop - v_sum_principal_cop else round(v_principal * v_fx_rate, 2) end))) then
      raise exception 'Equivalente COP inconsistente' using errcode = '22023';
    end if;
    v_sum_principal_cop := v_sum_principal_cop + v_principal_cop;
  end loop;
  if v_count > 1 and (v_balance <> 0 or v_sum_principal_cop <> v_amount_cop) then
    raise exception 'Capital de cuotas inconsistente' using errcode = '22023';
  end if;
  if v_prior_sum <> v_prior_paid then
    raise exception 'Capital previo inconsistente' using errcode = '22023';
  end if;

  -- No statements are created for cutoffs before installment k (no old handling fees, D1).
  v_statement_id := public.ensure_statement(v_card_id, v_first_cutoff);
  insert into public.transactions (user_id, card_id, statement_id, type, date, amount, currency, fx_rate, amount_cop, installments_count, interest_free, rate_ea_applied, category_id, merchant, note, source, prior_installments, prior_principal_paid, original_installments_count, is_international, statement_override)
  values (v_user, v_card_id, v_statement_id, v_type::public.transaction_type, v_date, v_amount, v_currency::public.currency_code, v_fx_rate, v_amount_cop, v_count, v_interest_free, v_rate, v_category_id, nullif(p_payload->>'merchant', ''), nullif(p_payload->>'note', ''), 'manual', v_prior, v_prior_paid, v_original, v_is_international, v_override is not null and v_override <> public.statement_cutoff_for(v_card.cutoff_day, v_date))
  returning id into v_transaction_id;

  v_index := 0;
  for v_row in select value from jsonb_array_elements(p_payload->'installments') loop
    v_index := v_index + 1;
    v_statement_id := case when v_index <= v_prior then null else public.ensure_statement(v_card_id, (v_row->>'cutoff_date')::date) end;
    insert into public.installments (user_id, transaction_id, statement_id, number, principal, interest, total, balance_after, principal_cop, interest_cop, total_cop, before_tracking)
    values (v_user, v_transaction_id, v_statement_id, (v_row->>'number')::integer, (v_row->>'principal')::numeric, (v_row->>'interest')::numeric, (v_row->>'total')::numeric, (v_row->>'balance_after')::numeric, (v_row->>'principal_cop')::numeric, (v_row->>'interest_cop')::numeric, (v_row->>'total_cop')::numeric, v_index <= v_prior);
  end loop;
  -- An in-progress advance already paid its fee before tracking.
  if v_fee > 0 then
    v_statement_id := public.ensure_statement(v_card_id, v_first_cutoff);
    insert into public.transactions (user_id, card_id, statement_id, type, date, amount, currency, amount_cop, parent_id, source)
    values (v_user, v_card_id, v_statement_id, 'advance_fee', v_date, v_fee, 'COP', v_fee, v_transaction_id, 'manual');
  end if;
  return v_transaction_id;
end;
$$;
revoke all on function public.create_transaction_with_installments(jsonb) from public, anon;
grant execute on function public.create_transaction_with_installments(jsonb) to authenticated;

create or replace function public.update_transaction_with_installments(p_id uuid, p_payload jsonb)
returns uuid language plpgsql volatile security invoker set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_original public.transactions%rowtype;
  v_card public.cards%rowtype;
  v_new public.transactions%rowtype;
  v_new_id uuid;
  v_type text := p_payload->>'type';
  v_expected_rate numeric;
  v_current_rate numeric;
  v_payload jsonb;
begin
  if v_user is null then raise exception 'No autorizado' using errcode = '42501'; end if;
  select * into v_original from public.transactions where id = p_id and user_id = v_user for update;
  if not found then raise exception 'Movimiento no disponible' using errcode = '42501'; end if;
  if v_original.type = 'advance_fee' and v_original.parent_id is not null then
    raise exception 'La comisión se edita desde el avance' using errcode = '22023';
  end if;
  -- R9: regenerating the plan would undo prepayments; typed payments keep their statement and prepayments.
  -- Only category, merchant and note change, through edit_transaction_details.
  if v_original.paid_statement_id is not null
     or exists (select 1 from public.principal_prepayments where transaction_id = p_id or payment_id = p_id) then
    raise exception 'Este movimiento tiene abonos a capital' using errcode = '22023';
  end if;
  select * into v_card from public.cards where id = (p_payload->>'card_id')::uuid and user_id = v_user and archived_at is null for share;
  if not found then raise exception 'Tarjeta no disponible' using errcode = '42501'; end if;
  v_current_rate := case v_type when 'purchase' then v_card.purchase_rate_ea when 'cash_advance' then v_card.advance_rate_ea else null end;
  v_expected_rate := case when v_original.card_id = v_card.id and v_original.type::text = v_type then coalesce(v_original.rate_ea_applied, v_current_rate) else v_current_rate end;
  if nullif(p_payload->>'rate_ea_applied', '')::numeric is distinct from v_expected_rate then
    raise exception 'La tasa aplicada no corresponde al movimiento' using errcode = '22023';
  end if;

  -- La función de creación valida el plan completo y crea los extractos en la misma transacción.
  -- Su comprobación de tasa usa la tasa vigente; la tasa congelada se valida arriba.
  -- D30: an edit that keeps the date and the card keeps the statement the bank billed the movement in; otherwise R1 applies.
  v_payload := jsonb_set(p_payload, '{rate_ea_applied}', coalesce(to_jsonb(v_current_rate), 'null'::jsonb));
  if v_original.statement_override and v_original.card_id = v_card.id and v_original.date = (p_payload->>'date')::date then
    v_payload := v_payload || jsonb_build_object('statement_cutoff_override', (select cutoff_date from public.statements where id = v_original.statement_id));
  end if;
  v_new_id := public.create_transaction_with_installments(v_payload);
  select * into strict v_new from public.transactions where id = v_new_id and user_id = v_user;
  delete from public.installments where transaction_id = p_id and user_id = v_user;
  delete from public.transactions where parent_id = p_id and user_id = v_user and type = 'advance_fee';
  update public.transactions set card_id = v_new.card_id, statement_id = v_new.statement_id, category_id = v_new.category_id,
    type = v_new.type, date = v_new.date, merchant = v_new.merchant, amount = v_new.amount, currency = v_new.currency,
    fx_rate = v_new.fx_rate, amount_cop = v_new.amount_cop, installments_count = v_new.installments_count,
    interest_free = v_new.interest_free, rate_ea_applied = v_expected_rate, note = v_new.note,
    prior_installments = v_new.prior_installments, prior_principal_paid = v_new.prior_principal_paid,
    original_installments_count = v_new.original_installments_count, is_international = v_new.is_international,
    statement_override = v_new.statement_override
    where id = p_id and user_id = v_user;
  update public.installments set transaction_id = p_id where transaction_id = v_new_id and user_id = v_user;
  update public.transactions set parent_id = p_id where parent_id = v_new_id and user_id = v_user;
  delete from public.transactions where id = v_new_id and user_id = v_user;
  if v_original.subscription_id is not null then
    update public.subscriptions set last_charged_amount = (
      select t.amount from public.transactions t where t.subscription_id = v_original.subscription_id and t.user_id = v_user
      order by t.date desc, t.created_at desc, t.id desc limit 1
    ) where id = v_original.subscription_id and user_id = v_user;
  end if;
  return p_id;
end;
$$;
