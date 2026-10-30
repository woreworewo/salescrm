begin;

create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 2 and 200),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create table public.properties (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id),
  name text not null check (length(trim(name)) between 2 and 200),
  code text not null check (length(trim(code)) between 1 and 40),
  timezone text not null default 'Asia/Jakarta' check (timezone in ('Asia/Jakarta','Asia/Makassar','Asia/Jayapura')),
  currency text not null default 'IDR' check (currency = 'IDR'),
  active boolean not null default true,
  unique (id, tenant_id), unique (tenant_id, code)
);
create table public.tenant_memberships (
  tenant_id uuid not null references public.tenants(id), user_id uuid not null references public.profiles(id),
  role text not null default 'member' check (role in ('tenant-admin','member')),
  active boolean not null default true,
  primary key (tenant_id, user_id)
);
create index tenant_memberships_user_idx on public.tenant_memberships(user_id, tenant_id);
create table public.property_memberships (
  tenant_id uuid not null, property_id uuid not null, user_id uuid not null,
  role text not null default 'sales' check (role in ('property-admin','sales')),
  active boolean not null default true,
  primary key (property_id, user_id),
  foreign key (property_id, tenant_id) references public.properties(id, tenant_id),
  foreign key (tenant_id, user_id) references public.tenant_memberships(tenant_id, user_id)
);
create index property_memberships_user_idx on public.property_memberships(user_id, property_id);
create index property_memberships_tenant_idx on public.property_memberships(tenant_id, user_id);

alter table public.companies add column tenant_id uuid references public.tenants(id);
alter table public.contacts add column tenant_id uuid references public.tenants(id);
alter table public.opportunities add column tenant_id uuid references public.tenants(id), add column property_id uuid;
alter table public.tasks add column tenant_id uuid references public.tenants(id), add column property_id uuid;
alter table public.pipeline_stage_history add column tenant_id uuid references public.tenants(id), add column property_id uuid;

-- Preserve existing single-organization data. Fresh installations get no seeded organization.
do $$
declare legacy_tenant uuid; legacy_property uuid;
begin
  if exists(select 1 from public.profiles) then
    insert into public.tenants(name) values ('Migrated organization') returning id into legacy_tenant;
    insert into public.properties(tenant_id, name, code) values (legacy_tenant, 'Main property', 'MAIN') returning id into legacy_property;
    insert into public.tenant_memberships(tenant_id, user_id, role)
      select legacy_tenant, id, case when role = 'admin' then 'tenant-admin' else 'member' end from public.profiles;
    insert into public.property_memberships(tenant_id, property_id, user_id, role)
      select legacy_tenant, legacy_property, id, 'sales' from public.profiles;
    update public.companies set tenant_id = legacy_tenant;
    update public.contacts set tenant_id = legacy_tenant;
    update public.opportunities set tenant_id = legacy_tenant, property_id = legacy_property;
    update public.tasks set tenant_id = legacy_tenant, property_id = legacy_property;
    update public.pipeline_stage_history set tenant_id = legacy_tenant, property_id = legacy_property;
  end if;
end;
$$;

alter table public.companies alter column tenant_id set not null,
  add unique (id, tenant_id),
  add foreign key (tenant_id, owner_id) references public.tenant_memberships(tenant_id, user_id);
alter table public.contacts alter column tenant_id set not null,
  add foreign key (company_id, tenant_id) references public.companies(id, tenant_id);
alter table public.opportunities alter column tenant_id set not null, alter column property_id set not null,
  add unique (id, tenant_id, property_id),
  add foreign key (property_id, tenant_id) references public.properties(id, tenant_id),
  add foreign key (company_id, tenant_id) references public.companies(id, tenant_id),
  add foreign key (tenant_id, owner_id) references public.tenant_memberships(tenant_id, user_id);
alter table public.tasks alter column tenant_id set not null, alter column property_id set not null,
  add foreign key (property_id, tenant_id) references public.properties(id, tenant_id),
  add foreign key (company_id, tenant_id) references public.companies(id, tenant_id),
  add foreign key (tenant_id, owner_id) references public.tenant_memberships(tenant_id, user_id);
alter table public.pipeline_stage_history alter column tenant_id set not null, alter column property_id set not null,
  add foreign key (tenant_id, actor_id) references public.tenant_memberships(tenant_id, user_id),
  add foreign key (opportunity_id, tenant_id, property_id) references public.opportunities(id, tenant_id, property_id);
