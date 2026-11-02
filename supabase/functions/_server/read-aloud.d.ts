export function wavFromPCM(pcm:Uint8Array):Uint8Array;
export function createReadAloud(config:{apiKey:string;model?:string;socketFactory:(url:string,options:any)=>any}):(text:string,signal:AbortSignal)=>Promise<{mime:string;base64:string}>;
