/** Pure, shared business rules. No database, UI, clock, or global randomness. */
export type Role = 'admin' | 'giver' | 'child';
export interface Actor { id: string; name: string; role: Role }
export interface Reward {
  id: string; title: string; description: string; icon: string;
  cost: number; stock: number | null; active: boolean; shop: boolean; gacha: boolean; version: number;
}
export interface Box { title: string; cost: number; dailyLimit: number; version: number; items: { rewardId: string; weight: number }[] }
export interface Praise { id: string; actorId: string; actorName: string; stars: number; category: string; reason: string; createdAt: string; reversed: boolean; ruleId?: string }
export interface Ledger { id: string; kind: 'praise' | 'reversal' | 'purchase' | 'draw' | 'grant' | 'gift' | 'revoke'; delta: number; balance: number; reason: string; actorId: string; actorName: string; createdAt: string; refId: string }
export type CouponStatus = 'available' | 'requested' | 'approved' | 'used' | 'revoked';
export interface Coupon { id: string; rewardId: string; title: string; description: string; icon: string; source: 'shop' | 'draw' | 'gift'; grantedById?: string; grantedByName?: string; grantReason?: string; stockConsumed?: boolean; status: CouponStatus; createdAt: string; requestedAt?: string; approvedAt?: string; usedAt?: string; note?: string; revokedAt?: string; revokedBy?: string; revokeReason?: string }
export interface Draw { id: string; cost: number; couponId: string; rewardId: string; boxTitle: string; day: string; createdAt: string; odds: { rewardId: string; title: string; probability: number }[] }
export interface PraiseRule {id:string;title:string;description:string;icon:string;stars:number;dailyLimit:number;active:boolean;featured:boolean;version:number}
export interface State {
  schema: 1; familyName: string; childName: string; balance: number; lifetimeEarned: number; goalRewardId: string | null;
  praiseRules?: PraiseRule[]; readPraiseIds?: string[];
  rewards: Reward[]; box: Box; praises: Praise[]; ledger: Ledger[]; inventory: Coupon[]; draws: Draw[];
}
export type Action =
  | {type:'rule/save';rule:Omit<PraiseRule,'version'>&{version?:number}}
  | {type:'praise/rule';ruleId:string;version:number}
  | {type:'letters/read';ids:string[]}
  | {type:'stars/reverse'|'coupon/revoke';id:string;reason:string}
  | {type: 'stars/grant'; stars: number; reason: string}
  | {type: 'reward/grant'; rewardId: string; version: number; reason: string; quantity?: number}
  | {type: 'praise/give'; stars: number; category: string; reason: string}
  | {type: 'praise/reverse'; id: string; reason: string}
  | {type: 'reward/save'; reward: Omit<Reward, 'version'> & {version?: number}}
  | {type: 'box/save'; box: Omit<Box, 'version'>}
  | {type: 'spend/shop'; rewardId: string; version: number}
  | {type: 'spend/draw'; quote: string}
  | {type: 'coupon/request' | 'coupon/cancel' | 'coupon/approve' | 'coupon/reject' | 'coupon/use'; id: string; note?: string}
  | {type: 'goal/set'; rewardId: string}
  | {type: 'profile/save'; familyName: string; childName: string};
