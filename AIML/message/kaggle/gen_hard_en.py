"""
English-only hard training messages for the AegisOne text model, round 3. Runs on Kaggle (T4 x2).

Round 2 (gen_hard_messages.py) cut false alarms on look-alike genuine messages from 65% to 19%, but four families were
still weak on the independent benchmark: bank transaction alerts (48% of genuine ones flagged), "never share this code"
notices (31%), promotions (25%) and scams that say the account was hacked (missed). This round writes MANY more of exactly
those, in English only, as genuine/scam PAIRS, with deliberately varied senders, regions, formats and tone so the model
cannot key on one template (near-duplicates are removed after masking digits and links).

Method (see docs/MODEL_RESEARCH_AND_PLAN.md): a small fine-tuned encoder keeps false alarms on genuine traffic far lower than a
zero-shot LLM and runs on a CPU; an LLM is used as the TEACHER that writes diverse hard examples (teacher-student data
generation, e.g. arXiv 2602.10869; synthetic scam corpora such as COVA, arXiv 2604.11752).

Output: /kaggle/working/hard_en.jsonl  {"text","label","lang":"en","channel","category","kind"}
"""
import itertools
import json
import os
import random
import re
import time

import torch
from transformers import AutoModelForCausalLM, AutoTokenizer

MODEL = "Qwen/Qwen2.5-7B-Instruct"
OUT = "/kaggle/working/hard_en.jsonl"
BATCH = int(os.environ.get("BATCH", "24"))
MAX_NEW = 430
N_MSG = 8
random.seed(11)

REGIONS = ["United States", "United Kingdom", "India", "Pakistan", "United Arab Emirates", "Nigeria", "Australia", "Canada", "Singapore", "South Africa"]
BANKS = ["Chase", "Bank of America", "Wells Fargo", "Citi", "Barclays", "HSBC", "Lloyds", "NatWest", "SBI", "HDFC Bank", "ICICI Bank", "Axis Bank",
         "HBL", "UBL", "Meezan Bank", "Bank Alfalah", "MCB", "Emirates NBD", "ADCB", "First Bank", "GTBank", "Commonwealth Bank", "ANZ", "RBC", "TD Bank",
         "Standard Chartered", "DBS", "Capital One", "Discover", "American Express", "Monzo", "Revolut", "PayPal", "Venmo", "Cash App", "Wise"]
BRANDS = ["Amazon", "Walmart", "Target", "Best Buy", "IKEA", "Nike", "Zara", "H&M", "Starbucks", "McDonald's", "Domino's", "KFC", "Uber Eats", "DoorDash",
          "Netflix", "Spotify", "Disney+", "Apple", "Google", "Microsoft", "Samsung", "Verizon", "AT&T", "T-Mobile", "Vodafone", "Jio", "Airtel", "Jazz",
          "Etisalat", "Emirates", "Qatar Airways", "Delta", "Booking.com", "Airbnb", "Daraz", "Flipkart", "Myntra", "Tesco", "Aldi", "Costco", "Sephora", "Adidas"]
SERVICES = ["Google", "Microsoft", "Apple ID", "Facebook", "Instagram", "WhatsApp", "Telegram", "Amazon", "Uber", "Lyft", "PayPal", "Coinbase", "Binance",
            "LinkedIn", "X", "Snapchat", "Steam", "Epic Games", "Dropbox", "Zoom", "Slack", "GitHub", "Airbnb", "Booking.com", "Revolut", "Wise", "Stripe", "Shopify"]
STYLES = ["very short and terse like a real bank SMS (abbreviations allowed)", "short and polite", "friendly and conversational", "formal and complete",
          "terse with an official-looking footer", "medium length with a helpline line"]

