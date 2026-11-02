# Integrated English: conversation + AI reading + sequential phonics

User-approved requirements (continuation): preserve the original text chat and add actual AI audio for the same reply; do not force a separate realtime-only screen. Merge word recall and short reading into one sequential course. Use the uploaded Seoul Office of Education **15분 파닉스** as an explicitly identified reference. Remain guardian-only; no child publishing, reward or math changes.

## Approach
Use the existing structured coach for text/recorded speech input, and add finite AI-generated speech for that reply. The same finite reader reads approved curriculum words/sentences without device voices or microphone permission. Reuse the existing API secret. Choose currently documented gpt-audio-1.5 REST audio output, with bounded response size, normalized transcript agreement and manual replay; do not add a dependency on deprecated speech endpoints. Network/provider failures preserve text, never fabricate audio success.

## Curriculum
Preserve the PDF's 22-unit order/names and printed/PDF page mappings. Small sessions cover two words in stable order: listen, read independently, spell/copy; then recall, a source sentence, meaning/review. Writing uses letter tiles/keyboard; a transient finger-writing board is a practice aid, never handwriting assessment. Start unit is guardian-selectable; previously practiced ai/ay is clearly labeled as an app supplement, not a chapter of this PDF. Old word/reading records remain readable; their separate entry cards are removed.

## Privacy, storage and non-goals
Store source metadata and a minimal curriculum mapping in the repository; preserve a separate original reference copy without publishing the full PDF. No audio or raw chat in family state/storage/logs; content-only approved audio is cached in memory for replay. Speech requests are guardian-authenticated and bounded, with no automatic paid retry. No automated pronunciation/handwriting scores, child data rollout, EBS integration, or math changes.

## Acceptance
One main conversation panel shows the original text/hints and AI voice; replay works without a second bill. No installed voice requirement. Sequential phonics has visible step order and real spelling input/checks, source page labels and next-word/unit progression. Failing media leaves usable text and a manual play action. Exit/hidden/role changes abort late results and release audio/mic. Full existing suite and browser tests, plus new source/curriculum, provider, auth, playback and integration tests, must pass. Live account and physical iPad quality are not inferred from mocks.
