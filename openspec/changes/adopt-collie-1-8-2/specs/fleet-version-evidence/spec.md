## MODIFIED Requirements

### Requirement: The shell receives one read-only version view through its existing application boundary
The authenticated application surface SHALL expose the minimum shared version view needed by the shell. The view SHALL reuse member versions already observed by Collie's crew census (`/api/crew`, which replaces `/api/pack`) and SHALL add no peer request, crew protocol field, new listener, alternate router, or browser credential. The view SHALL NOT depend on the previous census path or its redirect, which the adopted Collie keeps for one release only. Release and member discovery MUST NOT delay the first usable snapshot or navigation; React Router revalidation SHALL pick up the retained shared view after optional reads settle. Host rows SHALL create neither their own request nor their own polling timer.

#### Scenario: Several hosts render in one shell
- **WHEN** the shell displays multiple host rows
- **THEN** all rows consume the same loaded version view and no row starts a request or timer

#### Scenario: The shell revalidates
- **WHEN** the existing React Router poll refreshes root data
- **THEN** one read-only version view is refreshed without changing host navigation or terminal state

#### Scenario: The census is read
- **WHEN** the shell loads member versions
- **THEN** it reads the crew census directly and never relies on the previous path's redirect
