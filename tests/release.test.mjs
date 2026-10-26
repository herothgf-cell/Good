import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
test('환경 파일은 공개 URL/공개 키만 읽고 실행 환경을 우선한다',async()=>{
  assert.ok(fs.existsSync('scripts/env.mjs'),'env loader exists');
  const {loadPublicConfig}=await import('../scripts/env.mjs');
  const text='SUPABASE_URL="https://example.supabase.co"\nSUPABASE_ANON_KEY=sb_publishable_example\nSUPABASE_SERVICE_ROLE_KEY=SECRET\nOTHER=ignored';
  assert.deepEqual(loadPublicConfig({},text),{supabaseUrl:'https://example.supabase.co',supabaseAnonKey:'sb_publishable_example'});
  assert.equal(loadPublicConfig({SUPABASE_ANON_KEY:'override'},text).supabaseAnonKey,'override');
  assert.equal(loadPublicConfig({},'').supabaseUrl,'');
});
test('배포 설정과 Windows 실행기가 패키지에 존재한다',()=>{
  for(const f of ['package-lock.json','.env.example','vercel.json','start-demo.cmd','start-dev.cmd'])assert.ok(fs.existsSync(f),f);
  const config=JSON.parse(fs.readFileSync('vercel.json','utf8'));
  assert.equal(config.outputDirectory,'dist');assert.equal(config.buildCommand,'npm run build');
});
