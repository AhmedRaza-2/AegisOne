"""Regression guard for email scoring on modern phishing wording (NOT an accuracy estimate: the phishing
samples were written after seeing which ones were missed). Needs the API on :8765.
Before the link/component work this caught 9 of 12; the benign set must stay at 0 false positives."""
import sys, io, json, urllib.request, urllib.parse
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

PHISH = [
 ("IT Helpdesk <it@corp-support.com>", "Your password expires in 24 hours", "Hi, your network password will expire in 24 hours. Confirm your password now to avoid losing access: http://corp-support-login.top/verify"),
 ("Microsoft 365 <no-reply@sharepoint-docs-notify.com>", "Q3 Budget.xlsx was shared with you", "A colleague shared a file with you. Open the document: https://sharepoint-docs-notify.com/r/9f2a1 You must sign in with your work email to view it."),
 ("HR Payroll <payroll@hr-portal-update.com>", "Action required: confirm bank details", "We are migrating payroll. Confirm your bank details before Friday or your salary may be delayed. https://hr-portal-update.com/payroll"),
 ("CEO <ceo.office@company-mail.net>", "Quick favour", "I'm in a meeting and can't talk. I need you to buy 5 gift cards of $100 for a client and send me the codes. Reply only to me. Keep this confidential."),
 ("Bank Alerts <alerts@hbl-secure-verify.com>", "Unusual sign-in detected on your account", "We detected an unusual sign-in to your account from a new device. Your account will be suspended in 12 hours unless you verify your identity: http://hbl-secure-verify.com/login"),
 ("DHL <tracking@parcel-update-center.com>", "Your parcel could not be delivered", "We tried to deliver your parcel but nobody was home. Reschedule within 24 hours or it will be returned: https://parcel-update-center.com/reschedule?id=88213"),
 ("Accounts <billing@invoice-accounts-dept.com>", "FINAL NOTICE: invoice #48213 overdue", "Our records show invoice #48213 is 30 days overdue. Services will be suspended today unless payment is made. View invoice: http://invoice-accounts-dept.com/pay"),
 ("Netflix <billing@netflix-account-help.com>", "Payment declined - update your card", "Your last payment was declined and your membership will be cancelled. Update your payment method: https://netflix-account-help.com/update"),
 ("Security <security@apple-id-locked.com>", "Your Apple ID has been locked", "Your Apple ID has been locked for security reasons. Verify your identity to unlock it: https://apple-id-locked.com/unlock Failure to respond within 48 hours will result in permanent closure."),
 ("Admin <admin@mailbox-quota-alert.com>", "Mailbox storage full", "Your mailbox is 99% full. You will stop receiving emails. Click here to increase your quota: http://mailbox-quota-alert.com/upgrade"),
 ("Tax Dept <refund@fbr-gov-refund.com>", "You are eligible for a tax refund", "After the last annual calculation we determined that you are eligible to receive a tax refund of PKR 48,200. Submit the refund request: https://fbr-gov-refund.com/claim"),
 ("Zoom <no-reply@zoom-meeting-invite.com>", "Missed meeting: view recording", "You missed a meeting. The recording is available for 24 hours. Sign in to view: https://zoom-meeting-invite.com/rec/3319"),
]
BENIGN = [
 ("Sara Khan <sara@company.com>", "Meeting notes from Tuesday", "Hi team, attaching the notes from Tuesday's planning meeting. Action items are listed at the bottom. Let me know if I missed anything."),
 ("GitHub <noreply@github.com>", "[repo] Pull request #42 merged", "Your pull request 'Fix login redirect' was merged into main. View it here: https://github.com/acme/app/pull/42"),
 ("Ali <ali@company.com>", "Lunch tomorrow?", "Are we still on for lunch at 1pm tomorrow? I was thinking the new place near the office."),
 ("HR <hr@company.com>", "Updated leave policy", "Please find the updated leave policy on the intranet. No action is needed unless you have questions. Thanks, HR"),
 ("Amazon <shipment-tracking@amazon.com>", "Your package has shipped", "Your order #112-4455 has shipped and will arrive Thursday. Track it: https://www.amazon.com/progress-tracker"),
 ("Finance <finance@company.com>", "October invoice approvals", "Hi, please approve the October vendor invoices in the finance system by Friday. The list is under Approvals > Pending."),
 ("LinkedIn <messages-noreply@linkedin.com>", "You appeared in 12 searches this week", "See who is looking at your profile: https://www.linkedin.com/comm/profile-views"),
 ("Dev Team <dev@company.com>", "Deployment tonight at 10pm", "We are deploying release 2.4 tonight at 10pm. Expect a short downtime of about 5 minutes. Reply if you have concerns."),
 ("Newsletter <news@python.org>", "Python Weekly", "This week: new release candidates, PEP updates and conference news. Read more: https://www.python.org/blogs/"),
 ("Bank <statements@hbl.com>", "Your monthly statement is ready", "Your statement for October is ready. Log in to Internet Banking by typing hbl.com in your browser to view it. We never ask for your password by email."),
 ("IT <it@company.com>", "Scheduled maintenance this weekend", "The VPN will be unavailable on Saturday from 2am to 4am for maintenance. No action is required."),
 ("Zoom <no-reply@zoom.us>", "Your meeting starts in 15 minutes", "Reminder: Weekly sync starts in 15 minutes. Join: https://zoom.us/j/123456789"),
]

def score(s, sub, b):
    data = urllib.parse.urlencode({"sender": s, "subject": sub, "body": b}).encode()
    r = json.loads(urllib.request.urlopen(urllib.request.Request("http://localhost:8765/analyze/email", data=data), timeout=120).read())
    return round(r["phishing_probability"] * 100), r.get("components", {})

hits = 0
print("--- phishing")
for s, sub, b in PHISH:
    sc, c = score(s, sub, b); hits += sc >= 50
    print(f"{sc:3d}  text={c.get('text',{}).get('score')} links={c.get('links',{}).get('max_score')}  {sub[:50]}")
fps = 0
print("--- benign")
for s, sub, b in BENIGN:
    sc, c = score(s, sub, b); fps += sc >= 50
    print(f"{sc:3d}  text={c.get('text',{}).get('score')} links={c.get('links',{}).get('max_score')}  {sub[:50]}")
print(f"recall {hits}/{len(PHISH)}  false positives {fps}/{len(BENIGN)}")

assert fps == 0, "false positives on ordinary business mail"
assert hits >= 11, "recall regression on modern phishing wording"
print("EMAIL REGRESSION OK")
