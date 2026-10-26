import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const modulePath=new URL('../supabase/functions/_server/config.js',import.meta.url);
async function load(env){assert.ok(fs.existsSync(modulePath),'server config loader must exist');return (await import(modulePath)).loadServerConfig(name=>env[name]);}
const modern={SUPABASE_URL:'https://example.supabase.co',SUPABASE_PUBLISHABLE_KEYS:'{"default":"sb_publishable_public"}',SUPABASE_SECRET_KEYS:'{"default":"sb_secret_private"}',APP_ORIGIN:'https://example.vercel.app'};
test('서버는 새 JSON 키 맵에서 default 키를 읽는다',async()=>{const c=await load(modern);assert.equal(c.publicKey,'sb_publishable_public');assert.equal(c.serviceKey,'sb_secret_private');assert.deepEqual(c.databaseHeaders,{apikey:'sb_secret_private','Content-Type':'application/json'});});
test('레거시 서버 키에는 Bearer 헤더를 유지한다',async()=>{const c=await load({SUPABASE_URL:modern.SUPABASE_URL,SUPABASE_ANON_KEY:'legacy-anon',SUPABASE_SERVICE_ROLE_KEY:'legacy-service'});assert.equal(c.databaseHeaders.Authorization,'Bearer legacy-service');assert.equal(c.origin,'*');});
test('새 단일 키 환경 변수와 레거시 폴백을 지원한다',async()=>{const c=await load({SUPABASE_URL:modern.SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY:'sb_publishable_single',SUPABASE_SECRET_KEY:'sb_secret_single'});assert.equal(c.serviceKey,'sb_secret_single');});
test('새 키가 있으면 레거시보다 우선한다',async()=>{const c=await load({...modern,SUPABASE_ANON_KEY:'old',SUPABASE_SERVICE_ROLE_KEY:'old'});assert.equal(c.serviceKey,'sb_secret_private');});
test('깨진 JSON 또는 default 없는 맵은 조용히 넘어가지 않는다',async()=>{for(const map of ['not-json','[]','{"other":"sb_secret_other"}'])await assert.rejects(()=>load({...modern,SUPABASE_SECRET_KEYS:map}),/SUPABASE_SECRET_KEYS/);});
test('필수 서버 설정 누락과 URL 잘못은 명확하게 실패한다',async()=>{await assert.rejects(()=>load({}),/SUPABASE_URL/);await assert.rejects(()=>load({...modern,SUPABASE_URL:'not-a-url'}),/SUPABASE_URL/);await assert.rejects(()=>load({...modern,SUPABASE_SECRET_KEYS:''}),/서버 키/);});
test('서버 키를 공개 위치에 잘못 넣으면 거절한다',async()=>{await assert.rejects(()=>load({...modern,SUPABASE_PUBLISHABLE_KEYS:'{"default":"sb_secret_wrong"}'}),/공개 키/);});
test('서버 비밀 설정 모듈은 웹 빌드에 포함되지 않는다',()=>{assert.equal(fs.existsSync('dist/supabase/functions/_server/config.js'),false);});
