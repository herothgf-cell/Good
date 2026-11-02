import test from 'node:test';
import assert from 'node:assert/strict';

const moduleUrl = process.env.LEARNING_LAB_CONTENT_MODULE || new URL('../dist/supabase/functions/_shared/learning-lab-content.js', import.meta.url).href;
const content = await import(moduleUrl).catch(error => {
  if (error.code === 'ERR_MODULE_NOT_FOUND') return {};
  throw error;
});
const ids = ['english-conversation','english-words','english-reading','math-calculation','math-transfer','math-clock','math-calendar','math-groups','math-patterns'];
const settings = () => ({...content.DEFAULT_LAB_SETTINGS});
const build = (id, overrides = {}, seed = 17) => content.buildLabLesson(id, {...settings(), ...overrides}, seed);
const complete = lesson => lesson.steps.map(step => step.kind === 'practice'
  ? {stepId:step.id, attempts:1, help:'none', observation:'independent', evidence:'guardian'}
  : {stepId:step.id, value:step.answer, attempts:1, help:'none'});

// Removing bounded generation, strict validation or outcome separation must fail these behavioural assertions.
test('catalog preserves legacy content and adds the integrated source course', () => {
  assert.equal(content.LAB_CONTENT_VERSION, '2026-11-02.2');
  assert.deepEqual(content.LAB_CATALOG.map(item => item.id), ['english-conversation','english-phonics',...ids.slice(1)]);
  assert.deepEqual(settings(), {topic:'play',phonicsUnit:'01',phonics:'ai-ay',conversationSupport:'guided',addition:'mixed',subtraction:'mixed',moneyUnit:1000,clockLevel:1,calendarLevel:1,groupSize:2,patternLevel:1});
  const clean = content.validateLabSettings(settings());
  assert.deepEqual(clean, settings());
  assert.notEqual(clean, content.DEFAULT_LAB_SETTINGS);
  for (const value of [null, [], {}, {...settings(), unexpected:true}, {...settings(), clockLevel:4}, {...settings(), moneyUnit:'1000'}, {...settings(), phonics:'unknown'}]) {
    assert.throws(() => content.validateLabSettings(value));
  }
});

test('sessions are deterministic, bounded, varied and isolated mutable outputs', () => {
  for (const id of ids) {
    const lesson = build(id);
    assert.deepEqual(lesson, build(id));
    assert.ok(lesson.steps.length >= 4 && lesson.steps.length <= 10, id);
    assert.equal(new Set(lesson.steps.map(s => s.id)).size, lesson.steps.length);
    assert.equal(lesson.subject, id.startsWith('english') ? 'english' : 'math');
    for (const step of lesson.steps) {
      for (const field of ['id','skillId','title','prompt','hint','explanation']) assert.ok(step[field]?.trim(), `${id}/${field}`);
      assert.ok(['familiar','changed','symbolic'].includes(step.context));
      if (step.kind === 'choice') {
        assert.equal(new Set(step.options.map(o => o.id)).size, step.options.length);
        assert.equal(new Set(step.options.map(o => o.label)).size, step.options.length);
        assert.ok(step.options.some(o => o.id === step.answer));
      }
    }
    assert.ok(new Set(Array.from({length:12}, (_, seed) => JSON.stringify(build(id, {}, seed).steps))).size >= 3, id);
    lesson.steps[0].title = 'mutated';
    assert.notEqual(build(id).steps[0].title, 'mutated');
  }
  for (const seed of [-1, 2147483648, 0.5, NaN, Infinity, '1']) assert.throws(() => build('math-calculation', {}, seed));
  assert.throws(() => build('unknown'));
});

test('two-digit calculation obeys each addition and subtraction regrouping setting', () => {
  for (const mode of ['no-regroup','regroup','mixed']) {
    const observed = {add:new Set(), subtract:new Set()};
    for (let seed = 0; seed < 100; seed++) {
      for (const step of build('math-calculation', {addition:mode,subtraction:mode}, seed).steps) {
        assert.equal(step.kind, 'number');
        const match = step.prompt.match(/(\d+)\s*([+−-])\s*(\d+)/);
        assert.ok(match, step.prompt);
        const [,aText,op,bText] = match;
        const a = Number(aText), b = Number(bText);
        assert.ok(a >= 10 && a <= 99 && b >= 10 && b <= 99);
        const add = op === '+';
        assert.equal(Number(step.answer), add ? a + b : a - b);
        assert.ok(Number(step.answer) >= 0);
        const regroup = add ? a % 10 + b % 10 >= 10 : a % 10 < b % 10;
        observed[add ? 'add' : 'subtract'].add(regroup);
        if (mode !== 'mixed') assert.equal(regroup, mode === 'regroup', step.prompt);
      }
    }
    if (mode === 'mixed') for (const set of Object.values(observed)) assert.equal(set.size, 2);
  }
});

