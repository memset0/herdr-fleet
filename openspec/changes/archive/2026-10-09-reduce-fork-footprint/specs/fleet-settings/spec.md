## MODIFIED Requirements

### Requirement: Fleet's settings stand together at the head of the Settings page
In a Fleet build, the application's Settings page SHALL present every Fleet setting as one group
before Collie's own settings, so the two are told apart at a glance. A bundle built without the
Fleet statement SHALL show Collie's Settings page alone. Each Fleet setting SHALL make clear whether it
belongs to this browser or to the whole installation.

Collie's own settings SHALL keep their existing content, order and behavior below that group.

#### Scenario: The Settings page is opened
- **WHEN** the operator opens Settings
- **THEN** the Fleet group is the first thing on the page and Collie's own settings follow it unchanged

#### Scenario: A setting states its reach
- **WHEN** the operator reads a Fleet setting
- **THEN** it says whether it applies to this browser only or to the whole installation
