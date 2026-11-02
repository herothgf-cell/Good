import type {LabVisual} from '../supabase/functions/_shared/learning-lab-content.ts';
export const labEscape=(value:unknown)=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const e=labEscape;
const svg=(body:string,label:string)=>`<svg class="lab-clock" viewBox="0 0 220 220" role="img" aria-label="${e(label)}">${body}</svg>`;
function clock(hour:number,minute:number):string{
 const angle=(degrees:number,length:number):[number,number]=>[110+Math.sin(degrees*Math.PI/180)*length,110-Math.cos(degrees*Math.PI/180)*length];
 const h=angle((hour%12)*30+minute*.5,53),m=angle(minute*6,77);
 return svg(`<circle cx="110" cy="110" r="99" fill="#fffdf7" stroke="currentColor" stroke-width="3"/>${Array.from({length:60},(_,i)=>{const a=angle(i*6,i%5===0?85:91),b=angle(i*6,96);return `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="currentColor" stroke-width="${i%5===0?3:1}"/>`;}).join('')}${Array.from({length:12},(_,i)=>{const n=i+1,p=angle(n*30,73);return `<text x="${p[0]}" y="${p[1]+5}" text-anchor="middle" font-size="15" fill="currentColor">${n}</text>`;}).join('')}<line x1="110" y1="110" x2="${h[0]}" y2="${h[1]}" stroke="#7146a5" stroke-width="7" stroke-linecap="round"/><line x1="110" y1="110" x2="${m[0]}" y2="${m[1]}" stroke="#247d79" stroke-width="4" stroke-linecap="round"/><circle cx="110" cy="110" r="5" fill="#7146a5"/>`,`${hour}시 ${minute}분 시계`);
}
function calendar(year:number,month:number,day:number,targetDay?:number,targetMonth?:number):string{
 const offset=new Date(Date.UTC(year,month-1,1)).getUTCDay(),days=new Date(Date.UTC(year,month,0)).getUTCDate();
 return `<div class="lab-calendar" role="img" aria-label="${year}년 ${month}월 달력, 표시한 날 ${day}일${targetDay&&(!targetMonth||targetMonth===month)?`, 목표 ${targetDay}일`:''}"><strong>${year}년 ${month}월</strong><div class="lab-calendar-grid">${['일','월','화','수','목','금','토'].map(x=>`<b>${x}</b>`).join('')}${Array.from({length:offset},()=>'<span></span>').join('')}${Array.from({length:days},(_,i)=>`<span class="${i+1===day?'lab-day-current ':''}${i+1===targetDay&&(!targetMonth||targetMonth===month)?'lab-day-target':''}">${i+1}</span>`).join('')}</div></div>`;
}
/** Exact visual quantities come exclusively from reviewed structured content. */
export function renderLabVisual(v:LabVisual,hideWord=false,revealAnswer=false):string{
 if(v.kind==='word')return `<div class="lab-word-visual"><span aria-hidden="true">${e(v.icon)}</span>${hideWord?'':`<strong lang="en">${e(v.label)}</strong>`}</div>`;
 if(v.kind==='clock')return `<div class="lab-visual lab-clock-pair">${clock(v.hour,v.minute)}${v.endHour!==undefined&&v.endMinute!==undefined?`<span aria-hidden="true">→</span>${clock(v.endHour,v.endMinute)}`:''}</div>`;
 if(v.kind==='calendar'){
  const next=v.targetMonth!==undefined&&v.targetMonth!==v.month;
  return `<div class="lab-visual lab-calendars">${calendar(v.year,v.month,v.day,revealAnswer?v.targetDay:undefined,v.targetMonth)}${next?calendar(v.targetMonth!<v.month?v.year+1:v.year,v.targetMonth!,0,revealAnswer?v.targetDay:undefined,v.targetMonth):''}</div>`;
 }
 if(v.kind==='money'){
  const coin=v.unit===100,unit=coin?'개':'장';
  return `<div class="lab-visual lab-money" role="img" aria-label="${e(v.counts.map(n=>`${v.unit}원 ${n}${unit}`).join(', '))}">${v.counts.map((n,i)=>`<div class="lab-money-group"><span>${v.counts.length>1?`${i+1}번째 묶음`:''}</span><div>${Array.from({length:n},()=>coin?`<span class="lab-coin"><small>₩</small><strong>100</strong></span>`:`<span class="lab-bill">₩ ${v.unit.toLocaleString('ko-KR')}</span>`).join('')}</div><small>${n}${unit}</small></div>`).join('<span class="lab-visual-sign">+</span>')}</div>`;
 }
 if(v.kind==='groups')return `<div class="lab-visual lab-groups" role="img" aria-label="${v.size}개씩 ${v.groups}묶음">${Array.from({length:v.groups},()=>`<div class="lab-equal-group">${Array.from({length:v.size},()=>'<i aria-hidden="true"></i>').join('')}</div>`).join('')}<small>한 묶음에 ${v.size}개</small></div>`;
 if(v.kind==='sequence')return `<div class="lab-visual lab-sequence" role="img" aria-label="수 규칙 ${e(v.items.map(n=>n??'빈칸').join(', '))}">${v.items.map(n=>`<span class="${n===null?'lab-unknown':''}">${n??'?'}</span>`).join('<b aria-hidden="true">→</b>')}</div>`;
 if(v.kind==='bar')return `<div class="lab-visual lab-bar" role="img" aria-label="${e(v.labels.join(', '))}, 부분 ${e(v.parts.map(n=>n??'빈칸').join(', '))}, 전체 ${v.total??'빈칸'}"><div>${v.parts.map((n,i)=>`<span><small>${e(v.labels[i]??'부분')}</small><b>${n??'?'}</b></span>`).join('')}</div><strong>전체 ${v.total??'?'}</strong></div>`;
 return `<div class="lab-visual lab-place-values">${v.values.map(value=>`<div class="lab-place-number" role="img" aria-label="${value}, 십 ${Math.floor(value/10)}개 일 ${value%10}개"><div class="lab-rods">${Array.from({length:Math.floor(value/10)},()=>`<span class="lab-ten">${'<i></i>'.repeat(10)}</span>`).join('')}</div><div class="lab-units">${'<i></i>'.repeat(value%10)}</div><strong>${value}</strong></div>`).join('<span class="lab-visual-sign">·</span>')}</div>`;
}
