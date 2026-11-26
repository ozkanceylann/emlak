begin;
create or replace function private.is_company_user(target_company uuid,target_user uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.company_members m where m.company_id=target_company and m.user_id=target_user);
$$;
revoke all on function private.is_company_user(uuid,uuid) from public,anon;
grant execute on function private.is_company_user(uuid,uuid) to authenticated;

-- Advisors can edit only rows they own. Office managers retain office-wide access.
drop policy owners_update on public.owners;
create policy owners_update on public.owners for update to authenticated
using(private.can_access_company_record(company_id,created_by))
with check(private.can_access_company_record(company_id,created_by));

drop policy properties_update on public.properties;
create policy properties_update on public.properties for update to authenticated
using(private.can_access_company_record(company_id,created_by))
with check(private.can_access_company_record(company_id,created_by));

drop policy clients_update on public.clients;
create policy clients_update on public.clients for update to authenticated
using(private.can_access_company_record(company_id,created_by))
with check(private.can_access_company_record(company_id,created_by));

drop policy appointments_update on public.appointments;
create policy appointments_update on public.appointments for update to authenticated
using(private.can_access_company_record(company_id,created_by))
with check(private.can_access_company_record(company_id,created_by));

drop policy tasks_select on public.tasks;
create policy tasks_select on public.tasks for select to authenticated
using(private.can_access_company_record(company_id,created_by) or private.can_access_company_record(company_id,assigned_to));
drop policy tasks_update on public.tasks;
create policy tasks_update on public.tasks for update to authenticated
using(private.can_access_company_record(company_id,created_by) or private.can_access_company_record(company_id,assigned_to))
with check((private.can_access_company_record(company_id,created_by) or private.can_manage_company(company_id))
  and (assigned_to is null or private.is_company_user(company_id,assigned_to)));

drop policy shares_update on public.property_shares;
create policy shares_update on public.property_shares for update to authenticated
using(private.can_access_company_record(company_id,created_by))
with check(private.can_access_company_record(company_id,created_by));

drop policy notes_update on public.activity_notes;
create policy notes_update on public.activity_notes for update to authenticated
using(private.can_access_company_record(company_id,created_by))
with check(private.can_access_company_record(company_id,created_by));

drop policy media_update on public.property_media;
create policy media_update on public.property_media for update to authenticated
using(private.can_access_company_record(company_id,(select p.created_by from public.properties p where p.id=property_id)))
with check(private.can_access_company_record(company_id,(select p.created_by from public.properties p where p.id=property_id)));
commit;
