import WebSocket from 'npm:ws@8.22.1';
import {loadServerConfig} from '../_server/config.js';
import {createEnglishHandler,createEnglishStore,createEnglishAdapter} from '../_server/english.js';
import {createReadAloud} from '../_server/read-aloud.js';
import {englishLearningFor,applyEnglishCommand} from '../_shared/english-learning.ts';
import {phonicsSpeech} from '../_shared/phonics-course.ts';

const config=loadServerConfig(name=>name==='APP_ORIGIN'?'https://herothgf-cell.github.io':Deno.env.get(name));
const apiKey=Deno.env.get('OPENAI_API_KEY')||'';
const store=createEnglishStore(createEnglishAdapter(config),{read:englishLearningFor,apply:applyEnglishCommand});
Deno.serve(createEnglishHandler({
 origin:config.origin,configured:!!apiKey&&Deno.env.get('LEARNING_COACH_ENABLED')==='guardian',store,
 resolveSpeech:phonicsSpeech,
 async verify(bearer){
  const response=await fetch(`${config.url}/auth/v1/user`,{headers:{apikey:config.publicKey,Authorization:bearer},signal:AbortSignal.timeout(10000)});
  if(!response.ok)return null;const user=await response.json();return typeof user.id==='string'?user.id:null;
 },
 speech:createReadAloud({apiKey,model:Deno.env.get('LEARNING_READ_MODEL')||'gpt-realtime-2.1-mini',socketFactory:(url,options)=>new WebSocket(url,options)})
}));
