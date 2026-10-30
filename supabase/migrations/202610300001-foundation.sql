begin;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null check (length(full_name) between 1 and 200),
  role text not null default 'sales' check (role in ('admin', 'sales'))
);

create function public.is_admin() returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  sequence_no bigint generated always as identity unique,
  code text generated always as ('CL-' || sequence_no::text) stored,
  name text not null check (length(trim(name)) between 2 and 200),
  address text not null default '', city text not null default '', phone text not null default '',
  fax text not null default '', account_type text not null default '',
  owner_id uuid not null references public.profiles(id), created_at timestamptz not null default now()
);
create index companies_owner_idx on public.companies(owner_id);
create index companies_name_idx on public.companies(lower(name));

create function public.can_access_company(company uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.companies where id = company and (owner_id = auth.uid() or public.is_admin()));
$$;

create table public.contacts (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id),
  title text not null default '', first_name text not null check (length(trim(first_name)) > 0), last_name text not null default '',
  position text not null default '', mobile text not null default '', email text not null default '',
  check (email = '' or email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')
);
create index contacts_company_idx on public.contacts(company_id);

create table public.opportunities (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id),
  owner_id uuid not null references public.profiles(id), name text not null check (length(trim(name)) between 3 and 200),
  offering_type text not null check (offering_type in ('room', 'meeting', 'package')),
  estimated_value numeric(14,2) not null check (estimated_value >= 0),
  stage text not null default 'discovery' check (stage in ('discovery', 'proposal-sent', 'negotiation', 'won', 'lost')),
  target_close date not null, next_action text not null check (length(trim(next_action)) >= 3), follow_up_date date not null,
  stage_entered_at timestamptz not null default now(), version integer not null default 1,
  lost_reason text, created_at timestamptz not null default now(),
  check (stage <> 'lost' or coalesce(length(trim(lost_reason)), 0) >= 3)
);
create index opportunities_company_idx on public.opportunities(company_id);
create index opportunities_owner_idx on public.opportunities(owner_id);
create index opportunities_follow_up_idx on public.opportunities(follow_up_date) where stage not in ('won', 'lost');

create table public.tasks (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id),
  owner_id uuid not null references public.profiles(id), title text not null check(length(trim(title)) between 3 and 200),
  due_date date not null, completed boolean not null default false, version integer not null default 1,
  created_at timestamptz not null default now()
);
create index tasks_owner_idx on public.tasks(owner_id);
create index tasks_company_idx on public.tasks(company_id);

create table public.pipeline_stage_history (
  id uuid primary key default gen_random_uuid(), opportunity_id uuid not null references public.opportunities(id),
  previous_stage text not null, new_stage text not null, reason text,
  actor_id uuid not null references public.profiles(id), created_at timestamptz not null default now()
);
create index pipeline_history_opportunity_idx on public.pipeline_stage_history(opportunity_id);

alter table public.profiles enable row level security;
alter table public.companies enable row level security;
alter table public.contacts enable row level security;
alter table public.opportunities enable row level security;
alter table public.tasks enable row level security;
alter table public.pipeline_stage_history enable row level security;

create policy profiles_read on public.profiles for select to authenticated using (id = auth.uid() or public.is_admin());
create policy companies_read on public.companies for select to authenticated using (owner_id = auth.uid() or public.is_admin());
create policy contacts_read on public.contacts for select to authenticated using (public.can_access_company(company_id));
create policy opportunities_read on public.opportunities for select to authenticated using ((owner_id = auth.uid() and public.can_access_company(company_id)) or public.is_admin());
create policy opportunities_insert on public.opportunities for insert to authenticated with check (
  owner_id = auth.uid() and public.can_access_company(company_id) and stage = 'discovery' and version = 1
);
create policy tasks_read on public.tasks for select to authenticated using ((owner_id = auth.uid() and public.can_access_company(company_id)) or public.is_admin());
create policy tasks_insert on public.tasks for insert to authenticated with check (owner_id = auth.uid() and public.can_access_company(company_id) and completed = false and version = 1);
create policy history_read on public.pipeline_stage_history for select to authenticated using (exists(select 1 from public.opportunities o where o.id = opportunity_id));

