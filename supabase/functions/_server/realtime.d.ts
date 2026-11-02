export interface RealtimeRecord {id:string;actorId:string;nonce?:string;callId?:string;state:'reserved'|'active'|'closing'|'closed';createdAt:number;heartbeatAt:number;expiresAt:number;}
export interface RealtimeStore {
 member(family:string,user:string):Promise<{role:string}|null>;
 reserve(family:string,user:string,id:string,settings:{topic:string;voice:string}):Promise<{fresh:boolean;nonce?:string;expiresAt?:number}>;
 attach(family:string,user:string,id:string,nonce:string,callId:string):Promise<boolean>;
 get(family:string,user:string,id:string):Promise<RealtimeRecord|null>;
 markClosed(family:string,user:string,id:string,finished:boolean,providerId?:string):Promise<unknown>;
 heartbeat(family:string,user:string,id:string):Promise<{state:string;expiresAt?:number}>;
 stale(family:string,user:string):Promise<RealtimeRecord[]>;
}
export interface RealtimeProvider {
 create(input:{sdp:string;topic:string;voice:string;safetyId:string},signal:AbortSignal):Promise<{sdp:string;callId:string}>;
 hangup(id:string,signal:AbortSignal):Promise<void>;
}
export class RealtimeError extends Error {code:string;status:number;constructor(code:string,message:string,status?:number);}
export function createRealtimeProvider(config:{apiKey:string;model?:string},fetcher?:typeof fetch):RealtimeProvider;
export function createRealtimeHandler(deps:{origin:string;configured:boolean;model:string;now?:()=>number;verify:(bearer:string)=>Promise<string|null>;store:RealtimeStore;provider:RealtimeProvider}):(request:Request)=>Promise<Response>;
