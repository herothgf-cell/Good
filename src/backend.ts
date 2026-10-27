import {applyAction,demoState,DomainError,type Actor,type State,type Action,type Result} from '../supabase/functions/_shared/domain.ts';
import {canonical} from '../supabase/functions/_shared/service.ts';
import {AuthClient,ApiError,type StoragePort} from './auth.ts';
export const DEMO_KEY='praise-star.demo.v1';
export const DEMO_MEMBERS:Actor[]=[{id:'child',name:'연준이',role:'child'},{id:'dad',name:'아빠',role:'admin'},{id:'mom',name:'엄마',role:'admin'},{id:'grandma',name:'할머니',role:'giver'}];
export interface Snapshot {state:State;me:Actor;members:Actor[];familyId:string;revision:number}
export type FamilyAction=Action|{type:'member/rename';userId:string;displayName:string;expectedName:string};
export interface Backend {readonly mode:'demo'|'cloud';load():Promise<Snapshot>;perform(action:FamilyAction,requestId:string):Promise<{snapshot:Snapshot;result:Result}>}
interface Envelope {schema:1;members?:Actor[];revision:number;state:State;receipts:Record<string,{actorId:string;payload:string;result:Result}>}
let queue=Promise.resolve();
function exclusive<T>(run:()=>T|Promise<T>):Promise<T> {
  if(typeof navigator!=='undefined'&&navigator.locks)return navigator.locks.request('praise-star-demo-write',run);
  const result=queue.then(run);queue=result.then(()=>undefined,()=>undefined);return result;
}
export class DemoRepository implements Backend {
  readonly mode='demo' as const;
  constructor(private storage:StoragePort,private actor:Actor,private factory:()=>State=demoState){}
  private read():Envelope {
    const raw=this.storage.getItem(DEMO_KEY);
    if(raw){try{const value=JSON.parse(raw) as Envelope;
      if(value.schema!==1||value.state?.schema!==1||!Array.isArray(value.state.ledger)||!value.receipts||!Number.isSafeInteger(value.revision)||value.state.balance!==value.state.ledger.reduce((n,l)=>n+l.delta,0))throw new Error('invalid');
      return value;
    }catch{throw new Error('저장한 체험 데이터가 손상됐어요. 원본은 지우지 않았어요. 백업 후 체험판을 초기화해 주세요.');}}
    const value:Envelope={schema:1,revision:0,state:this.factory(),receipts:{}};this.write(value);return value;
  }
  private write(value:Envelope){try{this.storage.setItem(DEMO_KEY,JSON.stringify(value));}catch{throw new Error('브라우저 저장 공간에 기록하지 못했어요. 비공개 모드나 저장 공간을 확인해 주세요.');}}
  private snapshot(data:Envelope):Snapshot{const members=data.members??DEMO_MEMBERS;return {state:data.state,me:members.find(m=>m.id===this.actor.id)??this.actor,members,familyId:'demo-family',revision:data.revision};}
  async load():Promise<Snapshot>{return exclusive(()=>this.snapshot(this.read()));}
  async perform(action:FamilyAction,requestId:string):Promise<{snapshot:Snapshot;result:Result}> {
    return exclusive(()=>{const envelope=this.read();const payload=canonical(action);const old=envelope.receipts[requestId];
      if(old){if(old.actorId!==this.actor.id||old.payload!==payload)throw new Error('같은 요청 번호로 다른 작업을 보낼 수 없어요.');return {snapshot:this.snapshot(envelope),result:old.result};}
      const actor=this.snapshot(envelope).me;
      if(action.type==='member/rename'){
        if(actor.role!=='admin')throw new DomainError('FORBIDDEN','보호자만 가족 이름을 수정할 수 있어요.');
        if(typeof action.displayName!=='string'||!action.displayName.trim()||action.displayName.trim().length>30)throw new DomainError('INVALID_INPUT','이름을 1~30자로 입력해 주세요.');
        const members=structuredClone(envelope.members??DEMO_MEMBERS);
        const member=members.find(m=>m.id===action.userId);
        if(!member)throw new DomainError('NOT_FOUND','가족 구성원을 찾지 못했어요.');
        if(member.name!==action.expectedName)throw new DomainError('QUOTE_CHANGED','이름이 이미 바뀌었어요. 새로고침 후 다시 수정해 주세요.');
        member.name=action.displayName.trim();envelope.members=members;envelope.revision++;
        const result={message:'가족 이름을 수정했어요.'};envelope.receipts[requestId]={actorId:actor.id,payload,result};
        this.write(envelope);return {snapshot:this.snapshot(envelope),result};
      }
      const next=applyAction(envelope.state,action,{actor,now:new Date().toISOString(),newId:()=>crypto.randomUUID(),random:()=>crypto.getRandomValues(new Uint32Array(1))[0]!/4294967296});
      envelope.state=next.state;envelope.revision++;envelope.receipts[requestId]={actorId:this.actor.id,payload,result:next.result};
      this.write(envelope);return {snapshot:this.snapshot(envelope),result:next.result};
    });
  }
  async reset(){return exclusive(()=>{this.storage.removeItem(DEMO_KEY);return this.snapshot(this.read());});}
}
export class NoFamilyError extends Error {constructor(){super('가족을 만들거나 초대 코드로 참여해 주세요.');this.name='NoFamilyError';}}
export class CloudRepository implements Backend {
  readonly mode='cloud' as const;
  private snapshot:Snapshot|null=null;
  constructor(public auth:AuthClient){}
  async load():Promise<Snapshot> {
    const session=await this.auth.validSession();
    const memberships=await this.auth.api(`/rest/v1/family_members?user_id=eq.${encodeURIComponent(session.user.id)}&select=family_id,user_id,display_name,role`);
    if(!memberships?.length)throw new NoFamilyError();
    const member=memberships[0];const familyId=member.family_id;
    const [families,members]=await Promise.all([
      this.auth.api(`/rest/v1/families?id=eq.${familyId}&select=state,revision`),
      this.auth.api(`/rest/v1/family_members?family_id=eq.${familyId}&select=user_id,display_name,role&order=joined_at.asc`)
    ]);
    if(!families?.[0])throw new ApiError('가족 정보를 읽을 권한이 없어요.',403);
    const toActor=(m:any):Actor=>({id:m.user_id,name:m.display_name,role:m.role});
    this.snapshot={state:families[0].state,revision:Number(families[0].revision),familyId,me:toActor(member),members:members.map(toActor)};
    return this.snapshot;
  }
  async perform(action:FamilyAction,requestId:string):Promise<{snapshot:Snapshot;result:Result}> {
    const current=this.snapshot??await this.load();
    if(typeof navigator!=='undefined'&&navigator.onLine===false)throw new ApiError('오프라인에서는 별을 사용하지 않아요. 인터넷 연결 후 다시 확인해 주세요.',0,true);
    if(action.type==='member/rename'){
      const result=await this.auth.api('/rest/v1/rpc/family_rename_member',{p_user_id:action.userId,p_display_name:action.displayName,p_expected_name:action.expectedName,p_request_id:requestId});
      return {snapshot:await this.load(),result};
    }
    const response=await this.auth.api('/functions/v1/family-action',{familyId:current.familyId,requestId,action});
    this.snapshot={...current,state:response.state,revision:Number(response.revision)};
    return {snapshot:this.snapshot,result:response.result};
  }
  async createFamily(familyName:string,childName:string,displayName:string){await this.auth.api('/rest/v1/rpc/family_bootstrap',{p_family_name:familyName,p_child_name:childName,p_display_name:displayName});return this.load();}
  async joinFamily(code:string,displayName:string){await this.auth.api('/rest/v1/rpc/family_join',{p_token:code.trim(),p_display_name:displayName});return this.load();}
  async invite(role:Actor['role']){const s=this.snapshot??await this.load();return this.auth.api('/rest/v1/rpc/family_issue_invite',{p_family_id:s.familyId,p_role:role});}
  async removeMember(userId:string){await this.auth.api('/rest/v1/rpc/family_remove_member',{p_user_id:userId});return this.load();}
  async revokeInvites(){const s=this.snapshot??await this.load();return this.auth.api('/rest/v1/rpc/family_revoke_invites',{p_family_id:s.familyId});}
}
