-- Entre Nos: proposed cloud schema. Apply ONLY to a new, personal Supabase project.
-- This script is not applied automatically. Security verification is required before public launch.
create extension if not exists pgcrypto;
create schema if not exists private;

create table if not exists public.couples (
  id uuid primary key default gen_random_uuid(),
  invite_code text not null unique default encode(gen_random_bytes(16),'hex'),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.couple_members (
  couple_id uuid not null references public.couples(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade unique,
  joined_at timestamptz not null default now(),
  primary key(couple_id,user_id)
);
create index if not exists couple_members_user_idx on public.couple_members(user_id);

create table if not exists public.couple_items (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  item_type text not null check(item_type in ('mood','meal','event','message','music','memory','challenge','proof')),
  visibility text not null default 'shared' check(visibility in ('private','shared')),
  body jsonb not null default '{}'::jsonb check(jsonb_typeof(body)='object'),
  occurred_on date not null default current_date,
  created_at timestamptz not null default now()
);
create index if not exists couple_items_couple_date_idx on public.couple_items(couple_id,occurred_on desc);
create index if not exists couple_items_owner_idx on public.couple_items(owner_id);

-- Membership checks use an isolated definer function to avoid recursive RLS.
create or replace function private.is_member(p_couple uuid)
returns boolean language sql stable security definer set search_path=''
as $$select exists(
  select 1 from public.couple_members m
  where m.couple_id=p_couple and m.user_id=(select auth.uid())
)$$;

create or replace function private.is_member_path(p_path text)
returns boolean language sql stable security definer set search_path=''
as $$select exists(
  select 1 from public.couple_members m
  where m.couple_id::text=split_part(p_path,'/',1)
  and m.user_id=(select auth.uid())
)$$;

-- Couple creator is automatically added as the first member.
create or replace function private.join_creator()
returns trigger language plpgsql security definer set search_path=''
as $$begin
  if new.created_by is distinct from (select auth.uid()) then
    raise exception 'owner mismatch';
  end if;
  insert into public.couple_members(couple_id,user_id) values(new.id,new.created_by);
  return new;
end$$;
drop trigger if exists on_couple_created on public.couples;
create trigger on_couple_created after insert on public.couples
for each row execute function private.join_creator();

-- An invite code acts like a secret: 128-bit random and limited to the second member.
create or replace function public.join_couple(p_code text)
returns uuid language plpgsql security definer set search_path=''
as $$declare v_pair uuid;
begin
 if auth.uid() is null then raise exception 'Login required'; end if;
 if exists(select 1 from public.couple_members where user_id=(select auth.uid())) then
   raise exception 'Already part of a couple';
 end if;
 select id into v_pair from public.couples
 where invite_code=lower(trim(p_code)) for update;
 if v_pair is null then raise exception 'Invalid invitation'; end if;
 if (select count(*) from public.couple_members where couple_id=v_pair)>=2 then
   raise exception 'Couple already has two members';
 end if;
 insert into public.couple_members(couple_id,user_id) values(v_pair,(select auth.uid()));
 return v_pair;
end$$;

alter table public.couples enable row level security;
alter table public.couple_members enable row level security;
alter table public.couple_items enable row level security;
revoke all on public.couples, public.couple_members, public.couple_items from public,anon,authenticated;
grant select,insert on public.couples to authenticated;
grant select on public.couple_members to authenticated;
grant select,insert,update,delete on public.couple_items to authenticated;
revoke all on function public.join_couple(text) from public,anon,authenticated;
grant execute on function public.join_couple(text) to authenticated;
revoke all on function private.is_member(uuid),private.is_member_path(text) from public,anon,authenticated;
grant usage on schema private to authenticated;
grant execute on function private.is_member(uuid),private.is_member_path(text) to authenticated;

create policy couple_read on public.couples for select to authenticated
  using ((select private.is_member(id)));
create policy couple_create on public.couples for insert to authenticated
  with check(created_by=(select auth.uid()));
create policy member_read on public.couple_members for select to authenticated
  using ((select private.is_member(couple_id)));
create policy item_read on public.couple_items for select to authenticated
  using(owner_id=(select auth.uid()) or (visibility='shared' and (select private.is_member(couple_id))));
create policy item_create on public.couple_items for insert to authenticated
  with check(owner_id=(select auth.uid()) and (select private.is_member(couple_id)));
create policy item_update on public.couple_items for update to authenticated
  using(owner_id=(select auth.uid()) and (select private.is_member(couple_id)))
  with check(owner_id=(select auth.uid()) and (select private.is_member(couple_id)));
create policy item_delete on public.couple_items for delete to authenticated
  using(owner_id=(select auth.uid()) and (select private.is_member(couple_id)));

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('entre-nos-photos','entre-nos-photos',false,16777216,array['image/jpeg','image/png','image/webp'])
on conflict(id) do nothing;

-- Paths must be: <couple_uuid>/<uploader_uuid>/<random_uuid>.jpg
create policy couple_storage_select on storage.objects for select to authenticated
 using(bucket_id='entre-nos-photos' and (select private.is_member_path(name)));
create policy couple_storage_insert on storage.objects for insert to authenticated
 with check(bucket_id='entre-nos-photos'
   and split_part(name,'/',2)=(select auth.uid())::text
   and (select private.is_member_path(name)));
create policy couple_storage_delete on storage.objects for delete to authenticated
 using(bucket_id='entre-nos-photos'
   and split_part(name,'/',2)=(select auth.uid())::text
   and (select private.is_member_path(name)));

-- To validate before production:
-- 1. Create two authenticated test users and one third unrelated test user.
-- 2. Assert a private item cannot be selected by the partner; shared items can.
-- 3. Assert the third account cannot read any items or storage photos.
-- 4. Assert third member rejection, owner-ID impersonation rejection,
--    upload path impersonation rejection, and invite enumeration resistance.
-- 5. Run Supabase advisors and review permissions and Auth settings.
