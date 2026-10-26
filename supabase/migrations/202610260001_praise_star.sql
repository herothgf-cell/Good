-- Praise Star v0.1 — run in a NEW Supabase project.
-- Browser roles have SELECT-only access; all state writes are server-only CAS transactions.
create schema if not exists app_private;
revoke all on schema app_private from public;
grant usage on schema app_private to authenticated, service_role;

create table public.families (
  id uuid primary key default gen_random_uuid(),
  state jsonb not null check (state->>'schema' = '1'),
  revision bigint not null default 0 check (revision >= 0),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.family_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete cascade,
  display_name text not null check(length(btrim(display_name)) between 1 and 30),
  role text not null check(role in ('admin','giver','child')),
  joined_at timestamptz not null default now()
);
create index family_members_family_idx on public.family_members(family_id);
create table public.family_events (
  family_id uuid not null references public.families(id) on delete cascade,
  request_id uuid not null, actor_id uuid not null, payload jsonb not null, result jsonb not null,
  after_revision bigint not null, created_at timestamptz not null default now(),
  primary key(family_id,request_id)
);
create index family_events_created_idx on public.family_events(family_id,created_at desc);
create table public.family_invites (
  id uuid primary key default gen_random_uuid(), family_id uuid not null references public.families(id) on delete cascade,
  token_hash text not null unique, role text not null check(role in ('admin','giver','child')),
  created_by uuid not null, created_at timestamptz not null default now(),
  expires_at timestamptz not null, used_at timestamptz, revoked_at timestamptz
);
create index family_invites_family_idx on public.family_invites(family_id);

alter table public.families enable row level security;
alter table public.family_members enable row level security;
alter table public.family_events enable row level security;
alter table public.family_invites enable row level security;
revoke all on public.families, public.family_members, public.family_events, public.family_invites from public, anon, authenticated;
grant select on public.families, public.family_members, public.family_events to authenticated;
grant all on public.families, public.family_members, public.family_events, public.family_invites to service_role;

create function app_private.my_family() returns uuid language sql stable security definer set search_path = '' as $$
  select family_id from public.family_members where user_id = (select auth.uid());
$$;
revoke all on function app_private.my_family() from public, anon;
grant execute on function app_private.my_family() to authenticated;
create policy family_read on public.families for select to authenticated using (id = (select app_private.my_family()));
create policy member_read on public.family_members for select to authenticated using (family_id = (select app_private.my_family()));
create policy event_read on public.family_events for select to authenticated using (family_id = (select app_private.my_family()));
-- No browser policy or grant on family_invites. Tokens are never readable after issuance.

