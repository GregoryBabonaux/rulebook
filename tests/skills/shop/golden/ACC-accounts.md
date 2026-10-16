# ACC · Accounts
Customer accounts and how they are protected.

## ACC-P01 · Accounts resist password guessing
- **Kind:** policy · **Nature:** security requirement of the company
**Statement.** A customer account must be hard to break into by guessing its password.

### ACC-R001 · Passwords have at least 12 characters
- **Kind:** rule · **Category:** validation · **Implements:** ACC-P01
- **Status:** active · **Confidence:** read · **Audit:** passed

**Rule.** A password must have at least 12 characters.

**Evidence.**
- enforcement — src/accounts/password.js:4-9 `checkPassword`

### ACC-R002 · Five failed logins lock the account for 15 minutes
- **Kind:** rule · **Category:** timing · **Implements:** ACC-P01
- **Status:** active · **Confidence:** read · **Audit:** passed

**Rule.** After 5 failed logins in a row, the account cannot log in for 15 minutes.

**Evidence.**
- enforcement — src/accounts/password.js:11-19 `recordFailedLogin`

## Other operating rules

### ACC-R003 · One account per email
- **Kind:** rule · **Category:** data-constraint
- **Status:** active · **Confidence:** read · **Audit:** passed

**Rule.** Two accounts may not share the same email address.

**Evidence.**
- schema — db/schema.sql:3