test('money transfer links equivalent quantities and tests a fresh analogous answer', () => {
  for (const moneyUnit of [100,1000,10000]) for (let seed = 0; seed < 40; seed++) {
    const lesson = build('math-transfer', {moneyUnit}, seed);
    const money = lesson.steps.find(s => s.visual?.kind === 'money');
    assert.equal(money.visual.unit, moneyUnit);
    const [a,b] = money.visual.counts;
    assert.equal(Number(money.answer), (a+b)*moneyUnit);
    const groups = lesson.steps.find(s => s.visual?.kind === 'groups');
    assert.equal(Number(groups.answer), groups.visual.groups * groups.visual.size);
    assert.equal(Number(groups.answer), a+b);
    const equation = lesson.steps.find(s => s.context === 'symbolic');
    assert.match(equation.prompt, new RegExp(`${a}\\s*\\+\\s*${b}`));
    assert.equal(Number(equation.answer), a+b);
    const fresh = lesson.steps.at(-1);
    assert.equal(fresh.context, 'changed');
    assert.notEqual(fresh.answer, equation.answer);
    assert.equal(lesson.steps.filter(s => s.answer === equation.answer).length <= 2, true);
  }
});

function totalMinutes(hour, minute) { return hour*60+minute; }
test('clock levels solve within-hour, crossing-hour and reverse/duration relations exactly', () => {
  for (const clockLevel of [1,2,3]) for (let seed = 0; seed < 80; seed++) {
    const lesson = build('math-clock', {clockLevel}, seed);
    for (const step of lesson.steps) {
      assert.equal(step.kind, 'number');
      assert.equal(step.visual.kind, 'clock');
      const v = step.visual;
      assert.ok(v.hour >= 0 && v.hour <= 23 && v.minute >= 0 && v.minute < 60);
      assert.ok(v.endHour >= 0 && v.endHour <= 23 && v.endMinute >= 0 && v.endMinute < 60);
      const duration = (totalMinutes(v.endHour,v.endMinute) - totalMinutes(v.hour,v.minute) + 1440) % 1440;
      assert.ok(duration > 0 && duration <= 90);
      if (clockLevel === 1) assert.equal(v.hour, v.endHour);
      if (clockLevel === 2) assert.notEqual(v.hour, v.endHour);
      if (step.format === 'integer') assert.equal(Number(step.answer), duration);
      else {
        const expected = step.skillId.endsWith('start') ? `${String(v.hour).padStart(2,'0')}:${String(v.minute).padStart(2,'0')}` : `${String(v.endHour).padStart(2,'0')}:${String(v.endMinute).padStart(2,'0')}`;
        assert.equal(step.answer, expected);
      }
    }
    if (clockLevel === 3) {
      assert.ok(lesson.steps.some(s => s.skillId.endsWith('start')));
      assert.ok(lesson.steps.some(s => s.format === 'integer'));
    }
  }
});

test('calendar relations use exact Gregorian dates including leap years and year boundaries', () => {
  const seen = new Set();
  for (const calendarLevel of [1,2]) for (let seed = 0; seed < 120; seed++) {
    for (const step of build('math-calendar', {calendarLevel}, seed).steps) {
      const v = step.visual;
      assert.equal(v.kind, 'calendar');
      const start = new Date(Date.UTC(v.year,v.month-1,v.day));
      const offset = Number(step.prompt.match(/(\d+)일 (뒤|후)/)?.[1]);
      assert.ok(offset >= 1 && offset <= 14, step.prompt);
      const target = new Date(start.getTime() + offset*86400000);
      assert.equal(step.answer, target.toISOString().slice(0,10));
      assert.equal(v.targetDay, target.getUTCDate());
      assert.equal(v.targetMonth, target.getUTCMonth()+1);
      if (calendarLevel === 1) assert.equal(target.getUTCMonth()+1, v.month);
      else assert.notEqual(target.getUTCMonth()+1, v.month);
      seen.add(step.answer);
    }
  }
  assert.ok([...seen].some(s => s.includes('-02-29')));
  assert.ok([...seen].some(s => s.endsWith('-01-01')));
});

