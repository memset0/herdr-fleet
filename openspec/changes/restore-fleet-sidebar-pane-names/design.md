## Decisions
Reuse the existing Fleet shell. Add an optional single-pane layout port to the existing native DetailRoute; the Fleet-owned route selects it. Keep upstream width hooks and WideLayout untouched. Hide only its layout setting in Fleet builds.

Implement one owned pure sidebar-name helper, used by the owned hierarchy projection and Agent card. Meaningful explicit pane labels precede session/terminal titles; stale terminal titles are ignored. Do not borrow soleTabName. Detect paths before removing decorative prefixes so a leading slash cannot accidentally become a title. Preserve the hierarchy's Tab action subject and target even when its visible label changes.

No backend or peer behavior changes. Release axis is patch, 4.1.0 to 4.1.1. Focused model, naming, shell and route/settings coverage plus both typechecks, lint and fork/privacy checks protect the change. Preserve unrelated active changes.
