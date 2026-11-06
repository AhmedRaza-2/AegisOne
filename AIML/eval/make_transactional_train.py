"""
TRAINING-ONLY transactional SMS (legitimate notifications + the scams that imitate them).

Why: public SMS corpora have almost no legitimate transactional messages (their "ham" is personal chat) while their
spam is full of numbers, amounts and phone numbers - so a model learns "has a code / amount / phone number = scam"
and flags every real OTP, bank alert and courier update (measured: 24% false alarms on Pakistani notifications).
These templates follow the real formats of OTP, bank, wallet, courier, telco, utility and appointment messages,
with wording DIFFERENT from the evaluation guard (AIML/eval/make_handwritten_sms.py), and pair them with scams that
ask the reader to SEND the code, PIN or money - which is the difference the model must learn.
Output: AIML/eval/transactional_train.csv
"""
import csv
import random
from pathlib import Path

random.seed(57)
OUT = Path(__file__).resolve().parent / "transactional_train.csv"
SERV = ["Daraz", "Careem", "Bykea", "Foodpanda", "Uber", "inDrive", "Netflix", "Instagram", "Facebook", "Telegram", "Gmail", "Microsoft", "LinkedIn", "Zoom"]
BANK = ["HBL", "UBL", "MCB", "Meezan Bank", "Bank Alfalah", "Allied Bank", "Askari Bank", "Bank Al Habib", "Faysal Bank", "JS Bank"]
WALLET = ["JazzCash", "EasyPaisa", "SadaPay", "NayaPay", "Upaisa"]
COURIER = ["TCS", "Leopards", "M&P", "Trax", "PostEx", "Call Courier", "BlueEx"]
NAMES = ["Ahmed", "Fatima", "Saad", "Nida", "Kamran", "Mehwish", "Asad", "Rabia", "Hamid", "Sadia"]


def p(xs):
    return random.choice(xs)


def code(n=6):
    return "".join(str(random.randrange(10)) for _ in range(n))


def amt():
    return f"{random.randrange(1, 99)},{random.randrange(100, 999)}"


def phone():
    return f"03{random.randrange(0, 49):02d}{random.randrange(1000000, 9999999)}"


LEGIT = [
    lambda: f"Your {p(SERV)} login code is {code()}. Don't share it with anyone.",
    lambda: f"<#> {code()} is your {p(SERV)} OTP. Valid for 10 minutes.",
    lambda: f"Use {code(4)} to verify your phone number on {p(SERV)}.",
    lambda: f"{p(SERV)}: {code()} is your security code. If you didn't request it, ignore this message.",
    lambda: f"OTP for your {p(BANK)} transaction of Rs. {amt()} is {code()}. Never share your OTP.",
    lambda: f"Dear Customer, your {p(BANK)} account xx{random.randrange(1000, 9999)} has been credited with PKR {amt()} on {random.randrange(1, 28)}-Nov. Avl Bal PKR {amt()}.",
    lambda: f"PKR {amt()} debited from your {p(BANK)} card ending {random.randrange(1000, 9999)} at {p(['Imtiaz', 'Carrefour', 'Al-Fatah', 'Daraz', 'Shell'])}. Call helpline if not you.",
    lambda: f"{p(WALLET)}: Rs. {amt()} transferred to {p(NAMES)} successfully. TID {code(10)}.",
    lambda: f"{p(WALLET)}: You have received Rs. {amt()} from {p(NAMES)} ({phone()[:4]}****{phone()[-3:]}). New balance Rs. {amt()}.",
    lambda: f"{p(COURIER)}: Parcel {code(10)} delivered to {p(NAMES)} at {random.randrange(9, 12)}:{random.randrange(10, 59)} AM. Thank you.",
    lambda: f"{p(COURIER)} update: your order {code(8)} will be delivered today. Rider {p(NAMES)} {phone()}.",
    lambda: f"{p(COURIER)}: we tried to deliver parcel {code(10)} but you were unavailable. We will try again tomorrow.",
    lambda: f"Your {p(['Jazz', 'Zong', 'Ufone', 'Telenor'])} bill of Rs. {random.randrange(300, 3000)} is due on {random.randrange(10, 28)}th. Pay through the app or any retailer.",
    lambda: f"{p(['LESCO', 'IESCO', 'K-Electric', 'FESCO'])}: your electricity bill for reference {code(14)} is Rs. {amt()}. Due date {random.randrange(10, 28)}-Nov.",
    lambda: f"Appointment confirmed with Dr. {p(NAMES)} on {p(['Monday', 'Wednesday', 'Saturday'])} at {random.randrange(4, 9)} PM. Reply C to cancel.",
    lambda: f"Your {p(['Sui Northern', 'SSGC'])} complaint {code(7)} has been registered. Our team will visit within 48 hours.",
    lambda: f"NADRA: your token number {random.randrange(100, 999)} is called at counter {random.randrange(1, 12)}.",
    lambda: f"Your {p(SERV)} order {code(9)} has been placed. Estimated delivery {random.randrange(2, 6)} days.",
    lambda: f"Aap ka OTP {code()} hai. Yeh code kisi ko na batayein.",
    lambda: f"{p(WALLET)} mein Rs. {amt()} aap ke account mein aa gaye hain. Shukriya.",
    lambda: f"آپ کا تصدیقی کوڈ {code()} ہے۔ یہ کوڈ کسی کے ساتھ شیئر نہ کریں۔",
    lambda: f"آپ کا پارسل {code(10)} آج پہنچا دیا جائے گا۔",
    lambda: f"آپ کے اکاؤنٹ میں {amt()} روپے جمع ہو گئے ہیں۔",
]

SCAM = [
    lambda: f"Hi, I sent you a {p(SERV)} code by mistake. Can you forward me the {code(6)[:0]}6-digit code you just got? Urgent please.",
    lambda: f"{p(BANK)} officer here. To stop the suspicious transaction of Rs. {amt()}, read me the OTP you received now.",
    lambda: f"Your {p(WALLET)} account is on hold. Reply with your MPIN and the code we just sent to reactivate.",
    lambda: f"{p(COURIER)}: parcel {code(10)} held for unpaid charges Rs. {random.randrange(150, 600)}. Pay at http://{p(['tcs', 'leopards', 'trax'])}-redeliver.{p(['top', 'site', 'icu'])}/{code(5)}",
    lambda: f"Congratulations! Rs. {amt()} credited to your {p(WALLET)} as cashback. To withdraw, share the 4-digit code sent to you.",
    lambda: f"Bhai mera {p(SERV)} account lock ho gaya, aap ke number par code aaya hai, please mujhe bhej do.",
    lambda: f"Aap ke {p(BANK)} card se Rs. {amt()} ki transaction ho rahi hai. Rokne ke liye OTP is number par bhejein {phone()}.",
    lambda: f"آپ کو {amt()} روپے کا انعام ملا ہے۔ وصول کرنے کے لیے آنے والا کوڈ ہمیں بھیجیں۔",
    lambda: f"Final notice: your {p(['electricity', 'gas', 'internet'])} will be cut tonight. Pay Rs. {random.randrange(500, 4000)} now via {p(WALLET)} to {phone()}.",
    lambda: f"{p(SERV)} Security: your account will be deleted in 24h. Verify by replying with the code sent to this number.",
]


def build(n_legit=360, n_scam=170):
    rows = []
    for fam, label, n in ((LEGIT, 0, n_legit), (SCAM, 1, n_scam)):
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
