create function public.create_default_categories(p_user_id uuid) returns void
language sql security definer set search_path = '' as $$
  insert into public.categories (user_id, name, icon) values
    (p_user_id, 'Mercado', 'shopping-cart'), (p_user_id, 'Restaurantes', 'utensils'),
    (p_user_id, 'Transporte', 'car'), (p_user_id, 'Servicios', 'receipt'),
    (p_user_id, 'Salud', 'heart-pulse'), (p_user_id, 'Entretenimiento', 'clapperboard'),
    (p_user_id, 'Suscripciones', 'repeat'), (p_user_id, 'Viajes', 'plane'),
    (p_user_id, 'Educación', 'graduation-cap'), (p_user_id, 'Hogar', 'house'),
    (p_user_id, 'Otros', 'ellipsis')
  on conflict (user_id, name) do nothing;
$$;
revoke all on function public.create_default_categories(uuid) from public, anon, authenticated;

create function public.handle_new_user_categories() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform public.create_default_categories(new.id);
  return new;
end;
$$;
revoke all on function public.handle_new_user_categories() from public, anon, authenticated;
create trigger on_auth_user_created_categories after insert on auth.users
  for each row execute function public.handle_new_user_categories();

select public.create_default_categories(id) from auth.users;
