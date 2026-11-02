# Coach utterance ownership fix

## Scope and result

This focused wave resolves P2 in `docs/verification/LEARNING_V2_FINAL_REVIEW.md`. Only `src/learning-coach.ts`, `tests/learning-coach-client.test.mjs`, and this report were authored in this wave. No public API, transport/provider behavior, quota logic, persistence, UI, or documentation ruling was changed. No commit was created. The root retains the consolidated build and release decision.

The controller now identifies its active `SpeechSynthesisUtterance`. End, error, and timeout callbacks verify that ownership **before** checking the overall identity, clearing the speech timer, or changing state. Normal completion and errors invalidate ownership and clear/reset the timer. Timeout invalidates ownership before `speechSynthesis.cancel()`, so even synchronous cancellation callbacks are stale. `leave()` likewise invalidates ownership before abort/cleanup/cancellation and resets the timer handle. Starting speech assigns the new utterance before cancelling any previous browser speech, so previous cancellation events cannot own the new operation.

## Regression coverage and observed failure

The tests use the real compiled `LearningCoach`, its public check/send/leave methods, and the existing request fixture. Only the external speech-synthesis and speech-timeout boundaries are replaced. Global timers with any other delay continue to use real timers. No production test hooks were added.

Eight cases cross the prior terminal paths (20-second timeout, natural end, playback error, leave/reconnect) with a captured late `onend` or `onerror`. Each starts a new speaking turn and asserts the complete visible state stays unchanged, an attempted extra send stays blocked, and the new speech timeout still fires and returns the controller to ready. These assertions also verify normal completion cleanup and timeout cleanup. Existing seven client cases remain intact.

Before changing production code, all eight regressions failed against the old source compiled by `tsc`. Six showed the second utterance incorrectly becoming ready with an old completion/error message. Both leave/reconnect cases retained the speaking phase but lost their new timeout (`0 !== 1` active timers). Thus merely adding a generation check before timer cleanup would address the reconnect symptom while leaving the same-generation race exposed; the utterance guard addresses both.

Node v24.22.1's default process-isolated reporter in this environment reports test-file failures without their individual assertion details. The detailed red/green commands below use `--test-isolation=none`; the complete 33-file suite subsequently passed with the normal process-isolated runner. Initial default-run failure was therefore not counted as the regression evidence by itself.

## Commands and actual output

All commands ran from `/workspace/scratch/39f9901a0315/good-learning/.worktrees/learning-v2`. Full captured output follows; durations are observed values. `NODE_OPTIONS=--no-experimental-global-navigator` preserves the existing legacy-suite environment on Node 24.

### Compile original source before RED

```sh
./node_modules/.bin/tsc -p tsconfig.json
```

Exit 0; no output. This compiles the frontend/shared modules into ignored `dist` without running the consolidated build or regenerating `preview.html`.

### RED, original production source plus regression tests

```sh
NODE_OPTIONS=--no-experimental-global-navigator node --test --test-isolation=none tests/learning-coach-client.test.mjs
```

Exit 1:

