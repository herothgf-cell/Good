import test from 'node:test';
import assert from 'node:assert/strict';
import {renderApp} from '../dist/src/ui.js';
import {tabsFor,canVisit} from '../dist/src/experience.js';
import {emptyState,exampleRewards} from '../dist/supabase/functions/_shared/domain.js';

const child={id:'kid',name:'연준이',role:'child'};
const admin={id:'dad',name:'아빠',role:'admin'};
const giver={id:'gran',name:'할머니',role:'giver'};
function state(enabled){const s=emptyState();s.rewards=exampleRewards();if(enabled===undefined)delete s.gachaEnabled;else s.gachaEnabled=enabled;return s;}
function view(me=child,screen='home',s=state(),extra={}){return {snapshot:{state:s,me,members:[admin,child,giver],familyId:'family',revision:1},screen,mode:'cloud',busy:false,pending:false,syncError:'',lastSync:'',inventoryFilter:'all',...extra};}

for(const enabled of [undefined,false])test(`hidden draw has no child navigation or executable screen (${enabled})`,()=>{
  const s=state(enabled);
  assert.deepEqual(tabsFor('child',s),['home','earn','shop','inventory']);
  assert.equal(canVisit('child','gacha',s),false);
  for(const screen of ['home','earn','shop','inventory','family','gacha']){
    const html=renderApp(view(child,screen,s));
    assert.doesNotMatch(html,/data-nav="gacha"|data-action="draw"/);
    assert.doesNotMatch(html,/data-action="toggle-gacha"/);
  }
});
test('guardian opening draw makes both child menus and the real draw screen available',()=>{
  const s=state(true);
  assert.deepEqual(tabsFor('child',s),['home','earn','shop','gacha','inventory']);
  assert.equal(canVisit('child','gacha',s),true);
  const html=renderApp(view(child,'gacha',s));
  assert.equal((html.match(/data-nav="gacha"/g)||[]).length,2);
  assert.match(html,/data-action="draw"/);
});
for(const enabled of [false,true])test(`only guardian sees persisted draw visibility switch (${enabled})`,()=>{
  const s=state(enabled);
  for(const screen of ['family','box']){
    const html=renderApp(view(admin,screen,s));
    assert.match(html,new RegExp(`role="switch"[^>]*aria-checked="${enabled}"`));
    assert.match(html,/aria-label="연준이에게 뽑기 공개"/);
    assert.match(html,new RegExp(`data-action="toggle-gacha"[^>]*data-enabled="${!enabled}"`));
  }
  assert.doesNotMatch(renderApp(view(giver,'family',s)),/data-action="toggle-gacha"/);
  assert.equal(canVisit('giver','gacha',s),false);
});
test('pending guardian request disables the visibility switch',()=>{
  const html=renderApp(view(admin,'family',state(false),{pending:true}));
  assert.match(html,/<button[^>]*data-action="toggle-gacha"[^>]*disabled/);
});
