import test from 'node:test';
import assert from 'node:assert/strict';

const contentUrl = process.env.LEARNING_CONTENT_MODULE
  || new URL('../dist/supabase/functions/_shared/learning-content.js', import.meta.url).href;
const content = await import(contentUrl).catch(error => {
  if (error.code === 'ERR_MODULE_NOT_FOUND') return {};
  throw error;
});

test('reviewed catalog provides the six available five-question activities', () => {
  assert.deepEqual(content.LEARNING_LESSONS?.map(lesson => lesson.id), [
    'english-colors', 'english-animals', 'english-requests',
    'math-ten', 'math-place', 'math-stories',
  ]);
});

// Hand-reviewed fixtures: expected answers are never calculated from answerId.
const reviewed = {
  'english-colors': [
    ['color-red', 'red', '빨강', 'Find red.'],
    ['color-blue', 'blue', '파랑', 'Find blue.'],
    ['color-yellow', 'yellow', '노랑', 'Find yellow.'],
    ['color-green', 'green', '초록', 'Find green.'],
    ['color-pink', 'pink', '분홍', 'Find pink.'],
  ],
  'english-animals': [
    ['animal-cat', 'cat', '고양이', 'Find the cat.'],
    ['animal-dog', 'dog', '강아지', 'Find the dog.'],
    ['animal-bird', 'bird', '새', 'Find the bird.'],
    ['animal-fish', 'fish', '물고기', 'Find the fish.'],
    ['animal-rabbit', 'rabbit', '토끼', 'Find the rabbit.'],
  ],
  'english-requests': [
    ['request-ball', 'ball', '공', 'A ball, please.'],
    ['request-book', 'book', '책', 'A book, please.'],
    ['request-water', 'water', '물', 'Water, please.'],
    ['request-apple', 'apple', '사과', 'An apple, please.'],
    ['request-pencil', 'pencil', '연필', 'A pencil, please.'],
  ],
  'math-ten': [
    ['ten-six', '4', '4', {kind:'ten-frame', filled:6}],
    ['ten-nine', '1', '1', {kind:'ten-frame', filled:9}],
    ['ten-three', '7', '7', {kind:'ten-frame', filled:3}],
    ['ten-five', '5', '5', {kind:'ten-frame', filled:5}],
    ['ten-eight', '2', '2', {kind:'ten-frame', filled:8}],
  ],
  'math-place': [
    ['place-fourteen', '14', '14', {kind:'base-ten', hundreds:0, tens:1, ones:4}],
    ['place-twenty-seven', '27', '27', {kind:'base-ten', hundreds:0, tens:2, ones:7}],
    ['place-thirty', '30', '30', {kind:'base-ten', hundreds:0, tens:3, ones:0}],
    ['place-one-hundred-five', '105', '105', {kind:'base-ten', hundreds:1, tens:0, ones:5}],
    ['place-one-hundred-twenty', '120', '120', {kind:'base-ten', hundreds:1, tens:2, ones:0}],
  ],
  'math-stories': [
    ['story-apples', '5', '5', {kind:'objects', icon:'🍎', left:3, right:2, operation:'add'}],
    ['story-cookies', '4', '4', {kind:'objects', icon:'🍪', left:7, right:3, operation:'subtract'}],
    ['story-balls', '8', '8', {kind:'objects', icon:'⚽', left:4, right:4, operation:'add'}],
    ['story-strawberries', '0', '0', {kind:'objects', icon:'🍓', left:6, right:6, operation:'subtract'}],
    ['story-cars', '7', '7', {kind:'objects', icon:'🚗', left:2, right:5, operation:'add'}],
  ],
};

function answersFor(id = 'math-ten') {
  return reviewed[id].map(([questionId, optionId]) => ({questionId, optionId, attempts:1, help:'none'}));
}

test('every activity has five unique questions and usable distinct choices', () => {
  assert.equal(content.LEARNING_CONTENT_VERSION, '2026-10-31.1');
  const questionIds = new Set();
  for (const lesson of content.LEARNING_LESSONS) {
    assert.equal(lesson.questions.length, 5);
    assert.equal(lesson.subject, lesson.id.startsWith('english-') ? 'english' : 'math');
    for (const field of ['title', 'description', 'icon', 'goal']) assert.ok(lesson[field]?.trim(), `${lesson.id}/${field}`);
    assert.equal(content.getLearningLesson(lesson.id), lesson);
    for (const q of lesson.questions) {
      assert.equal(questionIds.has(q.id), false, q.id);
      questionIds.add(q.id);
      assert.ok(q.options.length >= 2 && q.options.length <= 3, q.id);
      assert.equal(new Set(q.options.map(o => o.id)).size, q.options.length, q.id);
      assert.equal(new Set(q.options.map(o => o.label)).size, q.options.length, q.id);
      assert.ok(q.options.every(o => typeof o.id === 'string' && o.id && typeof o.label === 'string' && o.label.trim()));
      assert.equal(q.options.filter(o => o.id === q.answerId).length, 1, q.id);
      for (const field of ['prompt', 'hint', 'explanation']) assert.ok(q[field]?.trim(), `${q.id}/${field}`);
    }
  }
  assert.equal(questionIds.size, 30);
  assert.equal(content.getLearningLesson('not-a-lesson'), undefined);
  assert.equal(content.getLearningLesson('__proto__'), undefined);
});

