## MODIFIED Requirements

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
