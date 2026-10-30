begin;

alter table public.contacts add unique (id, tenant_id, company_id);
alter table public.opportunities add unique (id, tenant_id, property_id, company_id);

create table public.sales_activities (
  id uuid primary key, tenant_id uuid not null references public.tenants(id), property_id uuid not null,
  company_id uuid not null, contact_id uuid, opportunity_id uuid, owner_id uuid not null references public.profiles(id),
  communication_type text not null check (communication_type in ('whatsapp','direct-call','visit','email')),
  occurred_at timestamptz not null check (isfinite(occurred_at)), summary text not null check (length(trim(summary)) between 3 and 200),
  outcome text not null check (length(trim(outcome)) between 3 and 1000), notes text not null default '' check (length(notes) <= 4000),
  next_action text check (length(trim(next_action)) between 3 and 200), follow_up_date date check (isfinite(follow_up_date)),
  latitude double precision check (latitude between -90 and 90), longitude double precision check (longitude between -180 and 180),
  accuracy_m double precision check (accuracy_m >= 0 and accuracy_m <= 100000), gps_captured_at timestamptz,
  photo_sha256 text check (photo_sha256 ~ '^[a-f0-9]{64}$'),
  photo_path text generated always as (case when photo_sha256 is not null then tenant_id::text || '/' || property_id::text || '/' || owner_id::text || '/' || id::text || '.jpg' end) stored,
  status text not null default 'draft' check (status in ('draft','recorded')),
  request_hash text not null, created_at timestamptz not null default now(), recorded_at timestamptz,
  unique (id, tenant_id, property_id, company_id),
  foreign key (property_id,tenant_id) references public.properties(id,tenant_id),
  foreign key (company_id,tenant_id) references public.companies(id,tenant_id),
  foreign key (contact_id,tenant_id,company_id) references public.contacts(id,tenant_id,company_id),
  foreign key (opportunity_id,tenant_id,property_id,company_id) references public.opportunities(id,tenant_id,property_id,company_id),
  foreign key (tenant_id,owner_id) references public.tenant_memberships(tenant_id,user_id),
  check (num_nonnulls(latitude,longitude,accuracy_m,gps_captured_at) in (0,4)),
  check ((next_action is null) = (follow_up_date is null)),
  check (communication_type = 'visit' or (latitude is null and photo_sha256 is null)),
  check (communication_type <> 'visit' or (latitude is not null and photo_sha256 is not null)),
  check ((status = 'recorded') = (recorded_at is not null))
);
create index sales_activities_scope_idx on public.sales_activities(tenant_id,property_id,occurred_at desc) where status = 'recorded';
create index sales_activities_owner_idx on public.sales_activities(owner_id,property_id);
create index sales_activities_company_idx on public.sales_activities(company_id,tenant_id);
create index sales_activities_contact_idx on public.sales_activities(contact_id);
create index sales_activities_opportunity_idx on public.sales_activities(opportunity_id);
alter table public.tasks add column activity_id uuid,
  add foreign key (activity_id,tenant_id,property_id,company_id) references public.sales_activities(id,tenant_id,property_id,company_id);
create unique index tasks_activity_idx on public.tasks(activity_id) where activity_id is not null;

create function public.can_read_sales_activity(activity uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.sales_activities a where a.id = activity and public.can_access_property(a.property_id,a.tenant_id)
    and (a.owner_id = auth.uid() or (a.status = 'recorded' and public.can_manage_property(a.property_id,a.tenant_id))));
$$;
alter table public.sales_activities enable row level security;
create policy sales_activities_read on public.sales_activities for select to authenticated using (public.can_read_sales_activity(id));
revoke all on public.sales_activities from public,anon,authenticated;
grant select on public.sales_activities to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('activity-selfies','activity-selfies',false,204800,array['image/jpeg'])
on conflict(id) do update set public = false,file_size_limit = 204800,allowed_mime_types = array['image/jpeg'];

create policy activity_selfies_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'activity-selfies' and exists(select 1 from public.sales_activities a where a.photo_path = name and a.owner_id = auth.uid()
    and a.status = 'draft' and a.created_at > now() - interval '1 hour' and public.can_access_property(a.property_id,a.tenant_id)));
create policy activity_selfies_read on storage.objects for select to authenticated using (
  bucket_id = 'activity-selfies' and exists(select 1 from public.sales_activities a where a.photo_path = name and public.can_read_sales_activity(a.id)));
create policy activity_selfies_delete_draft on storage.objects for delete to authenticated using (
  bucket_id = 'activity-selfies' and exists(select 1 from public.sales_activities a where a.photo_path = name and a.owner_id = auth.uid() and a.status = 'draft'
    and public.can_access_property(a.property_id,a.tenant_id)));
-- No UPDATE policy: uploaded proof cannot be overwritten, including by its author.

