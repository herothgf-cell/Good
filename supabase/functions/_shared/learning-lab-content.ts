import {PHONICS_UNITS,buildPhonicsSteps} from './phonics-curriculum.ts';
/** Reviewed, deterministic guardian-preview curriculum. No transcripts or rewards. */
export const LAB_CONTENT_VERSION = '2026-11-02.2';
export type LabLessonId = 'english-conversation'|'english-phonics'|'english-words'|'english-reading'|'math-calculation'|'math-transfer'|'math-clock'|'math-calendar'|'math-groups'|'math-patterns';
export type LabHelp = 'none'|'replay'|'hint'|'model';
export interface LabSettings {
  phonicsUnit?:string; topic:'play'|'shop'|'build'; phonics:'ai-ay'|'silent-e'|'cvc'; conversationSupport:'guided'|'light';
  addition:'no-regroup'|'regroup'|'mixed'; subtraction:'no-regroup'|'regroup'|'mixed';
  moneyUnit:100|1000|10000; clockLevel:1|2|3; calendarLevel:1|2; groupSize:2|3; patternLevel:1|2;
}
export const DEFAULT_LAB_SETTINGS:LabSettings = Object.freeze({phonicsUnit:'01',topic:'play',phonics:'ai-ay',conversationSupport:'guided',addition:'mixed',subtraction:'mixed',moneyUnit:1000,clockLevel:1,calendarLevel:1,groupSize:2,patternLevel:1});
const SETTING_VALUES:Record<keyof LabSettings, readonly (string|number)[]> = {
  phonicsUnit:PHONICS_UNITS.map(unit=>unit.id),topic:['play','shop','build'], phonics:['ai-ay','silent-e','cvc'], conversationSupport:['guided','light'],
  addition:['no-regroup','regroup','mixed'], subtraction:['no-regroup','regroup','mixed'],
  moneyUnit:[100,1000,10000], clockLevel:[1,2,3], calendarLevel:[1,2], groupSize:[2,3], patternLevel:[1,2],
};
function record(value:unknown):value is Record<string,unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}
export function validateLabSettings(value:unknown):LabSettings {
  if (!record(value) || Reflect.ownKeys(value).some(k=>typeof k!=='string'||!Object.hasOwn(SETTING_VALUES,k))) throw new Error('학습 설정 형식이 올바르지 않아요.');
  const normalized={...value,phonicsUnit:value.phonicsUnit??'01'};
  for (const key of Object.keys(SETTING_VALUES) as (keyof LabSettings)[]) {
    if (!Object.hasOwn(normalized,key) || !SETTING_VALUES[key]!.includes((normalized as Record<string,unknown>)[key] as string|number)) throw new Error(`학습 설정을 확인해 주세요: ${key}`);
  }
  return normalized as unknown as LabSettings;
}
export type LabVisual =
 | {kind:'money';unit:number;counts:number[]}
 | {kind:'place-value';values:number[]}
 | {kind:'groups';size:number;groups:number}
 | {kind:'clock';hour:number;minute:number;endHour?:number;endMinute?:number}
 | {kind:'calendar';year:number;month:number;day:number;targetDay?:number;targetMonth?:number}
 | {kind:'bar';parts:(number|null)[];total:number|null;labels:string[]}
 | {kind:'sequence';items:(number|null)[]}
 | {kind:'word';icon:string;label:string};
