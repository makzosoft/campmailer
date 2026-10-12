CAMPMAILER  v8
Personal emails from your own Gmail: schedule them, track them, stay out of spam.

In this zip
  README.txt                      this file
  CampMailer-Quick-Guide.pdf      a 6-page illustrated guide for beginners (share it with your users)
  supabase-setup.sql              paste into Supabase once (see SETUP)
  public/                         the app, the /docs guide, the logo and icons
  api/index.js                    the ONE serverless function the whole app runs on
  lib/                            the server code (lib/routes has one file per address)

Built-in help for your users
  https://YOUR-APP.vercel.app/docs      a step-by-step guide, start to finish, with screenshots
  Settings (bell icon) > "Open the guide" and "PDF quick guide"


====================================================================
WHAT'S NEW IN v8
====================================================================
  - INBOX CHECK. Under the message box, a live 0 to 100 score for how spam
    filters may see the email, with plain advice (ALL CAPS, spammy phrases,
    link shorteners, too many links, image-only emails, hidden text, links
    that lie, missing footer, and more). Runs in the browser. It is a guide,
    not a guarantee.
  - WARM-UP MODE (Schedule form). Start at, say, 20 a day and add 10 each
    sending day until the daily limit is reached. Presets: Gentle, Steady,
    Faster. The summary shows the ramp and how many days it will take.
  - AUTO-PAUSE. If sends keep failing (4 in a row, or 5 of the last 10) a
    schedule pauses itself, stops right away so the rest of the list is not
    burned through, and tells you (also as a notification). Fix the problem
    and press Resume.
  - /docs: a full beginner guide, and a 6-page PDF guide (CampMailer-Quick-Guide.pdf).
  - Fixes: the unsubscribe and newsletter sign-up pages no longer overflow
    small phone screens; the sign-up anti-bot box can no longer silently drop
    a real person; the Analytics header fits short screens; Opened/Clicked
    tags show sooner after a reload.


====================================================================
SETUP (once)
====================================================================
You need free accounts at GitHub, Vercel, Supabase and cron-job.org.

  1. GITHUB. Create a repository and upload the contents of this zip to the
     ROOT of it (api/, lib/, public/, package.json, vercel.json at the top
     level). Keep file names exactly as they are, including api/index.js.

  2. VERCEL. Import the repository. Leave settings as they are. Deploy.

  3. SUPABASE. Create a project. Open SQL Editor > New query, paste ALL of
     supabase-setup.sql, press Run. "Success. No rows returned" is normal.
     It is safe to run again later, it only adds what is missing.

  4. VERCEL > Settings > Environment Variables (Production):
        SUPABASE_URL                the project URL
        SUPABASE_SERVICE_ROLE_KEY   the service role key (server side only!)
        CRON_SECRET                 a long random secret, letters and numbers only
     Optional:
        APP_URL                     e.g. https://mail.yourbrand.com, if you use
                                    your own domain (tracking and unsubscribe
                                    links will use it)
     Then redeploy (Deployments > the latest one > Redeploy).

  5. CRON-JOB.ORG. Create ONE job that runs EVERY 1 MINUTE and opens
        https://YOUR-APP.vercel.app/api/cron/run?key=YOUR_CRON_SECRET
     (This is the "alarm clock" that wakes the app. The app itself decides
     what is due, so one job serves every schedule.)

  6. CHECK, in a browser, in this order:
        https://YOUR-APP.vercel.app/api            -> {"ok":true,"app":"CampMailer"}
        https://YOUR-APP.vercel.app/api/health?key=YOUR_CRON_SECRET  -> "ok": true
        https://YOUR-APP.vercel.app/docs           -> the guide
     /api/health also checks every Supabase table and names anything missing.

Never put keys in the code, in chats or in screenshots. If one leaks, replace
it. (CRON_SECRET also locks the saved App Passwords of running schedules, so
change it when no schedule is running.)


====================================================================
UPGRADING FROM AN EARLIER VERSION
====================================================================
  - Upload everything in this zip, replacing the old files.
  - Run supabase-setup.sql again in Supabase.
  - The whole app runs from ONE function (api/index.js) because Vercel's free
    plan allows only 12. DELETE these old files from the api/ folder if they
    are still there, otherwise Vercel still counts them:
        api/login.js, api/send.js, api/schedule-start.js, api/schedule-status.js,
        api/schedule-cancel.js, api/schedule-pause.js, api/unsub.js,
        api/unsubscribes.js, api/track-stats.js, api/subscribe.js,
        api/newsletters.js, api/push.js, api/push-key.js, api/health.js,
        api/[...path].js, and the folders api/cron/ and api/t/
    When done, api/ contains exactly one file: index.js
  - Redeploy and run the three checks in SETUP step 6.


====================================================================
WHAT YOUR USERS CAN DO (the /docs guide explains each step)
====================================================================
  - Sign in with Gmail + an App Password (a separate 16-letter password for
    one app; delete it in Google any time).
  - Load an Excel (.xlsx) or CSV list, or paste one. Bad and duplicate emails
    are skipped. Every list is saved in History on the device.
  - Name the campaign, write the email with merge fields such as
    {{Full Name}}, {{first_name}}, {{first_name|there}}; preview each person's
    version; plain text or raw HTML; send a test to yourself.
  - Tracking (off by default): count clicks (reliable) and opens (approximate),
    plus an optional footer line. Every email also gets an Unsubscribe link.
  - Inbox check: live spam-risk score with advice.
  - Send now (runs while the page is open) or Schedule (runs on the server).
  - Watch progress: the bar at the bottom, per-person Queued / Sent / Failed /
    Opened / Clicked, Pause / Resume / Cancel.
  - History and Analytics (rings, funnel, activity over time, best hour to
    send, top links, quick facts) and a CSV report per campaign.
  - Unsubscribed list (with Add back) and automatic skipping.
  - Newsletter lists with a public sign-up link (/join/CODE).
  - Install as an app (banner on phones), notifications, light/dark/auto.


