/** Authenticated metadata-only persistence and speech quotas. Never log raw input. */
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(v);
const day=n=>new Date(n+9*3600000).toISOString().slice(0,10);
const fail=(code,message,status=400)=>{const e=new Error(message);Object.assign(e,{code,status});throw e;};
const hash=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))).map(b=>b.toString(16).padStart(2,'0')).join('');
export function createEnglishStore(adapter,rules,now=Date.now){
 async function load(family,user){if((await adapter.member(family,user))?.role!=='admin')fail('FORBIDDEN','보호자만 사용할 수 있어요.',403);return adapter.load(family);}
 async function change(family,user,id,payload,fn){
  for(let i=0;i<6;i++){
   const loaded=await load(family,user),receipt=await adapter.receipt(family,id);
   if(receipt){if(receipt.actorId!==user||JSON.stringify(receipt.payload)!==JSON.stringify(payload))fail('DUPLICATE','같은 요청 번호로 다른 작업을 할 수 없어요.',409);return receipt.result;}
   const state=structuredClone(loaded.state),result=fn(state);
   const c=await adapter.commit({familyId:family,actorId:user,actorRole:'admin',requestId:id,payload,revision:loaded.revision,state,result});
   if(!c.conflict)return c.result;
  }fail('CONFLICT','진도가 바뀌었어요. 다시 불러와 주세요.',409);
 }
 return {
  member:adapter.member,
  async progress(family,user){return rules.read((await load(family,user)).state);},
  async command(family,user,id,action){const digest=await hash(JSON.stringify(action));return change(family,user,id,{type:'english/command',digest},state=>{let next;try{next=rules.apply(state,action,now());}catch(error){fail('INVALID_INPUT',String(error.message).slice(0,160),400);}Object.assign(state,next.state);return next.result;});},
  async reserve(family,user,id,digest){
   const nonce=crypto.randomUUID();const r=await change(family,user,id,{type:'english/speech',digest},state=>{
    const prev=state.learningSpeechUsage??{day:day(now()),count:0,active:[]};
    const meta={day:day(now()),count:prev.day===day(now())?prev.count:0,active:(prev.active??[]).filter(x=>x.expiresAt>now())};
    if(meta.count>=120)fail('DAILY_LIMIT','오늘 AI 읽어주기 120회를 사용했어요.',429);
    if(meta.active.length>=2)fail('BUSY','다른 읽어주기가 진행 중이에요. 잠시 후 다시 눌러 주세요.',429);
    meta.count++;meta.active.push({id,expiresAt:now()+60000});state.learningSpeechUsage=meta;return {nonce};
   });return r.nonce===nonce;
  },
  async release(family,user,id){return change(family,user,crypto.randomUUID(),{type:'english/speech-finish',id},state=>{if(state.learningSpeechUsage)state.learningSpeechUsage.active=state.learningSpeechUsage.active.filter(x=>x.id!==id);return {done:true};});}
 };
}
async function readBody(request){
 const reader=request.body?.getReader();if(!reader)fail('INVALID','요청을 확인해 주세요.');let size=0,parts=[];
 try{for(;;){const r=await reader.read();if(r.done)break;size+=r.value.byteLength;if(size>6000){await reader.cancel();fail('TOO_LARGE','요청이 너무 커요.',413);}parts.push(r.value);}}finally{reader.releaseLock();}
 const bytes=new Uint8Array(size);let offset=0;for(const p of parts){bytes.set(p,offset);offset+=p.length;}
 try{return JSON.parse(new TextDecoder().decode(bytes));}catch{fail('INVALID','요청을 확인해 주세요.');}
}
export function createEnglishHandler(deps){
 const headers={'Access-Control-Allow-Origin':deps.origin,'Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS','Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin'};
 const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers});
 return async request=>{
  if(request.headers.get('origin')&&request.headers.get('origin')!==deps.origin)return json({error:'허용되지 않은 출처입니다.'},403);
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
  if(request.method!=='POST')return json({error:'POST 요청만 지원해요.'},405);
  try{
   const bearer=request.headers.get('authorization');if(!bearer?.startsWith('Bearer '))return json({error:'로그인이 필요해요.'},401);
   const user=await deps.verify(bearer);if(!user)return json({error:'로그인을 다시 확인해 주세요.'},401);
   const body=await readBody(request);if(!body||Array.isArray(body)||!uuid(body.familyId))fail('INVALID','가족 정보를 확인해 주세요.');
   if((await deps.store.member(body.familyId,user))?.role!=='admin')return json({error:'성인 보호자 테스트 전용이에요.'},403);
   const keys=body.operation==='progress'?['operation','familyId']:body.operation==='command'?['operation','familyId','requestId','action']:['operation','familyId','requestId','text','unitId','index'];
   if(Object.keys(body).some(k=>!keys.includes(k)))fail('INVALID','요청 항목을 확인해 주세요.');
   if(body.operation==='progress')return json({progress:await deps.store.progress(body.familyId,user)});
   if(!uuid(body.requestId))fail('INVALID','요청 번호를 확인해 주세요.');
   if(body.operation==='command')return json(await deps.store.command(body.familyId,user,body.requestId,body.action));
   if(body.operation!=='speech')fail('INVALID','요청 종류를 확인해 주세요.');
   if(!deps.configured)return json({error:'서버의 API 키와 guardian 설정을 확인해 주세요.',code:'NOT_CONFIGURED'},503);
   let text;
   if(body.unitId!==undefined){if(body.text!==undefined)fail('INVALID','읽을 대상을 하나만 지정해 주세요.');try{text=deps.resolveSpeech(body.unitId,body.index);}catch{fail('INVALID','읽을 학습 단계를 확인해 주세요.');}}
   else {text=body.text;if(typeof text!=='string'||!text.trim()||text.length>800)fail('INVALID','읽을 문장은 800자 이내로 보내 주세요.');}
   if(request.signal.aborted)fail('CANCELLED','요청이 취소됐어요.',499);
   const digest=await hash(text);
   if(!await deps.store.reserve(body.familyId,user,body.requestId,digest))return json({error:'이미 보낸 음성 요청이에요. 중복 요금을 막기 위해 다시 생성하지 않았어요.',code:'DUPLICATE'},409);
   try{return json(await deps.speech(text,AbortSignal.any([request.signal,AbortSignal.timeout(50000)])));}
   finally{try{await deps.store.release(body.familyId,user,body.requestId);}catch{/* expires automatically; do not mask a valid audio result */}}
  }catch(error){return json({error:error?.code?String(error.message).slice(0,180):'AI 음성을 준비하지 못했어요. 글은 그대로 볼 수 있고, 다시 듣기로 새 요청을 보낼 수 있어요.',code:error?.code||'VOICE_UNAVAILABLE'},error?.status||502);}
 };
}

