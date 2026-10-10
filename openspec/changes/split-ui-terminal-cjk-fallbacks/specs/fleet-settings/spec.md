## MODIFIED Requirements

### Requirement: Fleet's settings stand together below native section rows
In a Fleet build, the application's Settings page SHALL present every Fleet setting as one group
below Collie's native grouped navigation rows on the Settings index, so the two are told apart at a glance. A bundle built without the
Fleet statement SHALL show Collie's Settings page alone. Each Fleet setting SHALL make clear whether it
belongs to this browser or to the whole installation.

Collie's own settings SHALL keep their existing content, order and behavior. Fleet settings SHALL remain flat on the index rather than requiring a submenu.

#### Scenario: The Settings page is opened
- **WHEN** the operator opens Settings
- **THEN** the native section rows come first and the flat Fleet settings group follows them

#### Scenario: A setting states its reach
- **WHEN** the operator reads a Fleet setting
- **THEN** it says whether it applies to this browser only or to the whole installation


## RENAMED Requirements

- FROM: `### Requirement: Fleet's settings stand together at the head of the Settings page`
- TO: `### Requirement: Fleet's settings stand together below native section rows`
