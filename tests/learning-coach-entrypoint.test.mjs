import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
import * as serverConfig from '../supabase/functions/_server/config.js';
import * as coachServer from '../supabase/functions/_server/coach.js';
import * as service from '../dist/supabase/functions/_shared/service.js';
import * as domain from '../dist/supabase/functions/_shared/domain.js';

const familyId='a0000000-0000-4000-8000-000000000001',userId='b0000000-0000-4000-8000-000000000001',sessionId='c0000000-0000-4000-8000-000000000001',turnId='d0000000-0000-4000-8000-000000000001';
async function boot({duplicate=false,role='admin',configured=true}={}){
  const source=readFileSync(new URL('../supabase/functions/learning-coach/index.ts',import.meta.url),'utf8');
  const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const env={SUPABASE_URL:'https://example.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test',SUPABASE_SECRET_KEY:'sb_secret_test',OPENAI_API_KEY:configured?'test-provider-key':'',LEARNING_COACH_ENABLED:'guardian'};
  let handler,paid=0,persisted;const state=domain.emptyState();
  const network=async(url,init={})=>{
    if(url.includes('api.openai.com')){paid++;assert.ok(url.endsWith('/chat/completions'));return Response.json({choices:[{message:{content:JSON.stringify({reply:'Do you like soccer?',modelPhrase:'',hint:''})}}]});}
    if(url.endsWith('/auth/v1/user'))return Response.json({id:userId});
    if(url.includes('/family_members?'))return Response.json([{user_id:userId,display_name:'보호자',role}]);
    if(url.includes('/families?'))return Response.json([{state,revision:0}]);
    if(url.includes('/family_events?'))return Response.json([]);
    if(url.endsWith('/rpc/family_commit')){
      const command=JSON.parse(init.body);persisted=command;
      // Models the real SQL race branch: request committed by another invocation
      // after both callers initially saw no receipt; SQL returns the winner's result.
      return Response.json({state:command.p_state,revision:1,result:duplicate?{message:'reserved',coachReservationId:'other-server-invocation'}:command.p_result});
    }
    throw Error('Unexpected external request');
  };
  const modules={'config.js':serverConfig,'coach.js':{...coachServer,createOpenAICoach:config=>coachServer.createOpenAICoach(config,network)},'service.ts':service,'domain.ts':domain};
  runInNewContext(compiled,{exports:{},require:path=>{const module=modules[path.split('/').at(-1)];assert.ok(module);return module;},
    Deno:{env:{get:key=>env[key]},serve:h=>handler=h},fetch:network,crypto,URL,Request,Response,AbortSignal,console});
  const request=body=>handler(new Request('https://example.supabase.co/functions/v1/learning-coach',{method:'POST',headers:{Authorization:'Bearer test',Origin:'https://herothgf-cell.github.io','Content-Type':'application/json'},body:JSON.stringify(body)}));
  return {request,paid:()=>paid,persisted:()=>persisted};
}
const turn={operation:'turn',familyId,sessionId,turnId,topic:'play',adultTest:true,text:'Hi!',history:[]};
test('deployed coach winner persists only quota identifiers before paid provider',async()=>{
  const b=await boot();const response=await b.request(turn);assert.equal(response.status,200);assert.equal(b.paid(),1);
  assert.deepEqual(b.persisted().p_payload,{type:'learning-lab/reserve-coach-turn',sessionId,turnId});
  assert.equal(b.persisted().p_request_id,turnId);assert.ok(b.persisted().p_result.coachReservationId);
  assert.ok(!JSON.stringify(b.persisted()).includes('Hi!'));
});
test('deployed coach SQL duplicate race loser never calls paid provider',async()=>{
  const b=await boot({duplicate:true});const response=await b.request(turn);
  assert.equal(response.status,409);assert.equal(b.paid(),0);
});
test('deployed coach child and unconfigured status do not persist quota or call provider',async()=>{
  const child=await boot({role:'child'});assert.equal((await child.request(turn)).status,403);assert.equal(child.persisted(),undefined);
  const disabled=await boot({configured:false});const response=await disabled.request({operation:'status',familyId});
  assert.equal(response.status,200);assert.equal((await response.json()).available,false);assert.equal(disabled.persisted(),undefined);assert.equal(disabled.paid(),0);
});
