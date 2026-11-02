# Unified English voice/text and sequential phonics

## User-approved intent
Keep the existing coupon app and guardian-only testing. Put spoken AI replies in the SAME chat that already shows text; do not substitute a separate voice-only product. Merge vocabulary and reading into one sequential listen/read/write/review course based on the uploaded Seoul education authority 15-minute phonics PDF. EBS remains deferred.

## Approach
Keep the proven text/recorded-input coach and add a shared server-generated speech player. A separate realtime-only screen and device-local TTS were rejected by the user. Use bounded server-side Realtime WebSocket read-aloud requests (not the deprecated Speech endpoint), returning WAV audio after checking its transcript against the requested text. Text survives any audio failure. No microphone is needed for reading aloud. Repeated clips can be replayed from memory without another paid request. End all media on navigation/hidden tab/role changes.

## Source fidelity and archive
Original PDF (84 pages, SHA-256 9d18c81241892fef4f71a97e8284a6460e14d4ae85db7458bfe0655862e94703) is archived privately in the user's Drive; do not publish it to the public repo. Record source title/page mapping and ordered units here. Preserve the 22 numbered unit titles/order, source words and sample sentences. Source steps are listen/repeat, word meaning/read/write, sentence meaning/read/write, review. App adaptations: one word at a time, touch tiles, handwriting scratchpad, per-step resume. ai/ay remains explicitly supplemental, NOT attributed to the PDF. Generated audio is NOT EBS/Seoul official audio and isolated phoneme accuracy is not certified.

## Boundaries
No child publication, no rewards or math changes, no private speech transcripts stored in family state. Existing historical vocabulary/reading records remain. Course writing validation covers entered/spelled words; handwriting shape and reading pronunciation are not automatically scored. Guardian selects a starting unit without pretending earlier units were mastered.

## Verification
Unit/source mapping, answer validation, role denial, idempotency and quotas; bounded audio provider failures/cancellation/transcript matching; DOM one chat + one course, writing inputs, no device voice, resume, tablet sizing, existing coupon/math regressions. Actual account-generated audio and physical iPad remain separate acceptance checks unless actually exercised.
