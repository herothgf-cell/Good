/** User-supplied 15분 파닉스: chapter order and lexical examples, not an unmarked replacement curriculum.
 * The full PDF is NOT redistributed in the public build. Meanings/icons and interactive tasks are app adaptations.
 */
import type {LabStep} from './learning-lab-content.ts';
export interface PhonicsWord {word:string;meaning:string;icon:string;}
export interface PhonicsUnit {id:string;number:number;title:string;pattern:string;origin:'source'|'supplement';pdfPages:number[];printedPages:number[];words:PhonicsWord[];sentence:{text:string;meaning:string};}
const make=(number:number,title:string,pattern:string,entries:[string,string,string][],text:string,meaning:string):PhonicsUnit=>({id:String(number).padStart(2,'0'),number,title,pattern,origin:'source',pdfPages:[12+number*2,13+number*2],printedPages:[10+number*2,11+number*2],words:entries.map(([word,meaning,icon])=>({word,meaning,icon})),sentence:{text,meaning}});
export const PHONICS_UNITS:readonly PhonicsUnit[]=[
 make(1,'짧게 소리 나는 a','a',[
  ['fat','뚱뚱한','🐈'],['jam','잼','🍓'],['can','깡통','🥫'],['hat','모자','👒'],['ham','햄','🍖'],['fan','선풍기','🌀']], 'I am sad.','나는 슬퍼요.'),
 make(2,'짧게 소리 나는 e','e',[
  ['bed','침대','🛏️'],['pen','펜','🖊️'],['tell','말하다','💬'],['red','빨간색','🔴'],['men','남자들','👥'],['bell','종','🔔']], 'The bell is red.','그 종은 빨간색이에요.'),
 make(3,'짧게 소리 나는 i','i',[
  ['pig','돼지','🐷'],['win','이기다','🏆'],['kid','아이','🧒'],['wig','가발','💇'],['bin','쓰레기통','🗑️'],['did','했다','✅']], 'Don’t kick the bin. It is bad.','쓰레기통을 차지 마세요. 나쁜 행동이에요.'),
 make(4,'짧게 소리 나는 o','o',[
  ['cop','경찰관','👮'],['hot','뜨거운','🌡️'],['sock','양말','🧦'],['top','팽이 / 맨 위','🔝'],['pot','냄비','🍲'],['rock','바위','🪨']], 'The black pot in the shop is hot.','가게 안의 검은 냄비는 뜨거워요.'),
 make(5,'짧게 소리 나는 u','u',[
  ['up','위로','⬆️'],['bug','벌레','🐞'],['us','우리를','👥'],['cup','컵','☕'],['hug','안다','🤗'],['bus','버스','🚌']], 'Dad hugs us.','아빠가 우리를 안아 주세요.'),
 make(6,'알파벳 이름으로 소리 나는 a','a',[
  ['name','이름','🏷️'],['tape','테이프','📼'],['plane','비행기','✈️'],['table','탁자','🪑'],['cable','케이블','🔌']], 'My name is Jane.','내 이름은 제인이에요.'),
 make(7,'알파벳 이름으로 소리 나는 e','ee / ea',[
  ['bee','벌','🐝'],['tree','나무','🌳'],['queen','여왕','👑'],['tea','차','🍵'],['peach','복숭아','🍑'],['dream','꿈','💭']], 'The queen drinks tea.','여왕이 차를 마셔요.'),
 make(8,'알파벳 이름으로 소리 나는 i','i',[
  ['rice','쌀 / 밥','🍚'],['slice','한 조각','🧀'],['hide','숨다','📦'],['ride','타다','🚲'],['wide','넓은','↔️'],['kite','연','🪁']], 'Mike rides a bike.','마이크가 자전거를 타요.'),
 make(9,'알파벳 이름으로 소리 나는 o','o / oa',[
  ['nose','코','👃'],['cone','원뿔 / 콘','🍦'],['phone','전화기','☎️'],['toe','발가락','🦶'],['boat','배','⛵']], 'The coat is pink.','그 코트는 분홍색이에요.'),
 make(10,'알파벳 이름으로 소리 나는 u','u / ue',[
  ['glue','풀','🧴'],['blue','파란색','🔵'],['tube','튜브','🧪'],['cube','정육면체','🧊'],['huge','거대한','🐘']], 'The tube is blue.','그 튜브는 파란색이에요.'),
 make(11,'/쉬/ 소리 나는 sh','sh',[
  ['ship','배','🚢'],['sheep','양','🐑'],['shark','상어','🦈'],['fish','물고기','🐟'],['sheet','시트 / 한 장','📄']], 'The fish is on the ship.','그 물고기는 배 위에 있어요.'),
 make(12,'/취/ 소리 나는 ch','ch',[
  ['beach','해변','🏖️'],['bench','벤치','🪑'],['chess','체스','♟️'],['peach','복숭아','🍑'],['cherry','체리','🍒']], 'They are playing chess.','그들은 체스를 하고 있어요.'),
 make(13,'/쓰/ 소리 나는 th','th',[
  ['bath','목욕','🛁'],['math','수학','➕'],['teeth','이','🦷'],['thumb','엄지손가락','👍'],['throw','던지다','🏐']], 'She is brushing her teeth.','그녀는 이를 닦고 있어요.'),
 make(14,'/드/ 소리 나는 th','th',[
  ['this','이것','👇'],['that','저것','👉'],['those','저것들','👉'],['father','아버지','👨'],['they','그들','👥'],['these','이것들','👇'],['mother','어머니','👩']], 'That is my book.','저것은 내 책이에요.'),
 make(15,'받침소리 /ㅇ/으로 나는 ng','ng',[
  ['king','왕','👑'],['sing','노래하다','🎤'],['long','긴','📏'],['ring','반지','💍'],['wing','날개','🪽'],['song','노래','🎵']], 'The king sings a song.','왕이 노래를 불러요.'),
 make(16,'/우/ 소리 나는 oo','oo',[
  ['moon','달','🌙'],['tool','도구','🛠️'],['room','방','🚪'],['spoon','숟가락','🥄'],['pool','수영장','🏊'],['broom','빗자루','🧹']], 'She cleans a room with a broom.','그녀는 빗자루로 방을 청소해요.'),
 make(17,'/오우/ 소리 나는 ow','ow',[
  ['low','낮은','⬇️'],['slow','느린','🐢'],['crow','까마귀','🐦‍⬛'],['blow','불다','🎈'],['row','줄','🚶'],['grow','자라다','🌱']], 'The crow is flying low.','까마귀가 낮게 날고 있어요.'),
 make(18,'/오/ 소리 나는 aw','aw',[
  ['law','법','⚖️'],['saw','톱','🪚'],['draw','그리다','✏️'],['claw','발톱','🐾'],['seesaw','시소','🛝'],['straw','빨대','🥤']], 'The saw is in the drawer.','톱은 서랍 안에 있어요.'),
 make(19,'/어/ 소리 나는 강세 없는 a','a',[
  ['agree','동의하다','🤝'],['attack','공격하다','🦁'],['again','다시','🔁'],['alive','살아 있는','🐟'],['away','멀리 / 떨어져','🚶'],['around','주위에','⭕']], 'I agree with you.','나는 네 말에 동의해요.'),
 make(20,'/아르/ 소리 나는 ar','ar',[
  ['car','자동차','🚗'],['jar','단지','🫙'],['arm','팔','💪'],['far','멀리','🏔️'],['star','별','⭐'],['dark','어두운','🌃']], 'I have a car.','나는 자동차가 있어요.'),
 make(21,'/어르/ 소리 나는 er','er',[
  ['her','그녀의 / 그녀를','👩'],['sister','여자 형제','👭'],['winter','겨울','☃️'],['water','물','💧'],['dinner','저녁 식사','🍽️'],['singer','가수','🎤']], 'I like winter.','나는 겨울을 좋아해요.'),
 make(22,'ild, ind에서 알파벳 이름으로 소리 나는 i','ild / ind',[
  ['mild','온화한','🌤️'],['kind','친절한','🤝'],['child','아이','🧒'],['find','찾다','🔍'],['wild','야생의','🦁'],['mind','마음','💭']], 'You are a kind child!','너는 친절한 아이구나!'),
 {id:'supplement-ai-ay',number:0,title:'보충 · ai / ay',pattern:'ai / ay',origin:'supplement',pdfPages:[],printedPages:[],words:[{word:'rain',meaning:'비',icon:'🌧️'},{word:'day',meaning:'낮 / 하루',icon:'☀️'},{word:'mail',meaning:'우편물',icon:'✉️'},{word:'play',meaning:'놀다',icon:'⚽'}],sentence:{text:'I play in the rain.',meaning:'나는 빗속에서 놀아요.'}},
];
export function getPhonicsUnit(id:string):PhonicsUnit|undefined{return PHONICS_UNITS.find(u=>u.id===id);}
export function resolvePhonicsAudio(unitId:string,itemId:string):string|null{
 const unit=getPhonicsUnit(unitId);if(!unit)return null;
 if(itemId==='sentence')return unit.sentence.text;
 const match=/^word-(\d{1,2})$/.exec(itemId);return match?unit.words[Number(match[1])]?.word??null:null;
}
/** seed is a sequential word offset in this course, not a random difficulty level. */
export function buildPhonicsSteps(unitId:string,offset:number):LabStep[]{
 const unit=getPhonicsUnit(unitId);if(!unit||!Number.isInteger(offset)||offset<0||offset>=unit.words.length)throw Error('파닉스 단원과 단어 순서를 확인해 주세요.');
 const source={title:'15분 파닉스',origin:unit.origin,pdfPages:unit.pdfPages,printedPages:unit.printedPages};
 const steps:LabStep[]=[];const chosen=unit.words.slice(offset,offset+2);
 const add=(step:LabStep)=>steps.push({...step,source});
 chosen.forEach((word,j)=>{
  const index=offset+j,key=`word-${index}`,prefix=`phonics-${unit.id}-${index}`,skill=`english.phonics.${unit.id}`;
  const common={context:'familiar' as const,source,visual:{kind:'word' as const,icon:word.icon,label:word.meaning},hint:'먼저 뜻을 떠올리고, 배운 소리와 글자를 연결해 보세요.',explanation:`${word.word}: ${word.meaning}.`,readingKey:key};
  add({...common,id:`${prefix}-listen`,skillId:`${skill}.listen`,kind:'practice',mode:'model',title:'1 · AI 소리 듣고 따라 읽기',prompt:'AI가 단어를 읽어요. 글자와 뜻을 보고 따라 말해 보세요.',target:word.word,speech:word.word,cue:`오늘의 소리: ${unit.pattern} · AI가 생성한 전체 단어 음성을 들어요.`,helperWords:[]});
  add({...common,id:`${prefix}-read`,skillId:`${skill}.read`,kind:'practice',mode:'read',title:'2 · 스스로 읽기',prompt:'이번에는 먼저 듣지 않고 단어를 읽어 보세요.',target:word.word,speech:'',cue:'막히면 AI 소리를 다시 들어도 괜찮아요. 소리 도움은 별도로 기록해요.',helperWords:[]});
  add({...common,id:`${prefix}-write`,skillId:`${skill}.copy`,kind:'spelling',mode:'copy',title:'3 · 글자 순서대로 써 보기',prompt:`‘${word.word}’를 보고 글자를 차례대로 눌러 쓰세요.`,target:word.word,answer:word.word.toLowerCase(),letters:word.word.toLowerCase().split(''),hint:'왼쪽 글자부터 하나씩 살펴보세요. 아래 손글씨 연습판에서도 써 볼 수 있어요.'});
 });
 const first=chosen[0]!,last=chosen.at(-1)!,lastIndex=offset+chosen.length-1;
 add({id:`phonics-${unit.id}-${offset}-recall`,skillId:`english.phonics.${unit.id}.recall`,kind:'practice',mode:'recall',context:'changed',title:'4 · 뜻에서 단어 떠올리기',prompt:`‘${first.meaning}’를 영어로 말해 보세요.`,target:first.word,speech:'',cue:'답 글자는 가려 두었어요. 자동 말하기 점수가 아닌 관찰로 기록해요.',helperWords:[],visual:{kind:'word',icon:first.icon,label:first.meaning},readingKey:`word-${offset}`,hint:'앞에서 들었던 단어 소리를 떠올려 보세요.',explanation:`${first.word}: ${first.meaning}.`});
 add({id:`phonics-${unit.id}-${offset}-spell`,skillId:`english.phonics.${unit.id}.spell`,kind:'spelling',mode:'recall',context:'changed',title:'5 · 안 보고 철자 쓰기',prompt:`‘${last.meaning}’의 영어 단어를 써 보세요.`,target:last.word,answer:last.word.toLowerCase(),letters:[...new Set([...last.word.toLowerCase(),'a','e','i','o','u'])].sort(),visual:{kind:'word',icon:last.icon,label:last.meaning},readingKey:`word-${lastIndex}`,hint:'앞에서 본 글자를 하나씩 이어 보세요. 필요하면 AI 소리를 다시 들어요.',explanation:`${last.word}: ${last.meaning}.`});
 add({id:`phonics-${unit.id}-${offset}-sentence`,skillId:`english.phonics.${unit.id}.sentence`,kind:'practice',mode:'read',context:'changed',title:'6 · 문장으로 읽기',prompt:'단어를 문장 속에서 읽어 보세요. 어려우면 AI와 함께 읽어요.',target:unit.sentence.text,speech:'',cue:unit.origin==='source'?'교재의 예문이에요. 단원 단어 외의 낱말은 도움을 받아도 괜찮아요.':'이 문장은 앱에서 추가한 보충 예문이에요.',helperWords:[],readingKey:'sentence',hint:'AI 음성을 들으며 문장을 천천히 다시 읽어 보세요.',explanation:unit.sentence.meaning});
 add({id:`phonics-${unit.id}-${offset}-meaning`,skillId:`english.phonics.${unit.id}.meaning`,kind:'choice',context:'changed',title:'7 · 뜻 확인과 복습',prompt:`“${unit.sentence.text}”는 어떤 뜻일까요?`,options:[{id:'other-1',label:'아이가 과자를 먹고 있어요.'},{id:'meaning',label:unit.sentence.meaning},{id:'other-2',label:'친구가 문을 닫았어요.'}],answer:'meaning',hint:'문장에 나온 사람이나 물건, 행동을 생각해 보세요.',explanation:unit.sentence.meaning,readingKey:'sentence'});
 return steps;
}
