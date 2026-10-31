/** Reviewed activities shared by the browser and authoritative completion checks. */
export const LEARNING_CONTENT_VERSION = '2026-10-31.1';
export type LearningSubject = 'english' | 'math';
export type LearningHelp = 'none' | 'replay' | 'hint' | 'model';

export interface LearningOption { id:string; label:string; icon?:string; color?:string }
export type LearningVisual =
  | {kind:'ten-frame'; filled:number}
  | {kind:'base-ten'; hundreds:number; tens:number; ones:number}
  | {kind:'objects'; icon:string; left:number; right:number; operation:'add'|'subtract'};
export interface LearningQuestion {
  id:string; prompt:string; speech?:string; options:LearningOption[]; answerId:string;
  hint:string; explanation:string; practicePhrase?:string; visual?:LearningVisual;
}
export interface LearningLesson {
  id:string; subject:LearningSubject; title:string; description:string; icon:string;
  goal:string; questions:LearningQuestion[];
}
export interface LearningAnswer {questionId:string; optionId:string; attempts:number; help:LearningHelp}
export interface LearningEvaluation {total:number; independent:number; supported:number; firstTry:number}

const colors: Record<string, LearningOption> = {
  red:{id:'red', label:'빨강', color:'#dc2626'},
  blue:{id:'blue', label:'파랑', color:'#2563eb'},
  yellow:{id:'yellow', label:'노랑', color:'#facc15'},
  green:{id:'green', label:'초록', color:'#16a34a'},
  pink:{id:'pink', label:'분홍', color:'#f472b6'},
};
const animals: Record<string, LearningOption> = {
  cat:{id:'cat', label:'고양이', icon:'🐱'},
  dog:{id:'dog', label:'강아지', icon:'🐶'},
  bird:{id:'bird', label:'새', icon:'🐦'},
  fish:{id:'fish', label:'물고기', icon:'🐟'},
  rabbit:{id:'rabbit', label:'토끼', icon:'🐰'},
};
const things: Record<string, LearningOption> = {
  ball:{id:'ball', label:'공', icon:'⚽'},
  book:{id:'book', label:'책', icon:'📘'},
  water:{id:'water', label:'물', icon:'💧'},
  apple:{id:'apple', label:'사과', icon:'🍎'},
  pencil:{id:'pencil', label:'연필', icon:'✏️'},
};

function choices(source: Record<string, LearningOption>, ...ids:string[]):LearningOption[] {
  return ids.map(id => ({...source[id]!}));
}

function englishQuestion(
  id:string, prompt:string, speech:string, options:LearningOption[], answerId:string,
  hint:string, explanation:string,
):LearningQuestion {
  return {id, prompt, speech, options, answerId, hint, explanation, practicePhrase:speech};
}

function mathQuestion(
  id:string, prompt:string, options:string[], answerId:string, visual:LearningVisual,
  hint:string, explanation:string,
):LearningQuestion {
  return {id, prompt, options:options.map(value => ({id:value, label:value})), answerId, visual, hint, explanation};
}

const listenColor = '소리를 듣고 알맞은 색을 골라요.';
const listenAnimal = '소리를 듣고 알맞은 동물을 골라요.';
const listenRequest = '소리를 듣고 친구가 달라고 한 것을 골라요.';

