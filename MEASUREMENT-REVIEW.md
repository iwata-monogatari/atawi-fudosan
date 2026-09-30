# Consultation measurement repair — prepared, not released

## Status and provenance

Draft-review candidate for iwata-monogatari/atawi-fudosan main `ee95131d54dc33b196e2c03a160a85729591082e`, independently rechecked 2026-09-30. The initial preparation was local-only. Draft publication and an integrated preview were subsequently authorized. No production merge/deployment, real inquiry, or real analytics emission is part of this change.

Stage2 draft PR35 remains open/draft at `bb3073dd0d14dadc0dc8476c15449c723f711654`, based on the same main. Its five-page CTA/radio/minimal-FAQ diff is not included in this patch. The measurement patch applies cleanly over the local Stage2 changes; final integration must retain both and rerun checks.

Public top and /karte/ inline scripts were previously matched to this main snapshot. The tracker fixture is the read-only 2026-09-30 public tracker snapshot, matching repository tracker except line endings. It is used with a fake fetch only. No worker/backend source is changed. The analytics live frontend has a 9/30 build marker but the available repository backend main is older; never deploy that old project to release this repair.

## Narrow changes

- Shared first-party helper for `/`, `/karte/`, and `/karte/thanks/`; all destinations are existing FGA/Google handlers. No new cookies, IDs, attribution keys, or personal field data
- FGA consultation actions use a canonical name once instead of raw + canonical aliases. Existing Google raw event names remain. Raw `form_submit_success` is Google-only: `/karte/` completion is owned by the existing receipt-gated thank-you page, avoiding cross-redirect duplicates
- `/karte/` still emits its separate `karte_application_complete` stage after HTTP success plus `data.ok`. That stage is NOT another consultation and must never be added to `form_consult`
- The existing `fgaKarteSubmit` timestamp receipt is written synchronously on successful `/karte/` submission, removing dependency on whether ads-conversion.js has loaded. The existing ads script consumes it with its existing 30-minute limit. Thanks/direct access/refresh without a valid receipt does not imply completion
- Top keeps completion at successful submit; it does not write the thank-you receipt. Address and photo submit handlers reject duplicate calls while their button is disabled
- Pre-tracker events queue in page memory. Session stage flags are only persisted when the existing tracker is ready for handoff, not when the stage is first observed. Repeated observations within page and stored v2 flags deduplicate. The helper has no network retry
- `/karte/` checks input/change, visible selected contact type, load/pageshow autofill, and valid submission fallback. Payload contains only enumerated `contact_type`, never its value. Contact stage remains at most one per tab session even if contact method changes
- Form visibility now checks `intersectionRatio >= 0.5`; prior `isIntersecting` could count less than half
- Explicit inline tracking ownership prevents the existing tracker’s automatic link handler and page handlers both recording consultation links, including the dynamically created closed-hours LINE link
- Helper metadata is an enum allowlist. Arbitrary server errors, contact/address values, new IDs, and arbitrary extra keys cannot be passed through this helper. Existing tracker URL/referrer collection is unchanged, not made private by this patch
- Internal/ignore/preview/automation contexts suppress the helper’s consultation events and (only on migrated pages) ads-conversion.js conversions. Existing Google config/pageview behavior and unrelated pages are unchanged. Testing must still mock transport or use a properly excluded preview
- Existing CLI CSV report recognizes old + canonical names; its existing Set-based grouping prevents aliases from adding duplicate conversions. It creates no new identifiers. Its preexisting short-IP-hash visitor estimate is not a count of people

## Counting and migration

Canonical consultation events: `line_consult` and `phone_consult` are taps, not proof of a received conversation; `form_consult` represents the browser’s successful-application handoff/receipt gate, not proof of email delivery. `karte_consult` means an application-link click, not form acceptance. Keep manually verified actual consultation counts distinct.

No historical backfill, database migration, or old count correction is proposed. Do not add old and new aliases together. Record the eventual deployment time; before/after contact and visibility series change meaning. Keep existing v2 storage keys to avoid a version bump recounting active tab sessions. Existing sessions can already have suppressed a stage; that history cannot be reconstructed.

Top stage counts are page-instance/route deduplicated; /karte/ stages are normally tab-session deduplicated. Neither is a people count, an exact application ledger, nor a same-person conversion cohort. /karte/ ad_landing is URL-rule-only, while later stages include all traffic. The separate dashboard proposal removes invalid rates/people labels and false zero-click alarms without inventing a cohort or new tracking.

## Explicit delivery limits

At-most-once page handoff is not exactly-once server receipt. Existing tracker `fgaTrack` returns no receipt acknowledgment, and its fetch-rejection→beacon fallback can duplicate an ambiguously received request. This patch does not change the tracker or backend transport. Server-level idempotency would require a verified current backend and separately reviewed scope.

The page-memory queue is capped at 100 events; readiness polling is capped at 30 seconds, with tracker onload/load/pageshow/later actions still able to flush. Page-memory queues cannot survive navigation before the tracker becomes available. The stage is not falsely marked delivered, so a later observation is eligible, but earlier lost observations are not replayed. No persistent event queue or new tracking IDs are introduced. If sessionStorage is unavailable, only page-memory stage deduplication is guaranteed, and the existing gated thank-you receipt cannot establish completion. If helper load fails, form submission still works but analytics may be absent. If ads-conversion.js fails on thanks, the receipt gate does not falsely assume success. These are disclosed limits, not passed end-to-end guarantees.

## Validation

- 44 mocked Node tests: load races, late ready hook, refresh/back flags, blocked storage, canonical mapping, enum privacy, 12 internal/test contexts, throwing handoff, input/change/autofill, contact switching, actual 50% view, validation rejection, HTTP/data/network/JSON failures, duplicate submission, helper failure without form failure, top address actual success gate, old/new CSV alias dedup, real tracker listener with mocked fetch, submit→thanks→reload, expiry/direct thanks, late trackers across redirect, and ads exclusions
- Syntax check for helper, ads script, CSV report, all top/karte/thanks inline scripts
- Public company facts validator passes
- No dependency install or full web app build is applicable to these static pages. Existing non-measurement validators have prior known legacy findings; no claim that unrelated site-wide checks are clean
- Separate dashboard: 12 isolated renderer tests; no browser/API integration claim

## Required release checklist

1. Identify the actual live analytics backend build/commit and verify its canonical-event normalization, filters, period definitions, and absence of alias expansion that would duplicate canonical input. Do not infer backend semantics from a frontend snapshot
2. Reconfirm latest Fudosan main/PR35 and apply the independent diff without removing Stage2 edits. Run these tests and the standard checks on the exact combined tree
3. Review the dashboard proposal against its actual current source/build. It is a proposal against a live asset snapshot, not deployable old repository code
4. Keep the review PR draft. Draft publication/preview authorization does not authorize production merge or deployment
5. With an authorized safe preview, check desktop/mobile rendering, normal click flow, Back/refresh, autofill behavior, helper/ads asset loading and cache busting, with transport mocked or test/internal exclusion. No real inquiry or production fake analytics without specific authorization
6. Only after verified source/contract and authorization, release the exact reviewed change. Read-only verify asset hashes and dashboard labels afterward; record deployment time and compare equal periods with equal definitions. No automatic monitor was created