```text
✔ demo and child coach cannot send a server request or request microphone (1.583494ms)
✔ real coach maintains ephemeral dialogue with separate user and AI messages (5.711049ms)
✔ leaving aborts response and late completion cannot restore conversation (0.7898ms)
✔ identity change during a response prevents old family content rendering (0.281123ms)
✔ double-send while pending does not reserve or send an extra paid turn (0.380302ms)
✔ unavailable connection and failed turn never fabricate responses or retry (0.407483ms)
✔ microphone permission resolving after leave releases every track without recording (0.574284ms)
✖ speech onend after timeout cannot unlock the next utterance or clear its timeout (2.672064ms)
✖ speech onerror after timeout cannot unlock the next utterance or clear its timeout (0.910611ms)
✖ speech onend after onend cannot unlock the next utterance or clear its timeout (0.826845ms)
✖ speech onerror after onend cannot unlock the next utterance or clear its timeout (0.461816ms)
✖ speech onend after onerror cannot unlock the next utterance or clear its timeout (0.587465ms)
✖ speech onerror after onerror cannot unlock the next utterance or clear its timeout (0.443638ms)
✖ speech onend after leave cannot unlock the next utterance or clear its timeout (0.393032ms)
✖ speech onerror after leave cannot unlock the next utterance or clear its timeout (0.314934ms)
ℹ tests 15
ℹ suites 0
ℹ pass 7
ℹ fail 8
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 32.635172

✖ failing tests:

test at tests/learning-coach-client.test.mjs:84:3
✖ speech onend after timeout cannot unlock the next utterance or clear its timeout (2.672064ms)
  AssertionError [ERR_ASSERTION]: stale speech must leave the active dialogue and status intact
  + actual - expected
  ... Skipped lines

    {
      available: true,
  +   message: '이제 보호자 차례예요. 짧게 대답해 주세요.',
  -   message: 'AI가 만든 답변을 기기의 영어 음성으로 읽고 있어요.',
      messages: [
        {
          role: 'user',
          text: 'First turn.'
        },
  ...
      ],
  +   phase: 'ready',
  -   phase: 'speaking',
      turns: 2
    }

      at file:///workspace/scratch/39f9901a0315/good-learning/.worktrees/learning-v2/tests/learning-coach-client.test.mjs:99:16
      at async withSpeech (file:///workspace/scratch/39f9901a0315/good-learning/.worktrees/learning-v2/tests/learning-coach-client.test.mjs:79:7)
      at async TestContext.<anonymous> (file:///workspace/scratch/39f9901a0315/good-learning/.worktrees/learning-v2/tests/learning-coach-client.test.mjs:85:5)
      at async Test.run (node:internal/test_runner/test:1409:7)
      at async Test.processPendingSubtests (node:internal/test_runner/test:974:7) {
    generatedMessage: false,
    code: 'ERR_ASSERTION',
    actual: [Object],
    expected: [Object],
    operator: 'deepStrictEqual',
    diff: 'simple'
  }

test at tests/learning-coach-client.test.mjs:84:3
✖ speech onerror after timeout cannot unlock the next utterance or clear its timeout (0.910611ms)
  AssertionError [ERR_ASSERTION]: stale speech must leave the active dialogue and status intact
  + actual - expected
  ... Skipped lines

    {
      available: true,
  +   message: '음성을 재생하지 못했어요. AI 답변은 글로 확인해 주세요.',
  -   message: 'AI가 만든 답변을 기기의 영어 음성으로 읽고 있어요.',
      messages: [
        {
          role: 'user',
          text: 'First turn.'
        },
  ...
      ],
  +   phase: 'ready',
  -   phase: 'speaking',
      turns: 2
    }

      at file:///workspace/scratch/39f9901a0315/good-learning/.worktrees/learning-v2/tests/learning-coach-client.test.mjs:99:16
      at async withSpeech (file:///workspace/scratch/39f9901a0315/good-learning/.worktrees/learning-v2/tests/learning-coach-client.test.mjs:79:7)
      at async TestContext.<anonymous> (file:///workspace/scratch/39f9901a0315/good-learning/.worktrees/learning-v2/tests/learning-coach-client.test.mjs:85:5)
      at async Test.run (node:internal/test_runner/test:1409:7)
      at async Test.processPendingSubtests (node:internal/test_runner/test:974:7) {
    generatedMessage: false,
    code: 'ERR_ASSERTION',
    actual: [Object],
    expected: [Object],
    operator: 'deepStrictEqual',
    diff: 'simple'
  }

test at tests/learning-coach-client.test.mjs:84:3
✖ speech onend after onend cannot unlock the next utterance or clear its timeout (0.826845ms)
  AssertionError [ERR_ASSERTION]: stale speech must leave the active dialogue and status intact
  + actual - expected
  ... Skipped lines

    {
      available: true,
  +   message: '이제 보호자 차례예요. 짧게 대답해 주세요.',
  -   message: 'AI가 만든 답변을 기기의 영어 음성으로 읽고 있어요.',
      messages: [
        {
          role: 'user',
          text: 'First turn.'
        },
  ...
      ],
  +   phase: 'ready',
  -   phase: 'speaking',
      turns: 2
    }

      at file:///workspace/scratch/39f9901a0315/good-learning/.worktrees/learning-v2/tests/learning-coach-client.test.mjs:99:16
      at async withSpeech (file:///workspace/scratch/39f9901a0315/good-learning/.worktrees/learning-v2/tests/learning-coach-client.test.mjs:79:7)
      at async TestContext.<anonymous> (file:///workspace/scratch/39f9901a0315/good-learning/.worktrees/learning-v2/tests/learning-coach-client.test.mjs:85:5)
      at async Test.run (node:internal/test_runner/test:1409:7)
      at async Test.processPendingSubtests (node:internal/test_runner/test:974:7) {
    generatedMessage: false,
    code: 'ERR_ASSERTION',
    actual: [Object],
    expected: [Object],
    operator: 'deepStrictEqual',
    diff: 'simple'
  }

test at tests/learning-coach-client.test.mjs:84:3
✖ speech onerror after onend cannot unlock the next utterance or clear its timeout (0.461816ms)
  AssertionError [ERR_ASSERTION]: stale speech must leave the active dialogue and status intact
  + actual - expected
  ... Skipped lines

    {
      available: true,
  +   message: '음성을 재생하지 못했어요. AI 답변은 글로 확인해 주세요.',
  -   message: 'AI가 만든 답변을 기기의 영어 음성으로 읽고 있어요.',
      messages: [
        {
          role: 'user',
          text: 'First turn.'
        },
  ...
      ],
  +   phase: 'ready',
  -   phase: 'speaking',
      turns: 2
    }

      at file:///workspace/scratch/39f9901a0315/good-learning/.worktrees/learning-v2/tests/learning-coach-client.test.mjs:99:16
      at async withSpeech (file:///workspace/scratch/39f9901a0315/good-learning/.worktrees/learning-v2/tests/learning-coach-client.test.mjs:79:7)
      at async TestContext.<anonymous> (file:///workspace/scratch/39f9901a0315/good-learning/.worktrees/learning-v2/tests/learning-coach-client.test.mjs:85:5)
      at async Test.run (node:internal/test_runner/test:1409:7)
      at async Test.processPendingSubtests (node:internal/test_runner/test:974:7) {
    generatedMessage: false,
    code: 'ERR_ASSERTION',
    actual: [Object],
    expected: [Object],
    operator: 'deepStrictEqual',
    diff: 'simple'
  }

test at tests/learning-coach-client.test.mjs:84:3
✖ speech onend after onerror cannot unlock the next utterance or clear its timeout (0.587465ms)
  AssertionError [ERR_ASSERTION]: stale speech must leave the active dialogue and status intact
  + actual - expected
  ... Skipped lines

    {
      available: true,
  +   message: '이제 보호자 차례예요. 짧게 대답해 주세요.',
  -   message: 'AI가 만든 답변을 기기의 영어 음성으로 읽고 있어요.',
      messages: [
        {
          role: 'user',
          text: 'First turn.'
        },
  ...
      ],
  +   phase: 'ready',
  -   phase: 'speaking',
      turns: 2
    }

      at file:///workspace/scratch/39f9901a0315/good-learning/.worktrees/learning-v2/tests/learning-coach-client.test.mjs:99:16
      at async withSpeech (file:///workspace/scratch/39f9901a0315/good-learning/.worktrees/learning-v2/tests/learning-coach-client.test.mjs:79:7)
      at async TestContext.<anonymous> (file:///workspace/scratch/39f9901a0315/good-learning/.worktrees/learning-v2/tests/learning-coach-client.test.mjs:85:5)
      at async Test.run (node:internal/test_runner/test:1409:7)
      at async Test.processPendingSubtests (node:internal/test_runner/test:974:7) {
    generatedMessage: false,
    code: 'ERR_ASSERTION',
    actual: [Object],
    expected: [Object],
    operator: 'deepStrictEqual',
    diff: 'simple'
  }

test at tests/learning-coach-client.test.mjs:84:3
✖ speech onerror after onerror cannot unlock the next utterance or clear its timeout (0.443638ms)
  AssertionError [ERR_ASSERTION]: stale speech must leave the active dialogue and status intact
  + actual - expected
  ... Skipped lines

    {
      available: true,
  +   message: '음성을 재생하지 못했어요. AI 답변은 글로 확인해 주세요.',
  -   message: 'AI가 만든 답변을 기기의 영어 음성으로 읽고 있어요.',
      messages: [
        {
          role: 'user',
          text: 'First turn.'
        },
  ...
      ],
  +   phase: 'ready',
  -   phase: 'speaking',
      turns: 2
    }

      at file:///workspace/scratch/39f9901a0315/good-learning/.worktrees/learning-v2/tests/learning-coach-client.test.mjs:99:16
      at async withSpeech (file:///workspace/scratch/39f9901a0315/good-learning/.worktrees/learning-v2/tests/learning-coach-client.test.mjs:79:7)
      at async TestContext.<anonymous> (file:///workspace/scratch/39f9901a0315/good-learning/.worktrees/learning-v2/tests/learning-coach-client.test.mjs:85:5)
      at async Test.run (node:internal/test_runner/test:1409:7)
      at async Test.processPendingSubtests (node:internal/test_runner/test:974:7) {
    generatedMessage: false,
    code: 'ERR_ASSERTION',
    actual: [Object],
    expected: [Object],
    operator: 'deepStrictEqual',
    diff: 'simple'
  }

test at tests/learning-coach-client.test.mjs:84:3
✖ speech onend after leave cannot unlock the next utterance or clear its timeout (0.393032ms)
  AssertionError [ERR_ASSERTION]: the active speech must retain its timeout

  0 !== 1

      at expire (file:///workspace/scratch/39f9901a0315/good-learning/.worktrees/learning-v2/tests/learning-coach-client.test.mjs:75:12)
      at file:///workspace/scratch/39f9901a0315/good-learning/.worktrees/learning-v2/tests/learning-coach-client.test.mjs:102:9
      at async withSpeech (file:///workspace/scratch/39f9901a0315/good-learning/.worktrees/learning-v2/tests/learning-coach-client.test.mjs:79:7)
      at async TestContext.<anonymous> (file:///workspace/scratch/39f9901a0315/good-learning/.worktrees/learning-v2/tests/learning-coach-client.test.mjs:85:5)
      at async Test.run (node:internal/test_runner/test:1409:7)
      at async Test.processPendingSubtests (node:internal/test_runner/test:974:7) {
    generatedMessage: false,
    code: 'ERR_ASSERTION',
    actual: 0,
    expected: 1,
    operator: 'strictEqual',
    diff: 'simple'
  }

test at tests/learning-coach-client.test.mjs:84:3
✖ speech onerror after leave cannot unlock the next utterance or clear its timeout (0.314934ms)
  AssertionError [ERR_ASSERTION]: the active speech must retain its timeout

  0 !== 1

      at expire (file:///workspace/scratch/39f9901a0315/good-learning/.worktrees/learning-v2/tests/learning-coach-client.test.mjs:75:12)
      at file:///workspace/scratch/39f9901a0315/good-learning/.worktrees/learning-v2/tests/learning-coach-client.test.mjs:102:9
      at async withSpeech (file:///workspace/scratch/39f9901a0315/good-learning/.worktrees/learning-v2/tests/learning-coach-client.test.mjs:79:7)
      at async TestContext.<anonymous> (file:///workspace/scratch/39f9901a0315/good-learning/.worktrees/learning-v2/tests/learning-coach-client.test.mjs:85:5)
      at async Test.run (node:internal/test_runner/test:1409:7)
      at async Test.processPendingSubtests (node:internal/test_runner/test:974:7) {
    generatedMessage: false,
    code: 'ERR_ASSERTION',
    actual: 0,
    expected: 1,
    operator: 'strictEqual',
    diff: 'simple'
  }
```

