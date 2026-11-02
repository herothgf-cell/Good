// Minimal runtime signatures for static checking only; this is NOT a Deno emulator.
declare namespace Deno {
  const env: {get(name:string):string|undefined};
  function serve(handler:(request:Request)=>Response|Promise<Response>):void;
}
// Pinned runtime module; only the adapter boundary is described for tsc (Deno resolves npm).
declare module 'npm:ws@8.22.1' {
 export default class WebSocket {
  constructor(url:string,options:unknown);
  on(event:string,listener:(...args:any[])=>void):this;
  send(data:string):void;
  close():void;
  terminate():void;
 }
}
