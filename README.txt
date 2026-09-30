GMAIL CAMPAIGN MANAGER  v4

Drop or paste a CSV, write the message, press Send. Each person gets their own
personalised email from your Gmail. There are no settings to configure on the
server: you connect your Gmail inside the app.


DEPLOY TO VERCEL (about 5 minutes)
  1. Put this folder in a GitHub repo (private is best).
  2. vercel.com > Add New > Project > import the repo > Deploy.
     Leave every setting as it is.
  3. Open the URL Vercel gives you. The first screen asks for:
       - your Gmail address
       - an App Password (explained below)
       - your name, as recipients should see it
     Press Connect Gmail. You stay signed in on that browser until you press
     Sign out (top right).
  This app is not just for you — anyone can open the same link and sign in
  with their own Gmail. Nobody's details are stored on the server, and nobody
  sees anyone else's sign-in. Each person's session lives only in their own
  browser.

  Command-line alternative: npm install, then "npx vercel".


SCHEDULED SENDING — optional, two settings on Vercel
  Lets a campaign send on its own, even with your browser closed. It runs on
  Vercel's own servers — not your phone, and not Google Apps Script. Two
  one-time settings:

  1. A database for the queue (a few clicks, no typing):
     Vercel dashboard > your project > Storage tab > Marketplace >
     add an Upstash Redis (or "KV") database > Connect to this project.
     Vercel fills in its own environment variables for you.

  2. A secret so only you can trigger a send:
     Project > Settings > Environment Variables > add CRON_SECRET, value
     = any long random string (a password generator works fine). This
     also becomes the key each App Password is encrypted with while its
     schedule is running, so treat it like a real secret. Redeploy once
     after adding it (Deployments > latest > Redeploy) so it takes effect.

  That's it. Whoever is signed in, in the app, can press "Schedule daily
  sending instead" under Send, set two numbers, and start it:
    - Emails per day — the most that will ever go out in one calendar day
      (UTC), no matter how it's triggered.
    - Emails per check-in — how many go out each time the sending route is
      pinged, so a day's total can be spread across several smaller sends
      instead of arriving in one burst.
  A bar at the bottom shows progress and a Cancel button; it stays there for
  anyone who opens the app, regardless of who is signed in, and survives
  closing the browser or signing out.

  Vercel's free plan only runs its OWN once-a-day Cron entry (already set up
  in vercel.json, no edits needed) — so left alone, "per check-in" and "per
  day" become the same number, arriving in one batch around 8am UTC (9am in
  Lagos all year; Nigeria doesn't change clocks for daylight saving).

  TO ACTUALLY SPREAD SENDS ACROSS THE DAY ON THE FREE PLAN
  Add a free outside pinger — a service that just visits a URL on a timer —
  pointed at:
      https://YOUR-APP.vercel.app/api/cron/run?key=YOUR_CRON_SECRET
  (same CRON_SECRET as above; this URL form exists because most free pingers
  can't send custom headers). cron-job.org is one such free service: sign up,
  add that URL, set it to run every 1-2 hours during the hours you want
  sending to happen. Every visit sends one "per check-in" slice; once a day's
  cap is reached, extra visits that day just do nothing, so pinging often is
  always safe — it never sends more than your daily cap.

  Notes:
    - A failed address (bad email, bounced, etc.) is never retried — it's
      logged under "failed" and doesn't count against later check-ins.
    - Your Gmail sign-in for a running schedule is encrypted and held only
      for as long as that campaign is still sending; it's deleted the
      moment the campaign finishes or is canceled.
    - Skip both settings if you don't need this — the app works exactly as
      before, and "Schedule" just won't be offered.


WHAT IS AN APP PASSWORD?
  A separate 16-letter password that Google creates for one app. It lets this
  app send email from your account without ever knowing your real Gmail
  password. You can delete it at any time and the app is cut off immediately.

  To create one:
    1. Turn on 2-Step Verification for your Google account, if it is off.
    2. Open myaccount.google.com/apppasswords
    3. Name it "Campaign Manager" and press Create.
    4. Copy the 16 letters and paste them into the app. Spaces are fine.
  (Some school/work Google accounts do not allow App Passwords.)


WHERE YOUR DETAILS LIVE
  - In the browser you signed in on (local storage), until you press Sign out.
    Sign out also clears your saved list and draft.
  - Each send passes them to your Vercel function, which uses them to talk to
    Gmail. Nothing is saved on the server.
  - Use it only on your own devices. If a device is lost, delete the App
    Password at myaccount.google.com/apppasswords.
  - If Gmail ever rejects the saved details (for example you deleted the App
    Password), the app stops, asks you to sign in again, and keeps your list.


USING IT
  - Above the message box, "Plain text" / "Raw HTML" switches how you write the
    body. Raw HTML is for pasting a full HTML email template (tables, styles,
    images, buttons). It sends as real HTML with a plain-text fallback built in,
    and the Preview panel renders it in an isolated frame so you see it exactly
    as a recipient would. Merge fields like {{Name}} work inside pasted HTML too.
    Script tags and inline event handlers (onclick etc.) are stripped for safety.
  - Paste or drop a CSV and it loads immediately. Comma, semicolon and tab files
    work, a plain list of emails works, and the email and name columns are found
    for you. Invalid and duplicate addresses are skipped automatically.
  - Fields: {{Name}}, {{Company}} or any of your columns, plus {{first_name}}.
    Add a fallback with {{first_name|there}}.
  - Preview shows each person's version; use the arrows to step through.
  - "Send test to me" mails you the previewed version.
  - Send asks once, then runs. Stop is always available. After a stop or
    failures the button becomes "Send to N" / "Retry N failed".
  - "Try sample data" mails name+ada@gmail.com style addresses, which land in
    your own inbox, so it is a safe real test.
  - "Look around in demo mode" on the sign-in screen lets you try everything
    without connecting anything. Nothing is sent.


LIMITS AND NOTES
  - Gmail allows roughly 500 emails a day over SMTP. The page cannot count them
    for you (the server keeps no records). If Gmail refuses, the app stops and
    shows Gmail's message. For large lists, spread them over several days; big
    bursts can get an account flagged.
  - Vercel's free Hobby plan is meant for personal, non-commercial use. If you
    use this for business outreach, check their terms.
