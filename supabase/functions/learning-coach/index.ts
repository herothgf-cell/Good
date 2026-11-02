import {createNarrator} from '../_server/narration.js';
import {resolvePhonicsAudio} from '../_shared/phonics-curriculum.ts';
import {loadServerConfig} from '../_server/config.js';
import {createCoachHandler,createOpenAICoach} from '../_server/coach.js';
import {processCommand,type CommandStore,type CommitData,type Loaded,type Receipt} from '../_shared/service.ts';
import {DomainError} from '../_shared/domain.ts';

const config=loadServerConfig(name=>name==='APP_ORIGIN'?'https://herothgf-cell.github.io':Deno.env.get(name));
const apiKey=Deno.env.get('OPENAI_API_KEY')||'';
const configured=!!apiKey&&Deno.env.get('LEARNING_COACH_ENABLED')==='guardian';
async function rest(path:string,body?:unknown):Promise<any>{
  const response=await fetch(`${config.url}/rest/v1/${path}`,{method:body===undefined?'GET':'POST',headers:config.databaseHeaders,
    signal:AbortSignal.timeout(15000),...(body===undefined?{}:{body:JSON.stringify(body)})});
  if(!response.ok)throw new Error('DATABASE');
  return response.json();
}
async function member(familyId:string,userId:string){
  const rows=await rest(`family_members?family_id=eq.${familyId}&user_id=eq.${userId}&select=user_id,display_name,role`);
  return rows[0]??null;
}
const store:CommandStore={
  async load(familyId,userId):Promise<Loaded>{
    const actor=await member(familyId,userId);if(!actor||actor.role!=='admin')throw new DomainError('FORBIDDEN','보호자만 AI 연결을 테스트할 수 있어요.');
    const rows=await rest(`families?id=eq.${familyId}&select=state,revision`);if(!rows[0])throw new DomainError('FORBIDDEN','가족 연결을 확인해 주세요.');
    return {state:rows[0].state,revision:Number(rows[0].revision),actor:{id:userId,name:actor.display_name,role:actor.role}};
  },
  async receipt(familyId,requestId):Promise<Receipt|null>{
    const rows=await rest(`family_events?family_id=eq.${familyId}&request_id=eq.${requestId}&select=actor_id,payload,result`);
    return rows[0]?{actorId:rows[0].actor_id,payload:rows[0].payload,result:rows[0].result}:null;
  },
  async commit(c:CommitData){return rest('rpc/family_commit',{p_family_id:c.familyId,p_actor_id:c.actorId,p_actor_role:c.actorRole,p_request_id:c.requestId,
    p_payload:c.action,p_expected_revision:c.revision,p_state:c.state,p_result:c.result});}
};

const narrate=createNarrator({apiKey,model:Deno.env.get('LEARNING_SPEECH_MODEL')||'gpt-audio-1.5'});
Deno.serve(createCoachHandler({
  narrate,readingText:resolvePhonicsAudio,
  origin:config.origin,configured,member,
  async verify(bearer){
    const response=await fetch(`${config.url}/auth/v1/user`,{headers:{apikey:config.publicKey,Authorization:bearer},signal:AbortSignal.timeout(10000)});
    if(!response.ok)return null;const user=await response.json();return typeof user.id==='string'?user.id:null;
  },
  async reserve({familyId,userId,sessionId,turnId,kind}){
    // Unique server nonce distinguishes the winning commit even when family_commit
    // returns a previous receipt to simultaneous duplicate callers.
    const nonce=crypto.randomUUID();
    const committed=await processCommand({familyId,requestId:turnId,action:kind==='read'?{type:'learning-lab/reserve-reading',turnId}:{type:'learning-lab/reserve-coach-turn',sessionId,turnId}},userId,store,
      {now:()=>new Date().toISOString(),newId:()=>nonce,random:()=>0});
    return committed.result.coachReservationId===nonce;
  },
  respond:createOpenAICoach({apiKey,chatModel:Deno.env.get('LEARNING_COACH_CHAT_MODEL')||'gpt-4.1-mini',transcribeModel:Deno.env.get('LEARNING_COACH_TRANSCRIBE_MODEL')||'gpt-transcribe'},fetch,narrate)
}));