### GREEN, fixed source and same regression cases

```sh
./node_modules/.bin/tsc -p tsconfig.json
NODE_OPTIONS=--no-experimental-global-navigator node --test --test-isolation=none tests/learning-coach-client.test.mjs
```

Compile exit 0 with no output; focused test exit 0:

```text
✔ demo and child coach cannot send a server request or request microphone (1.551596ms)
✔ real coach maintains ephemeral dialogue with separate user and AI messages (4.944636ms)
✔ leaving aborts response and late completion cannot restore conversation (0.321925ms)
✔ identity change during a response prevents old family content rendering (0.29842ms)
✔ double-send while pending does not reserve or send an extra paid turn (0.23922ms)
✔ unavailable connection and failed turn never fabricate responses or retry (0.394294ms)
✔ microphone permission resolving after leave releases every track without recording (0.483107ms)
✔ speech onend after timeout cannot unlock the next utterance or clear its timeout (1.309242ms)
✔ speech onerror after timeout cannot unlock the next utterance or clear its timeout (0.871783ms)
✔ speech onend after onend cannot unlock the next utterance or clear its timeout (0.450208ms)
✔ speech onerror after onend cannot unlock the next utterance or clear its timeout (0.283377ms)
✔ speech onend after onerror cannot unlock the next utterance or clear its timeout (0.440663ms)
✔ speech onerror after onerror cannot unlock the next utterance or clear its timeout (0.233211ms)
✔ speech onend after leave cannot unlock the next utterance or clear its timeout (0.20573ms)
✔ speech onerror after leave cannot unlock the next utterance or clear its timeout (3.568904ms)
ℹ tests 15
ℹ suites 0
ℹ pass 15
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 28.56262
```

