import type {RealtimeStore} from './realtime.js';
import type {ServerConfig} from './config.js';
export interface RealtimeAdapter {
 member(family:string,user:string):Promise<{role:string}|null>;
 load(family:string):Promise<{state:Record<string,unknown>;revision:number}>;
 receipt(family:string,id:string):Promise<{actorId:string;payload:unknown;result:unknown}|null>;
 commit(data:Record<string,unknown>):Promise<any>;
}
export function createRealtimeStore(adapter:RealtimeAdapter,now?:()=>number):RealtimeStore;
export function createRealtimeAdapter(config:ServerConfig,fetcher?:typeof fetch):RealtimeAdapter;
