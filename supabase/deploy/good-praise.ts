// good-praise deployment entrypoint. Shared business logic is pinned to the v0.6.0 source commit.
// Hosted Edge environment is read-only: inject origin through configuration.
import {loadServerConfig} from 'https://raw.githubusercontent.com/herothgf-cell/Good/7d03a1ebcc6183019f55a56513dc4b070c810e51/supabase/functions/_server/config.js';
import {processCommand, type CommandStore, type CommitData, type Receipt, type Loaded} from 'https://raw.githubusercontent.com/herothgf-cell/Good/7d03a1ebcc6183019f55a56513dc4b070c810e51/supabase/functions/_shared/service.ts';
import {DomainError} from 'https://raw.githubusercontent.com/herothgf-cell/Good/7d03a1ebcc6183019f55a56513dc4b070c810e51/supabase/functions/_shared/domain.ts';

const config=loadServerConfig(name=>name==='APP_ORIGIN'?'https://herothgf-cell.github.io':Deno.env.get(name));
const URL=config.url;
const PUBLIC_KEY=config.publicKey;
const ORIGIN=config.origin;
const cors={'Access-Control-Allow-Origin':ORIGIN,'Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS','Vary':'Origin'};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store'}});
async function rest(path:string,body?:unknown) {
  const response=await fetch(`${URL}/rest/v1/${path}`,{method:body===undefined?'GET':'POST',headers:config.databaseHeaders,...(body===undefined?{}:{body:JSON.stringify(body)})});
  if(!response.ok){console.error('Database request failed',response.status);throw new Error('DATABASE');}
  return response.json();
}
const store:CommandStore={
  async load(familyId,userId):Promise<Loaded>{
    const members=await rest(`family_members?family_id=eq.${familyId}&user_id=eq.${userId}&select=user_id,display_name,role`);
    if(!members[0])throw new DomainError('FORBIDDEN','이 가족에 접근할 권한이 없어요.');
    const families=await rest(`families?id=eq.${familyId}&select=state,revision`);
    if(!families[0])throw new DomainError('FORBIDDEN','가족을 찾지 못했어요.');
    return {state:families[0].state,revision:Number(families[0].revision),actor:{id:userId,name:members[0].display_name,role:members[0].role}};
  },
  async receipt(familyId,requestId):Promise<Receipt|null>{
    const rows=await rest(`family_events?family_id=eq.${familyId}&request_id=eq.${requestId}&select=actor_id,payload,result`);
    return rows[0]?{actorId:rows[0].actor_id,payload:rows[0].payload,result:rows[0].result}:null;
  },
  async commit(c:CommitData){return rest('rpc/family_commit',{p_family_id:c.familyId,p_actor_id:c.actorId,p_actor_role:c.actorRole,p_request_id:c.requestId,p_payload:c.action,p_expected_revision:c.revision,p_state:c.state,p_result:c.result});}
};
Deno.serve(async(request:Request)=>{
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
  if(request.method!=='POST')return json({error:'POST 요청만 지원합니다.'},405);
  if(ORIGIN!=='*'&&request.headers.get('origin')&&request.headers.get('origin')!==ORIGIN)return json({error:'허용되지 않은 출처입니다.'},403);
  const bearer=request.headers.get('Authorization');
  if(!bearer?.startsWith('Bearer '))return json({error:'로그인이 필요해요.'},401);
  try {
    // Never decode a JWT and trust it; verify it against the Auth service.
    const verified=await fetch(`${URL}/auth/v1/user`,{headers:{apikey:PUBLIC_KEY,Authorization:bearer}});
    if(!verified.ok)return json({error:'로그인이 만료됐어요. 다시 로그인해 주세요.'},401);
    const user=await verified.json();if(!user?.id)return json({error:'로그인이 필요해요.'},401);
    const raw=await request.text();if(raw.length>20000)return json({error:'요청 크기가 너무 커요.'},413);
    let input:unknown;try{input=JSON.parse(raw);}catch{return json({error:'요청 형식이 올바르지 않아요.'},400);}
    const result=await processCommand(input,user.id,store,{now:()=>new Date().toISOString(),newId:()=>crypto.randomUUID(),random:()=>crypto.getRandomValues(new Uint32Array(1))[0]!/4294967296});
    return json(result);
  }catch(error){
    if(error instanceof DomainError)return json({error:error.message,code:error.code},error.code==='FORBIDDEN'?403:error.code==='CONFLICT'?503:400);
    console.error('Family action failed',error instanceof Error?error.name:'Unknown');
    return json({error:'처리 결과를 확인하지 못했어요. 같은 요청 번호로 다시 확인해 주세요.'},503);
  }
});