export interface LabSource {title:string;origin:'source'|'supplement';pdfPages:number[];printedPages:number[];}
interface LabBaseStep {readingKey?:string;source?:LabSource;id:string;skillId:string;title:string;prompt:string;hint:string;explanation:string;visual?:LabVisual;context:'familiar'|'changed'|'symbolic';}
export interface LabNumberStep extends LabBaseStep {kind:'number';answer:string;format:'integer'|'time'|'date';}
export interface LabChoiceStep extends LabBaseStep {kind:'choice';options:{id:string;label:string}[];answer:string;}
export interface LabPracticeStep extends LabBaseStep {kind:'practice';mode:'model'|'recall'|'read'|'transfer-read'|'conversation';target:string;speech:string;cue:string;helperWords:string[];}
export interface LabSpellingStep extends LabBaseStep {kind:'spelling';mode:'copy'|'recall';target:string;answer:string;letters:string[];}
export type LabStep = LabNumberStep|LabChoiceStep|LabPracticeStep|LabSpellingStep;
export interface LabLesson {id:LabLessonId;subject:'english'|'math';title:string;description:string;goal:string;icon:string;steps:LabStep[];}
export const LAB_CATALOG:ReadonlyArray<Omit<LabLesson,'steps'>> = Object.freeze([
  {id:'english-conversation',subject:'english',title:'AI 영어 회화',description:'한 대화 화면에서 글이나 목소리로 말하고 AI의 글·음성 답변을 함께 받아요.',goal:'한 단어 또는 짧은 문장으로 뜻을 전하고 이어서 답해요.',icon:'💬'},
  {id:'english-phonics',subject:'english',title:'파닉스 · 듣고 읽고 쓰기',description:'15분 파닉스 참고 · 두 단어씩 순서대로 듣기, 읽기, 쓰기, 문장과 복습을 이어가요.',goal:'소리·글자·뜻을 연결하고 스스로 읽고 써 봐요.',icon:'🔤'},
  {id:'english-words',subject:'english',title:'뜻에서 영어 낱말 꺼내기',description:'그림과 뜻을 보고 낱말을 떠올리고 다른 상황에서 다시 써요.',goal:'듣고 따라 하기와 답을 보지 않고 말하기를 구분해요.',icon:'🌦️'},
  {id:'english-reading',subject:'english',title:'낱말에서 짧은 글 읽기',description:'소리 패턴을 읽고 처음 보는 낱말과 짧은 문장에 적용해요.',goal:'시범 듣기·스스로 읽기·새 낱말 읽기·뜻 확인을 나눠 연습해요.',icon:'📖'},
  {id:'math-calculation',subject:'math',title:'두 자리 덧셈과 뺄셈',description:'받아올림·받아내림 설정에 맞춰 답을 직접 입력해요.',goal:'십의 자리와 일의 자리를 연결해 계산해요.',icon:'✏️'},
  {id:'math-transfer',subject:'math',title:'돈에서 그림과 식으로',description:'같은 수량을 돈·묶음·식으로 연결한 뒤 새 문제에 적용해요.',goal:'단위가 달라져도 수량 관계를 설명해요.',icon:'💵'},
  {id:'math-clock',subject:'math',title:'시계와 시간의 관계',description:'시각을 읽는 데서 나아가 전후 시각과 걸린 시간을 생각해요.',goal:'시작·걸린 시간·끝 시각을 연결해요.',icon:'🕒'},
  {id:'math-calendar',subject:'math',title:'달력으로 날짜 생각하기',description:'며칠 뒤 날짜를 달 안이나 다음 달에서 찾아요.',goal:'월의 길이와 해의 경계를 달력에서 확인해요.',icon:'📅'},
  {id:'math-groups',subject:'math',title:'같은 수씩 묶기',description:'2개 또는 3개씩 묶은 그림을 덧셈과 곱셈에 연결해요.',goal:'묶음 수와 한 묶음의 수를 구분해요.',icon:'🧺'},
  {id:'math-patterns',subject:'math',title:'규칙을 읽고 빈칸 채우기',description:'명시된 한 가지 규칙으로 수 배열의 빈칸을 채워요.',goal:'같은 변화와 번갈아 바뀌는 변화를 설명해요.',icon:'🔎'},
].map(item => Object.freeze(item)) as ReadonlyArray<Omit<LabLesson,'steps'>>);

type Random = (min:number,max:number)=>number;
function random(seed:number):Random {
  let state = seed;
  return (min,max) => {
    state=(state+0x6D2B79F5) >>> 0;
    let mixed=Math.imul(state ^ state>>>15,1|state);
    mixed ^= mixed + Math.imul(mixed ^ mixed>>>7,61|mixed);
    return min+Math.floor(((mixed ^ mixed>>>14) >>> 0)/4294967296*(max-min+1));
  };
}
function shuffled<T>(items:readonly T[], rng:Random):T[] {
  const copy = [...items];
  for (let i=copy.length-1;i>0;i--) {const j = rng(0,i); [copy[i],copy[j]] = [copy[j]!,copy[i]!];}
  return copy;
}
function numberStep(id:string, skillId:string, title:string, prompt:string, answer:number|string, hint:string, explanation:string, visual:LabVisual, context:LabBaseStep['context']='symbolic', format:LabNumberStep['format']='integer'):LabNumberStep {
  return {id,skillId,kind:'number',title,prompt,answer:String(answer),format,hint,explanation,visual,context};
}
function clockTime(minutes:number):string {return `${String(Math.floor(minutes/60)%24).padStart(2,'0')}:${String(minutes%60).padStart(2,'0')}`;}
function dateText(date:Date):string {return date.toISOString().slice(0,10);}