test('equal groups use configured 2 or 3 with repeated addition and changed arrangements', () => {
  for (const groupSize of [2,3]) for (let seed = 0; seed < 50; seed++) {
    const lesson = build('math-groups', {groupSize}, seed);
    assert.ok(lesson.steps.some(s => s.prompt.includes('+')));
    assert.ok(lesson.steps.some(s => s.context === 'changed'));
    assert.ok(lesson.steps.some(s => s.context === 'symbolic'));
    for (const step of lesson.steps) {
      assert.equal(step.kind, 'number');
      assert.equal(step.visual.kind, 'groups');
      assert.equal(step.visual.size, groupSize);
      assert.equal(Number(step.answer), groupSize * step.visual.groups);
    }
  }
});

test('patterns state bounded unambiguous rule and matching missing number', () => {
  for (const patternLevel of [1,2]) for (let seed = 0; seed < 60; seed++) {
    for (const step of build('math-patterns', {patternLevel}, seed).steps) {
      assert.equal(step.visual.kind, 'sequence');
      assert.equal(step.visual.items.filter(n => n === null).length, 1);
      const values = step.visual.items.map(n => n ?? Number(step.answer));
      assert.ok(values.every(n => Number.isInteger(n) && n >= 0 && n <= 150));
      assert.match(step.prompt, /규칙/);
      const changes = values.slice(1).map((n,i) => n-values[i]);
      if (patternLevel === 1) assert.equal(new Set(changes).size, 1);
      else for (let i=2;i<changes.length;i++) assert.equal(changes[i],changes[i-2]);
    }
  }
});

test('word recall conceals the English target and provides meaningful visual retrieval', () => {
  for (const phonics of ['ai-ay','silent-e','cvc']) for (let seed = 0; seed < 15; seed++) {
    const lesson = build('english-words', {phonics}, seed);
    const recall = lesson.steps.filter(s => s.kind === 'practice' && s.mode === 'recall');
    assert.ok(recall.length >= 3);
    assert.ok(lesson.steps.some(s => s.mode === 'model'));
    assert.ok(recall.some(s => s.context === 'changed'));
    for (const step of recall) {
      assert.equal(step.speech, '');
      assert.equal(step.visual.kind, 'word');
      const visible = [step.title,step.prompt,step.cue,step.visual.label,...step.helperWords].join(' ').toLowerCase();
      assert.equal(visible.includes(step.target.toLowerCase()), false, visible);
      assert.ok(/[가-힣]/.test(step.visual.label));
      assert.ok(step.visual.icon);
    }
  }
});

test('reading separates model, independent decoding, new-pattern words and meaning', () => {
  for (const phonics of ['ai-ay','silent-e','cvc']) {
    const lesson = build('english-reading', {phonics});
    const practices = lesson.steps.filter(s => s.kind === 'practice');
    for (const mode of ['model','read','transfer-read']) assert.ok(practices.some(s => s.mode === mode));
    assert.ok(lesson.steps.some(s => s.kind === 'choice'));
    const familiar = practices.filter(s => ['model','read'].includes(s.mode) && !s.target.includes(' ')).map(s => s.target);
    for (const step of practices.filter(s => s.mode === 'transfer-read')) assert.ok(!familiar.includes(step.target));
    const connected = practices.find(s => s.target.includes(' '));
    assert.ok(connected.helperWords.length > 0);
    assert.match(connected.prompt, /스스로/);
    assert.ok(practices.filter(s => s.mode !== 'model').every(s => s.speech === ''));
  }
});

test('conversation is a varied topic-specific scenario preview with clear support', () => {
  const targets = [];
  for (const topic of ['play','shop','build']) {
    const lesson = build('english-conversation', {topic});
    assert.match(`${lesson.title} ${lesson.description}`, /글·음성/);
    assert.ok(!`${lesson.title} ${lesson.description}`.includes('실시간'));
    assert.ok(lesson.steps.every(s => s.kind === 'practice' && s.mode === 'conversation'));
    assert.ok(lesson.steps.every(s => s.cue.includes('한국어')));
    targets.push(lesson.steps.map(s => s.target).join('|'));
  }
  assert.equal(new Set(targets).size, 3);
  assert.notDeepEqual(build('english-conversation',{conversationSupport:'guided'}),build('english-conversation',{conversationSupport:'light'}));
});

