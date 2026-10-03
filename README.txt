CAMPMAILER  v7

Load a list (CSV or Excel), write the message, press Send or Schedule. Each
person gets their own personalised email from your Gmail.


WHAT'S NEW IN v7
  - New CampMailer logo and brand (green tent + paper plane). Files are in
    public/brand/ (icon, light and dark logos, app icons).
  - Install as an app: a banner at the top (phones only) offers to install
    CampMailer to the home screen. Android installs in one tap; on iPhone it
    shows the two steps (Share, then Add to Home Screen).
  - Light / Dark / Auto theme. Tap the sun/moon button, or choose in Settings.
  - Notifications: Settings (bell icon) > "Notify me on this device".
    Choose alerts for: every batch sent, campaign finished, problems.
    There is nothing to set up; the signing keys are created automatically.
  - Analytics: an "Analytics" button next to Open / Download report in
    History, and next to Download report on the list screen. Shows sent,
    opened, clicked and unsubscribed, a funnel, activity over time, the best
    hour to send, top links and quick facts.
  - The schedule bar at the bottom now wraps on small phones, so nothing is
    cut off. The HTML preview is taller and grows to fit the email.

  UPGRADING FROM v6: upload ALL files (new: sw.js, manifest.webmanifest,
  public/brand/, api/push.js, api/push-key.js, lib/push.js, new vercel.json),
  run supabase-setup.sql again in Supabase (it adds one table, push_subs, and
  is safe to repeat), then redeploy.

  NOTIFICATIONS, HONESTLY
  - They cover SCHEDULED campaigns, because those send from the server.
    A send you start by hand runs in your open page; if the page is in the
    background when it finishes you get a local alert, but closing the page
    stops that send.
  - iPhone needs the app installed to the home screen first (iOS 16.4 or
    newer). Android works in Chrome, installed or not.
  - If you clear the browser's data or reinstall, turn notifications on again.


