import test from 'node:test';
import assert from 'node:assert/strict';
import {loadPublicConfig} from '../scripts/env.mjs';
import fs from 'node:fs';
const good={supabaseUrl:'https://example.supabase.co',supabaseAnonKey:'sb_publishable_public_example'};
const modulePath=new URL('../scripts/deployment.mjs',import.meta.url);
async function check(config,options){assert.ok(fs.existsSync(modulePath),'deployment validation module must exist');return (await import(modulePath)).checkDeployment(config,options);}
test('공개 키의 새 환경 변수 이름을 읽는다',()=>{assert.equal(loadPublicConfig({SUPABASE_URL:good.supabaseUrl,SUPABASE_PUBLISHABLE_KEY:good.supabaseAnonKey}).supabaseAnonKey,good.supabaseAnonKey);});
test('공개 키 별칭은 env.local에서도 읽는다',()=>{assert.equal(loadPublicConfig({},`SUPABASE_URL=${good.supabaseUrl}\nSUPABASE_PUBLISHABLE_KEY="${good.supabaseAnonKey}"`).supabaseAnonKey,good.supabaseAnonKey);});
test('빈 설정은 명시적인 체험 모드로만 허용한다',async()=>{assert.equal(await check({supabaseUrl:'',supabaseAnonKey:''}), 'demo');await assert.rejects(()=>check({supabaseUrl:'',supabaseAnonKey:''},{requireCloud:true}),/가족 공유/);});
test('완전한 공개 설정은 가족 공유 모드다',async()=>{assert.equal(await check(good,{requireCloud:true}),'cloud');});
test('URL만 있거나 키만 있는 배포는 실패한다',async()=>{await assert.rejects(()=>check({...good,supabaseAnonKey:''}),/함께/);await assert.rejects(()=>check({...good,supabaseUrl:''}),/함께/);});
test('잘못된 URL과 예시 값을 게시하지 않는다',async()=>{for(const url of ['http://example.supabase.co','https://user:password@example.supabase.co','https://example.supabase.co/path','https://YOUR_PROJECT_REF.supabase.co'])await assert.rejects(()=>check({...good,supabaseUrl:url}),/URL|예시/);});
test('서버 전용 키와 알 수 없는 JWT 역할은 빌드 전에 차단한다',async()=>{for(const key of ['sb_secret_forbidden','YOUR_PUBLISHABLE_OR_ANON_PUBLIC_KEY',...['service_role','authenticated'].map(role=>`eyJ.${Buffer.from(JSON.stringify({role})).toString('base64url')}.signature`)])await assert.rejects(()=>check({...good,supabaseAnonKey:key}),/공개|예시/);});
test('레거시 anon JWT 공개 키는 허용한다',async()=>{const key=`eyJ.${Buffer.from(JSON.stringify({role:'anon'})).toString('base64url')}.signature`;assert.equal(await check({...good,supabaseAnonKey:key}),'cloud');});