for (const [lessonId, fixtures] of Object.entries(reviewed)) {
  test(`${lessonId}: reviewed answer keys, speech or exact visual counts match`, () => {
    const lesson = content.getLearningLesson(lessonId);
    assert.deepEqual(lesson.questions.map(q => q.id), fixtures.map(([id]) => id));
    for (const [questionId, answer, label, stimulus] of fixtures) {
      const q = lesson.questions.find(item => item.id === questionId);
      assert.equal(q.answerId, answer, questionId);
      assert.equal(q.options.find(o => o.id === answer)?.label, label, questionId);
      if (lesson.subject === 'english') {
        assert.equal(q.speech, stimulus, questionId);
        assert.match(q.prompt, /[가-힣]/);
        assert.equal(q.prompt.toLowerCase().includes(answer), false, `${questionId} reveals spoken target`);
        assert.equal(q.prompt.includes(label), false, `${questionId} reveals translated target`);
        assert.ok(q.options.every(o => /[가-힣]/.test(o.label) && !/[a-z]/i.test(o.label)));
        assert.ok(q.options.every(o => o.icon || o.color));
        assert.equal(q.practicePhrase, stimulus);
      } else {
        assert.deepEqual(q.visual, stimulus, questionId);
        assert.equal(q.speech, undefined);
      }
    }
    assert.deepEqual(content.evaluateLearningAnswers(lessonId, answersFor(lessonId)), {
      total:5, independent:5, supported:0, firstTry:5,
    });
  });
}

test('completion accepts all five unique correct answers in any order without mutating input', () => {
  const answers = answersFor().reverse();
  const before = structuredClone(answers);
  assert.deepEqual(content.evaluateLearningAnswers('math-ten', answers), {total:5, independent:5, supported:0, firstTry:5});
  assert.deepEqual(answers, before);
});

test('replay, hint, model and repeated attempts count as supported independently of first try', () => {
  const answers = answersFor();
  answers[1].help = 'replay';
  answers[2].help = 'hint';
  answers[3].help = 'model';
  answers[4].attempts = 2;
  assert.deepEqual(content.evaluateLearningAnswers('math-ten', answers), {total:5, independent:1, supported:4, firstTry:4});
});

test('attempt limit 20 is accepted and never counted as a first try', () => {
  const answers = answersFor().map(answer => ({...answer, attempts:20}));
  assert.deepEqual(content.evaluateLearningAnswers('math-ten', answers), {total:5, independent:0, supported:5, firstTry:0});
});

test('unknown activity cannot be evaluated', () => {
  for (const id of ['unknown', '', '__proto__']) assert.throws(() => content.evaluateLearningAnswers(id, answersFor()), Error);
});

for (const [name, value] of [
  ['missing answers', undefined], ['null answers', null], ['object instead of array', {}],
  ['string answers', 'all correct'], ['empty completion', []],
  ['incomplete completion', answersFor().slice(0, 4)],
  ['extra answer', [...answersFor(), answersFor()[0]]],
  ['duplicate question with one omitted', [answersFor()[0], ...answersFor().slice(0, 4)]],
  ['sparse completion', Array(5)],
]) {
  test(`rejects ${name}`, () => assert.throws(() => content.evaluateLearningAnswers('math-ten', value), Error));
}

for (const [name, patch] of [
  ['unknown question', {questionId:'made-up'}],
  ['question from another activity', {questionId:'animal-cat'}],
  ['numeric question ID', {questionId:1}], ['missing question ID', {questionId:undefined}],
  ['wrong existing option', {optionId:'3'}], ['unknown option', {optionId:'made-up'}],
  ['numeric option ID', {optionId:4}], ['missing option ID', {optionId:undefined}],
  ['zero attempts', {attempts:0}], ['negative attempts', {attempts:-1}],
  ['fractional attempts', {attempts:1.5}], ['attempts over limit', {attempts:21}],
  ['string attempts', {attempts:'1'}], ['NaN attempts', {attempts:NaN}],
  ['infinite attempts', {attempts:Infinity}], ['missing attempts', {attempts:undefined}],
  ['unknown assistance', {help:'audio'}], ['missing assistance', {help:undefined}],
  ['null assistance', {help:null}], ['numeric assistance', {help:0}],
]) {
  test(`rejects ${name}`, () => {
    const answers = answersFor();
    answers[0] = {...answers[0], ...patch};
    assert.throws(() => content.evaluateLearningAnswers('math-ten', answers), Error);
  });
}

for (const value of [null, undefined, 1, 'answer', [], true]) {
  test(`rejects malformed answer row ${JSON.stringify(value)}`, () => {
    const answers = answersFor();
    answers[0] = value;
    assert.throws(() => content.evaluateLearningAnswers('math-ten', answers), Error);
  });
}
