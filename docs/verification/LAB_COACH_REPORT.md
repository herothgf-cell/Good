# Guardian coach implementation and verification

The new `learning-coach` Edge endpoint verifies the bearer through Supabase Auth, reads the authoritative family role, then reserves a quota through existing CAS/receipt persistence. Only a matching fresh server nonce can invoke the paid provider. This covers the SQL branch that returns a previous receipt to a concurrent duplicate commit. No SQL changes or production family writes were needed to implement it.

Strict body validation limits identifiers, history roles/length, short text, MIME types and audio bytes. Raw audio/chat never enters a family command. Provider errors are sanitized; no automatic paid retry. Server model configuration uses secret env vars. Actual flow is transcription → structured short reply → installed local English speech synthesis with explicit text fallback.

The browser owns a transient session and per-operation generation. It aborts requests and releases tracks when leaving, hiding or changing identity, ignores late responses/permission callbacks, and separates microphone capture from spoken output. No Web Speech Recognition service is used. Demo and non-admin users cannot invoke the paid transport. `AuthClient.apiTransient` propagates cancellation and never persists a pending body.

## Evidence

- Handler/provider: stub RED12/13 → GREEN13/13, strict validation, auth/family/admin/config, quota-before-provider, sanitized failure and transport schema.
- Client: stub RED7/7 → GREEN7/7, identity and lifecycle cancellation, failed/double send, ephemeral transcript and delayed permission release.
- Deployed entrypoint:3/3, real shared processCommand/domain with mocked external HTTP only; SQL duplicate race loser does not call provider, winner only stores quota identifiers.
- Auth transport:2/2, bearer/public key headers, no-store, aborted request, no retry or speech persistence.
- Actual Chromium controller with mocked media/provider boundaries:3 groups passed. mp4 final data is sent once, capture tracks stop before synthesized speech, hidden page clears/aborts, >512000-byte recording is not sent.
- Browser test first failed because `page.set_content` has opaque origin and lacks native `crypto.randomUUID`; added the same test-only UUID fixture already used by UI tests. Production app is HTTPS and no product workaround was added.
- Source/Edge typecheck and consolidated build pass. Full Node suite contains33 files at this checkpoint; latest full run passed all33.

## Limits

Actual OpenAI API credentials were not provided locally, and the paid provider was never invoked. Tests do not establish real transcription/tutoring quality, account access, production provider configuration, or actual iPad microphone/voice availability. Child voice processing and v2 publication are explicitly excluded.

Supabase security advisor was read before release. Existing family RPC/anonymous-child design advisories and password-protection notice remain unchanged; no DDL/auth settings were changed. Privileged family_commit remains service-only, with authoritative membership checked both by endpoint and commit.

## Final review correction

Final review found an old utterance callback could unlock a newer speaking turn. Eight regression cases failed against the original code; active utterance ownership fixed it. Client coverage is now15 cases; independent scoped re-review approved. Consolidated release verification passed all441 individual cases across33 test files.
