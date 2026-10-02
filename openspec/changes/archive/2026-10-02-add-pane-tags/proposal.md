## Why

Operators need a shared vocabulary for panes that survives browser changes and agent replacement inside a pane. The existing per-browser pins organize attention but carry no shared labels.

## What Changes

- Add a lead-owned persistent tag catalog and pane associations, authenticated through Fleet's Gateway.
- Create tags with randomly selected palette colors; reuse an existing name and allow global name/color edits through stable tag IDs.
- Show named colored tags on an additional line beneath tagged Agent rail rows, including the phone switcher. Offer accessible assignment and global editing controls.
- Keep the existing 44px content area and add height only for attached tags.
- Non-goals: agent-conversation identity, changing favorites, color-only displays, filtering, peer protocol changes, and global tag deletion.

## Capabilities

### New Capabilities
- `fleet-pane-tags`: Shared tag definitions, pane associations, persistence and editing UI.

### Modified Capabilities
- `fleet-native-navigation-sidebars`: Permit an additional tag line beneath the native rail row.

## Impact

Baseline: Collie v1.15.0, commit `ef01b0ed4d9271897413984075aa6d2060ffcf2a`. Reuse native pane identity, pins, triage and UI primitives unchanged. New behavior belongs to Fleet Gateway modules and fork-owned web modules, with only translation dictionary ports if needed. No dependencies or peer changes are required; the intended release axis is patch because the lead alone supplies the Gateway and browser code.
