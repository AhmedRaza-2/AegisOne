"""
Hand-written modern e-mail set (regression guard, not a benchmark).

Short, plain, link-light messages in the style of today's credential, payroll, shared-file, bank, MFA and CEO-fraud
phishing, with Pakistani and global brands, next to ORDINARY business mail including hard negatives that mention
passwords, accounts, invoices and links legitimately (a real OTP mail, a requested password reset, a real invoice).
Written by us from the patterns above, NOT sampled from any model: it checks that known failure modes stay fixed.
Families are templates with slots, so the count is larger than the number of distinct ideas; do not read an accuracy
figure into it. Output: AIML/eval/handwritten_modern.csv
"""
import csv
import random
from pathlib import Path

random.seed(17)
OUT = Path(__file__).resolve().parent / "handwritten_modern.csv"

BANKS = ["HBL", "UBL", "Meezan Bank", "Bank Alfalah", "MCB", "Allied Bank", "JazzCash", "EasyPaisa", "Standard Chartered"]
SERV = ["Microsoft 365", "Google Workspace", "Outlook", "Dropbox", "DocuSign", "Zoom", "LinkedIn", "Netflix", "PayPal", "DHL", "FedEx", "Daraz", "Careem"]
NAMES = ["Ayesha", "Bilal", "Hina", "Usman", "Zain", "Farah", "Omar", "Sara", "Hamza", "Maryam"]
BADHOST = ["secure-verify-login.info", "account-check.top", "portal-update.xyz", "login-confirm.click", "docs-share.cfd", "verify-now.online", "helpdesk-sso.site"]
GOODHOST = ["https://portal.company.pk/leave", "https://github.com/org/repo/pull/48", "https://meet.google.com/abc-defg-hij", "https://docs.company.pk/handbook", "https://zoom.us/j/84217346512"]


def pick(xs):
    return random.choice(xs)


def bad():
    return f"http://{pick(BADHOST)}/{random.randrange(10**5, 10**6)}"


