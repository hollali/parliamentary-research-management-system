-- Member sign-off now closes the request.
--
-- `POST /reviews/confirm` used to set status = 'MEMBER_CONFIRMED', so a brief
-- an MP had signed off on sat in that state waiting for an admin to close it
-- manually, and the status badge read "Confirmed by Member" rather than
-- "Closed". The endpoint now writes status = 'CLOSED' and stamps dateClosed.
--
-- Requests that were confirmed before that change are moved to the same end
-- state, so the whole archive reports one consistent status. The sign-off
-- itself is preserved: memberConfirmedAt, memberConfirmedById and
-- memberConfirmationNote are untouched, and they are what the UI now uses to
-- decide whether a closed brief was confirmed by the member.
--
-- The 'MEMBER_CONFIRMED' value stays in the RequestStatus enum. It is still a
-- legal status, it is still produced by the legacy guard in reviews.ts, and
-- dropping an enum value that existing rows and older application versions may
-- reference is riskier than leaving it in place.

-- dateClosed should record when the member signed off, not the moment this
-- migration happened to run, so fall back to the approval date for the rare row
-- that somehow has no confirmation timestamp.
UPDATE "research_requests"
SET
    "status" = 'CLOSED',
    "dateClosed" = COALESCE("memberConfirmedAt", "dateCompleted", "dateDelivered", "updatedAt")
WHERE "status" = 'MEMBER_CONFIRMED';