function calculation(settings:LabSettings,rng:Random):LabStep[] {
  return Array.from({length:6},(_,i) => {
    const add = i%2 === 0;
    const setting = add ? settings.addition : settings.subtraction;
    const regroup = setting === 'regroup' || (setting === 'mixed' && rng(0,1) === 1);
    // Rejection sampling is bounded by constructing the complete valid pair bank.
    const pairs:[number,number][] = [];
    for (let a=10;a<=89;a++) for (let b=10;b<=89;b++) {
      if (add ? a+b>99 : a<b) continue;
      if ((add ? a%10+b%10>=10 : a%10<b%10) === regroup) pairs.push([a,b]);
    }
    const [a,b] = pairs[rng(0,pairs.length-1)]!;
    const answer = add ? a+b : a-b;
    const op = add ? '+' : '−';
    const hint = add ? '일의 자리끼리 더한 뒤 십의 자리를 살펴보세요.' : '일의 자리에서 뺄 수 있는지 보고, 필요하면 십 하나를 일 10개로 바꾸세요.';
    const explanation = add
      ? `${a%10} + ${b%10} = ${a%10+b%10}이에요. ${regroup ? '일 10개를 십 하나로 바꾸어 ' : ''}십의 자리까지 더하면 ${answer}예요.`
      : `${regroup ? '십 하나를 일 10개로 바꾸고 ' : ''}일의 자리부터 뺀 뒤 십의 자리도 빼면 ${a} − ${b} = ${answer}예요.`;
    return numberStep(`math-calculation-${i+1}`,`math.${add?'addition':'subtraction'}.${regroup?'regroup':'no-regroup'}`,add?'두 자리 덧셈':'두 자리 뺄셈',`${a} ${op} ${b} = ?`,answer,hint,explanation,{kind:'place-value',values:[a,b]});
  });
}
function transfer(settings:LabSettings,rng:Random):LabStep[] {
  // Same quantities first; representation-specific answers deliberately differ in unit.
  const size = rng(2,3), left = size*rng(2,4), right = size*rng(2,3), total=left+right;
  const freshLeft=left+rng(1,3), freshRight=right+rng(1,3);
  const unit=settings.moneyUnit;
  const item=unit===100?'동전':'지폐',counter=unit===100?'개':'장',and=unit===100?'와':'과';
  return [
    numberStep('math-transfer-1','math.transfer.money','돈으로 합치기',`${unit.toLocaleString('ko-KR')}원짜리 ${item} ${left}${counter}${and} ${right}${counter}${unit===100?'를':'을'} 합치면 모두 몇 원인가요?`,total*unit,`먼저 ${item}${unit===100?'이':'가'} 모두 몇 ${counter}인지 생각하고 한 ${counter}의 금액을 곱해 보세요.`,`${left} + ${right} = ${total}${counter}이므로 ${total} × ${unit} = ${total*unit}원이에요.`,{kind:'money',unit,counts:[left,right]},'familiar'),
    numberStep('math-transfer-2','math.transfer.groups','같은 수량을 묶음으로',`앞에서 합친 ${left}개와 ${right}개를 ${size}개씩 묶었어요. 물건은 모두 몇 개인가요?`,total,'한 묶음의 수와 묶음 수를 연결해 보세요.',`${total/size}묶음에 ${size}개씩 있으므로 모두 ${total}개예요. 돈의 단위를 빼도 수량 관계는 같아요.`,{kind:'groups',size,groups:total/size},'changed'),
    numberStep('math-transfer-3','math.transfer.symbolic','그림에서 식으로',`돈이나 물건 그림 없이 ${left} + ${right} = ?`,total,'앞에서 두 부분을 어떻게 합쳤는지 떠올려 보세요.',`표현이 달라도 ${left} + ${right} = ${total}이라는 관계는 같아요.`,{kind:'bar',parts:[left,right],total:null,labels:['첫 부분','둘째 부분']},'symbolic'),
    numberStep('math-transfer-4','math.transfer.fresh','새 상황에 적용하기',`새 상자에는 블록 ${freshLeft}개와 ${freshRight}개가 있어요. 모두 몇 개인가요?`,freshLeft+freshRight,'앞의 답을 그대로 쓰지 말고 새 두 부분을 합쳐 보세요.',`새 수량은 ${freshLeft} + ${freshRight} = ${freshLeft+freshRight}개예요. 새 문제에서도 같은 합치기 관계를 써요.`,{kind:'bar',parts:[freshLeft,freshRight],total:null,labels:['파란 블록','노란 블록']},'changed'),
  ];
}
function clocks(settings:LabSettings,rng:Random):LabStep[] {
  return Array.from({length:4},(_,i) => {
    const level=settings.clockLevel;
    const hour=rng(8,17);
    const minute=level===1 ? rng(0,5)*5 : rng(8,11)*5;
    const duration=level===1 ? rng(1,Math.floor((55-minute)/5))*5 : rng(5,9)*5;
    const start=hour*60+minute, end=start+duration;
    const type=level===3 ? i%3 : 0;
    const visual:LabVisual={kind:'clock',hour,minute,endHour:Math.floor(end/60),endMinute:end%60};
    const startLabel=clockTime(start), endLabel=clockTime(end);
    const prompt=type===1 ? `놀이가 ${endLabel}에 끝났어요. ${duration}분 동안 놀았다면 시작 시각은 언제인가요?`
      : type===2 ? `${startLabel}에 시작해서 ${endLabel}에 끝났어요. 몇 분 걸렸나요?`
      : `${startLabel}부터 ${duration}분 동안 놀아요. 끝나는 시각은 언제인가요?`;
    const skill=`math.clock.${type===1?'start':type===2?'duration':level===1?'within-hour':'across-hour'}`;
    return numberStep(`math-clock-${i+1}`,skill,type===1?'시작 시각 찾기':type===2?'걸린 시간 찾기':'끝 시각 찾기',prompt,type===1?startLabel:type===2?duration:endLabel,type===1?'끝 시각에서 걸린 분만큼 거꾸로 이동해 보세요.':'분침이 움직인 분을 세고 60분이 되면 다음 시로 넘어가세요.',`${startLabel}에서 ${duration}분 뒤는 ${endLabel}이에요.`,visual,i===0?'familiar':'changed',type===2?'integer':'time');
  });
}
function calendars(settings:LabSettings,rng:Random,seed:number):LabStep[] {
  // The bank deliberately includes leap February, ordinary February, short months and year end.
  const months=[[2024,2],[2025,2],[2026,4],[2026,12],[2028,2],[2026,9]] as const;
  return Array.from({length:4},(_,i) => {
    const [year,month]=months[(seed+i)%months.length]!;
    const last=new Date(Date.UTC(year,month,0)).getUTCDate();
    const offset=rng(1,10);
    const day=settings.calendarLevel===1 ? rng(1,last-offset) : last-rng(0,offset-1);
    const target=new Date(Date.UTC(year,month-1,day+offset));
    return numberStep(`math-calendar-${i+1}`,`math.calendar.${settings.calendarLevel===1?'within-month':'across-month'}`,'며칠 뒤 날짜',`${year}년 ${month}월 ${day}일에서 ${offset}일 뒤는 몇 년 몇 월 며칠인가요?`,dateText(target),'오늘을 0일로 두고 하루씩 앞으로 이동해요. 달의 마지막 날 다음은 다음 달 1일이에요.',`${month}월은 ${last}일까지 있어요. ${offset}일 뒤는 ${target.getUTCFullYear()}년 ${target.getUTCMonth()+1}월 ${target.getUTCDate()}일이에요.`,{kind:'calendar',year,month,day,targetDay:target.getUTCDate(),targetMonth:target.getUTCMonth()+1},i===0?'familiar':'changed','date');
  });
}
function groups(settings:LabSettings,rng:Random):LabStep[] {
  const size=settings.groupSize, base=rng(2,5), fresh=base+rng(1,2);
  return [base,base,base,fresh].map((count,i) => {
    const repeated=Array.from({length:count},()=>size).join(' + ');
    const prompt=i===0 ? `접시 ${count}개에 사과가 ${size}개씩 있어요. 사과는 모두 몇 개인가요?`
      : i===1 ? `같은 그림을 덧셈으로 쓰면 ${repeated}예요. 합은 얼마인가요?`
      : i===2 ? `한 묶음에 ${size}개씩 ${count}묶음이에요. ${size} × ${count} = ?`
      : `이번에는 상자 ${count}개에 공이 ${size}개씩 있어요. 모두 몇 개인가요?`;
    return numberStep(`math-groups-${i+1}`,`math.groups.${size}.${i===0?'equal':i===1?'addition':i===2?'multiply':'transfer'}`,i===3?'새 묶음에 적용하기':'같은 수씩 묶기',prompt,size*count,'한 묶음에 몇 개, 그런 묶음이 몇 개인지 따로 확인해 보세요.',`${size}개씩 ${count}묶음은 ${repeated} = ${size*count}개예요.`,{kind:'groups',size,groups:count},i===0?'familiar':i===2?'symbolic':'changed');
  });
}
function patterns(settings:LabSettings,rng:Random):LabStep[] {
  return Array.from({length:4},(_,i) => {
    const first=rng(1,5), second=settings.patternLevel===1?first:first+rng(1,3), start=rng(10,40);
    const values=[start];
    for(let j=0;j<5;j++) values.push(values[j]!+(j%2===0?first:second));
    const hole=rng(1,5), answer=values[hole]!;
    const items:(number|null)[]=[...values]; items[hole]=null;
    const rule=settings.patternLevel===1 ? `매번 ${first}씩 커지는 규칙` : `${first}을 더하고 ${second}을 더하는 것을 번갈아 반복하는 규칙`;
    return numberStep(`math-patterns-${i+1}`,`math.patterns.${settings.patternLevel===1?'constant':'alternating'}`,'규칙과 빈칸',`${rule}이에요. 첫 수에서부터 차례로 적용하면 빈칸에는 어떤 수가 들어가나요?`,answer,settings.patternLevel===1?`바로 앞 수에 ${first}을 더해 보세요.`:`첫 변화는 +${first}, 다음 변화는 +${second}예요. 어느 차례인지 확인해 보세요.`,`${values.join(' → ')}에서 빈칸의 수는 ${answer}예요.`,{kind:'sequence',items},i===0?'familiar':'changed');
  });
}

