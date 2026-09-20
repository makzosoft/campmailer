GMAIL CAMPAIGN MANAGER  v4

Drop or paste a CSV, write the message, press Send. Each person gets their own
personalised email from your Gmail. There are no settings to configure on the
server: you connect your Gmail inside the app.


DEPLOY TO VERCEL (about 3 minutes)
  1. Put this folder in a GitHub repo (private is best).
  2. vercel.com > Add New > Project > import the repo > Deploy.
     Leave every setting as it is. No environment variables are needed.
  3. Open the URL Vercel gives you. The first screen asks for:
       - your Gmail address
       - an App Password (explained below)
       - your name, as recipients should see it
     Press Connect Gmail. You stay signed in on that browser until you press
     Sign out (top right).

  Command-line alternative: npm install, then "npx vercel".


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
