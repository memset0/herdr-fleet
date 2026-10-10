## MODIFIED Requirements

### Requirement: The provider is fetched in pieces and may simply be absent
The selected face SHALL be requested through one stylesheet that declares it in `unicode-range`
pieces, so a browser fetches only the ranges it paints, including Latin ranges when the fetched face is the primary UI choice. The application SHALL request at most one stylesheet per distinct required face, with a maximum of two: the chosen UI face and the monospace fallback. A face serving multiple roles SHALL resolve to one family and one request.

An unreachable provider SHALL degrade to the same behavior as no fallback: the stacks fall through
to the system, the preference is kept, and no error is surfaced. The application MUST NOT block
first paint on the provider.

#### Scenario: A page paints no CJK
- **WHEN** a device renders only Latin and its UI choice is not a fetched face
- **THEN** no glyph file is fetched from the provider

#### Scenario: The provider is unreachable
- **WHEN** the stylesheet or a glyph file cannot be fetched
- **THEN** text renders in the next face in the stack, the preference is unchanged, and nothing is reported as an error

#### Scenario: The same face is chosen twice over
- **WHEN** the fallback and one of the Latin pickers name the same catalog entry
- **THEN** exactly one stylesheet is requested

## ADDED Requirements

### Requirement: Proportional CJK faces are UI choices
Fleet SHALL offer Source Han Sans and LXGW WenKai in the existing browser-local UI Typeface picker. Both SHALL be primary proportional UI faces, never terminal-font or monospace CJK-fallback choices. Choosing one SHALL immediately update UI typography and retain the choice across reloads, with the pre-paint and runtime classes agreeing. Existing defaults and monospace fallback preferences SHALL remain unchanged. Required faces SHALL come only from the closed catalog and use the existing font-only provider policy.

#### Scenario: A reader chooses a proportional Chinese face
- **WHEN** the reader selects either new UI face
- **THEN** the UI uses that face, the preference survives reload and the terminal continues using its independent monospace font and fallback

#### Scenario: UI and terminal need different fetched fonts
- **WHEN** a proportional UI font and Maple Mono fallback are selected together
- **THEN** both faces load once, and switching the UI font replaces only its stylesheet

### Requirement: Fleet Chat prose follows the UI font
Fleet Chat prose SHALL use the selected UI font stack. This SHALL include message prose and non-code text inside Chat cards. Code blocks, inline code, verbatim tool output, terminal/mirror and composer fonts SHALL remain independently monospace or follow their existing preferences. Other content surfaces and bare Collie SHALL retain their native typography. Chat density controls SHALL keep working independently of the chosen face.

#### Scenario: A reader changes UI typeface while reading Chat
- **WHEN** the reader changes the UI font
- **THEN** Chat prose updates with the UI while code, terminal and composer typography retain their existing fonts and Chat density settings stay unchanged
