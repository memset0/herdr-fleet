## MODIFIED Requirements

### Requirement: Chat letter spacing is a bounded browser preference
Fleet SHALL offer letter-spacing controls directly below the native Chat text-size row in Display when Chat is shown. Readers SHALL be able to tighten or widen spacing from -0.12em to 0.12em in 0.01em steps and reset to native normal spacing. The choice SHALL apply immediately to the Chat stream and persist only in the current browser. Invalid stored values SHALL fall back safely, and numeric values outside the range SHALL be bounded. Mirror, terminal, composer and navigation typography SHALL remain unaffected. Fleet Chat text size SHALL allow 10–20px while retaining the native 14px default and the bare Collie range; the controls SHALL be absent when the Display panel describes a terminal body.

#### Scenario: A reader tightens Chat spacing
- **WHEN** Chat is visible and the reader decreases its letter spacing
- **THEN** the stream updates immediately and reopening the page retains the chosen spacing without changing terminal or draft preferences

#### Scenario: A reader restores defaults
- **WHEN** the reader resets Chat letter spacing
- **THEN** the stream returns to native normal spacing

#### Scenario: Stored data is malformed
- **WHEN** the browser preference is invalid or outside its supported numeric range
- **THEN** Fleet uses the default for invalid data and bounds valid numeric data without breaking Display

## ADDED Requirements

### Requirement: Chat vertical density is independently adjustable
Fleet SHALL offer browser-local Chat line-height, content-block vertical padding and between-block gap controls in Display. Line height SHALL support 1.1–2.0 in 0.05 steps, padding 0–16px and gap 0–24px in 1px steps. Each preference SHALL reset independently to native formatting, and absent preferences SHALL preserve current formatting. Padding SHALL affect marked content areas of tool calls, messages and other Chat blocks without removing interactive hit-area floors or the stream's shadow/focus containment padding. Gap changes SHALL retain matching containment margins. Preferences SHALL apply immediately, persist safely and have bounded values; unrelated terminal, composer and navigation typography SHALL remain unchanged.

#### Scenario: A reader reduces tool-call padding
- **WHEN** the reader sets a smaller content padding and gap
- **THEN** Chat blocks become denser while their actions retain the native hit areas and focus/shadows are not clipped

#### Scenario: A reader resets one density choice
- **WHEN** a density preference is reset
- **THEN** native formatting returns for that preference while other chosen density values remain
