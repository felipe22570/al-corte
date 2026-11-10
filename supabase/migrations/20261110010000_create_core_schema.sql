create type public.amortization_method as enum ('fixed_principal', 'french');
create type public.transaction_type as enum ('purchase', 'cash_advance', 'advance_fee', 'payment', 'handling_fee', 'interest', 'insurance', 'refund', 'adjustment');
create type public.transaction_source as enum ('manual', 'subscription', 'import', 'email', 'system');
create type public.currency_code as enum ('COP', 'USD');
create type public.subscription_frequency as enum ('monthly', 'yearly');
create type public.subscription_status as enum ('active', 'paused', 'cancelled');

create table public.cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null, bank text not null, network text not null,
  last4 char(4) not null check (last4 ~ '^[0-9]{4}$'),
  credit_limit numeric(14,2) not null check (credit_limit >= 0),
  cutoff_day smallint not null check (cutoff_day between 1 and 31),
  payment_day smallint not null check (payment_day between 1 and 31),
  purchase_rate_ea numeric(9,6) not null default 0 check (purchase_rate_ea >= 0),
  advance_rate_ea numeric(9,6) not null default 0 check (advance_rate_ea >= 0),
  advance_fee numeric(14,2) not null default 0 check (advance_fee >= 0),
  handling_fee numeric(14,2) not null default 0 check (handling_fee >= 0),
  amortization_method public.amortization_method not null default 'fixed_principal',
  color text not null default 'card-1' check (color in ('card-1','card-2','card-3','card-4','card-5','card-6')),
  archived_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.categories (
  id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null, icon text not null, color text, monthly_budget numeric(14,2) check (monthly_budget >= 0),
  archived_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (user_id, name)
);

create table public.statements (
  id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid() references auth.users on delete cascade,
  card_id uuid not null references public.cards on delete restrict,
  period_start date not null, cutoff_date date not null, due_date date not null,
  real_total numeric(14,2), paid_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (card_id, cutoff_date), check (period_start <= cutoff_date and cutoff_date < due_date)
);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid() references auth.users on delete cascade,
  card_id uuid not null references public.cards on delete restrict, category_id uuid references public.categories on delete restrict,
  name text not null, amount numeric(14,2) not null check (amount > 0), currency public.currency_code not null default 'COP',
  frequency public.subscription_frequency not null, billing_day smallint not null check (billing_day between 1 and 31),
  start_date date not null, trial_ends_at date, status public.subscription_status not null default 'active',
  last_charged_amount numeric(14,2) check (last_charged_amount >= 0),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.transactions (
  id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid() references auth.users on delete cascade,
  card_id uuid not null references public.cards on delete restrict, statement_id uuid not null references public.statements on delete restrict,
  category_id uuid references public.categories on delete restrict, type public.transaction_type not null, date date not null,
  merchant text, amount numeric(14,2) not null check (amount > 0), currency public.currency_code not null default 'COP',
  fx_rate numeric(12,4), amount_cop numeric(14,2) not null check (amount_cop > 0),
  installments_count smallint not null default 1 check (installments_count between 1 and 36),
  interest_free boolean not null default false, rate_ea_applied numeric(9,6) check (rate_ea_applied >= 0),
  subscription_id uuid references public.subscriptions on delete set null,
  parent_id uuid references public.transactions on delete cascade,
  source public.transaction_source not null default 'manual', verified boolean not null default false, note text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check ((currency = 'COP' and fx_rate is null and amount_cop = amount) or (currency = 'USD' and fx_rate is not null and fx_rate > 0))
);

create table public.installments (
  id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid() references auth.users on delete cascade,
  transaction_id uuid not null references public.transactions on delete cascade, statement_id uuid not null references public.statements on delete restrict,
  number smallint not null check (number between 1 and 36),
  principal numeric(14,2) not null check (principal >= 0), interest numeric(14,2) not null check (interest >= 0),
  total numeric(14,2) not null check (total >= 0), balance_after numeric(14,2) not null check (balance_after >= 0),
  principal_cop numeric(14,2) not null check (principal_cop >= 0), interest_cop numeric(14,2) not null check (interest_cop >= 0),
  total_cop numeric(14,2) not null check (total_cop >= 0), created_at timestamptz not null default now(),
  unique (transaction_id, number), check (total = principal + interest), check (total_cop = principal_cop + interest_cop)
);

create table public.fx_rates (date date primary key, usd_cop numeric(12,4) not null check (usd_cop > 0));
create table public.notification_log (
  id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid() references auth.users on delete cascade,
  kind text not null, ref_id uuid not null, scheduled_for date not null, sent_at timestamptz,
  created_at timestamptz not null default now(), unique (user_id, kind, ref_id, scheduled_for)
);

create unique index transactions_subscription_date_unique on public.transactions (subscription_id, date) where subscription_id is not null;
create unique index transactions_system_handling_fee_unique on public.transactions (statement_id) where type = 'handling_fee' and source = 'system';
create index transactions_card_date_idx on public.transactions (card_id, date);
create index transactions_statement_idx on public.transactions (statement_id);
create index transactions_user_date_idx on public.transactions (user_id, date desc);
create index installments_statement_idx on public.installments (statement_id);
create index subscriptions_status_idx on public.subscriptions (status);

create function public.set_updated_at() returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
create trigger cards_updated_at before update on public.cards for each row execute function public.set_updated_at();
create trigger categories_updated_at before update on public.categories for each row execute function public.set_updated_at();
create trigger statements_updated_at before update on public.statements for each row execute function public.set_updated_at();
create trigger subscriptions_updated_at before update on public.subscriptions for each row execute function public.set_updated_at();
create trigger transactions_updated_at before update on public.transactions for each row execute function public.set_updated_at();

alter table public.cards enable row level security;
alter table public.categories enable row level security;
alter table public.statements enable row level security;
alter table public.subscriptions enable row level security;
alter table public.transactions enable row level security;
alter table public.installments enable row level security;
alter table public.fx_rates enable row level security;
alter table public.notification_log enable row level security;