EARLIER, IN v6
  - Campaign names: every campaign has a name (defaults to the file name).
    It shows in History, on the schedule, and in report file names.
  - Tracking (switched on per campaign): count link clicks and (approximate)
    opens. Each person shows "Opened" / "Clicked" chips, with filters, in the
    report CSV and in History.
  - Unsubscribe: every email gets an Unsubscribe link in the footer plus the
    Unsubscribe button Gmail shows next to your name. People who unsubscribe
    are skipped in every later campaign and schedule. The "Unsubscribed"
    button in the top bar lists them and lets you add someone back.
  - Optional footer line for your business name and address.
  - Newsletter: keep saved subscriber lists. Share a sign-up link
    (https://YOUR-APP.vercel.app/join/CODE), paste people you already have,
    or add the list on screen. "Send to this list" loads the subscribers so
    you write one message and send or schedule it like any other campaign.
    Anyone who unsubscribes is removed from the newsletter automatically.

  UPGRADING FROM v5: upload all files, run supabase-setup.sql again in
  Supabase (it only adds the new tables and is safe to repeat), redeploy.
  vercel.json now has a /join/ rewrite, so upload that file too.


EARLIER, IN v5
  - Advanced scheduling: daily limit, group size, gap between groups, sending
    hours, sending days and an optional start time. A plain-English summary
    shows what you will get before you start.
  - Every person shows Queued, Sent (with the time) or Failed, live.
  - History: every list you load is kept on your device (IndexedDB, far more
    room than before). Replacing a list never loses it. Open any past list.
  - Download report: a CSV of who was sent, when, and any errors.
  - Pause / Resume a schedule. If Gmail rejects the sign-in it pauses itself
    instead of failing everyone.
  - Overlap protection: two runs at the same moment can never send the same
    email twice.
  - Excel (.xlsx) files can be uploaded as well as CSV.
  - Demo mode is gone.


SETUP (once)
  1. GitHub: upload this folder's contents to the ROOT of your repo
     (api/, lib/, public/, package.json, vercel.json at the top level).
  2. Vercel: import the repo, leave settings as they are, Deploy.
  3. Supabase: SQL Editor > paste supabase-setup.sql > Run. (If you already
     ran it for v4, nothing more is needed.)
  4. Vercel > Settings > Environment Variables (Production):
       SUPABASE_URL                 your project URL
       SUPABASE_SERVICE_ROLE_KEY    the service role key (server only!)
       CRON_SECRET                  a long random secret, letters and numbers
     Then Redeploy.
  5. cron-job.org: one job, every 1 minute, calling
       https://YOUR-APP.vercel.app/api/cron/run?key=YOUR_CRON_SECRET
     Your app decides when each schedule is due. This job just keeps ticking.
  Optional: APP_URL (e.g. https://mail.yourbrand.com) if you use your own
  domain, so tracking and unsubscribe links use it instead of the vercel.app one.
  Without CRON_SECRET the footer, tracking and unsubscribe are switched off.
  Never put keys in the code or in screenshots.


SCHEDULING, IN PLAIN WORDS
  - Daily limit: the most emails sent in one day (Gmail allows about 500).
  - Send N emails every X: small groups instead of one big burst.
  - Only send between: hours in your own time zone.
  - On these days: pick the days of the week.
  - Start: right away, or at a time you choose.
  The form tells you how many emails a day that really allows, and about how
  many days your list will take.
  A failed address (bad email, bounce) is not retried. If Gmail can't be
  reached, that person is tried again on the next check, up to 3 times.
  If the automatic sender hasn't checked in for 10 minutes, a warning appears
  on the schedule bar.


WHERE THINGS LIVE
  - Notification devices (a code that lets the server reach your phone, not
    your contacts) are kept in Supabase until you switch them off.
  - Your sign-in and your lists/history: on your device (browser storage).
    Sign out keeps your history; it removes your sign-in and clears the screen.
  - A running schedule: on the server (Supabase), with your App Password
    encrypted using CRON_SECRET. It is deleted when the schedule finishes or
    is canceled.
  - Private/incognito windows may block History.


USING IT
  - "Plain text" / "Raw HTML" switches how you write the body. Merge fields
    like {{Name}}, {{Company}} or {{first_name|there}} work in both.
  - Preview shows each person's version. "Send test to me" mails you one.
  - Send asks once, then runs; Stop is always available.
  - "Try sample data" mails name+tag@gmail.com style addresses that land in
    your own inbox, so it is a safe real test.
  - For Excel files the first sheet is used; the first row should be headings.
    Old .xls files: use Save As .xlsx or CSV.


APP PASSWORD
  A separate 16-letter password Google creates for one app. Turn on 2-Step
  Verification, open myaccount.google.com/apppasswords, name it, press Create,
  and paste the 16 letters into the app. You can delete it any time.


TRACKING, HONESTLY
  - Clicks are reliable. Opens are approximate: Apple Mail can count an open
    before anyone reads, and Gmail may cache the image or people may block it.
  - Some security scanners click links, which can add a few extra clicks.
  - If you email people you don't know, tell them (a footer line works) and
    check the rules where they live (for example the NDPA in Nigeria, GDPR in
    the EU). Switch opens off if in doubt: clicks alone are less intrusive.
  - Unsubscribing takes two steps on purpose (open the link, press the
    button) so email scanners can't unsubscribe people by accident. Gmail's
    own Unsubscribe button works in one click.

NEWSLETTER SIGN-UP, HONESTLY
  - Sign-up is single step (no confirmation email), because the server does
    not keep your Gmail password. A hidden field and a timing check block most
    bots, but anyone can type someone else's email. Unsubscribe protects them.
  - Only add people who agreed to hear from you. The app asks you to confirm.
  - A schedule can hold up to 3000 people. For bigger newsletters, send in
    parts or use the normal Send.

LIMITS
  - Gmail allows roughly 500 emails a day. Big bursts can get an account
    flagged, so keep groups small.
  - Vercel's free Hobby plan is for personal, non-commercial use.
