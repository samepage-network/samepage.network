# Changelog

## Unreleased

- Replace the web app with the selected Lattice Flight homepage and self-hosted Manrope.
- Remove existing page routes and public content; redirect retired URLs to the homepage.
- Invalidate CloudFront caches after a full web deployment so old pages and assets stop being served.

## 0.75.6

- Fixed RoamJS extension error reports failing when the SamePage database is unavailable. Reports that include notebook details now reach storage and support email without a database lookup.
- Fixed database connection cleanup compatibility with the current Drizzle version.
