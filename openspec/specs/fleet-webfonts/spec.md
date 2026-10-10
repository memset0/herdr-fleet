# fleet-webfonts Specification

## Purpose
Defines the face Herdr Fleet puts under a chosen font for the codepoints that font does not draw,
where it comes from, and the exact boundary at which a third-party origin is admitted.

## Requirements

### Requirement: One fallback position in every stack
Every font stack the application resolves through — the app's own face including each face its
typeface setting offers, the terminal mirror's, the draft field's, and the stack agent-authored
content wears — SHALL contain exactly one position for a fallback face, after the faces the operator
chose and before the generic system tail.

That position SHALL be EFFECTIVE, not merely declared: the stack the default UI face actually resolves
through on a running page SHALL carry it, including where the adopted Collie re-declares the default
stack outside the cascade layer its stylesheet uses (its pre-paint mirror for the boot splash). Every
other typeface choice SHALL keep resolving through its own stack.

When no fallback face is selected, that position SHALL name a family that matches nothing, so every
stack resolves exactly as it did without this capability. It MUST NOT be empty, and selecting or
clearing a fallback MUST NOT reorder, remove or replace any face already in a stack.

#### Scenario: No fallback is selected
- **WHEN** the operator selects no fallback face
- **THEN** every stack resolves to the same face it resolved to before this capability existed

#### Scenario: A fallback is selected
- **WHEN** a fallback face is selected and a codepoint the chosen face does not draw is painted
- **THEN** the fallback draws it, in the chrome and in the terminal mirror alike, and every codepoint the chosen face does draw is still drawn by the chosen face

#### Scenario: CJK text in the default UI face
- **WHEN** the default typeface is in use, a CJK fallback is selected, and a rail heading, a tab-bar label or a belt label contains CJK text
- **THEN** its CJK glyphs are drawn by the selected fallback rather than by a system CJK face, and its Latin glyphs by the default face

#### Scenario: Another typeface is chosen
- **WHEN** the operator chooses a typeface other than the default
- **THEN** the UI resolves through that typeface's own stack, with the fallback position in it

### Requirement: The face is fetched from a closed catalog, never named by stored text
The selectable fallback faces SHALL come from a catalog compiled into the application, each entry
naming one family and one `https` stylesheet. The stored preference SHALL be a versioned,
size-bounded browser-local record holding a catalog id or an explicit refusal; any other value —
malformed, unknown, oversized, wrongly versioned, or carrying an unexpected field — SHALL resolve to
the default.

A family name or a stylesheet URL SHALL only ever be taken from that catalog. Stored text MUST NOT
become either. The preference MUST NOT be sent to the Gateway, the Collie bridge, Herdr, or another
browser.

#### Scenario: A stored record names something the catalog does not have
- **WHEN** the stored preference holds an unknown id, an arbitrary family, or a URL
- **THEN** the default face is used and nothing from that record reaches the document

#### Scenario: Browser storage cannot be read or written
- **WHEN** reading or writing the preference throws
- **THEN** the application continues with a bounded in-memory choice and performs no recovery request

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

### Requirement: The fetched origin is admitted for fonts and for nothing else
The application's Content-Security-Policy SHALL admit the provider origin for stylesheets and for
font files only. It MUST NOT admit that origin, or any other external origin, for scripts, for
network connections, for frames, or as a base URI. The document MUST NOT send this deployment's own
origin to the provider.

#### Scenario: The provider serves something other than a font
- **WHEN** the provider origin returns a script, or the application attempts a connection to it
- **THEN** the policy refuses it

#### Scenario: A font request is made
- **WHEN** the browser requests the stylesheet or one of its glyph files
- **THEN** the request carries no referrer identifying this deployment

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