PHISH = [
    lambda: (f"{pick(SERV)} Support <no-reply@{pick(BADHOST)}>", "Password expires today", f"Hi, your password expires today. To keep your mailbox active, confirm it here: {bad()}"),
    lambda: (f"IT Helpdesk <helpdesk@{pick(BADHOST)}>", "Action required: mailbox storage full", f"Your mailbox is 98% full and incoming mail will bounce. Sign in to increase quota: {bad()}"),
    lambda: (f"{pick(BANKS)} Alerts <alerts@{pick(BADHOST)}>", "Your account has been restricted", f"Dear customer, we noticed unusual sign-in to your {pick(BANKS)} account. Verify your identity within 24 hours or access will be limited: {bad()}"),
    lambda: (f"{pick(BANKS)} <care@{pick(BADHOST)}>", "Re-activate your mobile banking", f"Your mobile banking will be deactivated. Update your CNIC and PIN at {bad()} to continue using the app."),
    lambda: ("FBR Refund <refund@" + pick(BADHOST) + ">", "Tax refund approved", f"Your income tax refund of Rs. {random.randrange(18, 95)},{random.randrange(100, 999)} has been approved. Submit your bank account details to receive it: {bad()}"),
    lambda: ("NADRA e-Sahulat <info@" + pick(BADHOST) + ">", "CNIC verification pending", f"Your CNIC record needs biometric re-verification. Complete it online within 48 hours: {bad()}"),
    lambda: (f"{pick(NAMES)} (via {pick(['OneDrive','SharePoint','Google Drive'])}) <share@{pick(BADHOST)}>", "Salary_Revision_2026.pdf shared with you", f"{pick(NAMES)} shared a file with you. Open it with your work email and password to view: {bad()}"),
    lambda: ("HR Department <hr@" + pick(BADHOST) + ">", "Updated payroll schedule - confirm your details", f"We are moving to a new payroll system. Log in with your employee ID and password to confirm your salary account before Friday: {bad()}"),
    lambda: ("Payroll <payroll@" + pick(BADHOST) + ">", "Direct deposit change request", f"Hi, I changed banks and need my salary sent to a new account. Please update my direct deposit details before this month's payroll."),
    lambda: (f"CEO {pick(NAMES)} <ceo.office@gmail.com>", "Quick favour", "Are you at your desk? I need you to buy gift cards for a client today. Keep this between us, I am in a meeting and cannot talk. I will reimburse you. Reply as soon as you see this."),
    lambda: (f"Director Finance <{pick(NAMES).lower()}.fin@outlook.com>", "Urgent payment", "Please process a wire transfer to the new bank account below today. This is confidential, do not call me, reply only to me once done."),
    lambda: ("Accounts <accounts@" + pick(BADHOST) + ">", "Vendor bank details changed", "Please note our bank details have changed. Use the new banking details attached for all future payments, starting with invoice 4471."),
    lambda: (f"{pick(SERV)} <security@{pick(BADHOST)}>", "New sign-in from Russia", f"We blocked a sign-in to your {pick(SERV)} account from Moscow. If this was not you, secure your account now: {bad()}"),
    lambda: ("Microsoft Security <alert@" + pick(BADHOST) + ">", "MFA approval request", f"Your authenticator needs re-registration. Scan the QR code in the attachment or visit {bad()} and enter the code you receive."),
    lambda: ("DHL Express <track@" + pick(BADHOST) + ">", "Your parcel is on hold", f"Delivery failed due to unpaid customs fee of Rs. 150. Pay now to release your parcel: {bad()}"),
    lambda: ("Daraz Rewards <win@" + pick(BADHOST) + ">", "You have won a voucher", f"Congratulations! You are selected for a Rs. 10,000 Daraz voucher. Claim it in the next 30 minutes: {bad()}"),
    lambda: ("K-Electric <billing@" + pick(BADHOST) + ">", "Electricity bill overdue", f"Your bill is overdue. Pay immediately or your connection will be disconnected tonight: {bad()}"),
    lambda: ("University IT <it@" + pick(BADHOST) + ">", "Student portal login expires", f"Your university email will be deactivated. Revalidate your student account with your roll number and password: {bad()}"),
    lambda: ("DocuSign <dse@" + pick(BADHOST) + ">", "Please review and sign: Contract renewal", f"You have a document waiting. Sign in with your Microsoft account to review and sign: {bad()}"),
    lambda: (f"{pick(NAMES)} <{pick(NAMES).lower()}@gmail.com>", "Invoice overdue", f"Hello, please find the overdue invoice at {bad()}. Kindly confirm payment today to avoid penalties."),
    lambda: ("Recruitment <jobs@" + pick(BADHOST) + ">", "Job offer - Remote assistant", "We reviewed your CV and would like to offer you a remote position paying $450 per week. To begin, send us a copy of your ID and your bank account for onboarding."),
    lambda: ("Support <support@" + pick(BADHOST) + ">", "We could not verify your payment method", f"Your {pick(['Netflix','Spotify','Amazon'])} subscription will be cancelled. Update your card number and billing address here: {bad()}"),
    lambda: ("Security Team <security@" + pick(BADHOST) + ">", "Your account will be closed", f"Final notice: your account will be closed within 24 hours unless you verify your password at {bad()}"),
    lambda: ("Zoom <no-reply@" + pick(BADHOST) + ">", "You missed a meeting recording", f"A recording was shared with you. Log in with your work email to download it: {bad()}"),
]

