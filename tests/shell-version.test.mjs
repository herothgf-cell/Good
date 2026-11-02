import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync,existsSync} from 'node:fs';import vm from 'node:vm';
test('offline shell includes the complete new module graph and uses the release cache version',()=>{
 const source=readFileSync('public/sw.js','utf8'),version=JSON.parse(readFileSync('package.json','utf8')).version;
 const context={self:{addEventListener(){}},cacheVersion:'',assets:[]};vm.createContext(context);vm.runInContext(source+'\ncacheVersion=CACHE;assets=ASSETS;',context);
 assert.equal(context.cacheVersion,'praise-star-shell-v'+version);
 for(const file of ['src/praise-date.js','src/learning-audio.js','src/learning-reader.js','src/learning-writing.js','supabase/functions/_shared/phonics-curriculum.js'])assert.ok(context.assets.includes('./'+file),`${file} must survive offline update`);
 for(const asset of context.assets)assert.ok(existsSync('dist/'+asset),`missing built asset ${asset}`);
 assert.ok(!context.assets.includes('./config.js'),'auth config never cached');
});
