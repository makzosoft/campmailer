GMAIL CAMPAIGN MANAGER  v5

Load a list (CSV or Excel), write the message, press Send or Schedule. Each
person gets their own personalised email from your Gmail.


WHAT'S NEW IN v5
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


LIMITS
  - Gmail allows roughly 500 emails a day. Big bursts can get an account
    flagged, so keep groups small.
  - Vercel's free Hobby plan is for personal, non-commercial use.
