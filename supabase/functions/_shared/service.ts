import {applyAction, DomainError, type Actor, type State, type Result} from './domain.ts';
export interface Command { familyId: string; requestId: string; action: unknown }
export interface Receipt { actorId: string; payload: unknown; result: Result }
export interface Loaded {state: State; revision: number; actor: Actor}
export interface Committed { state: State; revision: number; result: Result }
export interface CommitData extends Command {actorId:string;actorRole:Actor['role'];revision:number;state:State;result:Result}
export interface CommandStore {
  load(familyId:string,userId:string):Promise<Loaded>;
  receipt(familyId:string,requestId:string):Promise<Receipt|null>;
  commit(data:CommitData):Promise<Committed|{conflict:true}>;
}
export interface Sources { now:()=>string; newId:()=>string; random:()=>number }
export function canonical(value: unknown): string {
  if(Array.isArray(value))return `[${value.map(canonical).join(',')}]`;
  if(value && typeof value==='object')return `{${Object.keys(value).sort().map(k=>`${JSON.stringify(k)}:${canonical((value as Record<string,unknown>)[k])}`).join(',')}}`;
  return JSON.stringify(value);
}
export function isUUID(value:unknown):value is string {return typeof value==='string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);}
export async function processCommand(input:unknown,userId:string,store:CommandStore,sources:Sources):Promise<Committed> {
  const c=input as Command;
  if(!c || !isUUID(c.familyId)||!isUUID(c.requestId)||!c.action||JSON.stringify(c.action).length>16000)
    throw new DomainError('INVALID_INPUT','올바른 요청 정보가 아니에요.');
  for(let attempt=0;attempt<4;attempt++) {
    const current=await store.load(c.familyId,userId); // Membership comes from the database, never from input.
    const receipt=await store.receipt(c.familyId,c.requestId);
    if(receipt) {
      if(receipt.actorId!==userId || canonical(receipt.payload)!==canonical(c.action))
        throw new DomainError('IDEMPOTENCY','같은 요청 번호로 다른 작업을 보낼 수 없어요.');
      return {state:current.state,revision:current.revision,result:receipt.result};
    }
    const next=applyAction(current.state,c.action,{actor:current.actor,now:sources.now(),newId:sources.newId,random:sources.random});
    const result=await store.commit({...c,actorId:userId,actorRole:current.actor.role,revision:current.revision,...next});
    if(!('conflict' in result))return result;
  }
  throw new DomainError('CONFLICT','가족이 동시에 사용 중이에요. 같은 요청으로 다시 확인해 주세요.');
}
