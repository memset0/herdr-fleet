## MODIFIED Requirements

### Requirement: Collie's own configuration files cannot decide a Fleet-owned setting
The adopted Collie reads a machine-wide and an instance configuration file beneath its environment.
For every Collie setting Fleet owns — the Collie child's state directory, its bind host and port and
the loopback guards around them, its ingress, origin, public-host and trusted-identity settings, the
adopted Collie's own Cloudflare Access gate (its team and audience), its serve publication, the base path it is served under, and the lead's crew timing — Fleet SHALL
reset the variable in the child's environment and, where Fleet decides the value, set it, so the
environment Fleet hands Collie is what decides it.

Where Fleet leaves such a setting unset on purpose, so Collie keeps its default, a configuration file
could otherwise supply it. Fleet SHALL therefore read both files Collie will read, through Collie's
own reader and from the paths Collie will resolve for that child, and SHALL refuse to start the
generation when either file sets a Fleet-owned setting. The refusal SHALL name the file and the
setting and MUST NOT print the value. A file that sets only settings Fleet does not own SHALL be left
to Collie, and Fleet SHALL NOT write, create or rewrite either file.

#### Scenario: No Collie configuration file exists
- **WHEN** neither Collie configuration file is present
- **THEN** Fleet starts Collie exactly as it did before the adoption

#### Scenario: A Collie configuration file sets a setting Fleet does not own
- **WHEN** a Collie configuration file sets, for example, a speech-to-text or reader setting
- **THEN** Fleet starts normally and Collie applies that setting under its own precedence

#### Scenario: A Collie configuration file sets a Fleet-owned setting
- **WHEN** either Collie configuration file sets the bind, the base path, a trusted identity, the state directory or another Fleet-owned setting
- **THEN** the generation does not start, and the diagnostic names the file and the setting without its value

#### Scenario: The base path is asked for through the environment
- **WHEN** Fleet is started from an environment that carries a Collie base path
- **THEN** the Collie child receives none, and Collie keeps serving at the root the Gateway proxies

#### Scenario: Collie's Access gate is asked for
- **WHEN** a Collie configuration file, or the environment Fleet is started from, names a Cloudflare Access team or audience
- **THEN** a file refuses the generation, naming the file and the setting without its value, and an inherited value never reaches the Collie child, so the Gateway remains the only authentication in front of Collie
