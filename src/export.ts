import type {State} from '../supabase/functions/_shared/domain.ts';
export function csvCell(value:string|number):string {
  const source=typeof value==='number'?String(value):/^[=+\-@\t\r]/.test(value)?`'${value}`:value;
  return `"${source.replaceAll('"','""')}"`;
}
export function ledgerCSV(state:State):string {
  const rows:(string|number)[][]=[['일시(UTC)','종류','내용','가족','별 변화','변경 후 잔액'],...state.ledger.map(l=>[l.createdAt,l.kind,l.reason,l.actorName,l.delta,l.balance])];
  return '\uFEFF'+rows.map(row=>row.map(csvCell).join(',')).join('\r\n');
}
export function downloadText(filename:string,contents:string,type='text/plain;charset=utf-8'){
  const url=URL.createObjectURL(new Blob([contents],{type}));const a=document.createElement('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);
}
