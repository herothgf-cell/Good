import {dayKey} from '../supabase/functions/_shared/domain.ts';
export function praiseDateLabel(value:string):string {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return '날짜를 선택해 주세요';
  const date=new Date(value+'T00:00:00Z');
  if(!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==value)return '날짜를 확인해 주세요';
  return new Intl.DateTimeFormat('ko-KR',{year:'numeric',month:'long',day:'numeric',timeZone:'UTC'}).format(date);
}
export function praiseDateFields(now=new Date().toISOString()):string {
  const today=dayKey(now);
  return `<fieldset class="praise-date-fields"><legend>칭찬일자 · 행동한 날</legend><label>언제 있었던 일인가요?<input type="date" name="praiseDate" value="${today}" max="${today}" required aria-label="칭찬일자"></label><div class="praise-date-shortcuts"><button type="button" class="button outline" data-action="set-praise-date" data-day="today">오늘</button><button type="button" class="button outline" data-action="set-praise-date" data-day="yesterday">어제</button></div><p class="small subtle">어제 했던 일도 오늘 칭찬할 수 있어요. 별은 편지를 보내는 지금 지급돼요.</p></fieldset>`;
}
export function praiseDayBefore(now=new Date().toISOString()):string {
  const today=dayKey(now);return new Date(new Date(today+'T00:00:00Z').getTime()-86400000).toISOString().slice(0,10);
}