### Entire existing unit-test file set, freshly compiled source

```sh
NODE_OPTIONS=--no-experimental-global-navigator node --test tests/*.test.mjs
```

Exit 0:

```text
✔ tests/bulk-reward.test.mjs (106.115476ms)
✔ tests/child-profile.test.mjs (95.328922ms)
✔ tests/cloud.test.mjs (110.469827ms)
✔ tests/deployment.test.mjs (87.646022ms)
✔ tests/domain.test.mjs (123.171941ms)
✔ tests/edge-entrypoint.test.mjs (643.129789ms)
✔ tests/experience-domain.test.mjs (134.478629ms)
✔ tests/experience-ui.test.mjs (137.523939ms)
✔ tests/gacha-domain.test.mjs (144.025319ms)
✔ tests/gacha-service.test.mjs (143.97649ms)
✔ tests/gacha-visibility-ui.test.mjs (97.575364ms)
✔ tests/guardian-service.test.mjs (92.127285ms)
✔ tests/guardian.test.mjs (148.043514ms)
✔ tests/learning-coach-auth.test.mjs (109.105418ms)
✔ tests/learning-coach-client.test.mjs (111.887478ms)
✔ tests/learning-coach-entrypoint.test.mjs (648.126108ms)
✔ tests/learning-coach-service.test.mjs (143.031417ms)
✔ tests/learning-content.test.mjs (185.304057ms)
✔ tests/learning-domain.test.mjs (199.861323ms)
✔ tests/learning-lab-content.test.mjs (318.862607ms)
✔ tests/learning-lab-state.test.mjs (419.05359ms)
✔ tests/learning-lab-ui.test.mjs (176.386296ms)
✔ tests/learning-navigation.test.mjs (137.538354ms)
✔ tests/learning-service.test.mjs (132.945439ms)
✔ tests/learning-ui.test.mjs (121.296651ms)
✔ tests/release.test.mjs (87.213816ms)
✔ tests/reward-icon-picker.test.mjs (89.688633ms)
✔ tests/security.test.mjs (193.593889ms)
✔ tests/server-config.test.mjs (85.961881ms)
✔ tests/storage.test.mjs (130.702967ms)
✔ tests/time-coupons-domain.test.mjs (143.983916ms)
✔ tests/time-coupons-service.test.mjs (143.137847ms)
✔ tests/time-coupons-ui.test.mjs (117.514681ms)
ℹ tests 33
ℹ suites 0
ℹ pass 33
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 900.335827
```

### Frontend and edge type checks

```sh
npm run typecheck
```

Exit 0:

```text
npm warn Unknown env config "http-proxy". This will stop working in the next major version of npm.

> praise-star@0.8.0 typecheck
> tsc --noEmit && tsc -p tsconfig.edge.json

```

The npm `http-proxy` warning is environmental and did not fail TypeScript checking. No failing checks remain from this wave.

## Verification limits and remaining risks

This is deterministic lifecycle verification at the browser speech/timer boundary. It does not certify actual installed voice availability, physical iPad Safari audio routing, microphone permissions/quality, or live provider transcription/reply quality. Those prior review limitations remain. Browser/media suites and the consolidated `npm run build`/standalone preview were deliberately left to the root's final integration pass; this wave ran isolated TypeScript emission, focused regression tests, all 33 existing test files, and the full typecheck. No deployment, live provider request, production mutation, or child voice enablement occurred.
