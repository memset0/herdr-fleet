## REMOVED Requirements

### Requirement: The shell reports its own route changes
**Reason**: The observation it was written for — a strip across the top of the phone when a Pane is
opened from the dashboard — was attributed to the busy bar's navigation signal, and turning that
signal off did not remove the strip. The requirement therefore describes a fix for something that
was not the cause, and nothing implements it any more.

**Migration**: None. Collie's own slow-load behaviour is restored exactly: a navigation past its
short threshold surfaces the ambient bar again, as it does everywhere else in the application. The
strip the operator sees remains open, to be identified before anything is changed for it.