test('normalization accepts accessible number/time/date input without coercing malformed answers', () => {
  for (const [raw, expected] of [[' １２,３４５ ','12345'],['00042','42'],['0','0'],['１０００원','1000']]) assert.equal(content.normalizeLabAnswer(raw,'integer'),expected);
  for (const raw of ['','-1','1.5','1e2','12,34','1 2','Infinity','+1','1,000.00']) assert.equal(content.normalizeLabAnswer(raw,'integer'),'');
  for (const [raw, expected] of [['9:5','09:05'],['０９：３０','09:30'],['9시 5분','09:05'],['23:59','23:59']]) assert.equal(content.normalizeLabAnswer(raw,'time'),expected);
  for (const raw of ['24:00','9:60','09:30abc','930']) assert.equal(content.normalizeLabAnswer(raw,'time'),'');
  for (const [raw,expected] of [['2024/2/29','2024-02-29'],['２０２６．３．１','2026-03-01'],['2026년 12월 31일','2026-12-31']]) assert.equal(content.normalizeLabAnswer(raw,'date'),expected);
  for (const raw of ['2025-02-29','2026-04-31','2026-13-01','26-01-01','2026-01-01garbage']) assert.equal(content.normalizeLabAnswer(raw,'date'),'');
});

test('evaluation separates final accuracy, help, retry and explicitly evidenced observation', () => {
  const lesson = build('math-calculation');
  const answers = complete(lesson);
  answers[1].help = 'replay';
  answers[2].attempts = 2;
  answers[3] = {stepId:lesson.steps[3].id, attempts:2, help:'model', observation:'retry', evidence:'guardian'};
  answers[4] = {stepId:lesson.steps[4].id, value:'999', attempts:1, help:'hint', observation:'retry', evidence:'self'};
  const result = content.evaluateLabAnswers(lesson, answers);
  assert.equal(result.total, lesson.steps.length);
  assert.equal(result.correct, lesson.steps.length-2);
  assert.equal(result.independent, lesson.steps.length-4);
  assert.equal(result.supported, 2);
  assert.equal(result.review, 2);
  assert.equal(result.observed, 0);
  assert.equal(result.skills.reduce((n,s) => n+s.independent+s.supported+s.review,0),lesson.steps.length);
  const words = build('english-words');
  const wordAnswers = complete(words);
  const recallIndex = words.steps.findIndex(s => s.mode === 'recall');
  wordAnswers[recallIndex].help = 'hint';
  const observed = content.evaluateLabAnswers(words,wordAnswers);
  assert.equal(observed.correct, words.steps.filter(s => s.kind !== 'practice').length);
  assert.equal(observed.observed, words.steps.filter(s => s.kind === 'practice').length);
  assert.ok(observed.supported >= words.steps.filter(s => s.mode === 'model').length+1);
});

test('evaluation rejects missing, duplicate, foreign and untrusted answer data', () => {
  const lesson = build('math-calculation');
  const valid = complete(lesson);
  const invalid = [null,{},valid.slice(1),[...valid,valid[0]],valid.map((a,i)=> i ? a : {...a,stepId:'foreign'}),valid.map((a,i)=> i ? a : {...a,attempts:0}),valid.map((a,i)=> i ? a : {...a,attempts:31}),valid.map((a,i)=> i ? a : {...a,attempts:1.5}),valid.map((a,i)=> i ? a : {...a,help:'unknown'}),valid.map((a,i)=> i ? a : {...a,value:'abc'}),valid.map((a,i)=> i ? a : {...a,transcript:'secret'}),valid.map((a,i)=> i ? a : {...a,value:'999'})];
  for (const answers of invalid) assert.throws(() => content.evaluateLabAnswers(lesson,answers));
  const words = build('english-words');
  for (const extra of [{value:'transcript'},{evidence:undefined},{observation:undefined},{evidence:'automatic'},{observation:'passed'}]) {
    const answers = complete(words); answers[0] = {...answers[0],...extra};
    assert.throws(() => content.evaluateLabAnswers(words,answers));
  }
  const review = complete(lesson);
  review[0] = {stepId:lesson.steps[0].id, attempts:1, help:'none', observation:'retry',evidence:'guardian'};
  assert.throws(() => content.evaluateLabAnswers(lesson,review));
});

