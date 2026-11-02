import {PHONICS_VERSION,getPhonicsUnit,buildPhonicsSteps,validatePhonicsCompletion,type PhonicsResult} from './phonics-course.ts';
export interface UnitProgress {cursor:number;attempt:number;results:PhonicsResult[];updatedAt:string;}
export interface EnglishLearning {version:string;selectedUnit:string;units:Record<string,UnitProgress>;}
export function englishLearningFor(state:Record<string,unknown>):EnglishLearning{
 const p=state.learningEnglish as EnglishLearning|undefined;
 return structuredClone(p?.version===PHONICS_VERSION?p:{version:PHONICS_VERSION,selectedUnit:'short-a',units:{}});
}
export function applyEnglishCommand(original:Record<string,unknown>,input:unknown,now:number):{state:Record<string,unknown>;result:{progress:EnglishLearning}}{
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('학습 요청을 확인해 주세요.');
 const a=input as Record<string,unknown>,type=a.type;
 if(!['phonics/select','phonics/complete','phonics/restart'].includes(String(type)))throw Error('학습 요청을 확인해 주세요.');
 const keys=type==='phonics/select'?['type','unitId']:type==='phonics/restart'?['type','unitId','attempt']:['type','unitId','version','index','attempt','record'];
 if(Object.keys(a).some(k=>!keys.includes(k))||typeof a.unitId!=='string')throw Error('학습 요청 항목을 확인해 주세요.');
 getPhonicsUnit(a.unitId);
 const state=structuredClone(original),progress=englishLearningFor(state),old=progress.units[a.unitId]??{cursor:0,attempt:0,results:[],updatedAt:''};
 if(type==='phonics/select')progress.selectedUnit=a.unitId;
 else {
  if(!Number.isSafeInteger(a.attempt)||a.attempt!==old.attempt)throw Error('다른 기기에서 진도가 달라졌어요. 새로 불러와 주세요.');
  if(type==='phonics/restart'){
   if(old.attempt>=100000)throw Error('단원 반복 한도에 도달했어요.');
   progress.units[a.unitId]={cursor:0,attempt:old.attempt+1,results:[],updatedAt:new Date(now).toISOString()};
  } else {
   if(a.version!==PHONICS_VERSION||a.index!==old.cursor)throw Error('다른 기기에서 진도가 달라졌어요. 새로 불러와 주세요.');
   const result=validatePhonicsCompletion(a.unitId,Number(a.index),a.record);
   if(old.cursor>=buildPhonicsSteps(a.unitId).length)throw Error('이미 마친 단원이에요.');
   progress.units[a.unitId]={...old,cursor:old.cursor+1,results:[...old.results,result],updatedAt:new Date(now).toISOString()};
  }
  progress.selectedUnit=a.unitId;
 }
 state.learningEnglish=progress;return {state,result:{progress}};
}
