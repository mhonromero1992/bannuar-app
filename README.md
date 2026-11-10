# Bannuar: the employee app

The phone app for the guards and staff of Bannuar Security Agency, Inc. (San Juan, La Union). It reads
and writes the same Supabase database as the HR portal
([bannuar-portal](https://github.com/mhonromero1992/bannuar-portal)) and the website
([bannuar-website](https://github.com/mhonromero1992/bannuar-website)), through the same row level
security: a guard sees only their own records, a detachment commander also their post's guards.

React Native 0.78.3 (bare, React Native CLI 15.0.1, no Expo), React 19, TypeScript. Built by House of
Gaia, in the same layout as the atlas app. Design: [DESIGN.md](DESIGN.md).

## What it does

| Screen | What the guard does there | In the database |
|---|---|---|
| Activate | First time: employee number, birthdate, mobile number on file, a new password | Edge Function `activate-employee` → `begin_employee_activation`, `auth.admin.createUser`, `handle_new_user` |
| Sign in | Employee number and password | `signInWithPassword` (login email made from the number), `my_access` |
| Set a new password | Forced after HR gives a temporary password | `auth.updateUser`, `mark_password_changed` |
| Forgot password | Told to ask HR for a temporary password (no email reset) | HR uses `admin_reset_password` in the portal |
| Time in and out | From Home: the phone's location is checked against the post, then a photo of the guard taken now, then the log. The time is the server's. Away from the post or with no location, it is still logged and marked for HR | `log_attendance`, `attendance_logs`, bucket `attendance-photos` |
| Attendance | Their time in and out of the last 31 days, by day, with each check | `attendance_logs` |
| Home | Today's attendance with the next button (time in or time out), post or "Floating since …", announcements to acknowledge, latest pay (hidden until tapped), open requests, documents to renew, leave to endorse (commanders) | `employees`, `announcements`, `payslips`, `leave_requests`, `coe_requests`, `profile_change_requests`, `payroll_concerns`, `document_alerts` |
| Announcements | Read, acknowledge, pictures | `announcements`, `announcement_receipts`, `mark_announcement_read`, bucket `announcement-media` |
| Payslips | Every published cutoff, every line, report a concern (no screenshots) | `payslips` + `payroll_periods`, `payroll_concerns` |
| Leave | Credits left, file leave with a document, cancel | `leave_balances`, `leave_types`, `leave_requests`, `cancel_leave_request`, bucket `employee-files` |
| Certificates of employment | Request (due in three days), cancel, open the PDF, the verification code | `coe_requests`, `certificates`, `cancel_coe_request`, bucket `certificates` |
| My records | The 201 file (read-only), government numbers (masked, no screenshots), documents with expiry, upload a renewal | `employees`, `get_government_ids`, `employee_documents`, `document_types` |
| Change my details | Ask HR to change contact details | `profile_change_requests` |
| Notifications | List, mark read, open the right screen; live while the app is open; push when set up | `notifications` (Realtime), `device_tokens` via `register_device_token` |
| My post | Commanders: their guards, leave to endorse with a reliever | `my_supervised_site_ids`, `decide_leave_request` |
| Account | Change password, app lock, privacy notice, version, sign out | |

Every list screen has loading, empty, error and offline states. Offline, it shows what was loaded
last with "Offline · updated 8 Nov 2026, 2:05 PM".

## Run it

You need Node 18 or newer, JDK 17, and Android Studio with: Android SDK Platform 36, Build-Tools
36.0.0, NDK 27.1.12297006 and CMake (SDK Manager → SDK Tools). For iOS: a Mac with Xcode 16 and
CocoaPods.

```bash
npm install
```

```bash
npm start
```

```bash
npm run android
```

`npm run android` builds a debug app, installs it on the phone or emulator that `adb devices` lists,
and loads the code from Metro (`npm start`). The build includes ARM only (most phones); for an x86_64
emulator:

```bash
cd android && ./gradlew installDebug -PreactNativeArchitectures=x86_64
```

iOS:

```bash
cd ios && bundle install && bundle exec pod install && cd ..
```

```bash
npm run ios
```

### The database side first

The app needs the portal's latest `supabase/schema.sql` and its two Edge Functions. Follow
[bannuar-portal/supabase/SETUP.md](https://github.com/mhonromero1992/bannuar-portal/blob/main/supabase/SETUP.md),
step 8 ("The employee app"): re-run `schema.sql`, deploy `activate-employee` and `send-push`, set
their secrets, add the webhook. Until `activate-employee` is deployed, activation answers "Something
went wrong on our side".

To try every screen before real records are loaded, run the portal's `supabase/seed-demo.sql` in a
new project, then activate a demo guard: employee number `DEMO-0002`, birthdate 30 September 1993,
mobile 0917 000 0002.

## Configuration

The app is already connected to Bannuar's Supabase project (`src/config/env.ts`). `.env` (copy
`.env.example`) overrides, for example to point a build at a staging copy:

| Variable | Default | |
|---|---|---|
| `SUPABASE_URL` | `https://bcynizcgdgqznlxuzwjx.supabase.co` | public |
| `SUPABASE_PUBLISHABLE_KEY` | Bannuar's publishable key | public; never the service role key |
| `WEBSITE_URL` | `https://bannuar-website.vercel.app` | the privacy notice and `/verify` |
| `EMPLOYEE_LOGIN_DOMAIN` | `employees.bannuar.invalid` | must match the function's `EMPLOYEE_LOGIN_DOMAIN` |
| `PUSH_ENABLED` | `false` | `true` once the Firebase files are in (below) |

Everything in `.env` is built into the app, where anyone can read it. After changing it, restart
Metro with `npm start -- --reset-cache`.

## Debug build on a phone

```bash
cd android && ./gradlew assembleDebug
```

```bash
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

A debug build loads its code from Metro on your computer; for a phone away from your computer, use a
release build.

## Release builds (APK and AAB)

Google Play takes only builds signed with Bannuar's upload key. Make it once and keep it, with its
passwords, somewhere safe outside git (`*.keystore` and `*.jks` are ignored):

```bash
keytool -genkeypair -v -storetype PKCS12 -keystore bannuar-upload.jks -alias bannuar-upload -keyalg RSA -keysize 2048 -validity 10000
```

Then in `~/.gradle/gradle.properties` on the machine that builds releases (or as
`ORG_GRADLE_PROJECT_<name>` variables on a build server):

```properties
BANNUAR_UPLOAD_STORE_FILE=/full/path/to/bannuar-upload.jks
BANNUAR_UPLOAD_STORE_PASSWORD=...
BANNUAR_UPLOAD_KEY_ALIAS=bannuar-upload
BANNUAR_UPLOAD_KEY_PASSWORD=...
```

| File | Command | Output |
|---|---|---|
| AAB for Google Play | `cd android && ./gradlew bundleRelease` | `android/app/build/outputs/bundle/release/app-release.aab` |
| APKs to install by hand | `cd android && ./gradlew assembleRelease` | `android/app/build/outputs/apk/release/app-arm64-v8a-release.apk` (most phones), `app-armeabi-v7a-release.apk` (older phones), `app-universal-release.apk` |

Without the upload key, `assembleRelease` signs with the debug key (fine for test phones) and
`bundleRelease` stops with an error. Raise `versionCode` in `android/app/build.gradle` for every
upload to Play; keep `versionName`, `package.json` `version` and the iOS version the same.

**Smaller APK.** Hermes is on and phone APKs are split by processor type. R8 shrinking is off until a
release build has been tried on a phone with it on: `./gradlew assembleRelease -PbannuarMinify=true`.

## Push notifications (Firebase)

Push is off until Bannuar's Firebase project is set up; the app builds and runs without it, and
notifications still reach the app live while it is open (Realtime).

1. In the Firebase console, create a project (or use Bannuar's), add an Android app with package
   `ph.bannuar.employee` and an iOS app with bundle ID `ph.bannuar.employee`.
2. Put `google-services.json` in `android/app/` and `GoogleService-Info.plist` in `ios/Bannuar/`
   (add it to the Bannuar target in Xcode). The Android build applies the Google Services plugin only
   when the file is there; iOS starts Firebase only when the plist is in the app.
3. iOS: in Xcode → Signing & Capabilities, add Push Notifications and Background Modes → Remote
   notifications; upload the APNs key to Firebase (Project settings → Cloud Messaging).
4. Set `PUSH_ENABLED=true` in `.env` and rebuild.
5. Server side: Firebase console → Project settings → Service accounts → Generate new private key,
   and save it as the `FCM_SERVICE_ACCOUNT` secret of the `send-push` Edge Function (portal SETUP.md,
   step 8).

After sign-in the app asks once for permission to show notifications (Android 13+ and iOS) and saves
the phone's token with `register_device_token`. Sign-out deletes it.

## Google Play: internal testing

1. Play Console → Create app: name "Bannuar" (to confirm), app, free.
2. App content: the privacy policy URL (the website's `/privacy`, once it covers the app), the Data
   safety form (what the app handles: name, employee number, contact details, pay, leave, documents
   and government numbers, all sent over HTTPS; no ads, no analytics), target audience 18+.
3. Testing → Internal testing → Create release → upload `app-release.aab` (Play App Signing keeps the
   app signing key; you keep the upload key).
4. Testers: add the testers' Google accounts or a Google Group, then share the opt-in link.
5. Each new build: raise `versionCode`, `./gradlew bundleRelease`, upload to a new release.

## Tests

```bash
npm run typecheck
```

```bash
npm run lint
```

```bash
npm test
```

`npm test` (Jest) runs every test against a mocked Supabase API at `https://mock.supabase.test`; any
request or socket to a real `*.supabase.co` host is refused and fails the test (`jest.setup.js`,
`jest.after.js`). It covers:

- every service's requests (method, table, columns, filters, body), and what the triggers fill in
  themselves (leave days and status, COE due date, document review status) is never sent
- a **contract test**: every service runs and each REST, RPC, storage and Edge Function request is
  checked against the real schema exported from Postgres (`__tests__/fixtures/schema-snapshot.json`,
  from the portal): tables, columns, embedded relations (including embeds PostgREST would refuse as
  ambiguous), filters, functions and their arguments, storage buckets and the folders the storage
  policies allow
- activation and its message for each answer, sign-in, staff accounts refused, the forced new
  password, sign-out removing the phone and wiping the keychain, cache and downloads, a fresh install
  after a previous one, offline starts
- peso, date and mobile formats, leave days, notification deep links, the commander's endorsement,
  push registration, the app lock, screenshot blocking, the WCAG contrast of both palettes, and the
  portal's status wording
- time in and out: the location check gives the same answer as `log_attendance` for the same points
  (the database tests use them too), Android's permission answers, the mock location flag, the app's
  own time limit, the selfie's folder, size and type, the log's arguments with and without a
  location, the photo deleted after sending, what to log next (night shifts included)
- screens driven through the real navigator: activation, payslips, filing leave, acknowledging an
  announcement, opening a notification, endorsing leave, time in from Home (checked, photographed,
  logged with the server's time), location refused, away with a mock location app, a failed send
  retried with the same upload, Home after a time in, the offline state

When the portal's `schema.sql` or `labels.ts` changes, copy them in and run the tests again:

```bash
npm run sync:portal
```

## Security and privacy (Data Privacy Act, RA 10173)

- The app holds only the publishable key. The service role key lives only in the Edge Functions'
  secrets.
- The session and every screen's saved data are encrypted in the phone's keychain
  (`react-native-keychain`: Android Keystore, iOS Keychain, this device only, no backup). Sign-out
  deletes them, the downloaded PDFs and the phone's push token. A fresh install on iOS wipes what a
  previous install left.
- Government numbers are never saved on the phone and are masked until tapped. Payslip and
  government number screens block screenshots and recordings on Android (`FLAG_SECURE`); iOS cannot
  block screenshots, so the app covers itself in the app switcher.
- Nothing personal goes to logs; there is no analytics or crash-reporting SDK. Push text never carries
  amounts or personal numbers (the `send-push` function writes it).
- App lock (off by default): the phone's own fingerprint, face or PIN.
- Time in and out: the location is read once while the guard logs ("while using the app" only,
  never in the background) and goes only with the log. The selfie is taken with the camera, never
  picked from the gallery, sent to the private `attendance-photos` bucket and deleted from the phone
  at once (also when the guard leaves without sending). The phone keeps no coordinates and no photo;
  its list of logs is encrypted like the rest. Staff and the post's commanders can open the photos.

## Choices

- **Bottom bar:** `@react-navigation/bottom-tabs` with a bar drawn by the app (`src/navigations/TabBar.tsx`).
- **Encrypted storage:** `react-native-keychain` for the session, the offline data and the app lock;
  one module instead of three.
- **Opening a COE PDF:** `react-native-blob-util` downloads it from a one-minute signed link into the
  app's private cache and hands it to the phone's PDF viewer (Android) or preview with share (iOS).
  One module does both; the alternatives need two (`react-native-fs` with `react-native-share` or a
  file viewer). The copy is deleted at sign-out.
- **Screenshots:** a 20-line module in the app (`SecureWindowModule.kt`) instead of a library.
- **Fonts:** five static cuts of Archivo, 51 KB each (`scripts/make-fonts.py`).
- **Location:** `@react-native-community/geolocation` 3.4.0, the community's module for what React
  Native core used to include. It reads Google Play services' fused location (Android's own location
  service on phones without Play services) and Core Location on iOS, and reports Android's "mock
  location" flag. It sends nothing anywhere; the app adds its own 25-second limit because its Play
  services path has none. The alternative was a native module of our own in Kotlin and Swift, which
  could not be compiled here.
- **Native modules:** screens, safe area, gesture handler, svg, bootsplash, notifee, document picker,
  image picker, geolocation, Firebase app and messaging, keychain, blob-util, and the screenshot
  module. No Expo.

## Not verified here

- **No Android build ran.** This container cannot reach Google's Maven repository (`dl.google.com`
  answers 403), which serves the Android Gradle plugin, AndroidX and Firebase, and has no Android SDK.
  `./gradlew assembleDebug` stops at resolving `com.android.tools.build:gradle:8.10.1`. Build with the
  commands above on a computer with Android Studio. The native code (`MainActivity.kt`,
  `MainApplication.kt`, `SecureWindowModule.kt`, `AppDelegate.swift`, Gradle and Podfile changes) was
  written but never compiled.
- **No iOS build** (no Mac here).
- **Nothing ran against the live project** (this container's network does not reach
  `*.supabase.co`). Supabase Auth's source (v2.197.0) shows `admin.createUser` checks an email's
  format only, so `…@employees.bannuar.invalid` should be accepted; confirm with the first
  activation.

## To confirm with Bannuar

| Item | Default in this build |
|---|---|
| App name and ID | "Bannuar", `ph.bannuar.employee` (Android and iOS) |
| Login email domain | `employees.bannuar.invalid` (never receives mail). If Bannuar prefers a domain it controls, set it in `.env` and in the function's `EMPLOYEE_LOGIN_DOMAIN` before the first guard activates |
| Firebase files | none: push stays off until `google-services.json` and `GoogleService-Info.plist` arrive |
| HR contact line | none printed: no phone or email has been verified yet |
| App lock | off by default; each guard can turn it on |
| Filipino text | English only for now |
| SMS sign-in | not built: it needs an SMS provider and budget approval |
| App icon | made from the badge PNG; the vector original is needed for a crisp icon |
| Commanders | operations names them on each post; the portal has no screen to give an employee login the `supervisor` role, so the app shows "My post" to anyone named on a post |
| Privacy notice | the app links to the website's `/privacy`, which today covers the website; it should also cover the app |
| Announcement pictures | the app shows pictures stored in `announcement-media/<announcement id>/`; the portal does not upload announcement pictures yet |
| Attendance away from the post | logged and marked for HR, never refused (GPS is off indoors and can be faked). Refusing it instead is a one-line change in `log_attendance` |
| Allowed distance | 150 m from the post's point unless operations sets another per post (20 m to 5 km) |
| Attendance without signal | not possible: the time must be the server's. A queue that logs later with the phone's clock would need Bannuar's approval |
| Who times in | every employee with an app login, office staff included; a floating guard's log is marked "No post assigned" |
| Selfie keeping | kept until HR deletes them (HR admins can); Bannuar should set a retention period in its privacy notice |
| Privacy notice | it should also say that time in and out take a photo and the phone's location |

## Layout

```
App.tsx, index.js
src/app/<area>/        screens: auth, home, announcements, payslips, leave, coe, records, notifications, commander, more
src/navigations/       stack and tab navigators, deep links, the tab bar
src/components/ui/     text, buttons, fields, date and select fields, cards, rows, states, icons
src/config/            env.ts, supabase.ts, theme.ts, labels.ts (the portal's wording)
src/services/          one file per domain (auth, payslips, leave, coe, records, push, …)
src/store/             session, cached data (encrypted), UI
src/lib/               formats, error messages
__tests__/             Jest; support/ holds the mock API and the contract check
android/, ios/         native projects
scripts/               fonts, icons, syncing the portal's schema snapshot
```
