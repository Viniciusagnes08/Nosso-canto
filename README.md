# Entre Nos - Nosso cantinho

A private, local-first web app for couples living apart. Responsive on desktop, Android and iPhone, installable as a Progressive Web App (PWA).

## What works in this preview

- Daily mood check-ins, notes, optionally marked private.
- Shared diary concepts: meals, messages, appointments and songs with listening links.
- Monthly calendar with day markers for records.
- Challenge catalog and new challenges. A user can attach photo proof to a challenge.
- Memories gallery, including older photos selected from the device.
- Custom names and relationship day counter.
- Offline storage of metadata in localStorage, images in IndexedDB.
- Full JSON export/import of local records and image blobs.
- Responsive desktop/mobile navigation, app manifest and service worker.
- Friendly relationship prompts (curated locally, with no AI profiling).

**Important:** The current app works on ONE device/browser. It does not yet synchronize two partners and is not connected to Google Photos, Google Calendar, or Spotify. It must not be described or used as if the other person's activities are automatically collected. No example personal data is preloaded.

## Run locally

Requires Python 3 (no npm or Docker needed):

```sh
cd entre-nos-app
python -m http.server 8080
```

Open http://localhost:8080/ in a browser. To install as an app, use the browser's "Add to Home Screen" or "Install" option while served from localhost or HTTPS.

## Deploy static preview

Import this folder as a static site in Vercel, Netlify, or Cloudflare Pages. No build command is needed; output directory is the root. The preview remains local-only on every device until remote sync is configured.

## Cloud and couple synchronization (not enabled)

`supabase/schema.sql` prepares an isolated database with Auth, couple invitations, row-level security, and private photo storage. The schema is not applied to any live project. Create a separate personal Supabase project before implementing authentication and synchronization; do not mix this with corporate project data.

Before turning on cloud writes, implement signed-in profiles, secure invitation redemption, authenticated storage uploads, an idempotent local-data migration, and complete RLS tests with two valid users plus one outsider. The preview intentionally does not have service-role secrets or hidden server access.

## External integrations (not enabled)

- **Google Photos:** since March 31, 2025, Google Photos Library API cannot read a user's entire personal library. The Photos Picker API can import user-selected old and new photos. It requires individual Google OAuth and user selection.
- **Google Calendar:** use per-user OAuth and read-only scopes, then let each user choose which events or busy slots to share with the partner.
- **Spotify:** use per-user OAuth PKCE for music data. Spotify Development Mode requires the developer's Premium subscription and user allow-list. Playback remains in Spotify; this app should show song metadata and deep links, not copy or stream Spotify recordings.
- **Advice API:** a further version can proxy a public tips API and provide reviewed Portuguese text. The current app uses curated on-device prompts.

## Data safety and consent

One user cannot read another's private journal or photo library. Future cloud sharing must require both users to join voluntarily, grant specific permissions, and provide a way to revoke access. Avoid continuous routine surveillance, partner location tracking, or inferred moods.

Source concept references: Pixy Mood Tracker (MIT), Mood Journal (MIT), Nightlio (AGPL-3.0), Our Days (MIT), TwoFrames (license file not verified). No upstream source code or assets are incorporated into this app. Ideas and functional patterns were researched; this preview is an independent implementation.

## Structure revision (0.2)

See [architecture and roadmap](docs/ESTRUTURA.md). Run `npm test` for regression checks. The application remains a local-only preview.
