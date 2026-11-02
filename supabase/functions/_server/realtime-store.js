import {RealtimeError} from './realtime.js';
const samePayload=(a,b)=>JSON.stringify(Object.entries(a).sort())===JSON.stringify(Object.entries(b).sort());
const day=ms=>new Date(ms+9*3600000).toISOString().slice(0,10);
const fail=(code,message,status=409)=>{throw new RealtimeError(code,message,status);};
/** Atomic metadata-only writes through the existing service-role family_commit boundary. */
export function createRealtimeStore(adapter,now=Date.now){
 const member=(family,user)=>adapter.member(family,user);
 async function load(family,user){if((await member(family,user))?.role!=='admin')fail('FORBIDDEN','보호자 권한을 확인해 주세요.',403);return adapter.load(family);}
 const metadata=state=>structuredClone(state.learningRealtime||{day:day(now()),starts:0,calls:[]});
 const prune=calls=>[...calls.filter(c=>c.state!=='closed'),...calls.filter(c=>c.state==='closed'&&now()-c.createdAt<86400000).slice(-58)];
 const staleCall=c=>c.state==='closing'||c.state!=='closed'&&(c.expiresAt<=now()||now()-c.heartbeatAt>75000);
 async function change(family,user,requestId,payload,fn){
  for(let i=0;i<6;i++){
   const loaded=await load(family,user);
   const receipt=await adapter.receipt(family,requestId);
   if(receipt){if(receipt.actorId!==user||!samePayload(receipt.payload,payload))fail('DUPLICATE','같은 연결 번호의 요청 내용이 달라요.');return receipt.result;}
   const state=structuredClone(loaded.state),meta=metadata(state);const result=fn(meta);state.learningRealtime=meta;
   const committed=await adapter.commit({familyId:family,actorId:user,actorRole:'admin',requestId,payload,revision:loaded.revision,state,result});
   if(!committed.conflict)return committed.result;
  }
  fail('CONFLICT','다른 기기에서 연결을 처리 중이에요. 잠시 후 다시 확인해 주세요.');
 }
 const operation=(family,user,kind,id,fn)=>change(family,user,crypto.randomUUID(),{type:`learning-realtime/${kind}`,sessionId:id},fn);
 return {
  member,
  async reserve(family,user,id,settings){
   const nonce=crypto.randomUUID();
   const result=await change(family,user,id,{type:'learning-realtime/reserve',sessionId:id,topic:settings.topic,voice:settings.voice},meta=>{
    if(meta.calls.some(c=>c.id===id))fail('CANCELLED','이미 종료하거나 접수한 연결이에요. 새로 시작해 주세요.');
    if(meta.calls.some(c=>c.state!=='closed'))fail('ACTIVE_CALL','가족의 음성 대화가 이미 열려 있어요. 먼저 종료해 주세요.');
    if(meta.day!==day(now())){meta.day=day(now());meta.starts=0;}
    if(meta.starts>=6)fail('DAILY_LIMIT','오늘의 음성 테스트 시작 6회를 사용했어요.',429);
    const expiresAt=now()+300000;
    meta.calls=prune(meta.calls);
    meta.calls.push({id,actorId:user,nonce,createdAt:now(),heartbeatAt:now(),expiresAt,state:'reserved'});meta.starts++;
    return {nonce,expiresAt};
   });
   return {...result,fresh:result.nonce===nonce};
  },
  async attach(family,user,id,nonce,callId){
   const result=await operation(family,user,'attach',id,meta=>{
    const c=meta.calls.find(c=>c.id===id);
    if(!c||c.actorId!==user||c.nonce!==nonce)return {attached:false};
    if(c.callId)return {attached:false}; // one provider call per reservation
    c.callId=callId;
    if(c.state!=='reserved'||c.expiresAt<=now()){c.state='closing';return {attached:false};}
    c.state='active';c.heartbeatAt=now();return {attached:true};
   });return result.attached;
  },
  async get(family,user,id){const loaded=await load(family,user);return metadata(loaded.state).calls.find(c=>c.id===id)||null;},
  async markClosed(family,user,id,finished,providerId){
   return operation(family,user,finished?'closed':'closing',id,meta=>{
    let c=meta.calls.find(c=>c.id===id);
    if(!c){
     // Stop may beat the initial reservation. Keep a cancellation tombstone.
     meta.calls=prune(meta.calls);
     c={id,actorId:user,createdAt:now(),heartbeatAt:now(),expiresAt:now(),state:'closed'};meta.calls.push(c);
    }
    if(c.actorId!==user&&!staleCall(c))fail('FORBIDDEN','다른 보호자의 연결이에요.',403);
    if(providerId&&!finished){if(!/^rtc_[A-Za-z0-9_-]{1,160}$/.test(providerId))fail('INVALID_INPUT','연결 번호를 확인해 주세요.');if(c.callId&&c.callId!==providerId)fail('CONFLICT','연결 번호가 달라요.');c.callId=providerId;}
    c.state=finished||!c.callId?'closed':'closing';
    if(finished)delete c.callId;
    return {closed:finished};
   });
  },
  async heartbeat(family,user,id){
   return operation(family,user,'heartbeat',id,meta=>{
    const c=meta.calls.find(c=>c.id===id);if(!c)return {state:'closed'};
    if(c.actorId!==user)fail('FORBIDDEN','다른 보호자의 연결이에요.',403);
    if(c.state==='active'&&c.expiresAt>now())c.heartbeatAt=now();
    return {state:c.state,expiresAt:c.expiresAt};
   });
  },
  async stale(family,user){const loaded=await load(family,user);return metadata(loaded.state).calls.filter(staleCall);}
 };
}
/** Adapter uses only the same privileged RPC already deployed by the coupon app. */
export function createRealtimeAdapter(config,fetcher=fetch){
 async function rest(path,body){
  const response=await fetcher(`${config.url}/rest/v1/${path}`,{method:body===undefined?'GET':'POST',headers:config.databaseHeaders,signal:AbortSignal.timeout(10000),...(body===undefined?{}:{body:JSON.stringify(body)})});
  if(!response.ok)throw new Error('DATABASE');return response.json();
 }
 return {
  async member(family,user){const rows=await rest(`family_members?family_id=eq.${family}&user_id=eq.${user}&select=role`);return rows[0]||null;},
  async load(family){const rows=await rest(`families?id=eq.${family}&select=state,revision`);if(!rows[0])fail('FORBIDDEN','가족을 확인해 주세요.',403);return rows[0];},
  async receipt(family,id){const rows=await rest(`family_events?family_id=eq.${family}&request_id=eq.${id}&select=actor_id,payload,result`);return rows[0]?{actorId:rows[0].actor_id,payload:rows[0].payload,result:rows[0].result}:null;},
  async commit(c){return rest('rpc/family_commit',{p_family_id:c.familyId,p_actor_id:c.actorId,p_actor_role:c.actorRole,p_request_id:c.requestId,p_payload:c.payload,p_expected_revision:c.revision,p_state:c.state,p_result:c.result});}
 };
}
