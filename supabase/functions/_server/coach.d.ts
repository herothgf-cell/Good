export interface CoachInput {operation:'turn';familyId:string;sessionId:string;turnId:string;adultTest:true;topic:'play'|'shop'|'build';text?:string;audio?:{mime:string;base64:string};history:{role:'user'|'assistant';text:string}[];}
export interface CoachOutput {transcript:string;reply:string;modelPhrase:string;hint:string;speech:string;}
export interface CoachDependencies {
  origin:string;configured:boolean;
  verify:(bearer:string)=>Promise<string|null>;
  member:(familyId:string,userId:string)=>Promise<{role:string}|null>;
  reserve:(args:{familyId:string;userId:string;sessionId:string;turnId:string})=>Promise<boolean>;
  respond:(input:CoachInput,signal:AbortSignal)=>Promise<CoachOutput>;
}
export function createCoachHandler(deps:CoachDependencies):(request:Request)=>Promise<Response>;
export function createOpenAICoach(config:{apiKey:string;chatModel?:string;transcribeModel?:string},fetcher?:typeof fetch):(input:CoachInput,signal:AbortSignal)=>Promise<CoachOutput>;
