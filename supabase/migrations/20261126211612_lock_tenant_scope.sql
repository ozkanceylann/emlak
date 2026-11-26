begin;
create or replace function private.prevent_tenant_reassignment()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.company_id is distinct from old.company_id then
    raise exception 'Kayıt başka bir ofise taşınamaz';
  end if;
  return new;
end; $$;

create trigger prevent_company_move_members before update on public.company_members for each row execute function private.prevent_tenant_reassignment();
create trigger prevent_company_move_owners before update on public.owners for each row execute function private.prevent_tenant_reassignment();
create trigger prevent_company_move_properties before update on public.properties for each row execute function private.prevent_tenant_reassignment();
create trigger prevent_company_move_media before update on public.property_media for each row execute function private.prevent_tenant_reassignment();
create trigger prevent_company_move_clients before update on public.clients for each row execute function private.prevent_tenant_reassignment();
create trigger prevent_company_move_appointments before update on public.appointments for each row execute function private.prevent_tenant_reassignment();
create trigger prevent_company_move_tasks before update on public.tasks for each row execute function private.prevent_tenant_reassignment();
create trigger prevent_company_move_favorites before update on public.favorites for each row execute function private.prevent_tenant_reassignment();
create trigger prevent_company_move_shares before update on public.property_shares for each row execute function private.prevent_tenant_reassignment();
create trigger prevent_company_move_notes before update on public.activity_notes for each row execute function private.prevent_tenant_reassignment();
commit;
