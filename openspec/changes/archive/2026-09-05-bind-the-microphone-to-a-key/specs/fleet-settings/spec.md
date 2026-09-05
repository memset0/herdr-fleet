## MODIFIED Requirements

### Requirement: The document the operator writes is the keyboard the operator gets
The effective bindings and the prefix the recognizer matches against SHALL come from the settings
document. A document that binds a command SHALL make that binding fire; a document that unbinds one
SHALL make its shipped default stop firing; a document that names a prefix SHALL make that chord the
one that arms a sequence.

The document SHALL be read once when the application starts, and again when the operator saves it, so
a save takes effect without a reload. It MUST NOT be polled.

An installation with no document, or one whose Gateway does not serve the route at all, SHALL run
exactly the shipped defaults. A document that fails to load for any other reason SHALL also leave the
shipped defaults in force rather than leaving the keyboard with nothing bound.

The path from the document to a key SHALL be covered end to end by a test that serves a document and
asserts what a key then does. A test that hands bindings directly to the recognizer proves the
mechanism and not this requirement.

#### Scenario: The operator adds a binding
- **WHEN** the served document gives a command a chord the shipped defaults do not
- **THEN** pressing that chord invokes that command

#### Scenario: The operator removes one
- **WHEN** the served document binds a command to nothing
- **THEN** its shipped default no longer invokes it

#### Scenario: The operator changes the prefix
- **WHEN** the served document names a different prefix chord
- **THEN** that chord arms a sequence and the shipped prefix does not

#### Scenario: There is no document
- **WHEN** the Gateway serves no document, or does not serve the route at all
- **THEN** every shipped default is in force and no key is left unbound by the absence

#### Scenario: The operator saves one
- **WHEN** the operator saves a valid document in Settings
- **THEN** the new bindings are in force without reloading the page

#### Scenario: A modifier is claimed as a key and also held
- **WHEN** a saved document binds a modifier as a command's key and any other binding, the prefix included, holds that same modifier
- **THEN** the save is refused as a whole, the message names both bindings, and the keyboard the operator had keeps working

