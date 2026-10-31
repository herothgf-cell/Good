import test from 'node:test';
import assert from 'node:assert/strict';
import {demoState} from '../dist/supabase/functions/_shared/domain.js';
import {LEARNING_CONTENT_VERSION} from '../dist/supabase/functions/_shared/learning-content.js';
import {canVisit,tabsFor} from '../dist/src/experience.js';
import {renderApp} from '../dist/src/ui.js';
const state=()=>demoState('2026-10-31T04:00:00Z');
const active=()=>({...state(),learning:{draft:{lessonIds:['english-animals'],dailyLimit:1,starsPerSession:1},draftVersion:3,publicationSequence:1,previews:[],runs:[],publication:{version:1,contentVersion:LEARNING_CONTENT_VERSION,settings:{lessonIds:['math-ten'],dailyLimit:1,starsPerSession:1},publishedAt:'2026-10-31T04:00:00Z',publishedBy:'dad'}}});
function view(s,role,screen='home'){return {snapshot:{state:s,me:{id:role,name:role,role},members:[],familyId:'family',revision:0},screen,mode:'demo',busy:false,pending:false,syncError:'',lastSync:'',inventoryFilter:'all',learningHtml:'<section data-testid="learning-injected">학습 내용</section>'};}
test('admin has a separate learning menu while legacy child and giver have no entry',()=>{
 assert.ok(tabsFor('admin',state()).includes('learning'));
 for(const role of ['child','giver']){
  assert.ok(!tabsFor(role,state()).includes('learning'));
  assert.equal(canVisit(role,'learning',state()),false);
  assert.doesNotMatch(renderApp(view(state(),role)),/data-nav="learning"/);
  assert.doesNotMatch(renderApp(view(state(),role,'learning')),/learning-injected/);
 }
});
test('child entry and screen exist only for current published content, independent of draft',()=>{
 const s=active();assert.ok(tabsFor('child',s).includes('learning'));assert.equal(canVisit('child','learning',s),true);
 assert.match(renderApp(view(s,'child')),/data-nav="learning"/);
 assert.match(renderApp(view(s,'child','learning')),/learning-injected/);
 s.learning.publication.contentVersion='obsolete';assert.equal(canVisit('child','learning',s),false);
 assert.doesNotMatch(renderApp(view(s,'child')),/data-nav="learning"/);
});
