export interface EnglishRules {read:(state:Record<string,unknown>)=>unknown;apply:(state:Record<string,unknown>,action:unknown,now:number)=>{state:Record<string,unknown>;result:unknown};}
export function createEnglishStore(adapter:any,rules:EnglishRules,now?:()=>number):any;
export function createEnglishHandler(deps:{origin:string;configured:boolean;verify:(bearer:string)=>Promise<string|null>;store:any;resolveSpeech:(id:string,index:number)=>string;speech:(text:string,signal:AbortSignal)=>Promise<{mime:string;base64:string}>}):(request:Request)=>Promise<Response>;

export function createEnglishAdapter(config:{url:string;databaseHeaders:Record<string,string>},fetcher?:typeof fetch):any;
