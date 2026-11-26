begin;

alter table public.companies add column admin_email text;
create unique index companies_admin_email_unique on public.companies(lower(admin_email)) where admin_email is not null;

create table public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.platform_admins enable row level security;
grant select on public.platform_admins to authenticated;

create table private.platform_setup (
  singleton boolean primary key default true check(singleton),
  setup_token_hash text not null,
  claimed_at timestamptz
);
revoke all on private.platform_setup from public,anon,authenticated;
insert into private.platform_setup(singleton,setup_token_hash) values(true,'131d95b3603382aab8bec05b668f24c45055e9c9f1c910d83286e6a1336c3805');

create or replace function private.is_platform_admin(target_user uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.platform_admins a where a.user_id=target_user);
$$;
revoke all on function private.is_platform_admin(uuid) from public,anon;
grant execute on function private.is_platform_admin(uuid) to authenticated;

create policy platform_admins_select_self on public.platform_admins for select to authenticated
  using(user_id=(select auth.uid()) or private.is_platform_admin((select auth.uid())));

create policy companies_select_platform_admin on public.companies for select to authenticated
  using(private.is_platform_admin((select auth.uid())));
create policy companies_insert_platform_admin on public.companies for insert to authenticated
  with check(private.is_platform_admin((select auth.uid())));
create policy companies_update_platform_admin on public.companies for update to authenticated
  using(private.is_platform_admin((select auth.uid())))
  with check(private.is_platform_admin((select auth.uid())));

create or replace function public.claim_initial_platform_admin(setup_token text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare current_user_id uuid := (select auth.uid()); token_row private.platform_setup%rowtype; confirmed_email text;
begin
  if current_user_id is null then raise exception 'Giriş yapmanız gerekiyor'; end if;
  select * into token_row from private.platform_setup where singleton=true for update;
  if token_row.claimed_at is not null then raise exception 'İlk platform yöneticisi daha önce oluşturuldu'; end if;
  if encode(extensions.digest(setup_token,'sha256'),'hex') <> token_row.setup_token_hash then raise exception 'Kurulum kodu geçersiz'; end if;
  select lower(email) into confirmed_email from auth.users where id=current_user_id and email_confirmed_at is not null;
  if confirmed_email is null then raise exception 'Önce e-posta adresinizi doğrulayın'; end if;
  insert into public.platform_admins(user_id) values(current_user_id);
  update private.platform_setup set claimed_at=now() where singleton=true;
  insert into public.company_members(company_id,user_id,role,can_view_all)
    select id,current_user_id,'owner',true from public.companies where slug='aras'
    on conflict(company_id,user_id) do nothing;
  update public.companies set admin_email=null where slug='aras';
  return current_user_id;
end; $$;
revoke all on function public.claim_initial_platform_admin(text) from public,anon;
grant execute on function public.claim_initial_platform_admin(text) to authenticated;

create or replace function public.claim_aras_office()
returns uuid language plpgsql security definer set search_path = '' as $$
declare c_id uuid; current_user_id uuid := (select auth.uid());
begin
  if current_user_id is null or not private.is_platform_admin(current_user_id) then raise exception 'Bu işlem platform yöneticisine özeldir'; end if;
  select id into c_id from public.companies where slug='aras';
  if c_id is null then raise exception 'Aras ofisi bulunamadı'; end if;
  insert into public.company_members(company_id,user_id,role,can_view_all) values(c_id,current_user_id,'owner',true)
    on conflict(company_id,user_id) do nothing;
  return c_id;
end; $$;
revoke all on function public.claim_aras_office() from public,anon;
grant execute on function public.claim_aras_office() to authenticated;

create or replace function public.claim_company_office()
returns uuid language plpgsql security definer set search_path = '' as $$
declare current_user_id uuid := (select auth.uid()); current_email text; c_id uuid;
begin
  if current_user_id is null then raise exception 'Giriş yapmanız gerekiyor'; end if;
  select lower(email) into current_email from auth.users where id=current_user_id and email_confirmed_at is not null;
  if current_email is null then raise exception 'Önce e-posta adresinizi doğrulayın'; end if;
  select id into c_id from public.companies where lower(admin_email)=current_email limit 1;
  if c_id is null then return null; end if;
  insert into public.company_members(company_id,user_id,role,can_view_all) values(c_id,current_user_id,'owner',true)
    on conflict(company_id,user_id) do nothing;
  update public.companies set admin_email=null where id=c_id;
  return c_id;
end; $$;
revoke all on function public.claim_company_office() from public,anon;
grant execute on function public.claim_company_office() to authenticated;

-- Company creation is restricted to the platform admin. Offices cannot self-register.
drop function if exists public.create_company(text);
create function public.create_company(company_name text,initial_admin_email text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare c_id uuid; clean_name text := trim(company_name); company_slug text; clean_email text := nullif(lower(trim(initial_admin_email)),'');
begin
  if (select auth.uid()) is null or not private.is_platform_admin((select auth.uid())) then raise exception 'Ofisleri yalnızca platform yöneticisi oluşturabilir'; end if;
  if clean_name is null or length(clean_name)<2 then raise exception 'Ofis adı en az 2 karakter olmalı'; end if;
  if clean_email is not null and clean_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then raise exception 'E-posta adresini kontrol edin'; end if;
  company_slug := trim(both '-' from regexp_replace(lower(clean_name),'[^a-z0-9]+','-','g')) || '-' || substr(gen_random_uuid()::text,1,8);
  insert into public.companies(name,slug,admin_email) values(clean_name,company_slug,clean_email) returning id into c_id;
  return c_id;
end; $$;
revoke all on function public.create_company(text,text) from public,anon;
grant execute on function public.create_company(text,text) to authenticated;

commit;
