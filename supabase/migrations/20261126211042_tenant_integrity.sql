begin;

-- Keep every tenant-owned relationship inside the same office.
alter table public.owners add constraint owners_company_record_unique unique(company_id,id);
alter table public.properties add constraint properties_company_record_unique unique(company_id,id);
alter table public.clients add constraint clients_company_record_unique unique(company_id,id);

alter table public.properties add constraint properties_owner_same_company_fk
  foreign key(company_id,owner_id) references public.owners(company_id,id) on delete set null (owner_id);
alter table public.property_media add constraint property_media_same_company_fk
  foreign key(company_id,property_id) references public.properties(company_id,id) on delete cascade;
alter table public.appointments add constraint appointments_property_same_company_fk
  foreign key(company_id,property_id) references public.properties(company_id,id) on delete set null (property_id);
alter table public.appointments add constraint appointments_client_same_company_fk
  foreign key(company_id,client_id) references public.clients(company_id,id) on delete set null (client_id);
alter table public.tasks add constraint tasks_property_same_company_fk
  foreign key(company_id,property_id) references public.properties(company_id,id) on delete set null (property_id);
alter table public.tasks add constraint tasks_client_same_company_fk
  foreign key(company_id,client_id) references public.clients(company_id,id) on delete set null (client_id);
alter table public.tasks add constraint tasks_owner_same_company_fk
  foreign key(company_id,owner_id) references public.owners(company_id,id) on delete set null (owner_id);
alter table public.favorites add constraint favorites_property_same_company_fk
  foreign key(company_id,property_id) references public.properties(company_id,id) on delete cascade;
alter table public.property_shares add constraint shares_property_same_company_fk
  foreign key(company_id,property_id) references public.properties(company_id,id) on delete cascade;
alter table public.activity_notes add constraint notes_property_same_company_fk
  foreign key(company_id,property_id) references public.properties(company_id,id) on delete cascade;
alter table public.activity_notes add constraint notes_client_same_company_fk
  foreign key(company_id,client_id) references public.clients(company_id,id) on delete cascade;
alter table public.activity_notes add constraint notes_owner_same_company_fk
  foreign key(company_id,owner_id) references public.owners(company_id,id) on delete cascade;

create or replace function public.claim_aras_office()
returns uuid language plpgsql security definer set search_path = '' as $$
declare c_id uuid; current_user_id uuid := (select auth.uid());
begin
  if current_user_id is null then raise exception 'Giriş yapmanız gerekiyor'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('aras_initial_office_claim'));
  select id into c_id from public.companies where slug='aras';
  if c_id is null then raise exception 'Aras ofisi bulunamadı'; end if;
  if exists(select 1 from public.company_members where company_id=c_id) then
    if exists(select 1 from public.company_members where company_id=c_id and user_id=current_user_id) then return c_id; end if;
    raise exception 'Aras ofisi zaten yönetici tarafından etkinleştirilmiş';
  end if;
  insert into public.company_members(company_id,user_id,role,can_view_all) values(c_id,current_user_id,'owner',true);
  return c_id;
end; $$;
revoke all on function public.claim_aras_office() from public,anon;
grant execute on function public.claim_aras_office() to authenticated;

create or replace function public.get_public_listing(share_token uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare result jsonb; s public.property_shares%rowtype;
begin
  select * into s from public.property_shares where token=share_token and is_active=true and (expires_at is null or expires_at>now());
  if not found then return null; end if;
  insert into public.property_views(share_id) values(s.id);
  select jsonb_build_object(
    'id',p.id,'title',p.title,'description',p.description,'listing_type',p.listing_type,'property_type',p.property_type,
    'price',p.price,'area_sqm',p.area_sqm,'room_count',p.room_count,'building_age',p.building_age,
    'province',pr.name,'district',coalesce(d.name,p.district),'neighborhood',p.neighborhood,'features',p.features,
    'photos',coalesce((select jsonb_agg(jsonb_build_object('url',pm.public_url,'caption',pm.caption) order by pm.sort_order) from public.property_media pm where pm.property_id=p.id and pm.company_id=s.company_id and pm.public_url is not null),'[]'::jsonb)
  ) into result
  from public.properties p left join public.provinces pr on pr.id=p.province_id left join public.districts d on d.id=p.district_id
  where p.id=s.property_id and p.company_id=s.company_id and p.is_published=true and p.status='active';
  return result;
end; $$;
revoke all on function public.get_public_listing(uuid) from public,authenticated,anon;
grant execute on function public.get_public_listing(uuid) to anon,authenticated;

commit;
