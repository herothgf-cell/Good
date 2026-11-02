import {dayKey,praiseDateFor,type Praise} from '../supabase/functions/_shared/domain.ts';
export function praiseDayLabel(day:string):string {
 const [year,month,date]=day.split('-').map(Number);
 return `${year}년 ${month}월 ${date}일`;
}
export function praiseDateLabel(praise:Praise):string{return praiseDayLabel(praiseDateFor(praise));}
export function praiseDateFields(now=new Date().toISOString()):string {
 const today=dayKey(now);
 return `<fieldset class="praise-date-fields"><legend>칭찬일자</legend><label>언제 한 행동인가요?<input type="date" name="praiseDate" value="${today}" max="${today}" required></label><div class="praise-date-shortcuts"><button type="button" class="button outline" data-action="praise-date-today">오늘</button><button type="button" class="button outline" data-action="praise-date-yesterday">어제</button></div><small>어제 한 일을 오늘 칭찬해도 괜찮아요. 실제 발송 시각과 별 지급 시각은 따로 남아요.</small></fieldset>`;
}
