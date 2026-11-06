"""
Hand-written Pakistani SMS / WhatsApp set (regression guard, not a benchmark).

The scams people in Pakistan actually receive - BISP / Ehsaas / Jeeto Pakistan prize lures, JazzCash and EasyPaisa
"account blocked" messages, OTP / WhatsApp-code theft, fake courier and PTA notices, "wrong transfer, please send it
back" - in English, Roman Urdu and Urdu script, next to ordinary messages that look similar on the surface: real
bank OTPs that warn you never to share them, delivery updates, family and office chat.
Written by us from those patterns; families are templates with slots. Output: AIML/eval/handwritten_sms.csv
"""
import csv
import random
from pathlib import Path

random.seed(23)
OUT = Path(__file__).resolve().parent / "handwritten_sms.csv"
WALLET = ["JazzCash", "EasyPaisa", "HBL Konnect", "UBL Omni", "Meezan Bank"]
BAD = ["bisp-gov.online", "ehsaas-check.site", "jazz-reward.top", "pta-verify.info", "tcs-track.click", "bit.ly/3xR9qL", "tinyurl.com/pk-inaam"]
NAMES = ["Ali", "Sana", "Bilal", "Ayesha", "Usman", "Hina", "Ammi", "Abbu", "Zain", "Fatima"]


def pick(xs):
    return random.choice(xs)


def amt():
    return pick(["10,000", "25,000", "50,000", "12,500", "1,00,000", "35,000"])


def link():
    return "http://" + pick(BAD)


SCAM = [
    lambda: f"Mubarak ho! Aap ka number BISP program mein Rs. {amt()} ke liye select hua hai. Raqam hasil karne ke liye apna CNIC aur PIN is link par darj karein: {link()}",
    lambda: f"Ehsaas Program: Your payment of Rs. {amt()} is pending. Verify your CNIC within 24 hours at {link()} or the amount will be cancelled.",
    lambda: f"Jeeto Pakistan ki taraf se aap ne {pick(['car', 'motorcycle', 'Rs. 5 lakh', 'gold set'])} jeeta hai! Inaam lene ke liye {pick(['0301', '0345', '0333'])}-{random.randrange(1000000, 9999999)} par call karein aur registration fee Rs. 2000 bhejein.",
    lambda: f"Dear customer, your {pick(WALLET)} account has been blocked due to incomplete biometric. Update now: {link()}",
    lambda: f"Aap ka {pick(WALLET)} account band ho jaye ga. Account bachane ke liye abhi apna MPIN aur OTP is number par reply karein.",
    lambda: f"Aap ke mobile par 6 digit code aaya hai, ghalti se mera number daal diya tha. Please woh code mujhe bhej dein, bohat zaroori hai.",
    lambda: "Hi, this is WhatsApp support. Someone tried to log in to your account. Send us the 6-digit code you just received to keep your account safe.",
    lambda: f"Assalam o Alaikum, maine ghalti se aap ke {pick(WALLET)} account mein Rs. {amt()} bhej diye hain. Meharbani kar ke wapas bhej dein, main bohat pareshan hoon.",
    lambda: f"PTA Notice: Your mobile number will be blocked today because your SIM is not re-verified. Re-verify here: {link()}",
    lambda: f"TCS: Your parcel could not be delivered due to an incomplete address. Pay Rs. 150 redelivery fee: {link()}",
    lambda: f"Leopards Courier: aap ka parcel custom par rok liya gaya hai. Release karwane ke liye Rs. 500 fee {link()} par ada karein.",
    lambda: f"FBR: You are eligible for a tax refund of Rs. {amt()}. Submit your bank account details at {link()} to receive it.",
    lambda: f"Congratulations! You have won an iPhone in the Daraz 11.11 lucky draw. Claim before midnight: {link()}",
    lambda: f"Mama, mera phone kharab ho gaya hai, ye mera naya number hai. Mujhe foran Rs. {amt()} {pick(WALLET)} kar dein, baad mein batata hoon.",
    lambda: f"Your HBL debit card is suspended. Call our helpline 0{random.randrange(300, 349)}-{random.randrange(1000000, 9999999)} and confirm your card number and PIN to unblock.",
    lambda: f"آپ کا نمبر بی آئی ایس پی پروگرام میں {amt()} روپے کے لیے منتخب ہوا ہے۔ رقم وصول کرنے کے لیے اپنا شناختی کارڈ نمبر اس لنک پر درج کریں {link()}",
    lambda: "آپ کے موبائل پر آنے والا کوڈ غلطی سے آپ کو بھیجا گیا ہے، براہ مہربانی وہ کوڈ مجھے واپس بھیج دیں۔",
    lambda: f"آپ کا {pick(['جاز کیش', 'ایزی پیسہ'])} اکاؤنٹ بند کر دیا گیا ہے۔ دوبارہ چالو کرنے کے لیے اپنا پن کوڈ بھیجیں۔",
    lambda: f"Part-time job offer: earn Rs. {amt()} daily by liking YouTube videos. Contact on WhatsApp now, limited seats: {link()}",
    lambda: f"Your Netflix subscription has expired. Update your card details to continue watching: {link()}",
    lambda: f"Bank Alfalah: unusual login detected on your account. If this was not you, verify immediately at {link()}",
    lambda: f"Aap ka electricity bill Rs. {random.randrange(4, 30)},{random.randrange(100, 999)} overdue hai. Aaj raat connection kaat diya jaye ga, foran is link se payment karein {link()}",
]

