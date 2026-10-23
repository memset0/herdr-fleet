# fleet-precache-limit Specification

## Purpose
TBD - created by archiving change fleet-precache-limit. Update Purpose after archive.

## Requirements

### Requirement: The web build precaches the main chunk up to 4 MiB
The Fleet web build SHALL set the service worker's precache size limit to 4 MiB, so that a main chunk above Workbox's 2 MiB default is precached and does not fail the build.

#### Scenario: The main chunk is above 2 MiB
- **WHEN** the web UI is built and its main chunk is between 2 MiB and 4 MiB
- **THEN** the build completes and the chunk is in the precache manifest

#### Scenario: The main chunk is above 4 MiB
- **WHEN** the main chunk grows past 4 MiB
- **THEN** the build fails, as upstream's does past its default
