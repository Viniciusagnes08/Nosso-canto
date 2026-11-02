# Entre Nos: a private space for two

## Decision
Build a responsive, installable, privacy-first web app for two people. The first deliverable works locally with no service dependencies, and is prepared for a dedicated Supabase instance for shared, authenticated data. External Google Photos, Google Calendar, and Spotify accounts remain opt-in per person.

## Scope
- Personal dashboards for each partner with current day, shared timeline, relationship countdown, routine, and daily prompts.
- Mood check-ins with optional notes and private/shared visibility; chronological history and calendar markers.
- Meals, photos, music links, messages, and events, authored by each person and visible to the other when shared.
- A small, positive challenge library; each partner can post photographic proof of completion. Absence of proof does not cause penalties.
- Memories gallery with image import from phone; a future Google Photos Picker connection can import user-selected images, including old photos.
- Optional Google Calendar read-only access and Spotify account access only after separate OAuth permissions and application registration. No automatic whole-library access.
- Safe offline sample behavior: no seeded personal content and clear local-only banner. Production sync requires explicit configuration.

## Platform and boundaries
- Static PWA shell (HTML/CSS/ES Modules + service worker): accessible on Android, iPhone, and desktop without app-store publication.
- No JavaScript framework or build dependency required for the preview.
- IndexedDB stores media blobs locally; localStorage stores local record metadata.
- Optional Supabase backend: authentication, relational pair membership, RLS, shared records, and private Storage photos. Each partner must authenticate and join a couple voluntarily.
- Google Photos picker only exposes explicitly selected images; the app never scans the user's photo library. Google Calendar and Spotify integrations can be added after separate OAuth credentials and consent flows.

## Security and privacy
- A couple is limited to two independently authenticated members, never tied to a phone number or identity inferred by the app.
- Private records visible to owner only. Shared records visible to members of the pair.
- No live location tracking, message scraping, inferred moods, or unattended photo collection.
- Users can disconnect integrations, hide entries, and delete their own data. Photo uploads are explicitly indicated as shared.
- No real or sample private information embedded in source. No developer keys in the client.

## Acceptance criteria
1. Open index.html and record a mood, a meal, an event, and a song; refresh and see saved entries.
2. Create a challenge and record photographic proof; progress reflects both partner slots.
3. Upload an image and see it in shared memories in local mode.
4. Navigate and use core flows at mobile and desktop widths.
5. Export a JSON backup.
6. Production setup instructions include a dedicated Supabase project, SQL migration and per-user opt-in; no external integration falsely appears connected.

## Staging
1. Local-first interactive prototype and schema (this build).
2. Remote pair auth/sync and shared media after new, personal Supabase project configured.
3. Google Photos Picker, Calendar OAuth, Spotify OAuth once both users consent and valid client IDs are provided.
4. Push notifications, time capsules, and native packaging after usage validation.