LEGIT = [
    lambda: (f"{pick(NAMES)} <{pick(NAMES).lower()}@company.pk>", "Meeting notes", f"Hi team, notes from today's meeting are in the shared folder. Action items: finalize the budget draft by Thursday and book the venue. Thanks, {pick(NAMES)}"),
    lambda: (f"{pick(NAMES)} <{pick(NAMES).lower()}@company.pk>", "Lunch tomorrow?", "Are you free for lunch tomorrow around 1? Thinking of the new place near the office."),
    lambda: ("HR <hr@company.pk>", "Eid holidays notice", "Dear all, the office will remain closed from Monday to Wednesday for Eid. Please complete pending tasks before leaving on Friday. Eid Mubarak!"),
    lambda: ("Finance <accounts@company.pk>", "Invoice 4471 for March", f"Hi, please find attached invoice 4471 for March services, due in 30 days to the bank account on our standing agreement. Thank you for your business. {pick(NAMES)}"),
    lambda: ("GitHub <noreply@github.com>", "[org/repo] Pull request #48: Fix login redirect", f"{pick(NAMES)} requested your review on this pull request. View it here: https://github.com/org/repo/pull/48"),
    lambda: ("Google Calendar <calendar-notification@google.com>", "Invitation: Sprint planning", "You have been invited to Sprint planning, Monday 10:00. Join with Google Meet: https://meet.google.com/abc-defg-hij"),
    lambda: ("Zoom <no-reply@zoom.us>", "Your meeting starts in 15 minutes", "Reminder: Weekly sync starts at 3:00 PM. Join: https://zoom.us/j/84217346512"),
    lambda: ("Service <no-reply@accounts.company.pk>", "Your password reset code", "You asked to reset your password. Your one-time code is 482915 and expires in 10 minutes. If you did not request this, you can ignore this email."),
    lambda: ("HBL <alerts@hbl.com>", "Transaction alert", "A debit of PKR 2,500 was made from your account ending 4821 at a merchant. If you did not make this transaction, call the number on the back of your card. Never share your PIN or OTP with anyone."),
    lambda: ("IT Support <it@company.pk>", "Scheduled maintenance this Saturday", "The mail server will be down for maintenance on Saturday from 2 to 4 AM. No action is required from you. Please save your work."),
    lambda: ("Daraz <orders@daraz.pk>", "Your order has been shipped", "Your order #8841723 has shipped and will arrive in 3-5 days. Track it in the Daraz app under My Orders."),
    lambda: ("Newsletter <news@techweekly.com>", "This week in AI", "Top stories this week: new open models released, a roundup of security research, and an interview with a founder. Read online or unsubscribe at the bottom of this email."),
    lambda: (f"{pick(NAMES)} <{pick(NAMES).lower()}@company.pk>", "Leave request", f"I would like to apply for leave from 12 to 14 June for a family event. I have handed over my tasks to {pick(NAMES)}. Please approve in the HR portal: https://portal.company.pk/leave"),
    lambda: ("Training <training@company.pk>", "Mandatory security awareness session", "All staff are invited to the annual security awareness session on Tuesday at 11 AM in the main hall. Attendance is mandatory. No links or passwords are needed."),
    lambda: ("Admissions <admissions@university.edu.pk>", "Fee challan for next semester", "Dear student, the fee challan for the next semester is available in the student portal. Please pay at any HBL branch before the due date to avoid a late fee."),
    lambda: ("Careem <noreply@careem.com>", "Your ride receipt", "Thanks for riding with Careem. Your fare was PKR 640. Receipt attached."),
    lambda: ("Security <security-noreply@google.com>", "Security alert", "A new sign-in to your Google Account on a Windows device. If this was you, you don't need to do anything. If not, you can review the activity at https://myaccount.google.com/notifications"),
    lambda: (f"{pick(NAMES)} <{pick(NAMES).lower()}@vendor.com>", "Quotation for servers", "As discussed, please find our quotation for two rack servers attached. Prices are valid for 14 days. Let me know if you would like a call to go through it."),
    lambda: ("Payroll <payroll@company.pk>", "Salary slips available", "Your salary slip for this month is now available in the HR portal. Log in with your normal company account. No action is needed unless you spot a mistake."),
    lambda: (f"{pick(NAMES)} <{pick(NAMES).lower()}@company.pk>", "Can you review the report?", "Could you look over the Q2 phishing awareness report and send comments by Wednesday? I added the click rates per department on page 3."),
]


def build(n_each=120):
    rows = []
    for fam, label, n in ((PHISH, 1, n_each), (LEGIT, 0, n_each)):
        seen, i = set(), 0
        while len(seen) < n and i < n * 20:
            s, subj, b = pick(fam)()
            if (subj, b) not in seen:
                seen.add((subj, b))
                rows.append((s, subj, b, label))
            i += 1
    random.shuffle(rows)
    return rows


if __name__ == "__main__":
    rows = build()
    with open(OUT, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["sender", "subject", "body", "label"])
        w.writerows(rows)
    print(OUT, len(rows), "rows;", sum(r[3] for r in rows), "phishing")
