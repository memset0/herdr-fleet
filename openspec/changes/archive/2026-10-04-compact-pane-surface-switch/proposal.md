## Why

The navigation footer's surface selector spends too much height on two heavy buttons. A compact shared track will give the hierarchy more room and make the choice feel like one control.

## What Changes

- Refine the fork-owned Collie / TTYD selector into a 44px band with a shared muted track and a sliding selected indicator.
- Retain a clear selected fill, 44px hit targets, keyboard focus, and stable label geometry.
- Reuse the existing Button primitive and the existing browser preference store on the Collie v1.15.0 baseline (ef01b0ed4d9271897413984075aa6d2060ffcf2a).
- Make the build identity a smaller, centered neutral-gray caption in a compact row.
- Non-goals: navigation, terminal behavior, settings, dependencies, or upstream components.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `fleet-native-navigation-sidebars`: replace the tall footer bands with a compact sliding selector and subdued build caption.

## Impact

Own this change directory, web/src/components/fleet-pane-surface-toggle.tsx, web/src/components/fleet-navigation-footer.tsx, both affected existing component tests, the owning canonical specification at archive, and the task's CHANGELOG.md entry. The product tree was clean at task start. No invasive port or fork ownership boundary changes are needed. This frontend-only change is patch-level if released.
