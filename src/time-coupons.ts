import {couponTime,rewardDuration,type Coupon,type Reward} from '../supabase/functions/_shared/domain.ts';

const escape=(value:unknown)=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const date=(value:string)=>new Intl.DateTimeFormat('ko-KR',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit',timeZone:'Asia/Seoul'}).format(new Date(value));

/** Keep the version the person actually saw, even when a background refresh replaces the snapshot. */
export function couponVersionAttribute(coupon:Coupon):string{
  const time=couponTime(coupon);
  return time?` data-usage-version="${time.usageVersion}"`:'';
}

export function minutePresets(max:number):string{
  const choices=[...new Set([5,10,15,30,max].filter(value=>value<=max))].sort((a,b)=>a-b);
  return `<div class="minute-presets" aria-label="시간 빠르게 선택">${choices.map(value=>`<button type="button" class="button outline small-btn" data-action="set-coupon-minutes" data-minutes="${value}">${value===max?'모두 ':''}${value}분</button>`).join('')}</div>`;
}

export function rewardTimeFields(reward?:Reward):string{
  const duration=reward?rewardDuration(reward):null;
  return `<fieldset class="time-reward-fields" data-duration-manual="${reward?.durationMinutes!==undefined}"><legend>쿠폰 사용 방식</legend><label class="check-label"><input type="checkbox" name="timeCoupon" ${duration!==null?'checked':''}> 시간을 나눠 쓰는 쿠폰</label><label class="time-duration-field" ${duration===null?'hidden':''}>한 장의 기본 이용 시간 (분)<input name="durationMinutes" type="number" min="1" max="1440" step="1" value="${duration??30}" ${duration===null?'disabled':''} required></label><p class="small subtle" data-duration-hint>${duration===null?'이름에 ‘30분’, ‘1시간’처럼 시간을 적으면 자동으로 알아봐요.':'필요한 시간만 나눠 지급하고 사용할 수 있어요.'}</p></fieldset>`;
}

export function grantTimeFields(reward:Reward):string{
  const duration=rewardDuration(reward);
  if(duration===null)return '';
  return `<div class="time-grant-fields"><label>한 장당 지급할 시간 (분)<input name="minutes" type="number" min="1" max="${duration}" step="1" value="${duration}" required></label>${minutePresets(duration)}<p class="minute-summary" data-minute-summary aria-live="polite">${duration}분 × 1장 · 총 ${duration}분 지급</p>${reward.stock!==null?'<p class="small subtle">짧게 나눠 지급해도 쿠폰 한 장당 재고 1개를 사용해요.</p>':''}</div>`;
}

export function timeRequestForm(coupon:Coupon):string{
  const time=couponTime(coupon);
  if(!time||time.remainingMinutes<1)return '';
  const selected=Math.min(10,time.remainingMinutes);
  return `<form id="coupon-minutes-form" data-id="${escape(coupon.id)}"${couponVersionAttribute(coupon)} data-remaining-minutes="${time.remainingMinutes}"><div class="dialog-heading"><h2>얼마나 사용할까요?</h2><p>${escape(coupon.title)}</p></div><div class="time-request-balance">지금 남은 시간 <strong>${time.remainingMinutes}분</strong></div><label>사용할 시간 (분)<input name="minutes" type="number" min="1" max="${time.remainingMinutes}" step="1" value="${selected}" required autofocus></label>${minutePresets(time.remainingMinutes)}<p class="minute-summary" data-minute-summary aria-live="polite">${selected}분 사용 완료 후 ${time.remainingMinutes-selected}분이 남아요.</p><p class="small subtle">보호자가 승인하고 사용 완료를 눌렀을 때만 시간이 줄어요.</p><button class="button primary full" type="submit">이 시간으로 사용 요청</button></form>`;
}

export function couponTimeDetails(coupon:Coupon):string{
  const time=couponTime(coupon);
  if(!time)return '';
  const requested=time.requestedMinutes;
  const used=coupon.status==='revoked'?time.usageHistory.reduce((sum,item)=>sum+item.minutes,0):time.totalMinutes-time.remainingMinutes;
  return `<div class="coupon-time-details"><div class="coupon-time-balance"><strong>남은 ${time.remainingMinutes}분</strong><span>받은 ${time.totalMinutes}분${used>0?` · 사용한 ${used}분`:''}</span></div>${requested!==null?`<p class="coupon-time-pending">${requested}분 ${coupon.status==='requested'?'사용 요청':'사용 승인'} · 완료 후 ${time.remainingMinutes-requested}분 남음</p>`:''}${time.usageHistory.length?`<details class="coupon-use-history"><summary>시간 사용 내역 (${time.usageHistory.length}회)</summary><ul>${[...time.usageHistory].reverse().map(item=>`<li><strong>${item.minutes}분 사용</strong><span>${escape(date(item.usedAt))} · ${escape(item.actorName)} 확인</span></li>`).join('')}</ul></details>`:''}</div>`;
}
