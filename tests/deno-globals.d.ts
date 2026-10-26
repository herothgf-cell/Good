// Minimal runtime signatures for static checking only; this is NOT a Deno emulator.
declare namespace Deno {
  const env: {get(name:string):string|undefined};
  function serve(handler:(request:Request)=>Response|Promise<Response>):void;
}