create index companies_tenant_idx on public.companies(tenant_id, lower(name));
create index contacts_tenant_idx on public.contacts(tenant_id, company_id);
create index opportunities_scope_idx on public.opportunities(tenant_id, property_id, owner_id);
create index tasks_scope_idx on public.tasks(tenant_id, property_id, owner_id);
create index pipeline_history_scope_idx on public.pipeline_stage_history(tenant_id, property_id);

drop policy profiles_read on public.profiles;
drop policy companies_read on public.companies;
drop policy contacts_read on public.contacts;
drop policy opportunities_read on public.opportunities;
drop policy opportunities_insert on public.opportunities;
drop policy tasks_read on public.tasks;
drop policy tasks_insert on public.tasks;
drop policy history_read on public.pipeline_stage_history;
drop function public.create_company_with_contact(jsonb);
drop function public.transition_opportunity(uuid, integer, text, text);
drop function public.set_task_completed(uuid, integer, boolean);
drop function public.can_access_company(uuid);
drop function public.is_admin();
alter table public.profiles drop column role;

create function public.can_access_tenant(target_tenant uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.tenant_memberships m join public.tenants t on t.id = m.tenant_id
    where m.tenant_id = target_tenant and m.user_id = auth.uid() and m.active and t.active);
$$;
create function public.is_tenant_admin(target_tenant uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.tenant_memberships m join public.tenants t on t.id = m.tenant_id
    where m.tenant_id = target_tenant and m.user_id = auth.uid() and m.role = 'tenant-admin' and m.active and t.active);
$$;
create function public.can_access_property(target_property uuid, target_tenant uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.properties p where p.id = target_property and p.tenant_id = target_tenant and p.active
    and public.can_access_tenant(p.tenant_id) and (public.is_tenant_admin(p.tenant_id) or exists(
      select 1 from public.property_memberships m where m.property_id = p.id and m.tenant_id = p.tenant_id and m.user_id = auth.uid() and m.active)));
