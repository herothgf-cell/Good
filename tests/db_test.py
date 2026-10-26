"""Destructive integration setup: ONLY an explicitly enabled, empty disposable DB.
No Supabase account, production data, or network services other than PostgreSQL are used.
"""
import concurrent.futures
import json
import os
from pathlib import Path
import subprocess
import uuid

ROOT=Path(__file__).resolve().parents[1]
URL=os.environ.get('DATABASE_URL','')
if not URL or os.environ.get('ALLOW_TEST_DATABASE')!='1':
    raise SystemExit('Set DATABASE_URL for an EMPTY DISPOSABLE database and ALLOW_TEST_DATABASE=1. Never use your real Supabase DB.')
checks=[]
def sql(statement,role=None,user=None,anonymous=False,fail=None):
    prefix=''
    if role:
        claims=json.dumps({'sub':user or '', 'is_anonymous':anonymous})
        prefix=f"set role {role}; set request.jwt.claims='{claims}';\n"
    result=subprocess.run(['psql',URL,'-X','-q','-t','-A','-v','ON_ERROR_STOP=1'],input=prefix+statement,text=True,capture_output=True,timeout=30)
    if fail:
        assert result.returncode!=0, 'Expected database denial'
        assert fail in result.stderr, result.stderr
        return None
    assert result.returncode==0, result.stderr
    return result.stdout.strip().splitlines()[-1] if result.stdout.strip() else ''
def passed(name):
    checks.append(name)
    print('PASS:',name,flush=True)
def lit(value):return "'"+str(value).replace("'","''")+"'"
def call(name,args,**kwargs):return sql('select public.'+name+'('+','.join(lit(v) for v in args)+');',**kwargs)

# Refuse to touch any nonempty project, even when the opt-in flag was accidentally set.
assert sql("select count(*) from pg_tables where schemaname in ('public','auth');")=='0','Database is not empty; refusing setup.'
sql("""
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create table auth.users(id uuid primary key);
create function auth.jwt() returns jsonb language sql stable as $$
 select coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb,'{}'::jsonb);
$$;
create function auth.uid() returns uuid language sql stable as $$ select nullif(auth.jwt()->>'sub','')::uuid; $$;
grant usage on schema public,auth to anon,authenticated,service_role;
grant execute on function auth.jwt(),auth.uid() to anon,authenticated,service_role;
""")
sql((ROOT/'supabase/migrations/202610260001_praise_star.sql').read_text())
passed('migration applies to real PostgreSQL')
users={name:str(uuid.uuid4()) for name in ['dad','outsider','giver','child','extra','other','anon']}
sql('insert into auth.users(id) values '+','.join('('+lit(v)+')' for v in users.values())+';')
args=['테스트 가족','아이','보호자']
family=call('family_bootstrap',args,role='authenticated',user=users['dad'])
assert sql('select state->>\'balance\' from families where id='+lit(family)+';')=='0'
passed('real family starts with zero stars')
assert sql('select count(*) from families;',role='authenticated',user=users['dad'])=='1'
assert sql('select count(*) from families;',role='authenticated',user=users['outsider'])=='0'
assert sql('select count(*) from family_members;',role='authenticated',user=users['outsider'])=='0'
passed('RLS isolates family and membership reads')
sql('select * from families;',role='anon',fail='permission denied')
call('family_bootstrap',args,role='authenticated',user=users['anon'],anonymous=True,fail='보호자')
passed('unauthenticated reads and anonymous family creation denied')
sql('update families set revision=999;',role='authenticated',user=users['dad'],fail='permission denied')
sql('select * from family_invites;',role='authenticated',user=users['dad'],fail='permission denied')
passed('browser writes and raw invitation reads denied')
invite=lambda role:json.loads(call('family_issue_invite',[family,role],role='authenticated',user=users['dad']))['code']
giver_code=invite('giver')
assert call('family_join',[giver_code,'칭찬 가족'],role='authenticated',user=users['giver'])==family
call('family_join',[giver_code,'다른 사람'],role='authenticated',user=users['extra'],fail='사용할 수 없는')
passed('one-use invitation joins once and rejects replay')
admin_code=invite('admin')
call('family_join',[admin_code,'아이'],role='authenticated',user=users['anon'],anonymous=True,fail='성인 가족')
child_code=invite('child')
call('family_join',[child_code,'아이'],role='authenticated',user=users['child'],anonymous=True)
call('family_issue_invite',[family,'admin'],role='authenticated',user=users['child'],anonymous=True,fail='권한')
passed('anonymous child invitation allowed, admin elevation denied')
revoked=invite('giver')
call('family_revoke_invites',[family],role='authenticated',user=users['dad'])
call('family_join',[revoked,'다른 사람'],role='authenticated',user=users['extra'],fail='사용할 수 없는')
expired=invite('giver')
sql("update family_invites set expires_at=now()-interval '1 second' where used_at is null and revoked_at is null;")
call('family_join',[expired,'다른 사람'],role='authenticated',user=users['extra'],fail='사용할 수 없는')
passed('revoked and expired invitations denied')
call('family_remove_member',[users['dad']],role='authenticated',user=users['dad'],fail='자기 자신')
call('family_remove_member',[users['giver']],role='authenticated',user=users['dad'])
assert sql('select count(*) from families;',role='authenticated',user=users['giver'])=='0'
passed('self-removal prevented, removed member loses reads')
state=json.loads(sql('select state from families where id='+lit(family)+';'))
revision=lambda:int(sql('select revision from families where id='+lit(family)+';'))
def commit(request_id,expected,updated=None,payload=None,role='service_role',fail=None):
    values=[family,users['dad'],'admin',request_id,json.dumps(payload or {'type':'test'}),str(expected),json.dumps(updated or state),json.dumps({'ok':True})]
    result=call('family_commit',values,role=role,user=users['dad'] if role=='authenticated' else None,fail=fail)
    return json.loads(result) if result else None
