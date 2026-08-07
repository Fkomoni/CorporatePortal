// The account Prognosis records portal-initiated decisions against.
//
// Prognosis validates the `useremail` field on ApproveEnrollees,
// RejectEnrollees and TerminateMember against its OWN user list, and refuses
// anything it doesn't know with "Invalid user.": including HR logins that are
// perfectly valid on our side. Probing with a nonexistent CIF, so useremail is
// judged in isolation, showed:
//
//   accepted: f-komoni-mbaekwe@leadway.com, komonifa@yahoo.com
//   rejected: the Prognosis service account (PROGNOSIS_USERNAME), a corporate
//             contact address, an empty string, africaterminal@yopmail.com
//
// INTERIM MEASURE: until the real HR emails are registered with Prognosis, an
// HR user on an unregistered account cannot approve, reject or terminate anyone
// at all. So every such decision is filed under this one known-good account.
//
// Consequence: on Prognosis these actions all appear to come from this account,
// not from the HR user who performed them. The real actor is logged on each call
// and stored in our own audit trail, so it stays traceable on our side.
//
// To undo: delete this module and pass the acting user's own email through
// again (lib/approve-enrollee.ts and lib/terminate-member.ts).
export const PROGNOSIS_ACTING_USER_EMAIL =
  process.env.PROGNOSIS_APPROVAL_FALLBACK_EMAIL ?? 'f-komoni-mbaekwe@leadway.com';