# category -> (genuine description, scam description, channel, weight)
CATS = {
    "bank_txn_alert": (
        "a GENUINE bank or card transaction notification (debit, credit, ATM withdrawal, POS purchase, online payment, fund transfer, standing order, salary credit, low balance or international transaction) with realistic details: masked account or card ending digits, amount, merchant or payee, available balance, date and time, a reference number, and often a line such as 'if you did not authorise this, call the number on the back of your card'. Genuine alerts may mention a phone number or an official website",
        "a SCAM that imitates a bank transaction alert: an unauthorised or unusually large debit, a blocked card, an account on hold or a failed payment, written to frighten the reader into calling a number, clicking a link or giving card or login details", "sms", 5),
    "otp_never_share": (
        "a GENUINE one-time passcode (OTP) or verification code message from a bank, payment app, delivery service or website: it contains the code, says what it is for (login, payment, delivery, password reset), the expiry time, and a warning such as 'do not share this code with anyone' or 'we will never ask for it'",
        "a SCAM about a verification code: it claims a code was sent by mistake and asks the reader to read it out, reply with it or forward it; or says the code is needed to cancel a charge, receive a refund, release a parcel or prove identity; or pairs a fake code message with a link", "sms", 5),
    "marketing_promo": (
        "a GENUINE marketing or promotional message from a real retailer, bank, telecom, airline, restaurant or app: a sale, discount code, cashback, loyalty points, new product, limited-time offer or app promotion, with the brand name, an end date and an opt-out line such as 'Reply STOP to unsubscribe'. It is advertising, not a threat, and may include a normal link",
        "a SCAM prize or reward message: you have won a prize, gift card, voucher, cash or a free phone, and must click a link, pay a small fee, or give card details to claim it; or a fake brand promotion with a suspicious shortened link", "sms", 5),
    "account_security": (
        "a GENUINE security notification from a real bank or online service about a new sign-in, a password or email change, a new device or a suspicious attempt that was blocked; it says to ignore the message if it was the user and to use the official app or website (not a link in the message) if it was not",
        "a SCAM warning that the reader's account has been hacked, compromised, suspended or accessed from another country, demanding immediate action: click a link, call a number, share a code, install an app, or move money to a 'safe account'", "sms", 5),
    "receipt": ("a GENUINE payment receipt or order confirmation with order number, items and amount", "a SCAM receipt or invoice for a purchase the reader never made, urging a click or a call to cancel it", "email", 2),
    "subscription": ("a GENUINE subscription renewal or billing notice with plan, price and date", "a SCAM saying the payment failed and the account will be closed unless payment details are updated", "email", 2),
    "courier": ("a GENUINE courier or delivery notification with tracking number, time window and sometimes a delivery code", "a SCAM delivery notice asking for a small fee, address confirmation or a reschedule through a link", "sms", 2),
    "utility_bill": ("a GENUINE utility, internet or phone bill reminder with due date, amount and account number", "a SCAM bill reminder threatening disconnection unless the reader pays through a link or a personal account", "sms", 2),
    "government": ("a GENUINE notice from a government body (tax, ID, passport, traffic fine, court date, benefits) with a reference and the official website", "a SCAM notice pretending to be a government body demanding a fine, a refund claim or personal data through a link", "sms", 2),
    "family_money": ("a GENUINE message from a relative or friend asking for money for an ordinary reason (rent, fees, hospital, car repair), written naturally and sometimes urgent", "a SCAM message from someone claiming to be a relative or boss with a new number who urgently needs money or gift cards", "sms", 2),
    "workplace": ("a GENUINE message from an employer, HR or IT (payslip ready, password expiry, shared document, meeting link)", "a SCAM imitating HR or IT that asks the employee to log in through a link to see a payslip or avoid account lock", "email", 2),
    "telecom": ("a GENUINE mobile operator message (balance, data pack expiry, recharge confirmation, plan change)", "a SCAM from a fake operator promising a reward or threatening to block the SIM", "sms", 2),
}
PROMPTS_PER_UNIT = 40   # x weight / 2 per (category, kind): about 1,400 prompts of 8 messages


