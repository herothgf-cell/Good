# Time coupons

## Intent

Let guardians issue a chosen number of minutes from time rewards such as `TV 30분 이용권`, and let the child request and consume only part of a received coupon. Keep the remaining minutes available for later use.

## Design decisions

- Keep the existing guardian grant and child request → guardian approval → guardian completion flow. Completion alone deducts minutes.
- Use positive whole minutes, from 1 to 1,440 per coupon. A partial grant cannot exceed the reward's normal duration. Bulk grants retain 1–20 coupons and specify minutes per coupon.
- Recognize unconfigured legacy titles containing a single unambiguous Korean duration (`30분`, `1시간`, `1시간 30분`). Explicit duration configuration overrides the title; explicit `null` means an ordinary coupon.
- Coupon duration is an immutable issuance snapshot. Legacy coupons infer from their own title, never from the current reward. Legacy used/revoked coupons have zero usable minutes.
- Keep ordinary coupon behavior and finite stock units unchanged: each newly issued coupon consumes one stock unit, including a partial-duration grant. Explain this in the grant form for finite stock. No stock or stars are consumed during use.
- Preserve each completed use in coupon history. Revoke only completely unused guardian gifts; partially consumed gifts cannot restore stock.
- Require a captured per-coupon usage version on every timed coupon transition, including revoke, and increment it on successful transitions. Missing/stale versions fail safely and ask the client to refresh. Existing receipt retries remain receipt-first and idempotent.
- Keep schema 1 JSON state and existing server role authorization/CAS/receipt storage. No database migration or real family data rewrite.

## Approaches

Separate coupons for every minute would create unnecessary inventory entries. Changing a reward title for every partial use would lose the original entitlement and history. Store total, remaining, pending minutes and usage entries on the existing coupon instead; this fits the existing persistence and approval flow.

## UI

Guardian reward editor has a time-coupon checkbox and minutes field. Existing time titles are recognized; new time titles suggest the matching duration until the guardian manually changes the setting. Direct grant shows minutes per coupon, quantity, and total minutes. Child usage offers a minutes field and quick choices. Inventory prominently shows remaining and received minutes, pending requested amount, and completed usage history. Approval and completion state the exact pending minutes.

## Scope

This is manual minute accounting, with no countdown, device control, timer scheduling, merged balances across coupons, or proportional star pricing. Existing shop/draw issuance still grants the reward's full duration.