commit(str(uuid.uuid4()),revision(),role='authenticated',fail='permission denied')
passed('family_commit is not executable by authenticated browser role')
rid=str(uuid.uuid4());rev=revision()
first=commit(rid,rev);second=commit(rid,rev)
assert first==second and revision()==rev+1
assert sql('select count(*) from family_events where request_id='+lit(rid)+';')=='1'
commit(rid,rev,payload={'type':'different'},fail='다른 작업')
passed('same request returns one receipt and different replay payload denied')
assert commit(str(uuid.uuid4()),rev).get('conflict') is True
assert revision()==rev+1
passed('stale revision cannot overwrite new state')
invalid={**state,'balance':-1}
commit(str(uuid.uuid4()),revision(),updated=invalid,fail='검증')
invalid={**state,'balance':5}
commit(str(uuid.uuid4()),revision(),updated=invalid,fail='원장')
passed('negative balance and ledger mismatch rejected')
rev=revision()
with concurrent.futures.ThreadPoolExecutor(2) as pool:
    results=list(pool.map(lambda request:commit(request,rev),[str(uuid.uuid4()),str(uuid.uuid4())]))
assert sum(r.get('conflict',False) is True for r in results)==1
assert revision()==rev+1
passed('two simultaneous distinct commits have one winner')
rev=revision();rid=str(uuid.uuid4())
with concurrent.futures.ThreadPoolExecutor(2) as pool:
    results=list(pool.map(lambda _:commit(rid,rev),range(2)))
assert results[0]==results[1] and revision()==rev+1
assert sql('select count(*) from family_events where request_id='+lit(rid)+';')=='1'
passed('simultaneous identical request is applied once')
OUT=ROOT/'artifacts';OUT.mkdir(exist_ok=True)
(OUT/'db-results.json').write_text(json.dumps({'passed':checks,'method':'PostgreSQL with test Auth schema; not a hosted Supabase test'},ensure_ascii=False,indent=2))
print(f'Database scenarios: {len(checks)} passed')