create function public.register_sales_activity(target_property uuid, activity uuid, payload jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare selected_tenant uuid; existing public.sales_activities; selected_property public.properties;
begin
  select * into selected_property from public.properties where id = target_property;
  selected_tenant := selected_property.tenant_id;
  if not public.can_access_property(target_property,selected_tenant) then raise exception 'Property unavailable'; end if;
  if activity is null or payload is null then raise exception 'Activity input required'; end if;
  -- Idempotent retry; a reused ID may not replace the original payload or author.
  perform pg_advisory_xact_lock(hashtextextended(activity::text,0));
  select * into existing from public.sales_activities where id = activity;
  if found then
    if existing.owner_id <> auth.uid() or existing.property_id <> target_property or existing.request_hash <> md5(payload::text) then raise exception 'Activity request conflict'; end if;
    return activity;
  end if;
  if (payload->>'occurred_at')::timestamptz > now() + interval '5 minutes' then raise exception 'Activity cannot be in the future'; end if;
  if (payload->>'gps_captured_at')::timestamptz > now() + interval '1 minute' or (payload->>'gps_captured_at')::timestamptz < now() - interval '10 minutes' then raise exception 'GPS measurement is stale or invalid'; end if;
  if payload->>'communication_type' = 'visit' then
    if payload->>'photo_sha256' is null then raise exception 'Visit selfie required'; end if;
    if payload->>'latitude' is null then raise exception 'Visit GPS required'; end if;
  end if;
  if payload->>'opportunity_id' is not null and not exists(select 1 from public.opportunities o where o.id = (payload->>'opportunity_id')::uuid
    and o.tenant_id = selected_tenant and o.property_id = target_property and (o.owner_id = auth.uid() or public.can_manage_property(target_property,selected_tenant))) then raise exception 'Opportunity unavailable'; end if;
  insert into public.sales_activities(id,tenant_id,property_id,company_id,contact_id,opportunity_id,owner_id,communication_type,occurred_at,summary,outcome,notes,next_action,follow_up_date,latitude,longitude,accuracy_m,gps_captured_at,photo_sha256,request_hash)
  values(activity,selected_tenant,target_property,(payload->>'company_id')::uuid,(payload->>'contact_id')::uuid,(payload->>'opportunity_id')::uuid,auth.uid(),payload->>'communication_type',(payload->>'occurred_at')::timestamptz,
    trim(payload->>'summary'),trim(payload->>'outcome'),coalesce(payload->>'notes',''),payload->>'next_action',(payload->>'follow_up_date')::date,
    (payload->>'latitude')::double precision,(payload->>'longitude')::double precision,(payload->>'accuracy_m')::double precision,(payload->>'gps_captured_at')::timestamptz,payload->>'photo_sha256',md5(payload::text));
  return activity;
end;
$$;

create function public.finalize_sales_activity(target_property uuid, activity uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare current_record public.sales_activities;
begin
  select * into current_record from public.sales_activities where id = activity and property_id = target_property for update;
  if not found or current_record.owner_id <> auth.uid() or not public.can_access_property(current_record.property_id,current_record.tenant_id) then raise exception 'Activity unavailable'; end if;
  if current_record.status = 'recorded' then return activity; end if;
  if current_record.created_at < now() - interval '1 hour' then raise exception 'Draft expired'; end if;
  if current_record.gps_captured_at < now() - interval '10 minutes' then raise exception 'GPS measurement is stale'; end if;
  if current_record.opportunity_id is not null and not exists(select 1 from public.opportunities o where o.id = current_record.opportunity_id and
    (o.owner_id = auth.uid() or public.can_manage_property(o.property_id,o.tenant_id))) then raise exception 'Opportunity access changed'; end if;
  if current_record.photo_path is not null and not exists(select 1 from storage.objects where bucket_id = 'activity-selfies' and name = current_record.photo_path
    and metadata->>'mimetype' = 'image/jpeg' and (metadata->>'size')::bigint between 1 and 204800) then raise exception 'Selfie upload not confirmed'; end if;
  update public.sales_activities set status = 'recorded', recorded_at = now() where id = activity;
  if current_record.next_action is not null then
    insert into public.tasks(tenant_id,property_id,company_id,owner_id,title,due_date,activity_id)
    values(current_record.tenant_id,target_property,current_record.company_id,auth.uid(),current_record.next_action,current_record.follow_up_date,activity);
  end if;
  return activity;
end;
$$;

revoke all on function public.can_read_sales_activity(uuid),public.register_sales_activity(uuid,uuid,jsonb),public.finalize_sales_activity(uuid,uuid) from public,anon;
grant execute on function public.can_read_sales_activity(uuid),public.register_sales_activity(uuid,uuid,jsonb),public.finalize_sales_activity(uuid,uuid) to authenticated;

commit;
