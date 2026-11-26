create or replace function public.get_public_listing(share_token uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare result jsonb; s public.property_shares%rowtype;
begin
  select * into s from public.property_shares where token=share_token and is_active=true and (expires_at is null or expires_at>now());
  if not found then return null; end if;
  insert into public.property_views(share_id) values(s.id);
  select jsonb_build_object(
    'id',p.id,'company_name',c.name,'title',p.title,'description',p.description,'listing_type',p.listing_type,'property_type',p.property_type,
    'price',p.price,'area_sqm',p.area_sqm,'room_count',p.room_count,'building_age',p.building_age,
    'province',pr.name,'district',coalesce(d.name,p.district),'neighborhood',p.neighborhood,'features',p.features,
    'photos',coalesce((select jsonb_agg(jsonb_build_object('url',pm.public_url,'caption',pm.caption) order by pm.sort_order) from public.property_media pm where pm.property_id=p.id and pm.company_id=s.company_id and pm.public_url is not null),'[]'::jsonb)
  ) into result
  from public.properties p
  join public.companies c on c.id=p.company_id
  left join public.provinces pr on pr.id=p.province_id
  left join public.districts d on d.id=p.district_id
  where p.id=s.property_id and p.company_id=s.company_id and p.is_published=true and p.status='active';
  return result;
end; $$;
revoke all on function public.get_public_listing(uuid) from public,authenticated,anon;
grant execute on function public.get_public_listing(uuid) to anon,authenticated;
