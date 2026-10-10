# fleet-webfonts Specification

## Purpose
Defines the face Herdr Fleet puts under a chosen font for the codepoints that font does not draw,
where it comes from, and the exact boundary at which a third-party origin is admitted.

## Requirements

### Requirement: One fallback position in every stack
Every font stack the application resolves through — the app's own face including each face its
typeface setting offers, the terminal mirror's, the draft field's, and the stack agent-authored
content wears — SHALL contain exactly one position for its role-specific fallback face, after the faces the operator
chose and before the generic system tail.

That position SHALL be EFFECTIVE, not merely declared: the stack the default UI face actually resolves
through on a running page SHALL carry it, including where the adopted Collie re-declares the default
stack outside the cascade layer its stylesheet uses (its pre-paint mirror for the boot splash). Every
other typeface choice SHALL keep resolving through its own stack.

UI/prose and terminal/monospace stacks SHALL resolve independently. Native primary faces SHALL precede the selected fallback in normal mode. An optional per-role exclusive mode SHALL instead use the selected CJK face before the generic system tail, omitting native primary faces while preserving terminal symbol coverage. Exclusive mode SHALL have no effect when its role has no selected face.

When no fallback face is selected, that position SHALL name a family that matches nothing, so every
stack resolves exactly as it did without this capability. It MUST NOT be empty, and in normal mode selecting or
clearing a fallback MUST NOT reorder, remove or replace any face already in a stack.

#### Scenario: No fallback is selected
- **WHEN** the operator selects no fallback face
- **THEN** every stack resolves to the same face it resolved to before this capability existed

#### Scenario: A fallback is selected
- **WHEN** a fallback face is selected and a codepoint the chosen face does not draw is painted
- **THEN** the fallback draws it, only in the role for which it is selected, and every codepoint the chosen face does draw is still drawn by the chosen face

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
Fleet SHALL offer Source Han Sans and LXGW WenKai as English-only choices in a browser-local UI CJK fallback selector alongside a separate terminal CJK selector. Both SHALL be UI fallback faces and SHALL NOT be offered in the native primary-font pickers or as terminal fallback choices. Terminal fallback SHALL offer only monospace catalog faces. Both selectors SHALL default to no custom fallback. Choosing one SHALL immediately update its role's CJK typography and retain the choice across reloads, without modifying the native primary-font preference. Explicit previous shared fallback choices SHALL migrate independently, and previous fetched primary choices SHALL migrate to that role's exclusive CJK selection. Required faces SHALL come only from the closed catalog and use the existing font-only provider policy.

#### Scenario: A reader chooses a proportional Chinese face
- **WHEN** the reader selects either new UI face
- **THEN** the UI uses that face as its selected fallback, the preference survives reload and the terminal continues using its independent monospace font and fallback

#### Scenario: UI and terminal need different fetched fonts
- **WHEN** a proportional UI fallback and Maple Mono terminal fallback are selected together
- **THEN** both faces load once, and switching the UI font replaces only its stylesheet

### Requirement: Fleet Chat prose follows the UI font
Fleet Chat prose SHALL use the selected UI font stack. This SHALL include message prose and non-code text inside Chat cards. Code blocks, inline code, verbatim tool output, terminal/mirror and composer fonts SHALL remain independently monospace or follow their existing preferences. Other content surfaces and bare Collie SHALL retain their native typography. Chat density controls SHALL keep working independently of the chosen face.

#### Scenario: A reader changes UI typeface while reading Chat
- **WHEN** the reader changes the UI font
- **THEN** Chat prose updates with the UI while code, terminal and composer typography retain their existing fonts and Chat density settings stay unchanged

### Requirement: CJK fallback controls stand together with independent exclusive switches
Fleet SHALL show UI and terminal CJK selectors and one “Use only CJK font” switch per role in one flat settings card. None SHALL disable custom fallback; with a face selected and exclusive mode off, native primary fonts SHALL precede the CJK font. With exclusive mode on, the selected CJK font SHALL handle Latin and CJK without the native primary faces. Values and modes SHALL persist independently and remain bounded by the role-aware closed catalog. Faces required by both roles SHALL load once. These controls SHALL apply to live mirror and real terminal surfaces as well as UI/Chat prose without changing native font picker definitions.

#### Scenario: Normal fallback mode
- **WHEN** a reader chooses a CJK face and leaves its exclusive switch off
- **THEN** the native primary font renders glyphs it supports and the CJK face covers missing glyphs for that role

#### Scenario: Exclusive mode
- **WHEN** the reader enables a role's exclusive switch with a selected face
- **THEN** that face renders Latin and CJK for its role while the other role keeps its own setting

#### Scenario: No custom face
- **WHEN** the reader chooses None
- **THEN** that role uses its native fonts and system fallback without a fetched CJK override
