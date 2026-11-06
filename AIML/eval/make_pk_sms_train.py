"""
Pakistani SMS / WhatsApp SEED TRAINING messages (English, Roman Urdu, Urdu script).

There is no public labelled Roman-Urdu smishing corpus, so the text detector gets a small seed set written by us.
To keep the evaluation honest these use DIFFERENT scenarios and wording from AIML/eval/make_handwritten_sms.py
(the evaluation guard): different brands, different scam stories, different phrasing. The model still never sees
an evaluation message. Replace / extend with real, verified reports as soon as organisations provide them (the
retraining loop does exactly that). Output: AIML/eval/pk_sms_train.csv
"""
import csv
import random
from pathlib import Path

random.seed(41)
OUT = Path(__file__).resolve().parent / "pk_sms_train.csv"
BANK = ["MCB", "Allied Bank", "Askari Bank", "Faysal Bank", "Bank Al Habib", "Sadapay", "Nayapay", "UBL"]
HOSTS = ["mcb-alert.live", "sim-verify.cfd", "8171-registration.site", "loan-pk.icu", "kyc-update.buzz", "cutt.ly/pk-gift"]


def p(xs):
    return random.choice(xs)


def money():
    return p(["7,500", "15,000", "20,000", "40,000", "2 lakh", "60,000"])


def url():
    return "https://" + p(HOSTS)


SCAM = [
    lambda: f"{p(BANK)} security: aap ka card temporary block hai. Unblock ke liye card ke peeche wala 3 digit code aur expiry reply karein.",
    lambda: f"Dear user, {p(BANK)} KYC pending. Complete within 12 hours or account will freeze: {url()}",
    lambda: f"8171 Ehsaas registration ab online! Rs. {money()} ki qist ke liye form bharein {url()} (registration fee Rs. 300)",
    lambda: f"Aap ki SIM par tax pending hai. PTA ki taraf se aaj SIM band kar di jaye gi. Tax ada karne ke liye {url()}",
    lambda: f"Instant loan Rs. {money()} bina guarantee ke! Sirf CNIC ki photo aur processing fee Rs. 999 bhejein.",
    lambda: "Ghar baithe online job, roz 3000 kamayein. Sirf WhatsApp par 'JOIN' likhein aur security deposit bhejein.",
    lambda: f"Bhai, main {p(['Captain', 'Major'])} bol raha hoon, transfer ho gaya hai isliye apni gaari sasti bech raha hoon. Advance bhej dein, gaari ghar pohanch jaye gi.",
    lambda: f"Aap ke naam par Rs. {money()} ka parcel aaya hai lekin custom duty baqi hai. Abhi {p(['JazzCash', 'EasyPaisa'])} karein warna parcel wapas.",
    lambda: "Your WhatsApp will be deactivated in 24 hours due to policy violation. Verify by sending the code we just texted you.",
    lambda: f"Congratulations, your number won Rs. {money()} in the Zong anniversary draw. Send your CNIC and account number to claim.",
    lambda: f"Assalam o Alaikum, aap ka beta police station mein hai. Case khatam karwane ke liye foran Rs. {money()} bhejein, kisi ko na batayein.",
    lambda: f"Investment offer: double your money in 15 days with crypto trading. Minimum Rs. {money()}. Limited seats {url()}",
    lambda: f"Sui Gas: aap ka meter replacement due hai, Rs. 1,500 fee {url()} par jama karwayein warna connection kat jaye ga.",
    lambda: "Hello dear, I am sending you a gift from abroad. Courier will call you, please pay the clearance charges.",
    lambda: f"آپ کے {p(['بینک', 'موبائل والٹ'])} اکاؤنٹ کی تصدیق باقی ہے۔ تصدیق کے لیے اپنا او ٹی پی اس نمبر پر بھیجیں۔",
    lambda: f"مبارک ہو! آپ نے {money()} روپے کا انعام جیتا ہے۔ انعام کے لیے پہلے رجسٹریشن فیس جمع کروائیں۔",
    lambda: f"آپ کی سم بند ہونے والی ہے، دوبارہ تصدیق کے لیے اس لنک پر کلک کریں {url()}",
    lambda: "Amazon refund team: you were charged twice. To get your refund, share the OTP that you receive now.",
    lambda: f"Final reminder: your {p(['Netflix', 'Daraz', 'Foodpanda'])} account is on hold. Re-enter your card at {url()}",
    lambda: f"Rishta online: verified proposals from abroad. Registration Rs. 5,000 send karein aur profile active karwayein.",
]

HAM = [
    lambda: f"{p(BANK)}: Rs. {money()} debited from your account for bill payment. Ref {random.randrange(10**7, 10**8)}. Helpline on the back of your card.",
    lambda: f"Your one-time password for {p(BANK)} internet banking is {random.randrange(100000, 999999)}. Bank staff will never ask for it.",
    lambda: f"Sui Gas bill for {p(['October', 'November', 'December'])} is Rs. {random.randrange(1, 9)},{random.randrange(100, 999)}. Due date 25th. Pay via your bank app.",
    lambda: f"PTCL: your broadband bill has been paid successfully. Thank you.",
    lambda: f"Aaj office nahi aa sakunga, tabiyat theek nahi. Kal report bhej dunga.",
    lambda: f"Beta, doodh aur anday le aana wapsi par.",
    lambda: f"Kal {p(['nikah', 'mehndi', 'walima'])} hai, 7 baje tak hall pohanch jana.",
    lambda: f"Teacher: kal quiz hai chapter {random.randrange(2, 9)} ka, sab tayyari kar ke aana.",
    lambda: f"Foodpanda: your order is on the way! Estimated delivery {random.randrange(15, 40)} minutes.",
    lambda: f"Uber: your driver {p(['Imran', 'Saad', 'Kamran'])} is arriving in a white Suzuki Cultus.",
    lambda: f"Pharmacy: your medicines are ready for pickup. Timing 10 AM to 10 PM.",
    lambda: f"Reminder: team standup at {p(['9:30', '10:00', '11:15'])} tomorrow in the conference room.",
    lambda: f"Zong: Rs. 100 balance recharged successfully. Your new balance is Rs. {random.randrange(101, 450)}.",
    lambda: "Gym ki membership agle hafte khatam ho rahi hai, renew karwa lena reception par.",
    lambda: "کل شام کو چائے پر آ جائیں، سب گھر والے آئیں گے۔",
    lambda: "آپ کی کلاس کا وقت تبدیل ہو گیا ہے، اب صبح نو بجے ہو گی۔",
    lambda: "میں راستے میں ہوں، دس منٹ میں پہنچ جاؤں گا۔",
    lambda: f"Daraz: Rs. {random.randrange(200, 900)} voucher has been added to your account for your last review. Use it in the app at checkout.",
    lambda: f"NADRA: your CNIC renewal application {random.randrange(10**6, 10**7)} is ready for collection at your registration centre.",
    lambda: f"JazzCash: you received Rs. {money()} from {p(['Hassan', 'Mariam', 'Nida'])}. Check your balance in the app.",
]


def build(n=90):
    rows = []
    for fam, label in ((SCAM, 1), (HAM, 0)):
        seen, i = set(), 0
        while len(seen) < n and i < n * 40:
            t = p(fam)()
            if t not in seen:
                seen.add(t)
                rows.append((t, label))
            i += 1
    random.shuffle(rows)
    return rows


if __name__ == "__main__":
    rows = build()
    with open(OUT, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["text", "label"])
        w.writerows(rows)
    print(OUT, len(rows), "rows;", sum(r[1] for r in rows), "scam")