interface Word {text:string;meaning:string;icon:string;}
const WORD_BANKS:Record<LabSettings['phonics'],readonly Word[]> = {
  'ai-ay':[{text:'rain',meaning:'비',icon:'🌧️'},{text:'tail',meaning:'꼬리',icon:'🐕'},{text:'mail',meaning:'우편물',icon:'✉️'},{text:'day',meaning:'낮',icon:'☀️'},{text:'say',meaning:'말하다',icon:'💬'},{text:'May',meaning:'5월',icon:'📅'},{text:'play',meaning:'놀다',icon:'⚽'},{text:'train',meaning:'기차',icon:'🚆'}],
  'silent-e':[{text:'cake',meaning:'케이크',icon:'🎂'},{text:'kite',meaning:'연',icon:'🪁'},{text:'home',meaning:'집',icon:'🏠'},{text:'game',meaning:'게임',icon:'🎲'},{text:'name',meaning:'이름',icon:'🏷️'},{text:'lake',meaning:'호수',icon:'🏞️'}],
  cvc:[{text:'cat',meaning:'고양이',icon:'🐈'},{text:'hat',meaning:'모자',icon:'🎩'},{text:'mat',meaning:'매트',icon:'🟩'},{text:'map',meaning:'지도',icon:'🗺️'},{text:'bag',meaning:'가방',icon:'🎒'},{text:'cap',meaning:'야구 모자',icon:'🧢'}],
};
function wordPractice(id:string,skillId:string,word:Word,mode:LabPracticeStep['mode'],context:LabBaseStep['context']):LabPracticeStep {
  const model=mode==='model', recall=mode==='recall';
  return {id,skillId,kind:'practice',mode,context,title:model?'뜻과 낱말 연결하기':recall?'답을 가리고 떠올리기':'스스로 낱말 읽기',
    prompt:model?'뜻을 확인하고 낱말 전체의 소리를 들어 보세요.':recall?'그림과 뜻을 보고 영어 낱말을 스스로 말해 보세요.':'먼저 듣지 않고 보이는 낱말을 스스로 읽어 보세요.',
    target:word.text,speech:model?word.text:'',cue:recall?'생각이 안 나면 힌트나 시범을 선택해요.':'보호자가 시도한 모습을 관찰해 기록해요.',helperWords:[],
    hint:recall?'어떤 뜻인지 다시 말하고, 이번에 배운 소리 패턴을 떠올려 보세요.':'낱말에서 익힌 소리 패턴을 찾고 앞뒤 소리와 이어 읽어 보세요.',
    explanation:`${word.text}은(는) ‘${word.meaning}’라는 뜻이에요. 듣기와 스스로 떠올리기·읽기는 서로 다른 연습이에요.`,
    visual:{kind:'word',icon:word.icon,label:word.meaning}};
}
function words(settings:LabSettings,rng:Random):LabStep[] {
  const bank=shuffled(WORD_BANKS[settings.phonics],rng);
  const a=bank[0]!,b=bank[1]!;
  return [
    wordPractice('english-words-1',`english.words.${settings.phonics}.model`,a,'model','familiar'),
    wordPractice('english-words-2',`english.words.${settings.phonics}.recall`,a,'recall','familiar'),
    wordPractice('english-words-3',`english.words.${settings.phonics}.model`,b,'model','familiar'),
    wordPractice('english-words-4',`english.words.${settings.phonics}.recall`,b,'recall','familiar'),
    {...wordPractice('english-words-5',`english.words.${settings.phonics}.reuse`,a,'recall','changed'),prompt:`새 그림책에서 ‘${a.meaning}’ 장면을 봤어요. 영어로 무엇이라고 말할까요?`},
    {...wordPractice('english-words-6',`english.words.${settings.phonics}.reuse`,b,'recall','changed'),prompt:`친구가 ‘${b.meaning}’의 영어 낱말을 물어요. 답을 보지 않고 말해 보세요.`},
  ];
}
const SENTENCES:Record<LabSettings['phonics'],readonly {text:string;helpers:string[];meaning:string;distractors:string[]}[]> = {
  'ai-ay':[
    {text:'May can play.',helpers:['May (사람 이름)','can'],meaning:'메이는 놀 수 있어요.',distractors:['메이는 잘 수 있어요.','메이는 우편물을 받아요.']},
    {text:'I see rain.',helpers:['I','see'],meaning:'나는 비를 봐요.',distractors:['나는 기차를 타요.','나는 연을 만들어요.']},
    {text:'The train has mail.',helpers:['The','has'],meaning:'기차에 우편물이 있어요.',distractors:['기차에 케이크가 있어요.','꼬리가 길어요.']},
  ],
  'silent-e':[
    {text:'I make a cake.',helpers:['I','a'],meaning:'나는 케이크를 만들어요.',distractors:['나는 연을 날려요.','나는 집에서 자요.']},
    {text:'The kite is at home.',helpers:['The','is','at'],meaning:'연이 집에 있어요.',distractors:['연이 호수에 있어요.','케이크가 집에 있어요.']},
    {text:'I like the game.',helpers:['I','the'],meaning:'나는 그 게임을 좋아해요.',distractors:['나는 호수에 가요.','나는 이름을 써요.']},
  ],
  cvc:[
    {text:'The cat is on the mat.',helpers:['The','is','on','the'],meaning:'고양이가 매트 위에 있어요.',distractors:['고양이가 가방 안에 있어요.','모자가 매트 위에 있어요.']},
    {text:'A cap is in the bag.',helpers:['A','is','in','the'],meaning:'야구 모자가 가방 안에 있어요.',distractors:['고양이가 가방 안에 있어요.','지도가 매트 위에 있어요.']},
    {text:'The cat has a hat.',helpers:['The','has','a'],meaning:'고양이에게 모자가 있어요.',distractors:['고양이에게 지도가 있어요.','가방에 매트가 있어요.']},
  ],
};
function reading(settings:LabSettings,rng:Random):LabStep[] {
  const bank=shuffled(WORD_BANKS[settings.phonics],rng);
  const a=bank[0]!,b=bank[1]!,c=bank[2]!;
  const sentence=SENTENCES[settings.phonics][rng(0,SENTENCES[settings.phonics].length-1)]!;
  // Explicit helpers include every word outside this lesson's reviewed pattern bank.
  const known=new Set(WORD_BANKS[settings.phonics].map(w=>w.text.toLowerCase()));
  const extras=sentence.text.match(/[A-Za-z]+/g)?.filter(w=>!known.has(w.toLowerCase())) ?? [];
  const helpers=[...new Set([...sentence.helpers,...extras])];
  const options=shuffled([{id:'meaning',label:sentence.meaning},...sentence.distractors.map((label,i)=>({id:`other-${i}`,label}))],rng);
  return [
    wordPractice('english-reading-1',`english.reading.${settings.phonics}.model`,a,'model','familiar'),
    wordPractice('english-reading-2',`english.reading.${settings.phonics}.decode`,a,'read','familiar'),
    wordPractice('english-reading-3',`english.reading.${settings.phonics}.transfer`,b,'transfer-read','changed'),
    wordPractice('english-reading-4',`english.reading.${settings.phonics}.transfer`,c,'transfer-read','changed'),
    {id:'english-reading-5',skillId:`english.reading.${settings.phonics}.connected`,kind:'practice',mode:'read',context:'changed',title:'짧은 글 스스로 읽기',prompt:'도움 낱말을 먼저 확인한 뒤, 문장을 듣지 않고 스스로 읽어 보세요.',target:sentence.text,speech:'',cue:'도움 낱말은 보호자가 알려 줄 수 있어요. 문장 읽기는 직접 관찰해 기록해요.',helperWords:helpers,hint:'도움 낱말은 뜻과 소리를 확인하고, 나머지는 익힌 패턴으로 이어 읽어 보세요.',explanation:`‘${sentence.text}’는 ‘${sentence.meaning}’라는 뜻이에요. 음성 재생 여부만으로 읽기 성공을 판단하지 않아요.`},
    {id:'english-reading-6',skillId:`english.reading.${settings.phonics}.meaning`,kind:'choice',context:'changed',title:'읽은 글의 뜻',prompt:`‘${sentence.text}’는 어떤 뜻인가요?`,hint:'누가 무엇을 하는 문장인지 생각해 보세요.',explanation:sentence.meaning,options,answer:'meaning'},
  ];
}
const SCENARIOS:Record<LabSettings['topic'],readonly {prompt:string;target:string;light:string}[]> = {
  play:[
    {prompt:'같이 놀고 싶은 친구에게 무엇을 하고 싶은지 말해 볼까요?',target:'Let’s play.',light:'무엇을 하고 싶나요?'},
    {prompt:'공과 블록 중 어떤 것을 고를까요? 고른 것을 친구에게 말해요.',target:'A ball, please.',light:'어느 것을 고르나요?'},
    {prompt:'친구와 차례를 번갈아 해요. 내 차례라고 말해 볼까요?',target:'My turn, please.',light:'누구 차례인가요?'},
    {prompt:'친구가 건네준 공을 받았어요. 뭐라고 말할까요?',target:'Thank you.',light:'받았을 때 하고 싶은 말은?'},
    {prompt:'놀이가 재미있었는지 친구에게 알려 주세요.',target:'It is fun.',light:'기분이 어떤가요?'},
  ],
  shop:[
    {prompt:'가게에서 사과를 골랐어요. 원하는 것을 점원에게 말해 볼까요?',target:'An apple, please.',light:'무엇을 원하나요?'},
    {prompt:'사과 한 개를 사고 싶어요. 몇 개 필요한지 말해 볼까요?',target:'One, please.',light:'몇 개 필요한가요?'},
    {prompt:'점원이 사과를 건네주었어요. 뭐라고 말할까요?',target:'Thank you.',light:'건네받았어요. 어떤 말을 할까요?'},
    {prompt:'점원이 더 필요한지 물어요. 이제 충분하다고 말해요.',target:'No, thank you.',light:'더 필요한가요?'},
    {prompt:'가게를 떠나며 인사해 볼까요?',target:'Goodbye.',light:'어떤 인사를 할까요?'},
  ],
  build:[
    {prompt:'블록으로 탑을 만들려고 해요. 무엇을 만들지 친구에게 말해요.',target:'A tower.',light:'무엇을 만들까요?'},
    {prompt:'파란 블록이 필요해요. 친구에게 부탁해 볼까요?',target:'A blue block, please.',light:'어떤 것이 필요한가요?'},
    {prompt:'블록이 잘 안 끼워져요. 도움을 부탁해 볼까요?',target:'Help me, please.',light:'어떻게 부탁할까요?'},
    {prompt:'탑이 높아졌어요. 친구에게 보라고 말해요.',target:'Look at my tower.',light:'무엇을 보여 주고 싶나요?'},
    {prompt:'만들기가 끝났어요. 완성했다고 말해 볼까요?',target:'I did it.',light:'끝나서 기분이 어떤가요?'},
  ],
};
function conversation(settings:LabSettings,rng:Random):LabStep[] {
  // Keep a meaningful scenario order while varying the opening/follow-up selection.
  const bank=SCENARIOS[settings.topic], omitted=rng(1,3);
  return bank.filter((_,i)=>i!==omitted).map((item,i) => ({id:`english-conversation-${i+1}`,skillId:`english.conversation.${settings.topic}`,kind:'practice',mode:'conversation',context:i===0?'familiar':'changed',title:'대화 시나리오 미리보기',prompt:settings.conversationSupport==='guided'?item.prompt:item.light,target:item.target,speech:'',cue:'한국어 또는 한 단어로 답해도 괜찮아요. 보호자가 뜻 전달을 관찰해요.',helperWords:settings.conversationSupport==='guided'?['please (부탁할 때)','thank you (고마울 때)']:[],hint:'먼저 전하고 싶은 뜻을 말해 보세요. 필요하면 시범 문장을 듣고 다시 말해요.',explanation:`시범 표현은 ‘${item.target}’예요. 이 활동은 고정 시나리오 연습이며 실제 AI 응답이나 자동 말하기 평가가 아니에요.`}));
}
export function buildLabLesson(id:LabLessonId,settings:LabSettings,seed:number):LabLesson {
  const validated=validateLabSettings(settings);
  if (!Number.isSafeInteger(seed) || seed<0 || seed>2147483647) throw new Error('학습 씨앗 값이 올바르지 않아요.');
  const meta=LAB_CATALOG.find(item=>item.id===id);
  if (!meta) throw new Error('알 수 없는 학습 활동이에요.');
  const rng=random(seed);
  let steps:LabStep[];
  switch (id) {
    case 'english-conversation': steps=conversation(validated,rng);break;
    case 'english-phonics': steps=buildPhonicsSteps(validated.phonicsUnit??'01',seed);break;
    case 'english-words': steps=words(validated,rng);break;
    case 'english-reading': steps=reading(validated,rng);break;
    case 'math-calculation': steps=calculation(validated,rng);break;
    case 'math-transfer': steps=transfer(validated,rng);break;
    case 'math-clock': steps=clocks(validated,rng);break;
    case 'math-calendar': steps=calendars(validated,rng,seed);break;
    case 'math-groups': steps=groups(validated,rng);break;
    case 'math-patterns': steps=patterns(validated,rng);break;
  }
  return {...meta,steps};
}

