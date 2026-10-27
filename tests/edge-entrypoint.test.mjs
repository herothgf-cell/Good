import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
import * as serverConfig from '../supabase/functions/_server/config.js';
import * as service from '../dist/supabase/functions/_shared/service.js';
import * as domain from '../dist/supabase/functions/_shared/domain.js';

// Exercise the actual deployed entrypoint. Only the platform/network boundary
// is substituted; the configuration, authorization flow and rules are real.
async function boot(fetchImpl = async () => {throw new Error('Unexpected network request');}) {
  const source=readFileSync(new URL('../supabase/deploy/good-praise.ts',import.meta.url),'utf8');
  const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const env={SUPABASE_URL:'https://example.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test',SUPABASE_SECRET_KEY:'sb_secret_test'};
  let handler;
  const modules={'config.js':serverConfig,'service.ts':service,'domain.ts':domain};
  await runInNewContext(`(async()=>{${compiled}\n})()`,{
    exports:{}, require:(path)=>{const module=modules[path.split('/').at(-1)];if(!module)throw new Error(`Unexpected import ${path}`);return module;},
    Deno:{env:{get:(key)=>env[key],set:()=>{throw new Error('Hosted runtime does not support env.set');}},serve:(h)=>{handler=h;}},
    URL,Request,Response,crypto,fetch:fetchImpl,console,
  });
  assert.equal(typeof handler,'function','Entrypoint must register its handler without mutating platform environment');
  return handler;
}
const endpoint='https://example.supabase.co/functions/v1/family-action';
const origin='https://herothgf-cell.github.io';

test('deployed entrypoint boots when hosted environment is read-only',async()=>{await boot();});
test('deployed handler permits Pages preflight with exact origin',async()=>{
  const handler=await boot();const response=await handler(new Request(endpoint,{method:'OPTIONS',headers:{Origin:origin}}));
  assert.equal(response.status,204);assert.equal(response.headers.get('access-control-allow-origin'),origin);
});
test('deployed handler rejects missing user token without contacting database',async()=>{
  const handler=await boot();const response=await handler(new Request(endpoint,{method:'POST',body:'{}'}));assert.equal(response.status,401);
});
test('deployed handler rejects token refused by Auth server',async()=>{
  const handler=await boot(async(url)=>{assert.ok(url.endsWith('/auth/v1/user'));return new Response('{}',{status:401});});
  const response=await handler(new Request(endpoint,{method:'POST',headers:{Authorization:'Bearer invalid'},body:'{}'}));assert.equal(response.status,401);
});
test('deployed handler rejects other browser origins before authentication',async()=>{
  const handler=await boot();const response=await handler(new Request(endpoint,{method:'POST',headers:{Origin:'https://unrelated.example'},body:'{}'}));assert.equal(response.status,403);
});
test('valid identity without family membership cannot issue commands',async()=>{
  const handler=await boot(async(url)=>{
    if(url.endsWith('/auth/v1/user'))return Response.json({id:'a0000000-0000-4000-8000-000000000001'});
    assert.ok(url.includes('/rest/v1/family_members?'));return Response.json([]);
  });
  const command={familyId:'b0000000-0000-4000-8000-000000000001',requestId:'c0000000-0000-4000-8000-000000000001',action:{type:'praise/give',stars:1,category:'도전',reason:'test'}};
  const response=await handler(new Request(endpoint,{method:'POST',headers:{Authorization:'Bearer valid'},body:JSON.stringify(command)}));assert.equal(response.status,403);
});