export const LEARNING_LESSONS: readonly LearningLesson[] = [
  {
    id:'english-colors', subject:'english', title:'영어로 색깔 찾기', icon:'🎨',
    description:'짧은 영어를 듣고 같은 색을 찾아요.',
    goal:'다섯 가지 색깔 이름을 듣고 구별해요.',
    questions:[
      englishQuestion('color-red', listenColor, 'Find red.', choices(colors, 'blue', 'red', 'yellow'), 'red',
        'red는 빨강이에요. 빨간 색칸을 찾아봐요.', 'red는 빨강이에요. Find red.는 빨강을 찾으라는 뜻이에요.'),
      englishQuestion('color-blue', listenColor, 'Find blue.', choices(colors, 'blue', 'green', 'pink'), 'blue',
        'blue는 파랑이에요. 파란 색칸을 찾아봐요.', 'blue는 파랑이에요. 파랑을 잘 찾았어요.'),
      englishQuestion('color-yellow', listenColor, 'Find yellow.', choices(colors, 'red', 'green', 'yellow'), 'yellow',
        'yellow는 노랑이에요. 노란 색칸을 찾아봐요.', 'yellow는 노랑이에요. 노랑을 잘 찾았어요.'),
      englishQuestion('color-green', listenColor, 'Find green.', choices(colors, 'pink', 'green', 'blue'), 'green',
        'green은 초록이에요. 초록 색칸을 찾아봐요.', 'green은 초록이에요. 초록을 잘 찾았어요.'),
      englishQuestion('color-pink', listenColor, 'Find pink.', choices(colors, 'pink', 'yellow', 'red'), 'pink',
        'pink는 분홍이에요. 분홍 색칸을 찾아봐요.', 'pink는 분홍이에요. 분홍을 잘 찾았어요.'),
    ],
  },
  {
    id:'english-animals', subject:'english', title:'영어로 동물 찾기', icon:'🐾',
    description:'동물 이름을 듣고 그림을 골라요.',
    goal:'친숙한 동물 다섯 가지의 영어 이름을 알아봐요.',
    questions:[
      englishQuestion('animal-cat', listenAnimal, 'Find the cat.', choices(animals, 'cat', 'dog', 'bird'), 'cat',
        'cat은 고양이예요. 고양이 그림을 찾아봐요.', 'cat은 고양이예요. Find the cat.은 고양이를 찾으라는 뜻이에요.'),
      englishQuestion('animal-dog', listenAnimal, 'Find the dog.', choices(animals, 'rabbit', 'fish', 'dog'), 'dog',
        'dog는 강아지예요. 강아지 그림을 찾아봐요.', 'dog는 강아지예요. 강아지를 잘 찾았어요.'),
      englishQuestion('animal-bird', listenAnimal, 'Find the bird.', choices(animals, 'cat', 'bird', 'fish'), 'bird',
        'bird는 새예요. 새 그림을 찾아봐요.', 'bird는 새예요. 새를 잘 찾았어요.'),
      englishQuestion('animal-fish', listenAnimal, 'Find the fish.', choices(animals, 'fish', 'dog', 'rabbit'), 'fish',
        'fish는 물고기예요. 물고기 그림을 찾아봐요.', 'fish는 물고기예요. 물고기를 잘 찾았어요.'),
      englishQuestion('animal-rabbit', listenAnimal, 'Find the rabbit.', choices(animals, 'bird', 'rabbit', 'cat'), 'rabbit',
        'rabbit은 토끼예요. 토끼 그림을 찾아봐요.', 'rabbit은 토끼예요. 토끼를 잘 찾았어요.'),
    ],
  },
  {
    id:'english-requests', subject:'english', title:'무엇을 달라고 할까요?', icon:'🤲',
    description:'친구의 짧은 부탁을 듣고 물건을 골라요.',
    goal:'물건 이름과 정중한 부탁 표현 please를 들어봐요.',
    questions:[
      englishQuestion('request-ball', listenRequest, 'A ball, please.', choices(things, 'book', 'ball', 'water'), 'ball',
        'ball은 공이에요. 친구가 공을 달라고 해요.', 'A ball, please.는 공을 주세요라는 뜻이에요.'),
      englishQuestion('request-book', listenRequest, 'A book, please.', choices(things, 'book', 'pencil', 'apple'), 'book',
        'book은 책이에요. 친구가 책을 달라고 해요.', 'A book, please.는 책을 주세요라는 뜻이에요.'),
      englishQuestion('request-water', listenRequest, 'Water, please.', choices(things, 'apple', 'ball', 'water'), 'water',
        'water는 물이에요. 친구가 물을 달라고 해요.', 'Water, please.는 물을 주세요라는 뜻이에요.'),
      englishQuestion('request-apple', listenRequest, 'An apple, please.', choices(things, 'pencil', 'apple', 'book'), 'apple',
        'apple은 사과예요. 친구가 사과를 달라고 해요.', 'An apple, please.는 사과를 주세요라는 뜻이에요.'),
      englishQuestion('request-pencil', listenRequest, 'A pencil, please.', choices(things, 'pencil', 'water', 'ball'), 'pencil',
        'pencil은 연필이에요. 친구가 연필을 달라고 해요.', 'A pencil, please.는 연필을 주세요라는 뜻이에요.'),
    ],
  },
  {
    id:'math-ten', subject:'math', title:'10을 채워요', icon:'🔟',
    description:'열 칸 그림을 보고 10까지 더 필요한 수를 찾아요.',
    goal:'채워진 칸과 빈칸을 세며 10을 만들어요.',
    questions:[
      mathQuestion('ten-six', '10칸 중 6칸이 채워졌어요. 10칸을 모두 채우려면 몇 칸이 더 필요할까요?', ['3', '4', '5'], '4',
        {kind:'ten-frame', filled:6}, '빈칸을 하나씩 세어 봐요.', '6칸에 4칸을 더하면 10칸이에요. 6 + 4 = 10'),
      mathQuestion('ten-nine', '10칸 중 9칸이 채워졌어요. 몇 칸을 더 채우면 10이 될까요?', ['1', '2', '3'], '1',
        {kind:'ten-frame', filled:9}, '아직 채워지지 않은 칸을 찾아봐요.', '9칸에 1칸을 더하면 10칸이에요. 9 + 1 = 10'),
      mathQuestion('ten-three', '10칸 중 3칸이 채워졌어요. 몇 칸을 더 채우면 될까요?', ['6', '8', '7'], '7',
        {kind:'ten-frame', filled:3}, '윗줄과 아랫줄의 빈칸을 모두 세어 봐요.', '3칸에 7칸을 더하면 10칸이에요. 3 + 7 = 10'),
      mathQuestion('ten-five', '10칸 중 5칸이 채워졌어요. 10칸을 채우려면 몇 칸이 더 필요할까요?', ['4', '5', '6'], '5',
        {kind:'ten-frame', filled:5}, '한 줄은 5칸이에요. 빈 줄에 몇 칸이 있나요?', '5칸에 5칸을 더하면 10칸이에요. 5 + 5 = 10'),
      mathQuestion('ten-eight', '10칸 중 8칸이 채워졌어요. 몇 칸을 더 채우면 10이 될까요?', ['2', '1', '3'], '2',
        {kind:'ten-frame', filled:8}, '빈칸만 천천히 세어 봐요.', '8칸에 2칸을 더하면 10칸이에요. 8 + 2 = 10'),
    ],
  },
  {
    id:'math-place', subject:'math', title:'수의 집을 찾아요', icon:'🧱',
    description:'100 묶음, 10 묶음, 낱개 그림으로 수를 알아봐요.',
    goal:'백·십·일의 자리와 0이 있는 수를 읽어요.',
    questions:[
      mathQuestion('place-fourteen', '10 묶음이 1개, 낱개가 4개예요. 모두 얼마일까요?', ['41', '14', '10'], '14',
        {kind:'base-ten', hundreds:0, tens:1, ones:4}, '10 묶음 하나는 10이에요. 낱개 4개를 더해 봐요.', '10 + 4 = 14예요. 십의 자리는 1, 일의 자리는 4예요.'),
      mathQuestion('place-twenty-seven', '10 묶음이 2개, 낱개가 7개예요. 어떤 수일까요?', ['27', '72', '9'], '27',
        {kind:'base-ten', hundreds:0, tens:2, ones:7}, '10 묶음 두 개는 20이에요. 7을 더해 봐요.', '20 + 7 = 27이에요. 십의 자리는 2, 일의 자리는 7이에요.'),
      mathQuestion('place-thirty', '10 묶음이 3개, 낱개는 없어요. 어떤 수일까요?', ['3', '13', '30'], '30',
        {kind:'base-ten', hundreds:0, tens:3, ones:0}, '10을 세 번 세어 봐요. 낱개가 없으면 일의 자리는 0이에요.', '10 + 10 + 10 = 30이에요. 낱개가 없어 일의 자리는 0이에요.'),
      mathQuestion('place-one-hundred-five', '100 묶음이 1개, 10 묶음은 없고 낱개가 5개예요. 어떤 수일까요?', ['150', '105', '15'], '105',
        {kind:'base-ten', hundreds:1, tens:0, ones:5}, '100에 낱개 5개를 더해요. 십의 자리는 0이에요.', '100 + 0 + 5 = 105예요. 십의 자리가 비어 있어도 0을 써요.'),
      mathQuestion('place-one-hundred-twenty', '100 묶음이 1개, 10 묶음이 2개, 낱개는 없어요. 어떤 수일까요?', ['120', '102', '12'], '120',
        {kind:'base-ten', hundreds:1, tens:2, ones:0}, '100에 10 두 묶음을 더해요. 일의 자리는 0이에요.', '100 + 20 + 0 = 120이에요. 일의 자리에 0을 써요.'),
    ],
  },
  {
    id:'math-stories', subject:'math', title:'그림 속 수 이야기', icon:'📖',
    description:'물건이 늘거나 줄어드는 이야기를 그림으로 풀어요.',
    goal:'10 안에서 더하고 빼며 남은 수를 알아봐요.',
    questions:[
      mathQuestion('story-apples', '사과가 3개 있어요. 2개를 더 받았어요. 모두 몇 개일까요?', ['4', '5', '6'], '5',
        {kind:'objects', icon:'🍎', left:3, right:2, operation:'add'}, '처음 사과와 새로 받은 사과를 함께 세어 봐요.', '사과 3개와 2개를 합치면 5개예요. 3 + 2 = 5'),
      mathQuestion('story-cookies', '쿠키가 7개 있어요. 3개를 먹었어요. 몇 개가 남을까요?', ['4', '3', '5'], '4',
        {kind:'objects', icon:'🍪', left:7, right:3, operation:'subtract'}, '7개 중 먹은 3개를 빼고 남은 쿠키를 세어 봐요.', '쿠키 7개에서 3개를 빼면 4개가 남아요. 7 − 3 = 4'),
      mathQuestion('story-balls', '공이 4개 있어요. 친구가 4개를 더 가져왔어요. 모두 몇 개일까요?', ['6', '7', '8'], '8',
        {kind:'objects', icon:'⚽', left:4, right:4, operation:'add'}, '두 무리의 공을 모두 세어 봐요.', '공 4개와 4개를 합치면 8개예요. 4 + 4 = 8'),
      mathQuestion('story-strawberries', '딸기가 6개 있어요. 6개를 모두 나누어 주었어요. 몇 개가 남을까요?', ['1', '0', '6'], '0',
        {kind:'objects', icon:'🍓', left:6, right:6, operation:'subtract'}, '모두 나누어 주면 남아 있는 딸기가 있을까요?', '딸기 6개를 모두 주면 0개가 남아요. 6 − 6 = 0'),
      mathQuestion('story-cars', '장난감 자동차가 2대 있어요. 5대를 더 가져왔어요. 모두 몇 대일까요?', ['7', '6', '8'], '7',
        {kind:'objects', icon:'🚗', left:2, right:5, operation:'add'}, '처음 2대와 새로 온 5대를 함께 세어 봐요.', '자동차 2대와 5대를 합치면 7대예요. 2 + 5 = 7'),
    ],
  },
];

