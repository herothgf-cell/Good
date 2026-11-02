/** Transient handwriting practice. No recognition, score, upload or persistent storage. */
export interface InkPoint {x:number;y:number;}
export type InkStrokes=InkPoint[][];
export function bindWritingPad(canvas:HTMLCanvasElement,guide:string,strokes:InkStrokes):void{
 const ctx=canvas.getContext('2d');if(!ctx)return;let active:number|null=null;
 const redraw=()=>{ctx.clearRect(0,0,canvas.width,canvas.height);ctx.lineWidth=1;ctx.strokeStyle='#d7dce7';for(const y of [50,105,155]){ctx.beginPath();ctx.moveTo(8,y);ctx.lineTo(canvas.width-8,y);ctx.stroke();}
  if(guide){ctx.font='76px sans-serif';ctx.fillStyle='#d7dce7';ctx.textAlign='center';ctx.fillText(guide,canvas.width/2,122);}
  ctx.strokeStyle='#29364b';ctx.fillStyle='#29364b';ctx.lineWidth=4;ctx.lineCap='round';ctx.lineJoin='round';for(const stroke of strokes){if(!stroke.length)continue;ctx.beginPath();ctx.moveTo(stroke[0]!.x*canvas.width,stroke[0]!.y*canvas.height);for(const p of stroke.slice(1))ctx.lineTo(p.x*canvas.width,p.y*canvas.height);if(stroke.length===1){ctx.arc(stroke[0]!.x*canvas.width,stroke[0]!.y*canvas.height,2,0,Math.PI*2);ctx.fill();}else ctx.stroke();}};
 const point=(event:PointerEvent):InkPoint=>{const r=canvas.getBoundingClientRect();return {x:Math.max(0,Math.min(1,(event.clientX-r.left)/r.width)),y:Math.max(0,Math.min(1,(event.clientY-r.top)/r.height))};};
 canvas.onpointerdown=event=>{if(active!==null||strokes.length>=100)return;event.preventDefault();active=event.pointerId;canvas.setPointerCapture(active);strokes.push([point(event)]);redraw();};
 canvas.onpointermove=event=>{if(active!==event.pointerId)return;const stroke=strokes.at(-1);if(!stroke||stroke.length>=200)return;event.preventDefault();stroke.push(point(event));redraw();};
 const end=(event:PointerEvent)=>{if(active!==event.pointerId)return;if(canvas.hasPointerCapture(event.pointerId))canvas.releasePointerCapture(event.pointerId);active=null;};
 canvas.onpointerup=end;canvas.onpointercancel=end;canvas.onlostpointercapture=()=>{active=null;};redraw();
}