export function normalizeSpelling(value:string):string{if(typeof value!=='string'||value.length>64)return '';const normalized=value.normalize('NFKC').trim().toLowerCase();return /^[a-z]{1,24}$/.test(normalized)?normalized:'';}

export function normalizeLabAnswer(value:string,format:'integer'|'time'|'date'):string {
  if (typeof value!=='string' || value.length>100) return '';
  const input=value.normalize('NFKC').trim();
  if (format==='integer') {
    const digits=input.replace(/\s*원$/,'');
    if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)$/.test(digits)) return '';
    const n=Number(digits.replaceAll(',',''));
    return Number.isSafeInteger(n) ? String(n) : '';
  }
  if (format==='time') {
    const match=input.match(/^(\d{1,2})\s*:\s*(\d{1,2})$/) ?? input.match(/^(\d{1,2})시\s*(\d{1,2})분$/);
    if (!match) return '';
    const hour=Number(match[1]),minute=Number(match[2]);
    return hour<24 && minute<60 ? clockTime(hour*60+minute) : '';
  }
  if (format==='date') {
    const match=input.match(/^(\d{4})\s*[-/.]\s*(\d{1,2})\s*[-/.]\s*(\d{1,2})$/) ?? input.match(/^(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일$/);
    if (!match) return '';
    const year=Number(match[1]),month=Number(match[2]),day=Number(match[3]);
    if (year<1 || month<1 || month>12 || day<1 || day>31) return '';
    const date=new Date(0);date.setUTCFullYear(year,month-1,day);date.setUTCHours(0,0,0,0);
    return date.getUTCFullYear()===year && date.getUTCMonth()===month-1 && date.getUTCDate()===day ? dateText(date) : '';
  }
  return '';
}
export interface LabAnswer {stepId:string;value?:string;attempts:number;help:LabHelp;observation?:'independent'|'supported'|'retry';evidence?:'self'|'guardian';}
export interface LabSkillResult {skillId:string;independent:number;supported:number;review:number;observed:number;}
export interface LabEvaluation {total:number;correct:number;independent:number;supported:number;review:number;observed:number;skills:LabSkillResult[];}
export function evaluateLabAnswers(lesson:LabLesson,answers:unknown):LabEvaluation {
  if (!Array.isArray(answers) || answers.length!==lesson.steps.length) throw new Error('각 학습 단계의 기록이 한 번씩 필요해요.');
  const allowedKeys=new Set(['stepId','value','attempts','help','observation','evidence']);
  const byId=new Map<string,Record<string,unknown>>();
  for(const value of answers) {
    if (!record(value) || Reflect.ownKeys(value).some(k=>typeof k!=='string' || !allowedKeys.has(k)) || typeof value.stepId!=='string'
      || !Number.isInteger(value.attempts) || Number(value.attempts)<1 || Number(value.attempts)>30
      || typeof value.help!=='string' || !['none','replay','hint','model'].includes(value.help) || byId.has(value.stepId)) throw new Error('학습 시도 기록이 올바르지 않아요.');
    if (value.observation!==undefined && (typeof value.observation!=='string' || !['independent','supported','retry'].includes(value.observation))) throw new Error('관찰 기록이 올바르지 않아요.');
    if (value.evidence!==undefined && (typeof value.evidence!=='string' || !['self','guardian'].includes(value.evidence))) throw new Error('관찰 출처가 올바르지 않아요.');
    byId.set(value.stepId,value);
  }
  const result:LabEvaluation={total:lesson.steps.length,correct:0,independent:0,supported:0,review:0,observed:0,skills:[]};
  const skills=new Map<string,LabSkillResult>();
  for(const step of lesson.steps) {
    const answer=byId.get(step.id);
    if (!answer) throw new Error('다른 학습 단계의 기록은 저장할 수 없어요.');
    let outcome:'independent'|'supported'|'review';
    const hasObservation=answer.observation!==undefined;
    const hasEvidence=answer.evidence!==undefined;
    if (hasObservation!==hasEvidence) throw new Error('관찰과 관찰 출처를 함께 기록해 주세요.');
    if (step.kind==='practice') {
      if (Object.hasOwn(answer,'value') || !hasObservation || !hasEvidence) throw new Error('말하기·읽기는 답 텍스트 없이 관찰로 기록해 주세요.');
      outcome=answer.observation==='retry'?'review':answer.observation==='supported'||answer.help!=='none'||Number(answer.attempts)>1||step.mode==='model'?'supported':'independent';
    } else {
      if (hasObservation && answer.observation!=='retry') throw new Error('직접 입력 문제는 정답으로 확인해요.');
      const review=answer.observation==='retry' && hasEvidence && (answer.help==='hint'||answer.help==='model');
      if (Object.hasOwn(answer,'value') && typeof answer.value!=='string') throw new Error('입력 답을 확인해 주세요.');
      let normalized='';
      if (typeof answer.value==='string') {
        normalized=step.kind==='number'?normalizeLabAnswer(answer.value,step.format):step.kind==='spelling'?normalizeSpelling(answer.value):answer.value;
        if (!normalized || (step.kind==='choice'&&!step.options.some(o=>o.id===normalized))) throw new Error('올바른 답 형식이 아니에요.');
      }
      if (normalized===step.answer) {
        result.correct++;
        outcome=answer.help==='none'&&answer.attempts===1&&!review&&!(step.kind==='spelling'&&step.mode==='copy')?'independent':'supported';
      } else if (review) outcome='review';
      else throw new Error('정답을 확인하거나 도움 후 다시 연습으로 기록해 주세요.');
    }
    let skill=skills.get(step.skillId);
    if (!skill) {skill={skillId:step.skillId,independent:0,supported:0,review:0,observed:0};skills.set(step.skillId,skill);}
    result[outcome]++;skill[outcome]++;
    if(step.kind==='practice') {result.observed++;skill.observed++;}
  }
  result.skills=[...skills.values()];
  return result;
}
