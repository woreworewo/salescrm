begin;

alter table public.tenants add column version integer not null default 1;
alter table public.properties add column version integer not null default 1;
alter table public.tenant_memberships add column version integer not null default 1;
alter table public.property_memberships add column version integer not null default 1;

create table public.administration_events (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id),
  property_id uuid, actor_id uuid not null references public.profiles(id),
  action text not null, subject_id uuid not null, details jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(),
  foreign key (property_id, tenant_id) references public.properties(id, tenant_id),
  foreign key (tenant_id, actor_id) references public.tenant_memberships(tenant_id, user_id)
);
create index administration_events_scope_idx on public.administration_events(tenant_id, property_id, created_at desc);
alter table public.administration_events enable row level security;
create policy administration_events_read on public.administration_events for select to authenticated using (
  public.is_tenant_admin(tenant_id) or public.can_manage_property(property_id, tenant_id));
revoke all on public.administration_events from public, anon, authenticated;
grant select on public.administration_events to authenticated;

-- Admins need archived properties and inactive identities for restoration; the switcher filters active properties.
drop policy properties_read on public.properties;
create policy properties_read on public.properties for select to authenticated using (
  public.is_tenant_admin(tenant_id) or public.can_access_property(id, tenant_id));
create or replace function public.can_read_profile(target_user uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select target_user = auth.uid() or exists(select 1 from public.tenant_memberships m where m.user_id = target_user
    and ((m.active and public.can_access_tenant(m.tenant_id)) or public.is_tenant_admin(m.tenant_id)));
$$;

create function public.rename_tenant(target_tenant uuid, expected_version integer, next_name text) returns void
language plpgsql security definer set search_path = '' as $$
declare current_record public.tenants;
begin
  select * into current_record from public.tenants where id = target_tenant for update;
  if not public.is_tenant_admin(target_tenant) then raise exception 'Tenant admin required'; end if;
  if expected_version is null or current_record.version <> expected_version then raise exception 'Version conflict'; end if;
  update public.tenants set name = trim(next_name), version = version + 1 where id = target_tenant;
  insert into public.administration_events(tenant_id,actor_id,action,subject_id,details) values(target_tenant,auth.uid(),'tenant-renamed',target_tenant,jsonb_build_object('previous_name',current_record.name,'name',trim(next_name)));
end;
$$;

create function public.save_property(target_tenant uuid, target_property uuid, expected_version integer, next_name text, next_code text, next_timezone text, next_active boolean)
returns uuid language plpgsql security definer set search_path = '' as $$
declare property uuid; current_record public.properties;
begin
  perform 1 from public.tenants where id = target_tenant for update;
  if not public.is_tenant_admin(target_tenant) then raise exception 'Tenant admin required'; end if;
  if target_property is null then
    insert into public.properties(tenant_id,name,code,timezone) values(target_tenant,trim(next_name),upper(trim(next_code)),next_timezone) returning id into property;
  else
    select * into current_record from public.properties where id = target_property and tenant_id = target_tenant for update;
    if not found then raise exception 'Property unavailable'; end if;
    if expected_version is null or current_record.version <> expected_version then raise exception 'Version conflict'; end if;
    if not next_active and current_record.active and not exists(select 1 from public.properties where tenant_id = target_tenant and id <> target_property and active) then raise exception 'Last active property cannot be disabled'; end if;
    update public.properties set name = trim(next_name), code = upper(trim(next_code)), timezone = next_timezone, active = next_active, version = version + 1 where id = target_property;
    property := target_property;
  end if;
  insert into public.administration_events(tenant_id,property_id,actor_id,action,subject_id,details) values(target_tenant,property,auth.uid(),'property-saved',property,jsonb_build_object('previous_name',current_record.name,'previous_active',current_record.active,'name',trim(next_name),'active',case when target_property is null then true else next_active end));
  return property;
end;
$$;

create function public.set_tenant_membership(target_tenant uuid, target_user uuid, expected_version integer, next_role text, next_active boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare current_record public.tenant_memberships;
begin
  perform 1 from public.tenants where id = target_tenant for update;
  if not public.is_tenant_admin(target_tenant) then raise exception 'Tenant admin required'; end if;
  select * into current_record from public.tenant_memberships where tenant_id = target_tenant and user_id = target_user for update;
  if not found then raise exception 'Membership unavailable'; end if;
  if expected_version is null or current_record.version <> expected_version then raise exception 'Version conflict'; end if;
  if current_record.role = 'tenant-admin' and current_record.active and (next_role <> 'tenant-admin' or not next_active)
    and not exists(select 1 from public.tenant_memberships where tenant_id = target_tenant and user_id <> target_user and role = 'tenant-admin' and active) then raise exception 'Last tenant admin cannot be removed'; end if;
  update public.tenant_memberships set role = next_role, active = next_active, version = version + 1 where tenant_id = target_tenant and user_id = target_user;
  insert into public.administration_events(tenant_id,actor_id,action,subject_id,details) values(target_tenant,auth.uid(),'tenant-membership-updated',target_user,jsonb_build_object('previous_role',current_record.role,'previous_active',current_record.active,'role',next_role,'active',next_active));
end;
$$;

create function public.set_property_membership(target_property uuid, target_user uuid, expected_version integer, next_role text, next_active boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare selected_tenant uuid; current_record public.property_memberships;
begin
  select tenant_id into selected_tenant from public.properties where id = target_property for update;
  if not public.can_manage_property(target_property,selected_tenant) then raise exception 'Property admin required'; end if;
  if not exists(select 1 from public.tenant_memberships where tenant_id = selected_tenant and user_id = target_user and active) then raise exception 'Active tenant membership required'; end if;
  select * into current_record from public.property_memberships where property_id = target_property and user_id = target_user for update;
  if not public.is_tenant_admin(selected_tenant) and (next_role <> 'sales' or coalesce(current_record.role,'sales') <> 'sales'
    or exists(select 1 from public.tenant_memberships where tenant_id = selected_tenant and user_id = target_user and role = 'tenant-admin')) then raise exception 'Cannot manage privileged membership'; end if;
  if current_record.user_id is null then
    if expected_version is distinct from 0 then raise exception 'Version conflict'; end if;
    insert into public.property_memberships(tenant_id,property_id,user_id,role,active) values(selected_tenant,target_property,target_user,next_role,next_active);
  else
    if expected_version is null or current_record.version <> expected_version then raise exception 'Version conflict'; end if;
    update public.property_memberships set role = next_role, active = next_active, version = version + 1 where property_id = target_property and user_id = target_user;
  end if;
  insert into public.administration_events(tenant_id,property_id,actor_id,action,subject_id,details) values(selected_tenant,target_property,auth.uid(),'property-membership-updated',target_user,jsonb_build_object('previous_role',current_record.role,'previous_active',current_record.active,'role',next_role,'active',next_active));
end;
$$;

create function public.assign_sales_record(target_property uuid, record_type text, record_id uuid, expected_version integer, next_owner uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare selected_tenant uuid; changed uuid; previous_owner uuid;
begin
  select tenant_id into selected_tenant from public.properties where id = target_property;
  if not public.can_manage_property(target_property,selected_tenant) then raise exception 'Property admin required'; end if;
  if not exists(select 1 from public.tenant_memberships m where m.tenant_id = selected_tenant and m.user_id = next_owner and m.active
    and (m.role = 'tenant-admin' or exists(select 1 from public.property_memberships p where p.tenant_id = selected_tenant and p.property_id = target_property and p.user_id = next_owner and p.active))) then raise exception 'Owner lacks active property access'; end if;
  if record_type = 'opportunity' then
    select owner_id into previous_owner from public.opportunities where id = record_id and tenant_id = selected_tenant and property_id = target_property for update;
    update public.opportunities set owner_id = next_owner, version = version + 1 where id = record_id and tenant_id = selected_tenant and property_id = target_property and version = expected_version returning id into changed;
  elsif record_type = 'task' then
    select owner_id into previous_owner from public.tasks where id = record_id and tenant_id = selected_tenant and property_id = target_property for update;
    update public.tasks set owner_id = next_owner, version = version + 1 where id = record_id and tenant_id = selected_tenant and property_id = target_property and version = expected_version returning id into changed;
  else raise exception 'Invalid record type'; end if;
  if changed is null then raise exception 'Record unavailable or version conflict'; end if;
  insert into public.administration_events(tenant_id,property_id,actor_id,action,subject_id,details) values(selected_tenant,target_property,auth.uid(),'sales-owner-assigned',record_id,jsonb_build_object('previous_owner',previous_owner,'owner',next_owner,'record_type',record_type));
end;
$$;

create table public.membership_invitations (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id), property_id uuid not null,
  email text not null check (email = lower(trim(email)) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' and length(email) <= 254),
  full_name text not null check (length(trim(full_name)) between 1 and 200), requested_role text not null check (requested_role in ('tenant-admin','property-admin','sales')),
  created_by uuid not null references public.profiles(id), created_at timestamptz not null default now(), expires_at timestamptz not null default now() + interval '7 days',
  accepted_at timestamptz, accepted_by uuid references public.profiles(id), revoked_at timestamptz,
  delivery_status text not null default 'not-sent' check (delivery_status in ('not-sent','processing','provider-accepted','failed','unknown')),
  delivery_attempt_id uuid, last_attempt_at timestamptz,
  foreign key (property_id,tenant_id) references public.properties(id,tenant_id),
  foreign key (tenant_id,created_by) references public.tenant_memberships(tenant_id,user_id)
);
create unique index pending_invitation_idx on public.membership_invitations(tenant_id,property_id,email) where accepted_at is null and revoked_at is null;
create index invitations_recipient_idx on public.membership_invitations(email,expires_at);
create index invitations_scope_idx on public.membership_invitations(tenant_id,property_id,created_at desc);
alter table public.membership_invitations enable row level security;
create policy invitations_admin_read on public.membership_invitations for select to authenticated using (
  public.is_tenant_admin(tenant_id) or (requested_role = 'sales' and public.can_manage_property(property_id,tenant_id)));
revoke all on public.membership_invitations from public, anon, authenticated;
grant select on public.membership_invitations to authenticated;

create function public.may_invite(target_property uuid, target_tenant uuid, requested_role text) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.can_access_property(target_property,target_tenant) and (public.is_tenant_admin(target_tenant)
    or (requested_role = 'sales' and public.can_manage_property(target_property,target_tenant)));
$$;

create function public.request_membership_invitation(target_property uuid, recipient_email text, recipient_name text, requested_role text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare selected_tenant uuid; invitation uuid;
begin
  select tenant_id into selected_tenant from public.properties where id = target_property for update;
  if not public.may_invite(target_property,selected_tenant,requested_role) then raise exception 'Invitation not permitted'; end if;
  if (select count(*) from public.membership_invitations where created_by = auth.uid() and created_at > now() - interval '1 hour') >= 20 then raise exception 'Invitation rate limit'; end if;
  update public.membership_invitations set revoked_at = now() where property_id = target_property and email = lower(trim(recipient_email)) and accepted_at is null and revoked_at is null and expires_at <= now();
  insert into public.membership_invitations(tenant_id,property_id,email,full_name,requested_role,created_by)
  values(selected_tenant,target_property,lower(trim(recipient_email)),trim(recipient_name),requested_role,auth.uid()) returning id into invitation;
  insert into public.administration_events(tenant_id,property_id,actor_id,action,subject_id) values(selected_tenant,target_property,auth.uid(),'invitation-created',invitation);
  return invitation;
end;
$$;

create function public.revoke_membership_invitation(invitation uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare current_record public.membership_invitations;
begin
  select * into current_record from public.membership_invitations where id = invitation for update;
  if not found or not public.may_invite(current_record.property_id,current_record.tenant_id,current_record.requested_role) then raise exception 'Invitation unavailable'; end if;
  if current_record.accepted_at is not null then raise exception 'Invitation already accepted'; end if;
  update public.membership_invitations set revoked_at = now() where id = invitation;
  insert into public.administration_events(tenant_id,property_id,actor_id,action,subject_id) values(current_record.tenant_id,current_record.property_id,auth.uid(),'invitation-revoked',invitation);
end;
$$;

create function public.claim_invitation_delivery(invitation uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare current_record public.membership_invitations; attempt uuid := gen_random_uuid();
begin
  select * into current_record from public.membership_invitations where id = invitation for update;
  if not found or not public.may_invite(current_record.property_id,current_record.tenant_id,current_record.requested_role)
    or current_record.revoked_at is not null or current_record.accepted_at is not null or current_record.expires_at <= now() then raise exception 'Invitation unavailable'; end if;
  if current_record.last_attempt_at > now() - interval '2 minutes' then raise exception 'Wait before retrying invitation delivery'; end if;
  update public.membership_invitations set delivery_status = 'processing', delivery_attempt_id = attempt, last_attempt_at = now() where id = invitation;
  return attempt;
end;
$$;
create function public.finish_invitation_delivery(invitation uuid, attempt uuid, next_status text) returns void
language plpgsql security definer set search_path = '' as $$
declare current_record public.membership_invitations;
begin
  select * into current_record from public.membership_invitations where id = invitation for update;
  if not found or not public.may_invite(current_record.property_id,current_record.tenant_id,current_record.requested_role)
    or current_record.delivery_attempt_id is distinct from attempt or attempt is null then raise exception 'Delivery attempt unavailable'; end if;
  if next_status not in ('provider-accepted','failed','unknown') or next_status is null then raise exception 'Invalid delivery status'; end if;
  update public.membership_invitations set delivery_status = next_status where id = invitation;
  insert into public.administration_events(tenant_id,property_id,actor_id,action,subject_id,details) values(current_record.tenant_id,current_record.property_id,auth.uid(),'invitation-delivery-recorded',invitation,jsonb_build_object('status',next_status,'attempt_id',attempt));
end;
$$;

create function public.list_my_invitations() returns table(id uuid,tenant_name text,property_name text,requested_role text,expires_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select i.id,t.name,p.name,i.requested_role,i.expires_at from public.membership_invitations i
  join auth.users u on u.id = auth.uid() and lower(u.email) = i.email and u.email_confirmed_at is not null
  join public.tenants t on t.id = i.tenant_id and t.active join public.properties p on p.id = i.property_id and p.tenant_id = i.tenant_id and p.active
  where i.revoked_at is null and i.accepted_at is null and i.expires_at > now()
  order by i.created_at desc;
$$;
create function public.accept_membership_invitation(invitation uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare current_record public.membership_invitations; issuer_valid boolean;
begin
  select * into current_record from public.membership_invitations where id = invitation for update;
  if not found or current_record.revoked_at is not null or current_record.accepted_at is not null or current_record.expires_at <= now()
    or not exists(select 1 from auth.users where id = auth.uid() and lower(email) = current_record.email and email_confirmed_at is not null) then raise exception 'Invitation unavailable'; end if;
  perform 1 from public.tenants where id = current_record.tenant_id and active for update;
  if not found or not exists(select 1 from public.properties where id = current_record.property_id and active) then raise exception 'Workspace unavailable'; end if;
  select exists(select 1 from public.tenant_memberships m where m.user_id = current_record.created_by and m.tenant_id = current_record.tenant_id and m.active and
    (m.role = 'tenant-admin' or (current_record.requested_role = 'sales' and exists(select 1 from public.property_memberships p where p.property_id = current_record.property_id and p.user_id = m.user_id and p.role = 'property-admin' and p.active)))) into issuer_valid;
  if not issuer_valid then raise exception 'Issuer no longer authorized'; end if;
  if not exists(select 1 from public.tenant_memberships where tenant_id = current_record.tenant_id and user_id = current_record.created_by and role = 'tenant-admin' and active)
    and (exists(select 1 from public.tenant_memberships where tenant_id = current_record.tenant_id and user_id = auth.uid() and role = 'tenant-admin')
      or exists(select 1 from public.property_memberships where property_id = current_record.property_id and user_id = auth.uid() and role = 'property-admin')) then raise exception 'Cannot restore privileged membership'; end if;
  -- A Property Admin may not reactivate a revoked tenant membership.
  if exists(select 1 from public.tenant_memberships where tenant_id = current_record.tenant_id and user_id = auth.uid() and not active)
    and not exists(select 1 from public.tenant_memberships where tenant_id = current_record.tenant_id and user_id = current_record.created_by and role = 'tenant-admin' and active) then raise exception 'Tenant admin must restore membership'; end if;
  insert into public.profiles(id,full_name) values(auth.uid(),current_record.full_name) on conflict (id) do nothing;
  insert into public.tenant_memberships(tenant_id,user_id,role) values(current_record.tenant_id,auth.uid(),case when current_record.requested_role = 'tenant-admin' then 'tenant-admin' else 'member' end)
    on conflict (tenant_id,user_id) do update set active = true, role = case when public.tenant_memberships.active and public.tenant_memberships.role = 'tenant-admin' then 'tenant-admin' else excluded.role end, version = public.tenant_memberships.version + 1;
  if current_record.requested_role <> 'tenant-admin' then
    insert into public.property_memberships(tenant_id,property_id,user_id,role) values(current_record.tenant_id,current_record.property_id,auth.uid(),current_record.requested_role)
      on conflict (property_id,user_id) do update set active = true, role = case when public.property_memberships.active and public.property_memberships.role = 'property-admin' then 'property-admin' else excluded.role end, version = public.property_memberships.version + 1;
  end if;
  update public.membership_invitations set accepted_at = now(), accepted_by = auth.uid() where id = invitation;
  insert into public.administration_events(tenant_id,property_id,actor_id,action,subject_id) values(current_record.tenant_id,current_record.property_id,auth.uid(),'invitation-accepted',invitation);
  return current_record.property_id;
end;
$$;

revoke all on function public.rename_tenant(uuid,integer,text), public.save_property(uuid,uuid,integer,text,text,text,boolean), public.set_tenant_membership(uuid,uuid,integer,text,boolean), public.set_property_membership(uuid,uuid,integer,text,boolean), public.assign_sales_record(uuid,text,uuid,integer,uuid), public.may_invite(uuid,uuid,text), public.request_membership_invitation(uuid,text,text,text), public.revoke_membership_invitation(uuid), public.claim_invitation_delivery(uuid), public.finish_invitation_delivery(uuid,uuid,text), public.list_my_invitations(), public.accept_membership_invitation(uuid) from public,anon;
grant execute on function public.rename_tenant(uuid,integer,text), public.save_property(uuid,uuid,integer,text,text,text,boolean), public.set_tenant_membership(uuid,uuid,integer,text,boolean), public.set_property_membership(uuid,uuid,integer,text,boolean), public.assign_sales_record(uuid,text,uuid,integer,uuid), public.may_invite(uuid,uuid,text), public.request_membership_invitation(uuid,text,text,text), public.revoke_membership_invitation(uuid), public.claim_invitation_delivery(uuid), public.finish_invitation_delivery(uuid,uuid,text), public.list_my_invitations(), public.accept_membership_invitation(uuid) to authenticated;

commit;