create function public.family_bootstrap(p_family_name text,p_child_name text,p_display_name text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_uid uuid:=auth.uid(); v_id uuid; v_state jsonb;
begin
  if v_uid is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then raise exception '보호자 계정으로 로그인해 주세요.'; end if;
  if length(coalesce(btrim(p_family_name),'')) not between 1 and 40 or length(coalesce(btrim(p_child_name),'')) not between 1 and 20 or length(coalesce(btrim(p_display_name),'')) not between 1 and 30 then raise exception '가족 이름과 별명을 확인해 주세요.'; end if;
  if exists(select 1 from public.family_members where user_id=v_uid) then raise exception '이미 참여한 가족이 있어요.'; end if;
  v_state := '{"schema":1,"familyName":"우리 가족","childName":"연준이","balance":0,"lifetimeEarned":0,"goalRewardId":"r-movie","rewards":[{"id":"r-play","title":"놀이 선택권","description":"오늘 함께할 놀이를 골라요.","icon":"🎲","cost":5,"stock":null,"active":true,"shop":true,"gacha":true,"version":1},{"id":"r-book","title":"잠자리 책 한 권 더","description":"좋아하는 책을 함께 읽어요.","icon":"📚","cost":10,"stock":null,"active":true,"shop":true,"gacha":true,"version":1},{"id":"r-soccer","title":"아빠와 축구 놀이","description":"날씨 좋은 날, 함께 공을 차요.","icon":"⚽","cost":15,"stock":null,"active":true,"shop":true,"gacha":true,"version":1},{"id":"r-meal","title":"저녁 메뉴 선택권","description":"가족이 함께 먹을 메뉴를 골라요.","icon":"🍝","cost":20,"stock":null,"active":true,"shop":true,"gacha":true,"version":1},{"id":"r-movie","title":"가족 영화 선택권","description":"가족 영화의 주인공은 나!","icon":"🎬","cost":30,"stock":null,"active":true,"shop":true,"gacha":true,"version":1},{"id":"r-trip","title":"특별한 체험 나들이","description":"가족과 상의해서 체험을 정해요.","icon":"🎡","cost":50,"stock":1,"active":true,"shop":true,"gacha":true,"version":1}],"box":{"title":"반짝 선물 상자","cost":5,"dailyLimit":3,"version":1,"items":[{"rewardId":"r-play","weight":60},{"rewardId":"r-book","weight":25},{"rewardId":"r-soccer","weight":10},{"rewardId":"r-movie","weight":5}]},"praises":[],"ledger":[],"inventory":[],"draws":[]}'::jsonb;
  v_state := jsonb_set(jsonb_set(v_state,'{familyName}',to_jsonb(btrim(p_family_name))),'{childName}',to_jsonb(btrim(p_child_name)));
  insert into public.families(state) values(v_state) returning id into v_id;
  insert into public.family_members(user_id,family_id,display_name,role) values(v_uid,v_id,btrim(p_display_name),'admin');
  return v_id;
end;
$$;

create function public.family_issue_invite(p_family_id uuid,p_role text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_uid uuid:=auth.uid(); v_token text; v_expires timestamptz:=now()+interval '48 hours';
begin
  perform 1 from public.families where id=p_family_id for update;
  if v_uid is null or not exists(select 1 from public.family_members where family_id=p_family_id and user_id=v_uid and role='admin') then raise exception '초대를 만들 권한이 없어요.'; end if;
  if p_role is null or p_role not in ('admin','giver','child') then raise exception '역할을 확인해 주세요.'; end if;
  if (select count(*) from public.family_invites where family_id=p_family_id and used_at is null and revoked_at is null and expires_at>now())>=20 then raise exception '사용하지 않은 초대가 많아요. 기존 초대를 취소해 주세요.'; end if;
  v_token := replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-','');
  insert into public.family_invites(family_id,token_hash,role,created_by,expires_at)
  values(p_family_id,encode(sha256(convert_to(v_token,'UTF8')),'hex'),p_role,v_uid,v_expires);
  return jsonb_build_object('code',v_token,'expiresAt',v_expires,'role',p_role);
end;
$$;

create function public.family_join(p_token text,p_display_name text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_uid uuid:=auth.uid(); v_invite public.family_invites%rowtype;
begin
  if v_uid is null then raise exception '먼저 로그인해 주세요.'; end if;
  if p_token is null or p_token !~ '^[a-f0-9]{64}$' or length(coalesce(btrim(p_display_name),'')) not between 1 and 30 then raise exception '초대 코드와 별명을 확인해 주세요.'; end if;
  if exists(select 1 from public.family_members where user_id=v_uid) then raise exception '이미 참여한 가족이 있어요.'; end if;
  -- Read identity first, then lock family -> invitation consistently with revoke/remove.
  select * into v_invite from public.family_invites where token_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex');
  if not found then raise exception '사용할 수 없는 초대 코드예요. 새 초대를 요청해 주세요.'; end if;
  perform 1 from public.families where id=v_invite.family_id for update;
  select * into v_invite from public.family_invites where token_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex') for update;
  if not found or v_invite.used_at is not null or v_invite.revoked_at is not null or v_invite.expires_at<=now() then raise exception '사용할 수 없는 초대 코드예요. 새 초대를 요청해 주세요.'; end if;
  if v_invite.role<>'child' and coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then raise exception '성인 가족 계정으로 로그인해 주세요.'; end if;
  -- Recheck the inviter: a removed administrator's unused invitation is not usable.
  if not exists(select 1 from public.family_members where user_id=v_invite.created_by and family_id=v_invite.family_id and role='admin') then raise exception '초대 권한이 만료됐어요. 새 초대를 요청해 주세요.'; end if;
  insert into public.family_members(user_id,family_id,display_name,role) values(v_uid,v_invite.family_id,btrim(p_display_name),v_invite.role);
  update public.family_invites set used_at=now() where id=v_invite.id;
  update public.families set revision=revision+1,updated_at=now() where id=v_invite.family_id;
  return v_invite.family_id;
end;
$$;

create function public.family_remove_member(p_user_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_uid uuid:=auth.uid(); v_family uuid;
begin
  select family_id into v_family from public.family_members where user_id=v_uid and role='admin';
  if v_family is null then raise exception '가족을 관리할 권한이 없어요.'; end if;
  perform 1 from public.families where id=v_family for update;
  if not exists(select 1 from public.family_members where user_id=v_uid and family_id=v_family and role='admin') then raise exception '권한이 바뀌었어요.'; end if;
  if p_user_id=v_uid then raise exception '현재 관리자는 자기 자신을 해제할 수 없어요.'; end if;
  delete from public.family_members where user_id=p_user_id and family_id=v_family;
  update public.family_invites set revoked_at=now() where family_id=v_family and created_by=p_user_id and used_at is null and revoked_at is null;
  update public.families set revision=revision+1,updated_at=now() where id=v_family;
end;
$$;

create function public.family_revoke_invites(p_family_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from public.families where id=p_family_id for update;
  if not exists(select 1 from public.family_members where family_id=p_family_id and user_id=auth.uid() and role='admin') then raise exception '초대를 취소할 권한이 없어요.'; end if;
  update public.family_invites set revoked_at=now() where family_id=p_family_id and used_at is null and revoked_at is null;
end;
$$;

-- This function must NEVER be executable by an authenticated browser user.
create function public.family_commit(
 p_family_id uuid,p_actor_id uuid,p_actor_role text,p_request_id uuid,p_payload jsonb,
 p_expected_revision bigint,p_state jsonb,p_result jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_family public.families%rowtype; v_previous public.family_events%rowtype; v_sum numeric;
begin
  select * into v_family from public.families where id=p_family_id for update;
  if not found then raise exception '가족을 찾지 못했어요.'; end if;
  if not exists(select 1 from public.family_members where family_id=p_family_id and user_id=p_actor_id and role=p_actor_role) then raise exception '가족 권한이 바뀌었어요. 다시 로그인해 주세요.'; end if;
  select * into v_previous from public.family_events where family_id=p_family_id and request_id=p_request_id;
  if found then
    if v_previous.actor_id<>p_actor_id or v_previous.payload is distinct from p_payload then raise exception '같은 요청 번호로 다른 작업을 보낼 수 없어요.'; end if;
    return jsonb_build_object('state',v_family.state,'revision',v_family.revision,'result',v_previous.result);
  end if;
  if v_family.revision<>p_expected_revision then return jsonb_build_object('conflict',true); end if;
  if p_state->>'schema' is distinct from '1' or jsonb_typeof(p_state->'balance') is distinct from 'number'
    or jsonb_typeof(p_state->'ledger') is distinct from 'array' or (p_state->>'balance')::numeric<0
    or (p_state->>'balance')::numeric<>trunc((p_state->>'balance')::numeric) or octet_length(p_state::text)>4000000
    then raise exception '상태 기록을 검증하지 못했어요.'; end if;
  select coalesce(sum((x->>'delta')::numeric),0) into v_sum from jsonb_array_elements(p_state->'ledger') x;
  if v_sum<>(p_state->>'balance')::numeric then raise exception '별 잔액과 원장이 일치하지 않아요.'; end if;
  update public.families set state=p_state,revision=revision+1,updated_at=now() where id=p_family_id;
  insert into public.family_events(family_id,request_id,actor_id,payload,result,after_revision)
    values(p_family_id,p_request_id,p_actor_id,p_payload,p_result,v_family.revision+1);
  return jsonb_build_object('state',p_state,'revision',v_family.revision+1,'result',p_result);
end;
$$;

revoke all on function public.family_bootstrap(text,text,text) from public, anon;
revoke all on function public.family_issue_invite(uuid,text) from public, anon;
revoke all on function public.family_join(text,text) from public, anon;
revoke all on function public.family_remove_member(uuid) from public, anon;
revoke all on function public.family_revoke_invites(uuid) from public, anon;
grant execute on function public.family_bootstrap(text,text,text), public.family_issue_invite(uuid,text), public.family_join(text,text), public.family_remove_member(uuid), public.family_revoke_invites(uuid) to authenticated;
revoke all on function public.family_commit(uuid,uuid,text,uuid,jsonb,bigint,jsonb,jsonb) from public, anon, authenticated;
grant execute on function public.family_commit(uuid,uuid,text,uuid,jsonb,bigint,jsonb,jsonb) to service_role;
