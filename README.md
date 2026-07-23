# DayPal Hosting

This repository is retained as a compatibility host for published DayPal watchface builds.

## Published URL

`https://lyle-morris.github.io/DayPal-Hosting/app-config.html`

Do not remove or rename `app-config.html` while a published DayPal build still points to this URL.

## Canonical hosting

The consolidated production page is maintained in the `lyle-morris/Hosting` repository:

`https://lyle-morris.github.io/Hosting/apps/daypal/prod/app-config.html`

QA and immutable release snapshots are also stored in that repository.

## Migration plan

1. Keep the existing DayPal page operational.
2. Develop and validate future changes in the consolidated QA path.
3. DayPal 1.6.1 points the companion to the consolidated production URL.
4. Confirm the new URL on a physical watch before publishing 1.6.1.
5. Only then replace this repository's page with a compatibility redirect, if desired.
6. Keep this repository online for DayPal 1.6.0 and earlier installations.

Any future redirect must append both `location.search` and `location.hash` to preserve Pebble configuration data.