def build():
    items = []
    for cat, (g, s, chan, w) in CATS.items():
        for kind in ("genuine", "scam"):
            for _ in range(PROMPTS_PER_UNIT * w // 2):
                region = random.choice(REGIONS)
                ents = random.sample(BANKS if cat in ("bank_txn_alert", "otp_never_share", "account_security") else BRANDS + SERVICES, 4)
                style = random.choice(STYLES)
                if chan == "sms":
                    form = f"{N_MSG} different SMS messages"
                else:
                    form = f"{N_MSG} different e-mails, each starting with a line 'Subject: ...' followed by a short body of 2 to 5 sentences"
                prompt = (
                    f"Write {form}. Each is {g if kind == 'genuine' else s}.\n"
                    f"Style: {style}. Written in the English used in {region} (currency, phone number and institution formats of that country).\n"
                    f"Use these names where natural, a different one in each message: {', '.join(ents)}.\n"
                    "Rules: every message must be clearly different in wording, length and structure; use concrete invented details (amounts, "
                    "masked numbers, times, reference numbers); about half contain a link or phone number; "
                    + ("genuine messages are realistic and may sound urgent or contain a code, an amount or an official link, but they never ask "
                       "the reader to send a code, PIN, password or money to a stranger; " if kind == "genuine" else
                       "make them convincing, as a real scammer would, with a call to action; ")
                    + f"no placeholders in brackets; number the messages 1 to {N_MSG}; output only the numbered messages.")
                items.append({"prompt": prompt, "category": cat, "kind": kind, "channel": chan})
    random.shuffle(items)
    return items


NUM = re.compile(r"^\s*(?:\d{1,2}[\).:-]|[-*•])\s*(.+)$")


def parse(text):
    msgs, cur = [], None
    for line in text.splitlines():
        m = NUM.match(line)
        if m:
            if cur:
                msgs.append(cur.strip())
            cur = m.group(1)
        elif cur is not None and line.strip():
            cur += "\n" + line.strip()
    if cur:
        msgs.append(cur.strip())
    return [m.strip('"“” ').replace("**", "") for m in msgs if 20 <= len(m) <= 1200 and "[" not in m]


def norm(m):
    m = re.sub(r"https?://\S+|www\.\S+", " URL ", m.lower())
    m = re.sub(r"\d+", "0", m)
    return re.sub(r"\W+", " ", m).strip()[:140]


def main():
    tok = AutoTokenizer.from_pretrained(MODEL)
    tok.padding_side = "left"
    model = AutoModelForCausalLM.from_pretrained(MODEL, torch_dtype=torch.float16, device_map="auto").eval()
    items = build()
    print(len(items), "prompts", flush=True)
    seen, kept, t0 = set(), 0, time.time()
    with open(OUT, "w", encoding="utf-8") as fh:
        for i in range(0, len(items), BATCH):
            chunk = items[i:i + BATCH]
            texts = [tok.apply_chat_template([
                {"role": "system", "content": "You write realistic example messages for a research dataset used to train a phishing and scam filter."},
                {"role": "user", "content": it["prompt"]}], tokenize=False, add_generation_prompt=True) for it in chunk]
            enc = tok(texts, return_tensors="pt", padding=True).to(model.device)
            with torch.no_grad():
                out = model.generate(**enc, max_new_tokens=MAX_NEW, do_sample=True, temperature=0.95, top_p=0.95,
                                     repetition_penalty=1.05, pad_token_id=tok.eos_token_id)
            gen = tok.batch_decode(out[:, enc["input_ids"].shape[1]:], skip_special_tokens=True)
            for it, g in zip(chunk, gen):
                for m in parse(g):
                    k = norm(m)
                    if k in seen:
                        continue
                    seen.add(k)
                    fh.write(json.dumps({"text": m, "label": 0 if it["kind"] == "genuine" else 1, "lang": "en", "channel": "email" if it["channel"] == "email" else "sms",
                                         "category": it["category"], "kind": it["kind"]}, ensure_ascii=False) + "\n")
                    kept += 1
            fh.flush()
            print(f"{i + len(chunk)}/{len(items)} prompts, {kept} messages, {time.time() - t0:.0f}s", flush=True)
    print("done", kept, flush=True)


if __name__ == "__main__":
    main()