$$;
create function public.can_manage_property(target_property uuid, target_tenant uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.can_access_property(target_property, target_tenant) and (public.is_tenant_admin(target_tenant) or exists(
    select 1 from public.property_memberships m where m.property_id = target_property and m.tenant_id = target_tenant
      and m.user_id = auth.uid() and m.role = 'property-admin' and m.active));
$$;
create function public.can_read_profile(target_user uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select target_user = auth.uid() or exists(select 1 from public.tenant_memberships m
    where m.user_id = target_user and m.active and public.can_access_tenant(m.tenant_id));
$$;

alter table public.tenants enable row level security;
alter table public.properties enable row level security;
alter table public.tenant_memberships enable row level security;
alter table public.property_memberships enable row level security;
create policy tenants_read on public.tenants for select to authenticated using (public.can_access_tenant(id));
create policy properties_read on public.properties for select to authenticated using (public.can_access_property(id, tenant_id));
create policy tenant_memberships_read on public.tenant_memberships for select to authenticated using (public.can_access_tenant(tenant_id));
create policy property_memberships_read on public.property_memberships for select to authenticated using (public.can_access_property(property_id, tenant_id));
create policy profiles_read on public.profiles for select to authenticated using (public.can_read_profile(id));
create policy companies_read on public.companies for select to authenticated using (public.can_access_tenant(tenant_id));
create policy contacts_read on public.contacts for select to authenticated using (public.can_access_tenant(tenant_id));
create policy opportunities_read on public.opportunities for select to authenticated using (
  public.can_access_property(property_id, tenant_id) and (owner_id = auth.uid() or public.can_manage_property(property_id, tenant_id)));
create policy opportunities_insert on public.opportunities for insert to authenticated with check (
  public.can_access_property(property_id, tenant_id) and owner_id = auth.uid() and stage = 'discovery' and version = 1);
create policy tasks_read on public.tasks for select to authenticated using (
  public.can_access_property(property_id, tenant_id) and (owner_id = auth.uid() or public.can_manage_property(property_id, tenant_id)));
create policy tasks_insert on public.tasks for insert to authenticated with check (
  public.can_access_property(property_id, tenant_id) and owner_id = auth.uid() and completed = false and version = 1);
create policy history_read on public.pipeline_stage_history for select to authenticated using (
  exists(select 1 from public.opportunities o where o.id = opportunity_id and o.tenant_id = pipeline_stage_history.tenant_id and o.property_id = pipeline_stage_history.property_id));

revoke all on public.tenants, public.properties, public.tenant_memberships, public.property_memberships from public, anon, authenticated;
grant select on public.tenants, public.properties, public.tenant_memberships, public.property_memberships to authenticated;
grant insert (tenant_id, property_id) on public.opportunities, public.tasks to authenticated;

create function public.create_company_with_contact(target_property uuid, payload jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare company uuid; selected_tenant uuid;
begin
  select tenant_id into selected_tenant from public.properties where id = target_property;
  if not public.can_access_property(target_property, selected_tenant) then raise exception 'Property unavailable'; end if;
  if length(trim(coalesce(payload->>'phone', '') || coalesce(payload->>'mobile', '') || coalesce(payload->>'email', ''))) = 0 then raise exception 'Contact channel required'; end if;
  insert into public.companies(tenant_id, name, address, city, phone, fax, account_type, owner_id)
  values(selected_tenant, payload->>'name', coalesce(payload->>'address',''), coalesce(payload->>'city',''), coalesce(payload->>'phone',''), coalesce(payload->>'fax',''), coalesce(payload->>'account_type',''), auth.uid()) returning id into company;
  insert into public.contacts(tenant_id, company_id, title, first_name, last_name, position, mobile, email)
  values(selected_tenant, company, coalesce(payload->>'title',''), payload->>'first_name', coalesce(payload->>'last_name',''), coalesce(payload->>'position',''), coalesce(payload->>'mobile',''), coalesce(payload->>'email',''));
  return company;
end;
$$;

create function public.transition_opportunity(target_property uuid, opportunity uuid, expected_version integer, next_stage text, reason text default '')
returns void language plpgsql security definer set search_path = '' as $$
declare current_record public.opportunities;
begin
  select * into current_record from public.opportunities where id = opportunity and property_id = target_property for update;
  if not found then raise exception 'Opportunity unavailable'; end if;
  if not public.can_access_property(current_record.property_id, current_record.tenant_id)
    or not (current_record.owner_id = auth.uid() or public.can_manage_property(current_record.property_id, current_record.tenant_id)) then raise exception 'Opportunity unavailable'; end if;
  if expected_version is null or current_record.version <> expected_version then raise exception 'Version conflict'; end if;
  if next_stage is null or next_stage not in ('discovery','proposal-sent','negotiation','lost') then raise exception 'Verified agreement and payment policy required for Won'; end if;
  if next_stage = 'lost' and coalesce(length(trim(reason)), 0) < 3 then raise exception 'Lost reason required'; end if;
  if next_stage = current_record.stage then return; end if;
  update public.opportunities set stage = next_stage, stage_entered_at = now(), version = version + 1,
    lost_reason = case when next_stage = 'lost' then trim(reason) else null end where id = opportunity;
  insert into public.pipeline_stage_history(tenant_id, property_id, opportunity_id, previous_stage, new_stage, reason, actor_id)
  values(current_record.tenant_id, current_record.property_id, opportunity, current_record.stage, next_stage, nullif(trim(reason), ''), auth.uid());
end;
$$;

create function public.set_task_completed(target_property uuid, task uuid, expected_version integer, next_completed boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare current_record public.tasks;
begin
  select * into current_record from public.tasks where id = task and property_id = target_property for update;
  if not found then raise exception 'Task unavailable'; end if;
  if not public.can_access_property(current_record.property_id, current_record.tenant_id)
    or not (current_record.owner_id = auth.uid() or public.can_manage_property(current_record.property_id, current_record.tenant_id)) then raise exception 'Task unavailable'; end if;
  if expected_version is null or current_record.version <> expected_version then raise exception 'Version conflict'; end if;
  update public.tasks set completed = next_completed, version = version + 1 where id = task;
end;
$$;

revoke all on function public.can_access_tenant(uuid), public.is_tenant_admin(uuid), public.can_access_property(uuid,uuid), public.can_manage_property(uuid,uuid), public.can_read_profile(uuid), public.create_company_with_contact(uuid,jsonb), public.transition_opportunity(uuid,uuid,integer,text,text), public.set_task_completed(uuid,uuid,integer,boolean) from public, anon;
grant execute on function public.can_access_tenant(uuid), public.is_tenant_admin(uuid), public.can_access_property(uuid,uuid), public.can_manage_property(uuid,uuid), public.can_read_profile(uuid), public.create_company_with_contact(uuid,jsonb), public.transition_opportunity(uuid,uuid,integer,text,text), public.set_task_completed(uuid,uuid,integer,boolean) to authenticated;

commit;
