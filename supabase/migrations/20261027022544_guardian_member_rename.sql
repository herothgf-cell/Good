-- Same-family administrator name correction; no role or credential changes.
-- A family lock serializes this with grants, invitation changes and member removal.
create or replace function public.family_rename_member(
  p_user_id uuid, p_display_name text, p_expected_name text, p_request_id uuid
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid(); v_family uuid; v_old_name text; v_revision bigint;
  v_payload jsonb; v_result jsonb; v_receipt public.family_events%rowtype;
begin
  if v_uid is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then
    raise exception '보호자만 가족 이름을 수정할 수 있어요.' using errcode='42501';
  end if;
  if p_request_id is null or p_user_id is null or p_expected_name is null
     or length(coalesce(btrim(p_display_name),'')) not between 1 and 30 then
    raise exception '이름을 1~30자로 입력해 주세요.' using errcode='22023';
  end if;
  select family_id into v_family from public.family_members where user_id=v_uid and role='admin';
  if v_family is null then raise exception '보호자만 가족 이름을 수정할 수 있어요.' using errcode='42501'; end if;
  perform 1 from public.families where id=v_family for update;
  if not exists(select 1 from public.family_members where user_id=v_uid and family_id=v_family and role='admin') then
    raise exception '가족 관리 권한이 바뀌었어요.' using errcode='42501';
  end if;
  v_payload:=jsonb_build_object('type','member/rename','userId',p_user_id,'displayName',p_display_name,'expectedName',p_expected_name);
  select * into v_receipt from public.family_events where family_id=v_family and request_id=p_request_id;
  if found then
    if v_receipt.actor_id<>v_uid or v_receipt.payload is distinct from v_payload then
      raise exception '같은 요청 번호로 다른 작업을 보낼 수 없어요.' using errcode='22023';
    end if;
    return v_receipt.result;
  end if;
  select display_name into v_old_name from public.family_members where user_id=p_user_id and family_id=v_family;
  if not found then raise exception '가족 구성원을 찾지 못했어요.' using errcode='42501'; end if;
  if v_old_name is distinct from p_expected_name then
    raise exception '이름이 이미 바뀌었어요. 새로고침 후 다시 수정해 주세요.' using errcode='22023';
  end if;
  update public.family_members set display_name=btrim(p_display_name) where user_id=p_user_id and family_id=v_family;
  update public.families set revision=revision+1,updated_at=now() where id=v_family returning revision into v_revision;
  v_result:=jsonb_build_object('message','가족 이름을 수정했어요.','oldName',v_old_name,'displayName',btrim(p_display_name));
  insert into public.family_events(family_id,request_id,actor_id,payload,result,after_revision)
    values(v_family,p_request_id,v_uid,v_payload,v_result,v_revision);
  return v_result;
end;
$$;
revoke all on function public.family_rename_member(uuid,text,text,uuid) from public, anon;
grant execute on function public.family_rename_member(uuid,text,text,uuid) to authenticated;
