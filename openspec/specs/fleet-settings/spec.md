# fleet-settings Specification

## Purpose
Give Fleet one settings document of its own — read and written by Fleet's own Gateway, kept beside
its private configuration — and one place in the application's Settings page where every Fleet
setting is presented together and told apart from Collie's.

## Requirements

### Requirement: Fleet keeps its own settings document beside its configuration
Fleet SHALL keep its operator-facing settings in one JSON document in the same directory as its
private configuration file, under the same ownership and permission posture. It MUST NOT write these
settings into that configuration file, and it MUST NOT write them into any file Collie owns.

The document SHALL carry an explicit schema version. An absent document SHALL mean "every shipped
default", not an error. A document that names an unknown top-level section SHALL be rejected rather
than partially applied.

Settings whose subject is the device — the rails' preferred widths, the fallback face, Agent
favorites — SHALL remain browser-local and MUST NOT be moved into this document.

#### Scenario: No document exists
- **WHEN** Fleet starts with no settings document present
- **THEN** every setting takes its shipped default and Fleet reports no error

#### Scenario: A device preference stays local
- **WHEN** the operator changes a rail's width or the fallback face on one browser
- **THEN** the settings document is unchanged and another browser is unaffected

### Requirement: Reading the document is live and holds the last good version
Fleet SHALL re-read the document behind a modification-time check rather than caching it for the
process lifetime, so an edit made on disk takes effect without restarting anything.

A document that fails to parse or fails validation SHALL NOT replace the last good one. Fleet SHALL
keep serving the previous effective settings, SHALL warn once per change of the file rather than once
per read, and MUST NOT fail the request that discovered the problem.

#### Scenario: The document is edited on disk
- **WHEN** the file is replaced with a valid document
- **THEN** the next read reflects it without a restart of Fleet, Collie, or the browser session

#### Scenario: The document is left mid-edit
- **WHEN** the file does not parse
- **THEN** the previously effective settings stay in force, the failure is warned once, and no request fails because of it

### Requirement: Writing the document is authenticated, whole, atomic and conflict-aware
Fleet SHALL accept a settings write only from an authenticated Fleet session. A write SHALL be
validated as a whole document and SHALL be applied atomically or not at all: a rejected write MUST
leave the file byte-identical and the effective settings unchanged.

A write SHALL carry the document version the client last read. When the file has changed since then,
Fleet SHALL refuse the write and return the current document, so an editor holding a stale copy
cannot overwrite a change made on disk.

The write path MUST NOT accept a file path, a directory, or any other location from the client.

#### Scenario: A valid document is saved
- **WHEN** an authenticated session submits a valid document matching the version it read
- **THEN** Fleet replaces the file atomically and the new settings take effect on the next read

#### Scenario: The file changed under the editor
- **WHEN** the submitted document's version does not match the file's current one
- **THEN** Fleet refuses the write, leaves the file untouched, and returns the current document

#### Scenario: An unauthenticated write is attempted
- **WHEN** a settings write arrives without a valid Fleet session
- **THEN** Fleet refuses it and the file is unchanged

### Requirement: The bindings section replaces the defaults completely
The document's bindings section SHALL declare the prefix and a map from command id to that command's
bindings, and SHALL be a complete replacement of the shipped defaults rather than a merge. A command
absent from the map SHALL keep its shipped default; a command present with an empty list SHALL be
completely unbound, and no shipped default SHALL reappear behind that empty list.

A document naming an unknown command id, spelling a binding the grammar rejects, or giving one exact
binding to two commands SHALL be rejected as a whole, with a message naming the offending entry.

One Fleet installation SHALL have one such document, served by the installation the browser is
talking to. A document present on another Pack member SHALL have no effect on what that browser sees.

#### Scenario: A command is deliberately unbound
- **WHEN** the document maps a command to an empty list
- **THEN** no key invokes it and its shipped default does not return

#### Scenario: An unknown id is submitted
- **WHEN** the document names a command id the catalog does not contain
- **THEN** the whole document is rejected, naming that id, and nothing is applied

#### Scenario: A duplicate binding is submitted
- **WHEN** two commands declare the same exact binding
- **THEN** the whole document is rejected, naming that binding, and nothing is applied

### Requirement: Fleet's settings stand together at the head of the Settings page
The application's Settings page SHALL present every Fleet setting as one group before Collie's own
settings, so the two are told apart at a glance. Each Fleet setting SHALL make clear whether it
belongs to this browser or to the whole installation.

Collie's own settings SHALL keep their existing content, order and behavior below that group.

#### Scenario: The Settings page is opened
- **WHEN** the operator opens Settings
- **THEN** the Fleet group is the first thing on the page and Collie's own settings follow it unchanged

#### Scenario: A setting states its reach
- **WHEN** the operator reads a Fleet setting
- **THEN** it says whether it applies to this browser only or to the whole installation

### Requirement: Bindings are edited as a validated document
The Fleet group SHALL offer the effective bindings as an editable JSON document. Saving SHALL apply
the same whole-document validation as any other write: a document that does not parse, names an
unknown command, spells a rejected binding, or duplicates a binding SHALL be refused, and the editor
SHALL say which entry was at fault while the previously effective bindings stay in force.

The editor SHALL show the effective bindings, including those a document has left unbound. It MUST
NOT reveal the document's path on disk or any unrelated configuration.

#### Scenario: A valid edit is saved
- **WHEN** the operator edits the document to a valid state and saves
- **THEN** the new bindings take effect and the editor reports success

#### Scenario: An invalid edit is refused
- **WHEN** the operator saves a document that does not parse or fails validation
- **THEN** the save is refused with the offending entry named, and the bindings in force are unchanged

#### Scenario: The editor is opened
- **WHEN** the operator opens the binding editor
- **THEN** it shows the effective bindings and no filesystem path or unrelated configuration
