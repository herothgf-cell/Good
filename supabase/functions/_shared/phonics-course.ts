/** Source order/words: Seoul education authority 15-minute phonics, printed pp.12–55.
 * UI steps, Korean hints and the supplemental ai/ay lesson are application adaptations. */
export const PHONICS_VERSION='2026-11-02.unified.1';
export const PHONICS_SOURCE={title:'서울특별시교육청 영어 기초학력 지도교재 · 15분 파닉스',pages:84,sha256:'9d18c81241892fef4f71a97e8284a6460e14d4ae85db7458bfe0655862e94703'};
export interface PhonicsWord {text:string;meaning:string;}
export interface PhonicsUnit {id:string;number:number|null;title:string;source:'seoul15'|'supplement';printedPage:number|null;pdfPage:number|null;patterns:string[];words:PhonicsWord[];sentence:{text:string;meaning:string};}
const w=(value:string):PhonicsWord[]=>value.split('|').map(pair=>{const [text,meaning]=pair.split(':');return {text:text!,meaning:meaning!};});
function unit(number:number,id:string,title:string,patterns:string[],words:string,sentence:string,meaning:string):PhonicsUnit{return {id,number,title,source:'seoul15',printedPage:10+number*2,pdfPage:12+number*2,patterns,words:w(words),sentence:{text:sentence,meaning}};}
export const PHONICS_UNITS:readonly PhonicsUnit[]=[
 unit(1,'short-a','짧게 소리 나는 a',['a + t → at','a + m → am','a + n → an'],'fat:뚱뚱한|jam:잼|can:깡통|hat:모자|ham:햄|fan:선풍기','I am sad.','나는 슬퍼요.'),
 unit(2,'short-e','짧게 소리 나는 e',['e + d → ed','e + n → en','e + ll → ell'],'bed:침대|pen:펜|tell:말하다|red:빨강|men:남자들|bell:종','The bell is red.','그 종은 빨간색이에요.'),
 unit(3,'short-i','짧게 소리 나는 i',['i + g → ig','i + n → in','i + d → id'],'pig:돼지|win:이기다|kid:아이|wig:가발|bin:통|did:했다','A king has a wig in a bag.','왕은 가방 안에 가발을 가지고 있어요.'),
 unit(4,'short-o','짧게 소리 나는 o',['o + p → op','o + t → ot','o + ck → ock'],'cop:경찰관|hot:뜨거운|sock:양말|top:맨 위|pot:냄비|rock:바위','The black pot in the shop is hot.','가게 안의 검은 냄비는 뜨거워요.'),
 unit(5,'short-u','짧게 소리 나는 u',['u + p → up','u + g → ug','u + s → us'],'up:위로|bug:벌레|us:우리를|cup:컵|hug:안다|bus:버스','Dad hugs us.','아빠가 우리를 안아 주어요.'),
 unit(6,'long-a','알파벳 이름으로 소리 나는 a',['a + m + e → ame','a + n + e → ane','a + b + le → able'],'name:이름|tape:테이프|plane:비행기|table:탁자|cable:케이블','My name is Jane.','내 이름은 제인이에요.'),
 unit(7,'long-e','알파벳 이름으로 소리 나는 e',['b + ee → bee','p + ea → pea','ee + n → een','ea + m → eam'],'bee:벌|tree:나무|queen:여왕|tea:차|peach:복숭아|dream:꿈','The queen drinks tea.','여왕은 차를 마셔요.'),
 unit(8,'long-i','알파벳 이름으로 소리 나는 i',['i + c + e → ice','i + d + e → ide','i + t + e → ite'],'rice:쌀|slice:한 조각|hide:숨다|ride:타다|wide:넓은|kite:연','Mike rides a bike.','마이크는 자전거를 타요.'),
 unit(9,'long-o','알파벳 이름으로 소리 나는 o',['o + se → ose','o + ne → one','o + e → oe','oa + t → oat'],'nose:코|cone:콘|phone:전화기|toe:발가락|boat:배','The doe has a cute nose.','그 암사슴은 귀여운 코를 가지고 있어요.'),
 unit(10,'long-u','알파벳 이름으로 소리 나는 u',['u + be → ube','u + ge → uge','u + e → ue'],'glue:풀|blue:파랑|tube:튜브|cube:정육면체|huge:거대한','The tube is blue.','그 튜브는 파란색이에요.'),
 unit(11,'sh','/쉬/ 소리 나는 sh',['sh + i → shi','sh + ee → shee','sh + ar → shar','i + sh → ish'],'ship:배|sheep:양|shark:상어|fish:물고기|sheet:시트','The fish is on the ship.','물고기가 배 위에 있어요.'),
 unit(12,'ch','/취/ 소리 나는 ch',['- + ch → ch','ch + e → che','ch + i → chi'],'beach:해변|bench:벤치|chess:체스|peach:복숭아|cherry:체리','He gave me three chicks.','그는 나에게 병아리 세 마리를 주었어요.'),
 unit(13,'th-unvoiced','/쓰/ 소리 나는 th',['a + th → ath','ee + th → eeth','th + u → thu'],'bath:목욕|math:수학|teeth:이들|thumb:엄지손가락|throw:던지다','She is brushing her teeth.','그녀는 이를 닦고 있어요.'),
 unit(14,'th-voiced','/드/ 소리 나는 th',['th + i → thi','th + a → tha','th + er → ther'],'this:이것|that:저것|those:저것들|father:아버지|they:그들|these:이것들|mother:어머니','They are my mother and father.','그들은 나의 어머니와 아버지예요.'),
 unit(15,'ng','받침소리 /ㅇ/으로 나는 ng',['i + ng → ing','o + ng → ong'],'king:왕|sing:노래하다|long:긴|ring:반지|wing:날개|song:노래','The king sings a song.','왕은 노래를 불러요.'),
 unit(16,'oo','/우/ 소리 나는 oo',['oo + l → ool','oo + m → oom','oo + n → oon'],'moon:달|tool:도구|room:방|spoon:숟가락|pool:수영장|broom:빗자루','She cleans a room with a broom.','그녀는 빗자루로 방을 청소해요.'),
 unit(17,'ow','/오우/ 소리 나는 ow',['l + ow → low','r + ow → row'],'low:낮은|slow:느린|crow:까마귀|blow:불다|row:줄|grow:자라다','I blow a balloon.','나는 풍선을 불어요.'),
 unit(18,'aw','/오/ 소리 나는 aw',['l + aw → law','s + aw → saw','r + aw → raw'],'law:법|saw:톱|draw:그리다|claw:발톱|seesaw:시소|straw:빨대','I want to be a lawyer.','나는 변호사가 되고 싶어요.'),
 unit(19,'unstressed-a','/어/ 소리 나는 강세 없는 a',['a + 자음 → 약한 모음 + 자음'],'agree:동의하다|attack:공격하다|again:다시|alive:살아 있는|away:멀리|around:주위에','I agree with you.','나는 너에게 동의해요.'),
 unit(20,'ar','/아r/ 소리 나는 ar',['a + r → ar'],'car:자동차|jar:병|arm:팔|far:먼|star:별|dark:어두운','I have a car.','나는 자동차를 가지고 있어요.'),
 unit(21,'er','/어r/ 소리 나는 er',['e + r → er'],'her:그녀를|sister:자매|winter:겨울|water:물|dinner:저녁 식사|singer:가수','I like winter.','나는 겨울을 좋아해요.'),
 unit(22,'ild-ind','ild, ind에서 알파벳 이름으로 소리 나는 i',['i + ld → ild','i + nd → ind'],'mild:온화한|kind:친절한|child:아이|find:찾다|wild:야생의|mind:마음','You are a kind child!','너는 친절한 아이구나!'),
 {id:'ai-ay',number:null,title:'보충 · ai / ay',source:'supplement',printedPage:null,pdfPage:null,patterns:['r + ai + n → rain','d + ay → day'],words:w('rain:비|tail:꼬리|mail:우편물|day:낮|say:말하다|play:놀다'),sentence:{text:'I can play in the rain.',meaning:'나는 빗속에서 놀 수 있어요.'}},
];
export type PhonicsKind='listen'|'read'|'write'|'recall'|'sentence'|'review';
export interface PhonicsStep {id:string;kind:PhonicsKind;target:string;meaning:string;wordIndex:number;sourceStep:2|3|4;}
export function getPhonicsUnit(id:string):PhonicsUnit{const u=PHONICS_UNITS.find(u=>u.id===id);if(!u)throw Error('파닉스 단원을 확인해 주세요.');return u;}
export function buildPhonicsSteps(id:string):PhonicsStep[]{const u=getPhonicsUnit(id);return [...u.words.flatMap((word,index)=>(['listen','read','write','recall'] as const).map(kind=>({id:`${u.id}:${index}:${kind}`,kind,target:word.text,meaning:word.meaning,wordIndex:index,sourceStep:2 as const}))),{id:`${u.id}:sentence`,kind:'sentence',target:u.sentence.text,meaning:u.sentence.meaning,wordIndex:-1,sourceStep:3},{id:`${u.id}:review`,kind:'review',target:u.words[0]!.text,meaning:u.words[0]!.meaning,wordIndex:0,sourceStep:4}];}
export interface PhonicsObservation {outcome:'independent'|'supported'|'review';answer?:string;attempts:number;help:boolean;}
export interface PhonicsResult {outcome:PhonicsObservation['outcome'];evidence:'spelling'|'self-observation'|'practice';attempts:number;}
export function validatePhonicsCompletion(id:string,index:number,value:unknown):PhonicsResult{
 const step=buildPhonicsSteps(id)[index];if(!Number.isSafeInteger(index)||!step||!value||typeof value!=='object'||Array.isArray(value))throw Error('단계 기록을 확인해 주세요.');
 const a=value as PhonicsObservation;
 if(Object.keys(a).some(k=>!['outcome','answer','attempts','help'].includes(k))||!['independent','supported','review'].includes(a.outcome)||!Number.isSafeInteger(a.attempts)||a.attempts<1||a.attempts>30||typeof a.help!=='boolean')throw Error('시도 기록을 확인해 주세요.');
 const spelling=['write','recall','review'].includes(step.kind);
 if(spelling&&a.outcome!=='review'&&(typeof a.answer!=='string'||a.answer.normalize('NFKC').trim().toLowerCase()!==step.target.toLowerCase()))throw Error('낱말의 철자를 확인해 주세요.');
 if(a.answer!==undefined&&(typeof a.answer!=='string'||a.answer.length>40||!/^[a-zA-Z\s]*$/.test(a.answer)))throw Error('영어 낱말만 입력해 주세요.');
 return {outcome:a.outcome==='review'?'review':a.help||a.attempts>1||step.kind==='listen'?'supported':a.outcome,evidence:spelling?'spelling':step.kind==='listen'?'practice':'self-observation',attempts:a.attempts};
}
export function phonicsSpeech(id:string,index:number):string{const step=buildPhonicsSteps(id)[index];if(!Number.isSafeInteger(index)||!step)throw Error('읽을 낱말을 확인해 주세요.');return step.target;}