====================================================================
SCHEDULING IN PLAIN WORDS
====================================================================
  Daily limit        the most emails in one day (Gmail: about 500)
  Send N every X     small groups; 3 to 5 every 15 minutes is a good start
  Only between       sending hours in the user's own time zone
  On these days      for example weekdays only
  Start              right away, or a date and time
  Warm up slowly     day 1 sends the "start" amount, each later sending day
                     adds the "step" until the daily limit is reached
  Auto-pause         4 failures in a row, or 5 of the last 10, pauses it
  A schedule holds up to 3000 people. A failed address (bad email) is not
  retried. If Gmail cannot be reached, that person is retried on the next
  check, up to 3 times. If cron-job.org has not pinged for 10 minutes the
  schedule bar shows a warning.


====================================================================
INBOX CHECK, HONESTLY
====================================================================
  It scores the subject and message for common spam signals. 85 and above is
  good, 65 to 84 is okay, below 65 is risky. It cannot see your sender
  reputation or what Gmail thinks of you, so a perfect score does not
  guarantee the inbox. The best protection is still: start slowly (warm-up),
  email only people who expect it, write like a person, keep the footer and
  unsubscribe link, and use a business domain for regular marketing.


====================================================================
TRACKING, UNSUBSCRIBE, NEWSLETTER: THE HONEST NOTES
====================================================================
  - Clicks are reliable. Opens are approximate: Apple Mail can count an open
    before anyone reads, and Gmail may cache the image or people may block it.
    Some security scanners also click links.
  - If you email people who do not know you, tell them (the footer helper adds
    a line) and check the rules where they live (for example NDPA in Nigeria,
    GDPR in the EU). When in doubt, switch opens off.
  - Unsubscribing takes two steps on purpose (open the link, press the button)
    so email scanners cannot unsubscribe people by accident. Gmail's own
    Unsubscribe button works in one click. Unsubscribes apply per sending
    Gmail account.
  - Newsletter sign-up is single step (no confirmation email), because the
    server does not keep your Gmail password. A hidden field and a timing
    check stop most bots, but anyone can type someone else's address, and the
    unsubscribe link protects them. Only add people who agreed to hear from you.


====================================================================
NOTIFICATIONS, HONESTLY
====================================================================
  - Settings (bell icon) > "Notify me on this device", then choose: every
    batch sent, campaign finished, problems. There is nothing to set up; the
    signing keys are created automatically.
  - They cover SCHEDULED campaigns, because those send from the server. A send
    started by hand runs in the open page: if the page is in the background
    when it finishes you get a local alert, but closing the page stops it.
  - iPhone needs the app installed to the home screen first (iOS 16.4+).
  - Clearing browser data removes the device; turn notifications on again.


====================================================================
WHERE THINGS LIVE (privacy)
====================================================================
  On the device (browser storage): the sign-in, lists and History (IndexedDB),
    theme, notification choices. Sign out keeps History, removes the sign-in.
  On the server (Supabase): running and finished schedules (people, status;
    the App Password encrypted, deleted when the schedule ends or is
    canceled), tracking events, unsubscribes, newsletter lists, and push
    devices (a code that lets the server reach a phone, not contacts).
  Private/incognito windows may block History.


====================================================================
IF SOMETHING BREAKS
====================================================================
  Open https://YOUR-APP.vercel.app/api/health?key=YOUR_CRON_SECRET
  It lists which package, file, database setting or table is missing (it
  never shows secrets).

  500 FUNCTION_INVOCATION_FAILED   a file or package was not uploaded
                                   (for example package.json). Check /api/health.
  Build failed: "no more than 12"  old files are still in api/. See UPGRADING.
  404 on /api/cron/run             api/index.js or vercel.json is missing or old.
  Queued but nothing sends         check hours/days/limit/paused on the bar,
                                   then that the cron-job.org job runs every minute.
  Sign-up page "Please try again"  the form was sent too fast or the hidden
                                   field was filled; resubmit.
  Notifications switch will not turn on   iPhone needs the app installed first;
                                   otherwise check browser permission.


====================================================================
LIMITS
====================================================================
  - Gmail allows roughly 500 emails a day on a free account. Big bursts can
    get an account flagged, so keep groups small and use warm-up.
  - Vercel's free Hobby plan is for personal, non-commercial use.
  - One schedule: up to 3000 people, groups of 1 to 20.


====================================================================
FILE MAP
====================================================================
  api/index.js            routes every /api/... and /join/... address
  lib/routes/*.js         one file per address (send, schedule-*, track, unsub, ...)
  lib/schedule.js         the scheduler (windows, warm-up, auto-pause, locks)
  lib/mail.js             builds and sends each email (plain + HTML, footer, tracking)
  lib/track.js            signed links for opens, clicks, unsubscribe
  lib/push.js             push notifications
  lib/store.js            Supabase storage
  public/index.html       the whole app
  public/docs.html        the guide (shown at /docs)
  public/sw.js            service worker (offline app, notifications)
  public/guide/           guide screenshots and the PDF
  public/brand/           logo and app icons
  supabase-setup.sql      database tables
