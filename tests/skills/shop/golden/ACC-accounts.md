# ACC · Accounts
Customer accounts and how they are protected.

## ACC-P01 · Accounts resist password guessing
- **Kind:** policy · **Nature:** security requirement of the company
**Statement.** A customer account must be hard to break into by guessing its password.

### ACC-R001 · Passwords have at least 12 characters, or 8 at sign-up
- **Kind:** rule · **Category:** validation · **Implements:** ACC-P01
- **Status:** active · **Confidence:** conflicting · **Audit:** passed

**Rule.** Two checks disagree: a password must have at least 12 characters when it is checked, but sign-up accepts 8.

**Evidence.**
- enforcement — src/accounts/password.js:4-9 `checkPassword`
- enforcement — src/accounts/signup.js:1-4 `validateSignup`

**Open questions.** Which minimum is the rule: 12 or 8?

### ACC-R002 · Five failed logins lock the account for 15 minutes
- **Kind:** rule · **Category:** timing · **Implements:** ACC-P01
- **Status:** active · **Confidence:** read · **Audit:** passed

**Rule.** After 5 failed logins in a row, the account cannot log in for 15 minutes.

**Parameters.** `MAX_ATTEMPTS = 5` — src/accounts/password.js:1 ; `LOCK_MINUTES = 15` — src/accounts/password.js:2

**Evidence.**
- enforcement — src/accounts/password.js:11-19 `recordFailedLogin`

## Other operating rules

### ACC-R003 · One account per email
- **Kind:** rule · **Category:** data-constraint
- **Status:** active · **Confidence:** read · **Audit:** passed

**Rule.** Two accounts may not share the same email address.

**Evidence.**
- schema — db/schema.sql:3