HAM = [
    lambda: f"Your {pick(WALLET)} OTP is {random.randrange(100000, 999999)}. Do not share this code with anyone. {pick(WALLET)} will never ask for it.",
    lambda: f"{random.randrange(100000, 999999)} is your verification code for {pick(['Careem', 'Foodpanda', 'Daraz', 'WhatsApp', 'Google'])}. It expires in 5 minutes.",
    lambda: f"Rs. {amt()} received in your {pick(WALLET)} account from {pick(NAMES)}. Available balance Rs. {random.randrange(1, 90)},{random.randrange(100, 999)}.",
    lambda: f"TCS: Your shipment {random.randrange(10**9, 10**10)} is out for delivery today. Rider: {pick(NAMES)}, 03{random.randrange(0, 49):02d}-{random.randrange(1000000, 9999999)}.",
    lambda: f"Daraz: Your order #{random.randrange(10**8, 10**9)} has been delivered. Thank you for shopping with us.",
    lambda: f"{pick(NAMES)} beta, khana garam hai, jaldi ghar aa jao.",
    lambda: f"Kal meeting {pick(['10', '11', '3', '4'])} baje hai, report saath le aana please.",
    lambda: f"Assalam o Alaikum, Eid Mubarak! Allah aap ko aur ghar walon ko khush rakhe.",
    lambda: f"Bhai main {pick(['15', '20', '30'])} minute mein pohanch raha hoon, gate par milte hain.",
    lambda: "K-Electric: Scheduled maintenance in your area tomorrow from 9 AM to 1 PM. We regret the inconvenience.",
    lambda: f"Your Careem ride is arriving in {random.randrange(2, 9)} minutes. Car: {pick(['Suzuki Alto', 'Honda City', 'Toyota Corolla'])}.",
    lambda: f"University notice: classes will resume on Monday. Check the portal for the updated timetable.",
    lambda: f"HBL: A transaction of Rs. {random.randrange(1, 20)},{random.randrange(100, 999)} was made on your card ending {random.randrange(1000, 9999)}. If not you, call the number on the back of your card.",
    lambda: "Office ka WiFi password change ho gaya hai, IT se naya password le lena.",
    lambda: f"آپ کا پارسل کل تک پہنچ جائے گا۔ شکریہ",
    lambda: "امی، میں دفتر سے نکل گیا ہوں، آدھے گھنٹے میں گھر پہنچوں گا۔",
    lambda: f"Doctor ki appointment {pick(['Monday', 'Tuesday', 'Friday'])} ko {pick(['5', '6', '7'])} baje confirm ho gayi hai.",
    lambda: f"Jazz: You have consumed 80% of your monthly data bundle. Dial *117# to check your remaining balance.",
]


def build(n_scam=110, n_ham=90):
    rows = []
    for fam, label, n in ((SCAM, 1, n_scam), (HAM, 0, n_ham)):
        seen, i = set(), 0
        while len(seen) < n and i < n * 30:
            t = pick(fam)()
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