/** Existing family_commit CAS; raw speech and spelling never enter the event payload. */
export function createEnglishAdapter(config,fetcher=fetch){
 async function rest(path,body){
  const response=await fetcher(`${config.url}/rest/v1/${path}`,{method:body===undefined?'GET':'POST',headers:config.databaseHeaders,signal:AbortSignal.timeout(10000),...(body===undefined?{}:{body:JSON.stringify(body)})});
  if(!response.ok)throw Error('DATABASE');return response.json();
 }
 return {
  async member(family,user){const r=await rest(`family_members?family_id=eq.${family}&user_id=eq.${user}&select=role`);return r[0]||null;},
  async load(family){const r=await rest(`families?id=eq.${family}&select=state,revision`);if(!r[0])fail('FORBIDDEN','가족 연결을 확인해 주세요.',403);return r[0];},
  async receipt(family,id){const r=await rest(`family_events?family_id=eq.${family}&request_id=eq.${id}&select=actor_id,payload,result`);return r[0]?{actorId:r[0].actor_id,payload:r[0].payload,result:r[0].result}:null;},
  async commit(c){return rest('rpc/family_commit',{p_family_id:c.familyId,p_actor_id:c.actorId,p_actor_role:c.actorRole,p_request_id:c.requestId,p_payload:c.payload,p_expected_revision:c.revision,p_state:c.state,p_result:c.result});}
 };
}
