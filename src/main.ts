import {grantStarsForm,grantRewardForm,renameMemberForm} from './guardian.ts';
import {DemoRepository,CloudRepository,NoFamilyError,DEMO_MEMBERS,DEMO_KEY,type Backend,type Snapshot,type FamilyAction} from './backend.ts';
import {AuthClient,ApiError,validateConfig,shouldRetainPending,type Config} from './auth.ts';
import {drawQuote,poolFor,dayKey,type Action,type Reward,type Role} from '../supabase/functions/_shared/domain.ts';
import {renderApp,rewardForm,cloudLogin,childJoinForm,onboarding,h,roleName,icons,names,formatProbability,type Screen} from './ui.ts';
import {downloadText,ledgerCSV} from './export.ts';
declare global {interface Window {PRAISE_CONFIG?:Config;PRAISE_STANDALONE?:boolean}}
const root=document.querySelector<HTMLDivElement>('#app')!;
const modal=document.querySelector<HTMLDialogElement>('#modal')!;
const toastElement=document.querySelector<HTMLDivElement>('#toast')!;
const config=window.PRAISE_CONFIG??{supabaseUrl:'',supabaseAnonKey:''};
let configured=false,configurationError='';
try{configured=validateConfig(config);}catch(error){configurationError=error instanceof Error?error.message:'연결 설정을 확인해 주세요.';}
let mode:'demo'|'cloud'='demo';
let backend:Backend;let auth:AuthClient|null=null;let snapshot:Snapshot|null=null;
let screen:Screen='home';let inventoryFilter='all';let busy=false;let refreshing=false;let lastSync='';let syncError='';let toastTimer:ReturnType<typeof setTimeout>;
let priorFocus:HTMLElement|null=null;let confirmAction:FamilyAction|null=null;
interface Pending {mode:'demo'|'cloud';familyId:string;actorId:string;requestId:string;action:FamilyAction}
let pending:Pending|null=null;let inviteCode='';let inviteRole='';let latestInvite:{code:string;expiresAt:string;role:Role}|null=null;
const err=(error:unknown)=>error instanceof Error?error.message:'처리하지 못했어요. 다시 확인해 주세요.';
function toast(message:string){clearTimeout(toastTimer);toastElement.textContent=message;toastElement.classList.add('show');toastTimer=setTimeout(()=>toastElement.classList.remove('show'),4300);}
function dialogError(message:string){const el=modal.querySelector<HTMLDivElement>('.dialog-error');if(el)el.textContent=message;else toast(message);}
function render(){if(!snapshot)return;root.innerHTML=renderApp({snapshot,screen,mode,busy,pending:!!pending,syncError,lastSync,inventoryFilter});document.title=`${snapshot.state.childName}의 칭찬 별나라`;}
function pendingKey(){return snapshot?`praise-star.pending.${mode}.${snapshot.familyId}.${snapshot.me.id}`:'';}
function readPending(){const key=pendingKey();const raw=key?localStorage.getItem(key):null;try{pending=raw?JSON.parse(raw):null;}catch{pending=null;}}
function savePending(value:Pending|null){const key=pendingKey();if(!key)throw new Error('가족 정보를 먼저 확인해 주세요.');if(value)localStorage.setItem(key,JSON.stringify(value));else localStorage.removeItem(key);pending=value;}
function openModal(content:string){priorFocus=document.activeElement as HTMLElement;modal.innerHTML=`<button class="dialog-close" aria-label="창 닫기" data-action="close-modal">×</button>${content}<div class="dialog-error" role="alert"></div>`;const title=modal.querySelector('h2');if(title){title.id='modal-title';modal.setAttribute('aria-labelledby','modal-title');}else{modal.setAttribute('aria-label','안내');}if(!modal.open)modal.showModal();const first=modal.querySelector<HTMLElement>('[autofocus]');if(first)setTimeout(()=>first.focus(),0);}
function closeModal(){if(busy)return;modal.close();confirmAction=null;if(priorFocus?.isConnected)priorFocus.focus();else root.querySelector<HTMLElement>('.brand,.mobile-brand')?.focus();}
function disableControls(disabled:boolean){document.querySelectorAll<HTMLInputElement|HTMLButtonElement|HTMLTextAreaElement|HTMLSelectElement>('#app button,#app input,#app textarea,#app select,#modal button,#modal input,#modal textarea,#modal select').forEach(el=>{if(disabled){el.dataset.originalDisabled=String(el.disabled);el.disabled=true;}else if(el.dataset.originalDisabled!==undefined){el.disabled=el.dataset.originalDisabled==='true';delete el.dataset.originalDisabled;}});}
function confirm(title:string,detail:string,action:FamilyAction,label='확인'){confirmAction=action;openModal(`<div class="dialog-heading"><span class="eyebrow">ONE LITTLE MOMENT</span><h2>${title}</h2></div>${detail}<div class="dialog-actions"><button class="button outline" data-action="close-modal">돌아가기</button><button class="button primary" data-action="confirm-action">${label}</button></div>`);}
async function doAction(action?:FamilyAction,retry=false){
  if(busy||!snapshot)return;
  if(pending&&!retry){toast('먼저 이전 요청의 결과를 확인해 주세요.');return;}
  const operation:Pending=retry&&pending?pending:{mode,familyId:snapshot.familyId,actorId:snapshot.me.id,requestId:crypto.randomUUID(),action:action!};
  if(!operation.action)return;
  try{savePending(operation);}catch(error){toast(`요청을 안전하게 저장하지 못했어요. ${err(error)}`);return;}
  busy=true;disableControls(true);
  try {
    const result=await backend.perform(operation.action,operation.requestId);
    snapshot=result.snapshot;savePending(null);syncError='';lastSync=new Intl.DateTimeFormat('ko-KR',{hour:'2-digit',minute:'2-digit',second:'2-digit'}).format(new Date());
    busy=false;disableControls(false);closeModal();render();
    if(result.result.coupon){const coupon=result.result.coupon;openModal(`<div class="celebration"><div class="eyebrow">A GIFT FROM YOUR LITTLE STARS</div><div class="celebration-stars">✧ ✦ ✧</div><span class="dialog-emoji">${h(coupon.icon)}</span><h2>${h(coupon.title)}</h2><p>${h(coupon.description)}<br>쿠폰을 보관함에 안전하게 넣어 두었어요.</p><button class="button primary full" data-action="go-inventory">내 보관함으로 가기 →</button></div>`);}else toast(result.result.message);
  } catch(error) {
    if(!shouldRetainPending(error)){try{savePending(null);}catch{/* Retain request key if the browser cannot remove it. */}}
    busy=false;disableControls(false);render();
    const message=err(error);if(modal.open){dialogError(message);if(pending&&!modal.querySelector('[data-action="retry-pending"]'))modal.querySelector('.dialog-error')?.insertAdjacentHTML('afterend','<button class="button primary full space-top" data-action="retry-pending">같은 요청 결과 확인</button>');}else toast(message);
  }
}
async function refresh(quiet=false){if(busy||refreshing)return;refreshing=true;
  try {const fresh=await backend.load();if(!snapshot||fresh.familyId!==snapshot.familyId||fresh.revision>=snapshot.revision){const changed=!snapshot||fresh.revision!==snapshot.revision||fresh.me.role!==snapshot.me.role;snapshot=fresh;readPending();lastSync=new Intl.DateTimeFormat('ko-KR',{hour:'2-digit',minute:'2-digit',second:'2-digit'}).format(new Date());syncError='';if(changed||!quiet){const typing=['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName??'');if(!quiet||(!typing&&!modal.open))render();}}}
  catch(error){syncError=mode==='cloud'?`가족 기록 갱신 실패: ${err(error)}`:err(error);if(!quiet)render();}
  finally{refreshing=false;}}
async function initialize(){root.innerHTML='<div class="loading"><span>✦</span>우리 가족의 별을 모으고 있어요.</div>';snapshot=null;pending=null;syncError='';
  try {
    if(mode==='cloud'){
      if(!configured){root.innerHTML=cloudLogin(false);return;}
      auth??=new AuthClient(config,localStorage);backend=new CloudRepository(auth);
      if(!auth.session()){root.innerHTML=cloudLogin(true,inviteCode);if(inviteRole==='child')switchLoginTab(true);return;}
      try{snapshot=await backend.load();}catch(error){if(error instanceof NoFamilyError){root.innerHTML=onboarding(!!auth.session()?.user.is_anonymous,inviteCode);return;}throw error;}
    }else{const actorId=localStorage.getItem('praise-star.demo-actor')??'child';const actor=DEMO_MEMBERS.find(m=>m.id===actorId)??DEMO_MEMBERS[0]!;backend=new DemoRepository(localStorage,actor);snapshot=await backend.load();}
    readPending();lastSync='';screen='home';render();
  }catch(error){root.innerHTML=`<div class="onboarding"><h1>기록을 불러오지 못했어요.</h1><div class="error-banner" role="alert">${h(err(error))}</div><p class="subtle space-top">기존 데이터는 자동으로 삭제하지 않았어요.</p><div class="button-row"><button class="button primary" data-action="reload-app">다시 불러오기</button>${mode==='cloud'?'<button class="button outline" data-action="logout">로그아웃 후 다시 연결</button>':'<button class="button outline" data-action="export-raw">체험 원본 백업</button><button class="button outline" data-action="reset-demo">체험판 초기화</button>'}</div></div>`;}
}
function switchLoginTab(child:boolean){const area=document.querySelector('#login-form-area');if(!area)return;document.querySelectorAll('.login-tabs>button').forEach((b,i)=>b.classList.toggle('active',child?i===1:i===0));area.innerHTML=child?childJoinForm(inviteCode):`<form id="login-form"><label>이메일<input type="email" name="email" autocomplete="username" required></label><label>비밀번호<input type="password" name="password" autocomplete="current-password" minlength="6" required></label><button class="button primary full" type="submit">우리 가족으로 로그인</button><p class="small subtle">성인 계정은 먼저 Supabase 대시보드에서 생성해 주세요.</p></form>`;}
function setupHelp(){openModal(`<div class="dialog-heading"><span class="eyebrow">FAMILY CONNECTION</span><h2>가족 공유를 연결하려면</h2><p>체험판을 가족 공유로 가장하지 않아요. 실제 서버 연결이 필요해요.</p></div><div class="dialog-help"><p>① 무료 Supabase 프로젝트에 동봉한 데이터베이스 설정과 Edge Function을 적용해요.</p><p>② 보호자 이메일 계정을 만들고 아이용 익명 인증을 켜요.</p><p>③ 공개 URL과 <strong>공개 키</strong>로 웹앱을 배포해요. 서버 비밀 키는 입력하지 않아요.</p><p>④ 보호자로 로그인해 가족을 만들고, 초대 코드를 발급해요.</p><br><p>프로젝트의 <code>docs/technical/DEPLOYMENT.md</code>에 실행 명령과 화면별 설정이 있어요.</p></div><button class="button primary full space-top" data-action="${configured?'use-cloud':'close-modal'}">${configured?'가족 공유 로그인으로 이동':'체험 계속하기'}</button>`);}
async function adminOperation(run:()=>Promise<void>){if(busy)return;busy=true;disableControls(true);try{await run();}catch(error){if(modal.open)dialogError(err(error));else{const errorBox=document.querySelector('#auth-error');if(errorBox)errorBox.textContent=err(error);else toast(err(error));}}finally{busy=false;disableControls(false);}}
function navigate(next:Screen){if(busy)return;if(snapshot?.me.role==='child'&&['praise','manage'].includes(next)){toast('보호자 화면이에요.');return;}if(snapshot?.me.role==='giver'&&next==='manage'){toast('보호자만 보상을 설정할 수 있어요.');return;}screen=next;closeModal();render();window.scrollTo({top:0,behavior:'instant'});}
function openRolePicker(){openModal(`<div class="dialog-heading"><span class="eyebrow">DEMO ROLE SWITCH</span><h2>누구의 화면으로 볼까요?</h2><p>체험용 역할 전환이에요. 실제 공유 모드에서는 로그인 권한으로 구분해요.</p></div><div class="role-picker">${(snapshot?.members??DEMO_MEMBERS).map(m=>`<button class="role-button" data-demo-role="${h(m.id)}"><span>${m.role==='child'?'🌟':m.id==='grandma'?'👵':m.id==='dad'?'🧑':'👩'}</span><span><strong>${h(m.name)}</strong><small>${roleName(m.role)}</small></span></button>`).join('')}</div>`);}
function extractInvite(){try{if(location.hash.startsWith('#join=')){const q=new URLSearchParams(location.hash.slice(1));const code=q.get('join')??'';if(/^[a-f0-9]{64}$/.test(code)){inviteCode=code;inviteRole=q.get('role')??'';sessionStorage.setItem('praise-star.invite',JSON.stringify({code,role:inviteRole}));}history.replaceState(null,'',location.pathname+location.search);}else{const saved=JSON.parse(sessionStorage.getItem('praise-star.invite')??'null');if(saved){inviteCode=saved.code;inviteRole=saved.role;}}}catch{/* A private browser may not allow session persistence. */}}
async function handleClick(event:MouseEvent){const source=(event.target as Element).closest<HTMLElement>('[data-nav],[data-action],[data-demo-role],[data-filter],[data-template]');if(!source||busy)return;
 if(source.dataset.nav){navigate(source.dataset.nav as Screen);return;}
 if(source.dataset.filter){inventoryFilter=source.dataset.filter;render();return;}
 if(source.dataset.demoRole){if(mode!=='demo')return;localStorage.setItem('praise-star.demo-actor',source.dataset.demoRole);closeModal();await initialize();return;}
 if(source.dataset.template){const area=document.querySelector<HTMLTextAreaElement>('#praise-reason');if(area){area.value=source.dataset.template;area.dispatchEvent(new Event('input',{bubbles:true}));area.focus();}return;}
 const action=source.dataset.action,id=source.dataset.id;
 switch(action){
  case 'grant-stars':if(snapshot?.me.role==='admin')openModal(grantStarsForm(snapshot.state.childName));break;
  case 'grant-reward':if(snapshot?.me.role==='admin'){const r=snapshot.state.rewards.find(r=>r.id===id);if(r&&r.active&&(r.stock===null||r.stock>0))openModal(grantRewardForm(r,snapshot.state.childName));}break;
  case 'rename-member':if(snapshot?.me.role==='admin'){const m=snapshot.members.find(m=>m.id===id);if(m)openModal(renameMemberForm(m));}break;
  case 'close-modal':closeModal();break;
  case 'switch-role':if(mode==='demo')openRolePicker();break;
  case 'account-info':if(snapshot)openModal(`<div class="dialog-heading"><h2>${h(snapshot.me.name)}의 계정</h2><p>현재 권한은 ${roleName(snapshot.me.role)}예요. 공유 기기에서는 사용 후 로그아웃해 주세요.</p></div><button class="button outline full" data-action="logout">이 기기 로그아웃</button>`);break;
  case 'more-menu':if(snapshot){const list:Screen[]=snapshot.me.role==='admin'?['praise','manage','family','history']:snapshot.me.role==='giver'?['praise','family','history']:['family','history'];openModal(`<div class="dialog-heading"><h2>함께하는 가족</h2></div><div class="role-picker">${list.map(t=>`<button class="role-button" data-nav="${t}"><span>${icons[t]}</span><strong>${names[t]}</strong></button>`).join('')}</div>${mode==='demo'?'<button class="button outline full space-top" data-action="switch-role">체험 역할 바꾸기</button>':''}`);}break;
  case 'set-goal':if(id)await doAction({type:'goal/set',rewardId:id});break;
  case 'buy':{const r=snapshot?.state.rewards.find(r=>r.id===id);if(!r||!snapshot)return;confirm('이 선물로 교환할까요?',`<div class="confirm-card"><span class="dialog-emoji">${h(r.icon)}</span><h3>${h(r.title)}</h3><p>${h(r.description)}</p><div class="confirm-amount">✦ ${snapshot.state.balance}<small>→</small>${snapshot.state.balance-r.cost}<small>개</small></div></div><p class="dialog-help">별 ${r.cost}개를 사용하고 쿠폰을 받아요. 실제 사용할 때 보호자의 승인이 필요해요.</p>`,{type:'spend/shop',rewardId:r.id,version:r.version},`별 ${r.cost}개로 교환`);break;}
  case 'draw':{if(!snapshot)return;const s=snapshot.state;const pool=poolFor(s);confirm('반짝 선물 상자를 열까요?',`<div class="confirm-card"><span class="dialog-emoji">🎁</span><h3>별 ${s.box.cost}개로 선물 하나</h3><p>확률을 한 번 더 확인해 주세요.</p></div><div class="odds-list">${pool.map(i=>`<div class="odds-row"><span class="odds-icon">${h(i.reward.icon)}</span><div class="grow"><strong>${h(i.reward.title)}</strong></div><b>${formatProbability(i.probability)}%</b></div>`).join('')}</div><p class="dialog-help space-top">확정 상점에서 원하는 선물을 고를 수도 있어요. 결과는 화면을 닫아도 보관함에 남아요.</p>`,{type:'spend/draw',quote:drawQuote(s)},'이 확률로 한 번 열기');break;}
  case 'confirm-action':if(confirmAction)await doAction(confirmAction);break;
  case 'retry-pending':await doAction(undefined,true);break;
  case 'go-inventory':inventoryFilter='all';navigate('inventory');break;
  case 'coupon/request':case 'coupon/cancel':case 'coupon/approve':if(id)await doAction({type:action,id});break;
  case 'reject-coupon':if(id)openModal(`<div class="dialog-heading"><h2>다음에 사용할 수 있도록</h2><p>쿠폰은 사라지지 않고 다시 요청할 수 있어요.</p></div><form id="reject-form" data-id="${h(id)}"><label>아이에게 남길 안내<textarea name="note" maxlength="180" rows="3" required autofocus>이번 주말에 함께 사용해요.</textarea></label><button class="button primary full" type="submit">쿠폰을 보관함으로 돌려주기</button></form>`);break;
  case 'complete-coupon':if(id)confirm('선물을 전달했나요?','<p class="dialog-help">실제로 선물을 주거나 함께 활동을 마친 뒤 사용 완료로 표시해 주세요.</p>',{type:'coupon/use',id},'네, 사용 완료');break;
  case 'edit-reward':{const reward=snapshot?.state.rewards.find(r=>r.id===id);openModal(rewardForm(reward));break;}
  case 'toggle-reward':{const reward=snapshot?.state.rewards.find(r=>r.id===id);if(reward)await doAction({type:'reward/save',reward:{...reward,active:!reward.active}});break;}
  case 'reverse-praise':if(id)openModal(`<div class="dialog-heading"><h2>입력 오류만 정정해요</h2><p>벌점이나 행동에 대한 벌칙으로 사용하지 않아요. 원래 기록과 정정 사유는 남겨 둬요.</p></div><form id="reverse-form" data-id="${h(id)}"><label>정정 사유<textarea name="reason" maxlength="180" rows="3" placeholder="예: 같은 칭찬을 실수로 두 번 입력했어요" required autofocus></textarea></label><button class="button primary full" type="submit">오류 정정 기록하기</button></form>`);break;
  case 'invite-child':if(mode==='demo'){setupHelp();}else openModal('<div class="dialog-heading"><h2>연준이 기기 추가</h2><p>기존 연준이 프로필에 새 기기를 연결합니다.</p></div><form id="invite-form"><input type="hidden" name="role" value="child"><button class="button primary full" type="submit">일회용 코드 발급</button></form>');break;
  case 'invite':if(mode==='demo'){setupHelp();}else openModal(`<div class="dialog-heading"><h2>우리 가족에게 초대 보내기</h2><p>한 번만 사용할 수 있고 48시간 뒤 만료돼요. 가족에게만 전달해 주세요.</p></div><form id="invite-form"><label>초대할 가족의 역할<select name="role"><option value="giver">칭찬 가족 — 칭찬 지급과 기록 보기</option><option value="admin">보호자 — 보상 편집과 사용 승인도 가능</option><option value="child">연준이 기기 — 기존 연준이 프로필 공유</option></select></label><button class="button primary full" type="submit">일회용 초대 만들기</button></form>`);break;
  case 'copy-invite':if(latestInvite){try{await navigator.clipboard.writeText(latestInvite.code);toast('초대 코드를 복사했어요.');}catch{toast('자동 복사를 사용할 수 없어요. 표시된 코드를 선택해서 복사해 주세요.');}}break;
  case 'copy-invite-link':if(latestInvite){const link=`${location.origin}${location.pathname}#join=${latestInvite.code}&role=${latestInvite.role}`;try{await navigator.clipboard.writeText(link);toast('초대 링크를 복사했어요.');}catch{dialogError('자동 복사가 허용되지 않아요. 표시된 초대 코드를 직접 복사해 주세요.');}}break;
  case 'remove-member':if(id&&snapshot){const member=snapshot.members.find(m=>m.id===id);openModal(`<div class="dialog-heading"><h2>이 가족의 연결을 해제할까요?</h2><p>${h(member?.name)}은(는) 더 이상 가족 기록에 접근하지 못해요. 이전 칭찬 기록은 유지돼요.</p></div><div class="dialog-actions"><button class="button outline" data-action="close-modal">취소</button><button class="button primary" data-action="confirm-remove" data-id="${h(id)}">연결 해제</button></div>`);}break;
  case 'confirm-remove':if(id&&backend instanceof CloudRepository)await adminOperation(async()=>{snapshot=await (backend as CloudRepository).removeMember(id);busy=false;closeModal();render();toast('가족 연결을 해제했어요.');});break;
  case 'revoke-invites':openModal('<div class="dialog-heading"><h2>미사용 초대를 모두 취소할까요?</h2><p>이미 참여한 가족은 영향을 받지 않아요.</p></div><div class="dialog-actions"><button class="button outline" data-action="close-modal">돌아가기</button><button class="button primary" data-action="confirm-revoke">초대 취소</button></div>');break;
  case 'confirm-revoke':if(backend instanceof CloudRepository)await adminOperation(async()=>{await (backend as CloudRepository).revokeInvites();busy=false;closeModal();toast('미사용 초대를 취소했어요.');});break;
  case 'refresh':await refresh();toast(syncError||'가족 기록을 새로 확인했어요.');break;
  case 'connect-cloud':setupHelp();break;
  case 'use-cloud':mode='cloud';localStorage.setItem('praise-star.mode',mode);closeModal();await initialize();break;
  case 'use-demo':mode='demo';localStorage.setItem('praise-star.mode',mode);closeModal();await initialize();break;
  case 'adult-login-tab':switchLoginTab(false);break;
  case 'child-login-tab':switchLoginTab(true);break;
  case 'logout':await auth?.logout();closeModal();snapshot=null;await initialize();break;
  case 'reload-app':await initialize();break;
  case 'export-json':if(snapshot){const value={app:'praise-star',version:'0.1.0',exportedAt:new Date().toISOString(),mode,state:snapshot.state,members:snapshot.members.map(m=>({name:m.name,role:m.role}))};downloadText(`칭찬별나라_백업_${dayKey(new Date().toISOString())}.json`,JSON.stringify(value,null,2),'application/json;charset=utf-8');toast('기록을 저장했어요. 가족 정보가 포함되니 안전하게 보관해 주세요.');}break;
  case 'export-csv':if(snapshot){downloadText(`칭찬별나라_별기록_${dayKey(new Date().toISOString())}.csv`,ledgerCSV(snapshot.state),'text/csv;charset=utf-8');toast('별 거래 기록을 CSV로 저장했어요.');}break;
  case 'export-raw':downloadText('칭찬별나라_체험원본.json',localStorage.getItem(DEMO_KEY)??'{}','application/json');break;
  case 'reset-demo':if(mode==='demo')openModal('<div class="dialog-heading"><h2>체험 기록을 초기화할까요?</h2><p>이 브라우저의 체험 기록만 지워지고 예시 데이터로 돌아가요. 필요한 기록은 먼저 내보내 주세요.</p></div><div class="dialog-actions"><button class="button outline" data-action="close-modal">취소</button><button class="button primary" data-action="confirm-reset-demo">초기화</button></div>');break;
  case 'confirm-reset-demo':if(mode==='demo'){if(snapshot)localStorage.removeItem(pendingKey());localStorage.removeItem(DEMO_KEY);closeModal();await initialize();toast('체험 예시 데이터로 돌아왔어요.');}break;
 }
}
document.addEventListener('click',event=>{handleClick(event).catch(error=>toast(err(error)));});
document.addEventListener('submit',event=>{const form=event.target as HTMLFormElement;if(!(form instanceof HTMLFormElement))return;event.preventDefault();if(busy)return;const data=new FormData(form);const value=(key:string)=>String(data.get(key)??'');const number=(key:string)=>Number(value(key));
 (async()=>{switch(form.id){
  case 'grant-stars-form':{const stars=number('stars'),reason=value('reason').trim();confirm('별을 직접 지급할까요?',`<div class="confirm-card"><h3>✦ +${h(stars)}개</h3><p>${h(reason)}</p><p>지급 후 ${(snapshot?.state.balance??0)+stars}개</p></div>`,{type:'stars/grant',stars,reason},'별 지급');break;}
  case 'grant-reward-form':{const r=snapshot?.state.rewards.find(r=>r.id===form.dataset.id);if(!r)break;const reason=value('reason').trim();confirm('이 선물을 직접 지급할까요?',`<div class="confirm-card"><h3>${h(r.icon)} ${h(r.title)}</h3><p>쿠폰 1장 · 별 차감 없음</p><p>${h(reason)}</p></div>`,{type:'reward/grant',rewardId:r.id,version:Number(form.dataset.version),reason},'선물 지급');break;}
  case 'rename-member-form':await doAction({type:'member/rename',userId:form.dataset.id!,expectedName:form.dataset.expectedName!,displayName:value('displayName')});break;
  case 'praise-form':{const action:Action={type:'praise/give',stars:number('stars'),category:value('category'),reason:value('reason')};const duplicate=snapshot?.state.praises.some(p=>!p.reversed&&p.actorId===snapshot?.me.id&&p.reason===action.reason.trim()&&dayKey(p.createdAt)===dayKey(new Date().toISOString()));if(duplicate)confirm('같은 칭찬을 오늘 이미 남겼어요','<p class="dialog-help">다른 행동에 대한 추가 칭찬인지 확인해 주세요. 실수라면 돌아가서 수정할 수 있어요.</p>',action,'추가 칭찬이 맞아요');else await doAction(action);break;}
  case 'reward-form':{const reward:Omit<Reward,'version'>&{version?:number}={id:form.dataset.id||crypto.randomUUID(),title:value('title'),description:value('description'),icon:value('icon'),cost:number('cost'),stock:data.has('unlimited')?null:number('stock'),active:data.has('active'),shop:data.has('shop'),gacha:data.has('gacha')};if(form.dataset.id)reward.version=Number(form.dataset.version);await doAction({type:'reward/save',reward});break;}
  case 'box-form':{const items=[...data.entries()].filter(([key,val])=>key.startsWith('weight-')&&Number(val)>0).map(([key,val])=>({rewardId:key.slice(7),weight:Number(val)}));await doAction({type:'box/save',box:{title:value('title'),cost:number('cost'),dailyLimit:number('dailyLimit'),items}});break;}
  case 'profile-form':await doAction({type:'profile/save',familyName:value('familyName'),childName:value('childName')});break;
  case 'reverse-form':await doAction({type:'praise/reverse',id:form.dataset.id!,reason:value('reason')});break;
  case 'reject-form':await doAction({type:'coupon/reject',id:form.dataset.id!,note:value('note')});break;
  case 'login-form':await adminOperation(async()=>{auth??=new AuthClient(config,localStorage);await auth.login(value('email'),value('password'));form.reset();busy=false;await initialize();});break;
  case 'child-join-form':await adminOperation(async()=>{auth??=new AuthClient(config,localStorage);if(auth.session()&&!auth.session()?.user.is_anonymous)throw new Error('보호자 계정을 먼저 로그아웃해 주세요.');if(!auth.session())await auth.anonymous();const cloud=new CloudRepository(auth);snapshot=await cloud.joinFamily(value('code'),value('name'));sessionStorage.removeItem('praise-star.invite');inviteCode='';backend=cloud;busy=false;render();});break;
  case 'create-family-form':if(backend instanceof CloudRepository)await adminOperation(async()=>{snapshot=await (backend as CloudRepository).createFamily(value('familyName'),value('childName'),value('displayName'));busy=false;render();});break;
  case 'join-family-form':if(backend instanceof CloudRepository)await adminOperation(async()=>{snapshot=await (backend as CloudRepository).joinFamily(value('code'),value('displayName'));sessionStorage.removeItem('praise-star.invite');inviteCode='';busy=false;render();});break;
  case 'invite-form':if(backend instanceof CloudRepository)await adminOperation(async()=>{latestInvite=await (backend as CloudRepository).invite(value('role') as Role);busy=false;const invite=latestInvite!;openModal(`<div class="dialog-heading"><h2>가족 초대가 준비됐어요</h2><p>${roleName(invite.role)} 초대 · 한 번만 사용 · 48시간 후 만료</p></div><div class="invite-code">${h(invite.code)}</div><p class="dialog-help">${invite.role==='child'?'새 기기에서 “아이 기기 연결”을 선택하고 기기 이름과 코드를 입력하세요. 별과 선물은 연준이 프로필에서 공유해요.':'성인 가족은 보호자가 Supabase에서 계정을 먼저 생성한 뒤 로그인하고 이 초대를 사용해요.'}</p><div class="button-row"><button class="button primary" data-action="copy-invite">코드 복사</button><button class="button outline" data-action="copy-invite-link">초대 링크 복사</button></div>`);});break;
 }})().catch(error=>{if(modal.open)dialogError(err(error));else toast(err(error));});
});
document.addEventListener('input',event=>{const target=event.target as HTMLInputElement;const form=target.closest('form');if(form?.id==='praise-form'){const data=new FormData(form);const message=String(data.get('reason')??'');const text=document.querySelector('#praise-preview-text');const stars=document.querySelector('#praise-preview-stars');const count=document.querySelector('#reason-count');if(text)text.textContent=message||'작은 도전도 멋진 칭찬이 돼요.';if(stars)stars.textContent=`✦ ${String(data.get('stars'))}개`;if(count)count.textContent=`${message.length} / 180`;}
 if(form?.id==='box-form'){const total=[...new FormData(form).entries()].filter(([key])=>key.startsWith('weight-')).reduce((sum,[,v])=>sum+(Number(v)||0),0);const label=document.querySelector('#weight-total');if(label){label.textContent=`합계 ${total}%`;label.classList.toggle('invalid',total!==100);}}
});
document.addEventListener('change',event=>{const target=event.target as HTMLInputElement;if(target.name==='unlimited'){const stock=target.form?.querySelector<HTMLInputElement>('[name="stock"]');if(stock)stock.disabled=target.checked;}if(target.name==='stars')target.dispatchEvent(new Event('input',{bubbles:true}));});
modal.addEventListener('cancel',event=>{event.preventDefault();closeModal();});
modal.addEventListener('click',event=>{if(event.target===modal){const r=modal.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)closeModal();}});
window.addEventListener('storage',event=>{if(mode==='demo'&&event.key===DEMO_KEY&&snapshot)void refresh(true);});
window.addEventListener('focus',()=>{if(snapshot)void refresh(true);});
window.addEventListener('online',()=>{if(snapshot&&mode==='cloud')void refresh();});
window.addEventListener('offline',()=>{if(snapshot&&mode==='cloud'){syncError='오프라인이에요. 연결 전에는 별을 지급하거나 사용할 수 없어요.';render();}});
setInterval(()=>{if(mode==='cloud'&&snapshot&&!document.hidden)void refresh(true);},15000);
try{extractInvite();mode=configured&&localStorage.getItem('praise-star.mode')!=='demo'?'cloud':'demo';if(configured&&inviteCode)mode='cloud';void initialize();if(configurationError)setTimeout(()=>toast(configurationError),300);}catch(error){root.innerHTML=`<div class="onboarding"><h1>브라우저 저장 기능이 필요해요.</h1><p>${h(err(error))}</p><p>파일을 다운로드한 뒤 Chrome 또는 Edge에서 열어 주세요. 비공개 모드에서는 저장을 허용해야 해요.</p></div>`;}
// App-shell caching is optional; API responses and credentials are never cached by this worker.
if(!window.PRAISE_STANDALONE&&location.protocol==='https:'&&'serviceWorker' in navigator)void navigator.serviceWorker.register('./sw.js').catch(()=>{});