export interface Context { actor: Actor; now: string; newId: () => string; random: () => number }
export interface Result { message: string; coupon?: Coupon; praiseId?: string }
export interface Transition { state: State; result: Result }
export class DomainError extends Error {
  constructor(public code: string, message: string) { super(message); this.name = 'DomainError'; }
}
function fail(code: string, message: string): never { throw new DomainError(code, message); }
function text(value: unknown, label: string, max: number, optional = false): string {
  if (typeof value !== 'string' || (!optional && !value.trim()) || value.trim().length > max)
    fail('INVALID_INPUT', `${label}을(를) ${max}자 이내로 입력해 주세요.`);
  return value.trim();
}
function integer(value: unknown, min: number, max: number, message: string): asserts value is number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min || value > max) fail('INVALID_INPUT', message);
}
function allow(actor: Actor, roles: Role[]) {
  if (!actor || !roles.includes(actor.role)) fail('FORBIDDEN', '이 작업을 할 권한이 없어요. 보호자에게 요청해 주세요.');
}
export function dayKey(time: string): string {
  const ms = new Date(time).getTime();
  if (!Number.isFinite(ms)) fail('INVALID_TIME', '날짜를 확인해 주세요.');
  return new Date(ms + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}
export function poolFor(state: State) {
  const items = state.box.items.flatMap(item => {
    const reward = state.rewards.find(r => r.id === item.rewardId);
    return reward && reward.active && reward.gacha && (reward.stock === null || reward.stock > 0) && item.weight > 0 ? [{reward, weight: item.weight}] : [];
  });
  const total = items.reduce((n, i) => n + i.weight, 0);
  return items.map(i => ({...i, probability: i.weight / total * 100}));
}
/** Quote changes when the displayed effective pool or configured terms change. */
export function drawQuote(state: State): string {
  return JSON.stringify({version: state.box.version, cost: state.box.cost, dailyLimit: state.box.dailyLimit,
    pool: poolFor(state).map(i => [i.reward.id, i.reward.version, i.weight])});
}
export function drawsToday(state: State, now = new Date().toISOString()): number { return state.draws.filter(d => d.day === dayKey(now)).length; }
export function validateReward(r: unknown, existing?: Reward): Reward {
  if (!r || typeof r !== 'object') fail('INVALID_INPUT', '보상 정보를 확인해 주세요.');
  const x = r as Reward;
  integer(x.cost, 1, 10000, '가격은 1~10,000 사이의 정수여야 해요.');
  if (x.stock !== null) integer(x.stock, 0, 100000, '재고는 0 이상의 정수 또는 무제한이어야 해요.');
  for (const field of ['active','shop','gacha'] as const) if (typeof x[field] !== 'boolean') fail('INVALID_INPUT', '보상 공개 설정을 확인해 주세요.');
  return {id: text(x.id,'보상 ID',80),title:text(x.title,'보상 이름',60),description:text(x.description,'보상 설명',240,true),
    icon:text(x.icon,'아이콘',12),cost:x.cost,stock:x.stock,active:x.active,shop:x.shop,gacha:x.gacha,version:existing ? existing.version + 1 : 1};
}
function appendLedger(s: State, ctx: Context, kind: Ledger['kind'], delta: number, reason: string, refId: string) {
  const balance = s.balance + delta;
  if (balance < 0) fail('INSUFFICIENT_STARS', '별이 부족해요. 칭찬 별을 조금 더 모아 주세요.');
  if (!Number.isSafeInteger(balance) || balance > 10000000) fail('LIMIT', '별 보유 한도를 초과했어요.');
  s.balance = balance;
  s.ledger.push({id:ctx.newId(),kind,delta,balance,reason,actorId:ctx.actor.id,actorName:ctx.actor.name,createdAt:ctx.now,refId});
}
function acquire(s: State, reward: Reward, source: Coupon['source'], cost: number, ctx: Context): Coupon {
  if (reward.stock !== null && reward.stock < 1) fail('SOLD_OUT', '보상 재고가 없어요. 다른 선물을 골라 주세요.');
  if (s.balance < cost) fail('INSUFFICIENT_STARS', '별이 부족해요. 칭찬 별을 조금 더 모아 주세요.');
  const coupon: Coupon = {id:ctx.newId(),rewardId:reward.id,title:reward.title,description:reward.description,icon:reward.icon,source,stockConsumed:reward.stock!==null,status:'available',createdAt:ctx.now};
  appendLedger(s,ctx,source === 'gift' ? 'gift' : source === 'shop' ? 'purchase' : 'draw',cost===0?0:-cost,source === 'gift' ? `${reward.title} 보호자 직접 지급` : source === 'shop' ? `${reward.title} 교환` : `${s.box.title} 뽑기`,coupon.id);
  if (reward.stock !== null) { reward.stock--; reward.version++; }
  s.inventory.push(coupon);
  return coupon;
}
/** Accepts untrusted JSON; every used property is validated inside the switch. */
export function applyAction(original: State, input: unknown, ctx: Context): Transition {
  if (!input || typeof input !== 'object' || !('type' in input)) fail('INVALID_INPUT','올바른 명령이 아니에요.');
  if (original.schema !== 1) fail('SCHEMA','앱 업데이트가 필요해요.');
  const s = structuredClone(original);
  const action = input as Action;
  let result: Result;
  dayKey(ctx.now);
  switch (action.type) {
    case 'rule/save': {
      allow(ctx.actor,['admin']);
      if(!action.rule||typeof action.rule!=='object')fail('INVALID_INPUT','칭찬 행동을 확인해 주세요.');
      const incoming=action.rule;
      const rules=structuredClone(rulesFor(s));
      const id=text(incoming.id,'행동 ID',80);
      const index=rules.findIndex(r=>r.id===id);
      if(index<0&&rules.length>=30)fail('LIMIT','칭찬 행동은 최대 30개까지 등록해 주세요.');
      if(index>=0&&incoming.version!==rules[index]!.version)fail('QUOTE_CHANGED','행동 설정이 바뀌었어요. 다시 열어 주세요.');
      integer(incoming.stars,1,3,'칭찬 별은 1~3개의 정수로 정해 주세요.');
      integer(incoming.dailyLimit,1,10,'하루 횟수는 1~10회의 정수로 정해 주세요.');
      if(typeof incoming.active!=='boolean'||typeof incoming.featured!=='boolean')fail('INVALID_INPUT','공개 설정을 확인해 주세요.');
      const rule: PraiseRule={id,title:text(incoming.title,'행동 이름',60),description:text(incoming.description,'행동 설명',180,true),icon:text(incoming.icon,'아이콘',12),stars:incoming.stars,dailyLimit:incoming.dailyLimit,active:incoming.active,featured:incoming.featured,version:index<0?1:rules[index]!.version+1};
      if(index<0)rules.push(rule);else rules[index]=rule;
      s.praiseRules=rules;result={message:'별 받는 행동을 저장했어요.'};break;
    }
    case 'praise/rule': {
      allow(ctx.actor,['admin','giver']);
      const rule=rulesFor(s).find(r=>r.id===action.ruleId&&r.active);
      if(!rule)fail('NOT_FOUND','현재 사용할 수 없는 칭찬 행동이에요.');
      if(rule.version!==action.version)fail('QUOTE_CHANGED','행동 설정이 바뀌었어요. 다시 확인해 주세요.');
      if(ruleGivesToday(s,rule.id,ctx.now)>=rule.dailyLimit)fail('DAILY_LIMIT','이 행동은 오늘 정한 만큼 칭찬했어요. 다른 노력을 칭찬해 주세요.');
      const praise:Praise={id:ctx.newId(),actorId:ctx.actor.id,actorName:ctx.actor.name,stars:rule.stars,category:'우리 약속',reason:rule.title,createdAt:ctx.now,reversed:false,ruleId:rule.id};
      appendLedger(s,ctx,'praise',rule.stars,rule.title,praise.id);
      s.praises.push(praise);s.lifetimeEarned+=rule.stars;
      result={message:`칭찬 별 ${rule.stars}개와 편지를 보냈어요!`,praiseId:praise.id};break;
    }
    case 'letters/read': {
      allow(ctx.actor,['child']);
      if(!Array.isArray(action.ids)||action.ids.length<1||action.ids.length>100)fail('INVALID_INPUT','읽은 편지를 1~100개 골라 주세요.');
      const ids=[...new Set(action.ids.map(id=>text(id,'편지 ID',80)))];
      if(ids.some(id=>!s.praises.some(p=>p.id===id)))fail('NOT_FOUND','편지를 찾지 못했어요.');
      s.readPraiseIds=[...new Set([...(s.readPraiseIds??[]),...ids])];
      result={message:'편지를 읽었어요. 다른 기기에도 반영돼요.'};break;
    }
    case 'stars/reverse': {
      allow(ctx.actor,['admin']);
      const reason=text(action.reason,'정정 사유',180);
      const grant=s.ledger.find(l=>l.id===action.id&&l.kind==='grant'&&l.delta>0);
      if(!grant)fail('NOT_FOUND','직접 지급한 별 내역을 선택해 주세요.');
      if(s.ledger.some(l=>l.kind==='reversal'&&l.refId===grant.id))fail('ALREADY_REVERSED','이미 정정한 지급이에요.');
      if(s.balance<grant.delta)fail('INSUFFICIENT_STARS','이미 사용한 별은 정정으로 회수할 수 없어요.');
      appendLedger(s,ctx,'reversal',-grant.delta,`별 지급 오류 정정: ${reason}`,grant.id);
      s.lifetimeEarned-=grant.delta;
      result={message:'별 지급 정정 내역을 남겼어요. 원래 기록은 보존돼요.'};break;
    }
    case 'coupon/revoke': {
      allow(ctx.actor,['admin']);
      const reason=text(action.reason,'회수 사유',180);
      const coupon=s.inventory.find(c=>c.id===action.id);
      if(!coupon||coupon.source!=='gift')fail('NOT_FOUND','직접 지급한 선물만 회수할 수 있어요.');
      if(coupon.status!=='available')fail('INVALID_STATE','아직 사용 요청하지 않은 선물만 회수할 수 있어요.');
      coupon.status='revoked';coupon.revokedAt=ctx.now;coupon.revokedBy=ctx.actor.name;coupon.revokeReason=reason;
      const reward=s.rewards.find(r=>r.id===coupon.rewardId);
      if(reward&&reward.stock!==null&&coupon.stockConsumed===true){if(reward.stock>=100000)fail('LIMIT','재고 한도를 확인해 주세요.');reward.stock++;reward.version++;}
      appendLedger(s,ctx,'revoke',0,`선물 지급 취소: ${coupon.title} · ${reason}`,coupon.id);
      result={message:'미사용 선물을 회수하고 취소 기록을 남겼어요.'};break;
    }
    case 'stars/grant': {
      allow(ctx.actor,['admin']);
      integer(action.stars,1,10000,'직접 지급할 별은 1~10,000개의 정수로 입력해 주세요.');
      const reason=text(action.reason,'지급 사유',180);
      appendLedger(s,ctx,'grant',action.stars,`보호자 별 지급: ${reason}`,ctx.newId());
      s.lifetimeEarned+=action.stars;
      result={message:`별 ${action.stars}개를 직접 지급했어요.`};break;
    }
    case 'reward/grant': {
      allow(ctx.actor,['admin']);
      const quantity=action.quantity??1;
      integer(quantity,1,20,'선물 지급 수량은 1~20개의 정수로 입력해 주세요.');
      const reason=text(action.reason,'지급 사유',180);
      const reward=s.rewards.find(r=>r.id===action.rewardId&&r.active);
      if(!reward)fail('NOT_FOUND','공개 중인 보상을 선택해 주세요.');
      if(action.version!==reward.version)fail('QUOTE_CHANGED','보상 설정이나 재고가 바뀌었어요. 최신 내용을 확인해 주세요.');
      if(reward.stock!==null&&reward.stock<quantity)fail('SOLD_OUT','선물 재고가 부족해요.');
      let first:Coupon|undefined;
      for(let i=0;i<quantity;i++){
        const coupon=acquire(s,reward,'gift',0,ctx);
        coupon.grantedById=ctx.actor.id;coupon.grantedByName=ctx.actor.name;coupon.grantReason=reason;
        s.ledger[s.ledger.length-1]!.reason='보호자 선물: '+reward.title+' · '+reason;
        first??=coupon;
      }
      result={message:'별 차감 없이 '+quantity+'장의 선물을 지급했어요!',coupon:quantity===1?first:undefined};break;
    }
    case 'praise/give': {
      allow(ctx.actor,['admin','giver']);
      integer(action.stars,1,3,'칭찬 별은 1~3개의 정수로 골라 주세요.');
      const reason = text(action.reason,'칭찬 내용',180);
      const praise: Praise = {id:ctx.newId(),actorId:ctx.actor.id,actorName:ctx.actor.name,stars:action.stars,category:text(action.category,'칭찬 종류',20),reason,createdAt:ctx.now,reversed:false};
      appendLedger(s,ctx,'praise',action.stars,reason,praise.id);
      s.praises.push(praise); s.lifetimeEarned += action.stars;
      result = {message:`칭찬 별 ${action.stars}개를 붙여줬어요!`,praiseId:praise.id}; break;
    }
    case 'praise/reverse': {
      allow(ctx.actor,['admin']); const p=s.praises.find(p=>p.id===action.id);
      if (!p) fail('NOT_FOUND','칭찬 기록을 찾지 못했어요.');
      if (p.reversed) fail('ALREADY_REVERSED','이미 정정된 칭찬이에요.');
      if (s.balance < p.stars) fail('INSUFFICIENT_STARS','이미 사용한 별은 정정으로 회수할 수 없어요.');
      const reason=text(action.reason,'정정 사유',180);
      appendLedger(s,ctx,'reversal',-p.stars,`입력 오류 정정: ${reason}`,p.id);
      p.reversed=true; s.lifetimeEarned-=p.stars;
      result={message:'오류 정정 내역을 남겼어요. 원래 기록은 보존돼요.'}; break;
    }
    case 'reward/save': {
      allow(ctx.actor,['admin']);
      if (!action.reward || typeof action.reward !== 'object') fail('INVALID_INPUT','보상 정보를 확인해 주세요.');
      const index=s.rewards.findIndex(r=>r.id===action.reward.id);
      if (index < 0 && s.rewards.length >= 100) fail('LIMIT','보상은 최대 100개까지 등록할 수 있어요.');
      if (index >= 0 && action.reward.version !== s.rewards[index]!.version) fail('QUOTE_CHANGED','보상 설정이나 재고가 바뀌었어요. 최신 내용을 확인해 주세요.');
      const reward=validateReward(action.reward,index<0?undefined:s.rewards[index]);
      if(index<0)s.rewards.push(reward);else s.rewards[index]=reward;
      result={message:'보상 설정을 저장했어요.'}; break;
    }
    case 'box/save': {
      allow(ctx.actor,['admin']); const b=action.box;
      if (!b || typeof b !== 'object') fail('INVALID_INPUT','상자 설정을 확인해 주세요.');
      integer(b.cost,1,10000,'뽑기 비용은 1~10,000개의 정수여야 해요.');
      integer(b.dailyLimit,1,10,'하루 뽑기 횟수는 1~10회로 설정해 주세요.');
      if (!Array.isArray(b.items) || b.items.length<1 || b.items.length>20) fail('INVALID_INPUT','보상은 1~20개 선택해 주세요.');
      const seen=new Set<string>();
      const items=b.items.map(i=>{
        if(!i || typeof i!=='object')fail('INVALID_INPUT','확률 항목을 확인해 주세요.');
        const id=text(i.rewardId,'보상 ID',80);
        if(seen.has(id)) fail('INVALID_INPUT','중복 보상이 있어요.'); seen.add(id);
        integer(i.weight,1,100,'확률은 1~100의 정수로 입력해 주세요.');
        const r=s.rewards.find(r=>r.id===id);
        if(!r || !r.gacha)fail('INVALID_INPUT','뽑기에 사용할 수 있는 보상을 골라 주세요.');
        return {rewardId:id,weight:i.weight};
      });
      if(items.reduce((n,i)=>n+i.weight,0)!==100) fail('INVALID_INPUT','확률 합계가 100%가 되어야 해요.');
      s.box={title:text(b.title,'상자 이름',60),cost:b.cost,dailyLimit:b.dailyLimit,items,version:s.box.version+1};
      result={message:'뽑기 설정을 저장했어요.'}; break;
    }
    case 'spend/shop': {
      allow(ctx.actor,['child']);
      const r=s.rewards.find(r=>r.id===action.rewardId);
      if(!r || !r.active || !r.shop)fail('NOT_FOUND','지금 교환할 수 없는 보상이에요.');
      if(action.version!==r.version)fail('QUOTE_CHANGED','보상 설정이 바뀌었어요. 다시 확인해 주세요.');
      const coupon=acquire(s,r,'shop',r.cost,ctx);
      result={message:`${r.title}을(를) 보관함에 넣었어요!`,coupon}; break;
    }
    case 'spend/draw': {
      allow(ctx.actor,['child']);
      const pool=poolFor(s);
      if(!pool.length)fail('EMPTY_POOL','지금 뽑을 수 있는 보상이 없어요. 보호자에게 알려 주세요.');
      if(action.quote!==drawQuote(s))fail('QUOTE_CHANGED','보상 목록이나 확률이 바뀌었어요. 확인 후 다시 뽑아 주세요.');
      if(drawsToday(s,ctx.now)>=s.box.dailyLimit)fail('DAILY_LIMIT','오늘 뽑기는 모두 했어요. 남은 별은 모아 두어요!');
      const random=ctx.random();
      if(!Number.isFinite(random)||random<0||random>=1)fail('RANDOM','추첨을 완료하지 못했어요. 별은 차감하지 않았어요.');
      const total=pool.reduce((n,i)=>n+i.weight,0);
      let remaining=random*total; let selected=pool[pool.length-1]!;
      for(const item of pool){if(remaining<item.weight){selected=item;break;}remaining-=item.weight;}
      const coupon=acquire(s,selected.reward,'draw',s.box.cost,ctx);
      s.draws.push({id:ctx.newId(),cost:s.box.cost,couponId:coupon.id,rewardId:selected.reward.id,boxTitle:s.box.title,day:dayKey(ctx.now),createdAt:ctx.now,
        odds:pool.map(i=>({rewardId:i.reward.id,title:i.reward.title,probability:i.probability}))});
      result={message:'선물이 도착했어요!',coupon}; break;
    }
    case 'coupon/request': case 'coupon/cancel': case 'coupon/approve': case 'coupon/reject': case 'coupon/use': {
      const adminAction=['coupon/approve','coupon/reject','coupon/use'].includes(action.type);
      allow(ctx.actor,adminAction?['admin']:['child']);
      const c=s.inventory.find(c=>c.id===action.id);
      if(!c)fail('NOT_FOUND','보상 쿠폰을 찾지 못했어요.');
      const expected: Record<string,CouponStatus>={'coupon/request':'available','coupon/cancel':'requested','coupon/approve':'requested','coupon/reject':'requested','coupon/use':'approved'};
      if(c.status!==expected[action.type])fail('INVALID_STATE','쿠폰 상태가 바뀌었어요. 새로 확인해 주세요.');
      if(action.type==='coupon/request'){c.status='requested';c.requestedAt=ctx.now;c.note=undefined;result={message:'보호자에게 사용을 요청했어요.'};}
      else if(action.type==='coupon/cancel'){c.status='available';c.requestedAt=undefined;result={message:'사용 요청을 취소했어요.'};}
      else if(action.type==='coupon/approve'){c.status='approved';c.approvedAt=ctx.now;result={message:'사용을 승인했어요. 선물을 준 뒤 사용 완료를 눌러 주세요.'};}
      else if(action.type==='coupon/reject'){c.status='available';c.note=text(action.note??'지금은 어렵지만 다음에 사용해요.','안내',180);c.requestedAt=undefined;result={message:'쿠폰을 보관함으로 돌려보냈어요. 다시 요청할 수 있어요.'};}
      else {c.status='used';c.usedAt=ctx.now;result={message:'선물 전달을 완료했어요!'};}
      break;
    }
    case 'goal/set': {
      allow(ctx.actor,['child']);
      const r=s.rewards.find(r=>r.id===action.rewardId && r.active && r.shop);
      if(!r)fail('NOT_FOUND','목표로 정할 보상을 찾지 못했어요.');
      s.goalRewardId=r.id; result={message:'모으고 싶은 선물을 골랐어요!'};break;
    }
    case 'profile/save': {
      allow(ctx.actor,['admin']);s.familyName=text(action.familyName,'가족 이름',40);s.childName=text(action.childName,'아이 별명',20);
      result={message:'가족 이름을 저장했어요.'};break;
    }
    default: fail('UNKNOWN_ACTION','알 수 없는 명령이에요.');
  }
  if (s.balance !== s.ledger.reduce((n,l)=>n+l.delta,0)) fail('INVARIANT','별 기록이 일치하지 않아요. 보호자에게 알려 주세요.');
  return {state:s,result};
}
export function emptyState(familyName='우리 가족',childName='연준이'): State {
  return {schema:1,familyName,childName,balance:0,lifetimeEarned:0,goalRewardId:null,rewards:[],
    box:{title:'반짝 선물 상자',cost:5,dailyLimit:3,version:1,items:[]},praises:[],ledger:[],inventory:[],draws:[]};
}
export function exampleRewards(): Reward[] {
  return [
    ['r-play','놀이 선택권','오늘 함께할 놀이를 골라요.','🎲',5,null],
    ['r-book','잠자리 책 한 권 더','좋아하는 책을 함께 읽어요.','📚',10,null],
    ['r-soccer','아빠와 축구 놀이','날씨 좋은 날, 함께 공을 차요.','⚽',15,null],
    ['r-meal','저녁 메뉴 선택권','가족이 함께 먹을 메뉴를 골라요.','🍝',20,null],
    ['r-movie','가족 영화 선택권','가족 영화의 주인공은 나!','🎬',30,null],
    ['r-trip','특별한 체험 나들이','가족과 상의해서 체험을 정해요.','🎡',50,1],
  ].map(([id,title,description,icon,cost,stock])=>({id:id as string,title:title as string,description:description as string,icon:icon as string,cost:cost as number,stock:stock as number|null,active:true,shop:true,gacha:true,version:1}));
}
export function demoState(now=new Date().toISOString()): State {
  let s=emptyState();s.rewards=exampleRewards();s.goalRewardId='r-movie';
  s.box.items=[{rewardId:'r-play',weight:60},{rewardId:'r-book',weight:25},{rewardId:'r-soccer',weight:10},{rewardId:'r-movie',weight:5}];
  const reasons=[['스스로','스스로 양치하고 정리했어요','엄마'],['도전','어려운 문제도 다시 도전했어요','아빠'],['배려','친구의 이야기를 끝까지 들었어요','엄마'],['노력','축구 연습에 즐겁게 참여했어요','아빠'],['스스로','놀고 난 장난감을 정리했어요','엄마'],['배려','가족에게 따뜻하게 인사했어요','할머니'],['도전','처음 하는 일에 용기를 냈어요','아빠'],['노력','포기하지 않고 끝까지 해 봤어요','엄마'],['배려','가족을 도와주었어요','아빠'],['스스로','외출 준비를 스스로 했어요','엄마']];
  reasons.forEach((r,i)=>{const when=new Date(new Date(now).getTime()-(reasons.length-1-i)*5*3600000).toISOString();
    s=applyAction(s,{type:'praise/give',stars:i===0?1:3,category:r[0],reason:r[1]}, {actor:{id:r[2]==='아빠'?'dad':r[2]==='엄마'?'mom':'grandma',name:r[2]!,role:'admin'},now:when,newId:()=>crypto.randomUUID(),random:()=>0}).state;
  });
  s=applyAction(s,{type:'spend/shop',rewardId:'r-play',version:1},{actor:{id:'child',name:'연준이',role:'child'},now,newId:()=>crypto.randomUUID(),random:()=>0}).state;
  return s; // 28 earned - 5 exchanged = 23 stars.
}

/** Legacy families use these editable defaults without any balance/data migration. */
export function defaultPraiseRules():PraiseRule[]{return [
  ['tidy','🧸','장난감 정리하기','놀고 난 장난감을 제자리에 넣어요.'],
  ['ready','🪥','스스로 준비하기','양치하거나 준비물을 챙겨요.'],
  ['try','📚','끝까지 도전하기','어려워도 한 번 더 해 봐요.'],
  ['kind','💗','따뜻하게 말하기','가족과 친구에게 친절하게 말해요.'],
  ['share','🤝','함께 배려하기','차례를 기다리거나 함께 나눠요.'],
  ['practice','⚽','즐겁게 연습하기','운동이나 새로운 활동에 도전해요.']
].map(([id,icon,title,description],i)=>({id:'rule-'+id,icon:icon!,title:title!,description:description!,stars:1,dailyLimit:1,active:true,featured:i<3,version:1}));}
export function rulesFor(s:State):PraiseRule[]{return s.praiseRules??defaultPraiseRules();}
export function ruleGivesToday(s:State,id:string,now:string):number{return s.praises.filter(p=>!p.reversed&&p.ruleId===id&&dayKey(p.createdAt)===dayKey(now)).length;}
export function unreadPraises(s:State):Praise[]{const read=new Set(s.readPraiseIds??[]);return s.praises.filter(p=>!p.reversed&&!read.has(p.id));}
