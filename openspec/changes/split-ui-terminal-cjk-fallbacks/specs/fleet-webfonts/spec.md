## MODIFIED Requirements

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


### Requirement: Proportional CJK faces are UI choices
Fleet SHALL offer Source Han Sans and LXGW WenKai as English-only choices in a browser-local UI CJK fallback selector alongside a separate terminal CJK selector. Both SHALL be UI fallback faces and SHALL NOT be offered in the native primary-font pickers or as terminal fallback choices. Terminal fallback SHALL offer only monospace catalog faces. Both selectors SHALL default to no custom fallback. Choosing one SHALL immediately update its role's CJK typography and retain the choice across reloads, without modifying the native primary-font preference. Explicit previous shared fallback choices SHALL migrate independently, and previous fetched primary choices SHALL migrate to that role's exclusive CJK selection. Required faces SHALL come only from the closed catalog and use the existing font-only provider policy.

#### Scenario: A reader chooses a proportional Chinese face
- **WHEN** the reader selects either new UI face
- **THEN** the UI uses that face as its selected fallback, the preference survives reload and the terminal continues using its independent monospace font and fallback

#### Scenario: UI and terminal need different fetched fonts
- **WHEN** a proportional UI fallback and Maple Mono terminal fallback are selected together
- **THEN** both faces load once, and switching the UI font replaces only its stylesheet


## ADDED Requirements

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
