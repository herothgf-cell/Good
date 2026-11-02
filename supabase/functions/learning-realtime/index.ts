import {loadServerConfig} from '../_server/config.js';
import {createRealtimeHandler,createRealtimeProvider} from '../_server/realtime.js';
import {createRealtimeAdapter,createRealtimeStore} from '../_server/realtime-store.js';
const config=loadServerConfig(name=>name==='APP_ORIGIN'?'https://herothgf-cell.github.io':Deno.env.get(name));
const apiKey=Deno.env.get('OPENAI_API_KEY')||'';
const model=Deno.env.get('LEARNING_REALTIME_MODEL')||'gpt-realtime-2.1-mini';
Deno.serve(createRealtimeHandler({
 origin:config.origin,configured:!!apiKey&&Deno.env.get('LEARNING_COACH_ENABLED')==='guardian',model,
 async verify(bearer){
  const response=await fetch(`${config.url}/auth/v1/user`,{headers:{apikey:config.publicKey,Authorization:bearer},signal:AbortSignal.timeout(10000)});
  if(!response.ok)return null;const user=await response.json();return typeof user.id==='string'?user.id:null;
 },
 store:createRealtimeStore(createRealtimeAdapter(config)),provider:createRealtimeProvider({apiKey,model})
}));
