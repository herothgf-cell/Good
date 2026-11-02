import type {RealtimeView} from './learning-realtime.ts';
import {labEscape as e} from './learning-lab-visuals.ts';
const button=(label:string,action:string,tone='secondary',disabled=false)=>`<button type="button" class="lab-button lab-${tone}" data-lab-action="${action}"${disabled?' disabled':''}>${label}</button>`;
export function renderRealtimePanel(v:RealtimeView):string{
 const titles={idle:'말로 만나는 영어 친구',checking:'연결 설정을 확인해요',ready:'대화할 준비가 됐어요',connecting:'AI 친구를 만나고 있어요',listening:'당신의 이야기를 듣고 있어요',thinking:'듣고, 생각하고 있어요',speaking:'AI 친구가 말하고 있어요','audio-blocked':'AI 소리를 켜 주세요',ended:'대화를 마쳤어요',error:'연결을 확인해 주세요'};
 const time=`${Math.floor(v.remainingSeconds/60)}:${String(v.remainingSeconds%60).padStart(2,'0')}`;
 return `<section class="voice-panel voice-${v.phase}" data-voice-layout="${v.phase}/${v.active}/${v.captions}/${v.voice}" aria-labelledby="voice-title"><div class="voice-topline"><span class="voice-label">REALTIME · 음성으로 주고받기</span><span class="voice-private">보호자 전용</span></div><h1 id="voice-title">실시간 음성 대화</h1><p class="voice-intro">키보드 없이, AI가 생성한 목소리로.<br>한 번 시작하면 말을 듣고 자연스럽게 이어가요.</p><div class="voice-orb" aria-hidden="true"><div class="voice-waves">${Array.from({length:5},(_,i)=>`<i style="--wave:${i}"></i>`).join('')}</div></div><h2 class="voice-phase">${e(titles[v.phase])}</h2><p class="voice-message" role="status">${e(v.message)}</p><div class="voice-metrics"><span>테스트 <strong data-voice-time>${time}</strong></span><span>AI 응답 <strong data-voice-count>${v.responses} / 40</strong></span></div><div class="voice-controls">${v.active?button('■ 대화 종료','realtime-stop','primary'):button('● 음성 대화 시작','realtime-start','primary',v.phase==='checking')}${v.phase==='audio-blocked'?button('🔊 소리 켜기','realtime-audio','secondary'):''}${button(v.captions?'자막 숨기기':'영어 자막 보기','realtime-captions','quiet')}</div>${v.captions?`<div class="voice-caption" lang="en" aria-label="AI가 말하는 영어 자막">${e(v.caption||'AI가 말하면 여기에 자막이 표시돼요.')}</div>`:''}<div class="voice-options"><span>목소리</span>${button('Marin','realtime-marin',v.voice==='marin'?'selected':'quiet',v.active||v.phase==='checking')}${button('Cedar','realtime-cedar',v.voice==='cedar'?'selected':'quiet',v.active||v.phase==='checking')}${button('연결 상태 확인','realtime-check','quiet',v.active||v.phase==='checking')}</div><p class="voice-footnote">실제 사람이 아닌 AI와 대화합니다. 성인 보호자의 목소리로만 테스트해 주세요.<br>AI가 말할 때는 마이크를 잠시 닫아요. 화면을 나가면 연결을 종료해요.<br>최대 5분 · 하루 시작 6회 · API 사용 요금 발생 · 별 지급 없음</p></section>`;
}

/** Update captions/countdown in place, preserving audio, focus and the rest of the app. */
export function updateRealtimePanel(v:RealtimeView):boolean {
 const panel=document.querySelector<HTMLElement>('.voice-panel');if(!panel)return false;
 const layout=`${v.phase}/${v.active}/${v.captions}/${v.voice}`;
 if(panel.dataset.voiceLayout!==layout){
  const focus=document.activeElement instanceof HTMLElement&&panel.contains(document.activeElement)?document.activeElement.dataset.labAction:undefined;
  panel.outerHTML=renderRealtimePanel(v);
  if(focus&&/^realtime-[a-z]+$/.test(focus))document.querySelector<HTMLButtonElement>(`.voice-panel [data-lab-action="${focus}"]:not(:disabled)`)?.focus({preventScroll:true});
 }else{
  const set=(selector:string,text:string)=>{const node=panel.querySelector(selector);if(node&&node.textContent!==text)node.textContent=text;};
  set('.voice-message',v.message);set('.voice-caption',v.caption||'AI가 말하면 여기에 자막이 표시돼요.');
  set('[data-voice-time]',`${Math.floor(v.remainingSeconds/60)}:${String(v.remainingSeconds%60).padStart(2,'0')}`);set('[data-voice-count]',`${v.responses} / 40`);
 }
 return true;
}