export function getLearningLesson(id:string):LearningLesson|undefined {
  return LEARNING_LESSONS.find(lesson => lesson.id === id);
}

/** Completion proves five final choices; it does not assess speech or grant rewards. */
export function evaluateLearningAnswers(lessonId:string, answers:unknown):LearningEvaluation {
  const lesson = getLearningLesson(lessonId);
  if (!lesson) throw new Error('알 수 없는 학습 활동이에요.');
  if (!Array.isArray(answers) || answers.length !== lesson.questions.length) {
    throw new Error('모든 문항의 답을 한 번씩 보내 주세요.');
  }
  const seen = new Set<string>();
  let independent = 0;
  let firstTry = 0;
  for (const entry of answers) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new Error('학습 답의 형식이 올바르지 않아요.');
    }
    const {questionId, optionId, attempts, help} = entry as Record<string, unknown>;
    if (typeof questionId !== 'string' || seen.has(questionId)) {
      throw new Error('문항은 한 번씩만 보낼 수 있어요.');
    }
    const question = lesson.questions.find(item => item.id === questionId);
    if (!question || typeof optionId !== 'string' || optionId !== question.answerId) {
      throw new Error('각 문항의 정답을 선택하고 완료해 주세요.');
    }
    if (typeof attempts !== 'number' || !Number.isInteger(attempts) || attempts < 1 || attempts > 20) {
      throw new Error('선택 횟수는 1부터 20까지의 정수여야 해요.');
    }
    if (help !== 'none' && help !== 'replay' && help !== 'hint' && help !== 'model') {
      throw new Error('도움 기록이 올바르지 않아요.');
    }
    seen.add(questionId);
    if (attempts === 1) {
      firstTry++;
      if (help === 'none') independent++;
    }
  }
  return {total:lesson.questions.length, independent, supported:lesson.questions.length - independent, firstTry};
}
