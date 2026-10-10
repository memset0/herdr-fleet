## ADDED Requirements

### Requirement: Chat letter spacing is a bounded browser preference
Fleet SHALL offer letter-spacing controls directly below the native Chat text-size row in Display when Chat is shown. Readers SHALL be able to tighten or widen spacing from -0.08em to 0.12em in 0.01em steps and reset to native normal spacing. The choice SHALL apply immediately to the Chat stream and persist only in the current browser. Invalid stored values SHALL fall back safely, and numeric values outside the range SHALL be bounded. Mirror, terminal, composer and navigation typography SHALL remain unaffected. Existing native Chat text-size controls and defaults SHALL remain unchanged; the controls SHALL be absent when the Display panel describes a terminal body.

#### Scenario: A reader tightens Chat spacing
- **WHEN** Chat is visible and the reader decreases its letter spacing
- **THEN** the stream updates immediately and reopening the page retains the chosen spacing without changing terminal or draft preferences

#### Scenario: A reader restores defaults
- **WHEN** the reader resets Chat letter spacing
- **THEN** the stream returns to native normal spacing

#### Scenario: Stored data is malformed
- **WHEN** the browser preference is invalid or outside its supported numeric range
- **THEN** Fleet uses the default for invalid data and bounds valid numeric data without breaking Display
