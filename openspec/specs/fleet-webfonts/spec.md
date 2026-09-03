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

When no fallback face is selected, that position SHALL name a family that matches nothing, so every
stack resolves exactly as it did without this capability. It MUST NOT be empty, and selecting or
clearing a fallback MUST NOT reorder, remove or replace any face already in a stack.

#### Scenario: No fallback is selected
- **WHEN** the operator selects no fallback face
- **THEN** every stack resolves to the same face it resolved to before this capability existed

#### Scenario: A fallback is selected
- **WHEN** a fallback face is selected and a codepoint the chosen face does not draw is painted
- **THEN** the fallback draws it, in the chrome and in the terminal mirror alike, and every codepoint the chosen face does draw is still drawn by the chosen face

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
pieces, so a browser fetches only the ranges it paints. The application SHALL request at most one
such stylesheet at a time, and a face named as both the fallback and a Latin choice SHALL resolve to
one family and one request.

An unreachable provider SHALL degrade to the same behavior as no fallback: the stacks fall through
to the system, the preference is kept, and no error is surfaced. The application MUST NOT block
first paint on the provider.

#### Scenario: A page paints no CJK
- **WHEN** a device renders only Latin
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