revoke all on public.profiles, public.companies, public.contacts, public.opportunities, public.tasks, public.pipeline_stage_history from anon, authenticated;
grant select on public.profiles, public.companies, public.contacts, public.opportunities, public.tasks, public.pipeline_stage_history to authenticated;
grant insert (company_id, owner_id, name, offering_type, estimated_value, target_close, next_action, follow_up_date) on public.opportunities to authenticated;
grant insert (company_id, owner_id, title, due_date) on public.tasks to authenticated;

create function public.create_company_with_contact(payload jsonb) returns uuid language plpgsql security definer set search_path = '' as $$
declare company uuid;
begin
  if not exists(select 1 from public.profiles where id = auth.uid()) then raise exception 'Unauthorized'; end if;
  if length(coalesce(payload->>'phone', '') || coalesce(payload->>'mobile', '') || coalesce(payload->>'email', '')) = 0 then raise exception 'Contact channel required'; end if;
  insert into public.companies(name, address, city, phone, fax, account_type, owner_id)
  values(payload->>'name', coalesce(payload->>'address',''), coalesce(payload->>'city',''), coalesce(payload->>'phone',''), coalesce(payload->>'fax',''), coalesce(payload->>'account_type',''), auth.uid()) returning id into company;
  insert into public.contacts(company_id, title, first_name, last_name, position, mobile, email)
  values(company, coalesce(payload->>'title',''), payload->>'first_name', coalesce(payload->>'last_name',''), coalesce(payload->>'position',''), coalesce(payload->>'mobile',''), coalesce(payload->>'email',''));
  return company;
end;
$$;

create function public.transition_opportunity(opportunity uuid, expected_version integer, next_stage text, reason text default '')
returns void language plpgsql security definer set search_path = '' as $$
declare current_record public.opportunities;
begin
  select * into current_record from public.opportunities where id = opportunity for update;
  if not found or not public.can_access_company(current_record.company_id) or not (current_record.owner_id = auth.uid() or public.is_admin()) then raise exception 'Opportunity unavailable'; end if;
  if current_record.version <> expected_version then raise exception 'Version conflict'; end if;
  if next_stage not in ('discovery','proposal-sent','negotiation','lost') then raise exception 'Verified agreement and payment policy required for Won'; end if;
  if next_stage = 'lost' and coalesce(length(trim(reason)), 0) < 3 then raise exception 'Lost reason required'; end if;
  if next_stage = current_record.stage then return; end if;
  update public.opportunities set stage = next_stage, stage_entered_at = now(), version = version + 1,
    lost_reason = case when next_stage = 'lost' then trim(reason) else null end where id = opportunity;
  insert into public.pipeline_stage_history(opportunity_id, previous_stage, new_stage, reason, actor_id)
  values(opportunity, current_record.stage, next_stage, nullif(trim(reason), ''), auth.uid());
end;
$$;

create function public.set_task_completed(task uuid, expected_version integer, next_completed boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare current_record public.tasks;
begin
  select * into current_record from public.tasks where id = task for update;
  if not found or not public.can_access_company(current_record.company_id) or not (current_record.owner_id = auth.uid() or public.is_admin()) then raise exception 'Task unavailable'; end if;
  if current_record.version <> expected_version then raise exception 'Version conflict'; end if;
  update public.tasks set completed = next_completed, version = version + 1 where id = task;
end;
$$;

revoke all on function public.is_admin(), public.can_access_company(uuid), public.create_company_with_contact(jsonb), public.transition_opportunity(uuid, integer, text, text), public.set_task_completed(uuid, integer, boolean) from public, anon;
grant execute on function public.is_admin(), public.can_access_company(uuid), public.create_company_with_contact(jsonb), public.transition_opportunity(uuid, integer, text, text), public.set_task_completed(uuid, integer, boolean) to authenticated;

commit;
