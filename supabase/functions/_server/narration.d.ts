export interface NarrationAudio {mime:'audio/wav';base64:string;transcript:string;}
export function createNarrator(config:{apiKey:string;model?:string},fetcher?:typeof fetch):(text:string,signal:AbortSignal)=>Promise<NarrationAudio>;
export function validateNarrationAudio(value:unknown,expected:string):NarrationAudio;