test('answer enum values cannot be supplied as coercible arrays or objects', () => {
  const lesson = build('english-words');
  for (const extra of [{help:['none']},{help:{toString:()=> 'none'}},{observation:['independent']},{evidence:['guardian']}]) {
    const answers = complete(lesson); answers[0] = {...answers[0],...extra};
    assert.throws(() => content.evaluateLabAnswers(lesson,answers));
  }
});

test('addition and subtraction settings are independent and prompts match exact visual relationships', () => {
  for (let seed=0;seed<40;seed++) {
    for (const step of build('math-calculation',{addition:'no-regroup',subtraction:'regroup'},seed).steps) {
      if (step.prompt.includes('+')) assert.ok(step.skillId.endsWith('.no-regroup'));
      else assert.ok(step.skillId.endsWith('.regroup'));
      const [a,b]=step.visual.values;
      assert.ok(step.prompt.includes(`${a} `) && step.prompt.includes(` ${b}`));
    }
    for (const clockLevel of [1,2,3]) for (const step of build('math-clock',{clockLevel},seed).steps) {
      const v=step.visual;
      const start=`${String(v.hour).padStart(2,'0')}:${String(v.minute).padStart(2,'0')}`;
      const end=`${String(v.endHour).padStart(2,'0')}:${String(v.endMinute).padStart(2,'0')}`;
      const duration=v.endHour*60+v.endMinute-v.hour*60-v.minute;
      if (step.skillId.endsWith('.start')) {
        assert.ok(step.prompt.includes(end));
        assert.ok(step.prompt.includes(`${duration}분`));
        assert.equal(step.answer,start);
      } else if (step.skillId.endsWith('.duration')) {
        assert.ok(step.prompt.includes(start) && step.prompt.includes(end));
        assert.equal(step.answer,String(duration));
      } else {
        assert.ok(step.prompt.includes(start));
        assert.ok(step.prompt.includes(`${duration}분`));
        assert.equal(step.answer,end);
      }
    }
  }
});

test('supported/retry observations are not automated correctness and model cannot be independent', () => {
  const lesson=build('english-words');
  const answers=complete(lesson);
  answers[1].observation='supported';
  answers[3].observation='retry';
  answers[5].evidence='self';
  const result=content.evaluateLabAnswers(lesson,answers);
  assert.equal(result.correct,0);
  assert.equal(result.supported,3);
  assert.equal(result.review,1);
  assert.equal(result.independent,2);
  assert.equal(result.observed,6);
  for (const skill of result.skills.filter(s=>s.skillId.endsWith('.model'))) assert.equal(skill.independent,0);
  const reading=build('english-reading');
  const readAnswers=complete(reading);
  const choiceIndex=reading.steps.findIndex(s=>s.kind==='choice');
  readAnswers[choiceIndex].value='foreign-choice';
  assert.throws(()=>content.evaluateLabAnswers(reading,readAnswers));
  readAnswers[choiceIndex].value=reading.steps[choiceIndex].answer;
  assert.equal(content.evaluateLabAnswers(reading,readAnswers).correct,1);
});

test('money wording uses coins for 100 won and banknotes for larger denominations', () => {
  for (const moneyUnit of [100,1000,10000]) {
    const step=build('math-transfer',{moneyUnit}).steps.find(s=>s.visual?.kind==='money');
    const [left,right]=step.visual.counts;
    const counter=moneyUnit===100?'개':'장';
    const item=moneyUnit===100?'동전':'지폐';
    assert.ok(step.prompt.includes(item),step.prompt);
    assert.ok(step.prompt.includes(`${left}${counter}${moneyUnit===100?'와':'과'} ${right}${counter}`),step.prompt);
    assert.ok(step.hint.includes(item),step.hint);
    assert.ok(step.hint.includes(`몇 ${counter}`),step.hint);
    assert.ok(step.hint.includes(`한 ${counter}`),step.hint);
    assert.ok(step.explanation.includes(`${left+right}${counter}`),step.explanation);
    if(moneyUnit===100) assert.ok(![step.prompt,step.hint,step.explanation].join(' ').includes('지폐'));
    else assert.ok(![step.prompt,step.hint,step.explanation].join(' ').includes('동전'));
  }
});
