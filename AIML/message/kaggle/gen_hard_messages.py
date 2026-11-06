"""
Hard GENUINE messages (and the scams that imitate them) for the AegisOne message model. Runs on Kaggle (T4 x2).

Why: on the independent ScamGuardBench the message models flag most genuine messages that merely LOOK like scams (bank
OTPs 70%, courier notices 87%, receipts 87%, utility reminders 62%, genuine family money requests 46%). The public
corpora have almost no such messages, so the model learns "has a code / amount / link / urgency = scam".
This script asks an open instruction model (Qwen2.5-7B-Instruct, Apache-2.0) to write realistic examples in English,
Roman Urdu and Urdu script, as PAIRS: for every category a genuine message (label 0) and a scam imitating it (label 1).
Generated text is training data only; the evaluation sets are never shown to the generator.

Output: /kaggle/working/hard_messages.jsonl   {"text", "label", "lang", "channel", "category", "kind"}
"""
import itertools
import json
import os
import random
import re
import sys
import time

import torch
from transformers import AutoModelForCausalLM, AutoTokenizer

MODEL = "Qwen/Qwen2.5-7B-Instruct"
OUT = "/kaggle/working/hard_messages.jsonl"
SAMPLES_PER_COMBO = int(os.environ.get("SAMPLES", "10"))   # prompts per (category, language, kind); 10 messages each
BATCH = int(os.environ.get("BATCH", "24"))
MAX_NEW = 520
random.seed(7)

LANGS = {
    "en": "English",
    "roman_ur": "Roman Urdu (Urdu written with English letters, the way Pakistanis really type messages)",
    "ur": "Urdu (in Urdu script)",
}
# category -> (genuine description, scam description, channel)
CATS = {
    "bank_otp": ("a genuine one-time password / verification code from a bank, wallet or online service, including the usual warning not to share it",
                 "a scam that imitates an OTP message but pushes the reader to reveal or forward the code, or to click a link", "sms"),
    "transaction_alert": ("a genuine debit, credit, ATM or transfer alert from a Pakistani bank or wallet (amount, balance, reference number, helpline)",
                          "a scam imitating a transaction alert to make the reader panic and call a number or open a link", "sms"),
    "card_security": ("a genuine card or account security notice from a bank (card used abroad, new login, limit change) telling the customer what to do if it was not them",
                      "a scam imitating a card or account security notice that sends the reader to a fake page or asks for card details", "sms"),
    "receipt": ("a genuine payment receipt or order confirmation from a shop, app or service with order number and amount",
                "a scam receipt for a purchase the reader never made, urging a click to cancel or dispute", "email"),
    "subscription": ("a genuine subscription renewal or billing notice (streaming, cloud storage, software) with the plan and date",
                     "a scam renewal notice saying the card failed and the account will be closed unless the reader updates payment", "email"),
    "courier": ("a genuine courier or delivery notification (tracking number, delivery time, rider call, delivery code)",
                "a scam delivery notice asking for a small fee or address confirmation through a link", "sms"),
    "utility_bill": ("a genuine electricity, gas, water, internet or phone bill reminder (due date, amount, consumer number, official payment channels)",
                     "a scam bill reminder threatening disconnection unless the reader pays through a link or a personal account", "sms"),
    "government": ("a genuine notice from a government body (tax, ID card, passport, traffic e-challan, university, court date) with a reference and an official website",
                   "a scam notice pretending to be a government body demanding a fine or personal data through a link", "sms"),
    "telecom": ("a genuine mobile operator message (balance, data package expiry, recharge confirmation, SIM or number notice)",
                "a scam from a fake operator promising a prize or threatening to block the SIM", "sms"),
    "family_money": ("a genuine message from a relative or friend asking for money for a real, ordinary reason (fees, hospital, rent), written naturally, sometimes urgent",
                     "a scam message pretending to be a relative with a new number who urgently needs money sent to an account", "sms"),
    "workplace": ("a genuine message from an employer, HR, IT department or manager (payslip ready, password expiry, meeting link, document to review) with a normal internal link",
                  "a scam message imitating HR or IT asking the employee to log in through a link to see a payslip or avoid account lock", "email"),
    "account_notice": ("a genuine notice from an online service (login from a new device, password changed, verification email) that says to ignore it if it was the user",
                       "a scam notice about unusual sign-in that demands the reader to verify identity on a fake page", "email"),
    "promotion": ("a genuine promotional message from a real shop, restaurant, bank or app (discount, sale, voucher) with an opt-out line",
                  "a scam prize or giveaway message that asks for a fee, card details or a share to claim a reward", "sms"),
    "appointment_edu": ("a genuine appointment reminder, fee voucher, exam result or class notice from a clinic, school or university",
                        "a scam imitating a school fee or scholarship notice asking for payment to a personal account or a login", "sms"),
}
TEMPLATE = (
    "Write {n} different {chan} messages. Each is {desc}.\n"
    "Language: {lang}.\n"
    "Rules: realistic and varied (tone, length, sender, wording); include concrete details such as amounts in PKR, reference "
    "numbers, times, short links or phone numbers where natural; {extra}no placeholders like [name]; one message per item, "
    "numbered 1 to {n}; output only the numbered messages."
)
GENUINE_EXTRA = "genuine messages may sound urgent or contain a code, an amount or an official link, but they never ask the reader to send a code, PIN, password or money to a stranger; "
SCAM_EXTRA = "make them convincing, as a real scammer would, with a call to action; "


def build_prompts():
    items = []
    for (cat, (g, s, chan)), (lang, lname), kind in itertools.product(CATS.items(), LANGS.items(), ("genuine", "scam")):
        desc = g if kind == "genuine" else s
        for _ in range(SAMPLES_PER_COMBO):
            chan_word = "SMS" if chan == "sms" else random.choice(["short e-mail", "e-mail"])
            items.append({"prompt": TEMPLATE.format(n=10, chan=chan_word, desc=desc, lang=lname,
                                                     extra=GENUINE_EXTRA if kind == "genuine" else SCAM_EXTRA),
                          "category": cat, "lang": lang, "kind": kind, "channel": "email" if "mail" in chan_word else "sms"})
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
    return [m.strip('"“” ') for m in msgs if 12 <= len(m) <= 1500]


def main():
    print("loading", MODEL, flush=True)
    tok = AutoTokenizer.from_pretrained(MODEL)
    tok.padding_side = "left"
    model = AutoModelForCausalLM.from_pretrained(MODEL, torch_dtype=torch.float16, device_map="auto")
    model.eval()
    items = build_prompts()
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
                out = model.generate(**enc, max_new_tokens=MAX_NEW, do_sample=True, temperature=0.9, top_p=0.95,
                                     repetition_penalty=1.05, pad_token_id=tok.eos_token_id)
            gen = tok.batch_decode(out[:, enc["input_ids"].shape[1]:], skip_special_tokens=True)
            for it, g in zip(chunk, gen):
                for m in parse(g):
                    key = re.sub(r"\W+", " ", m.lower())[:120]
                    if key in seen:
                        continue
                    seen.add(key)
                    fh.write(json.dumps({"text": m, "label": 0 if it["kind"] == "genuine" else 1, "lang": it["lang"],
                                         "channel": it["channel"], "category": it["category"], "kind": it["kind"]},
                                        ensure_ascii=False) + "\n")
                    kept += 1
            fh.flush()
            print(f"{i + len(chunk)}/{len(items)} prompts, {kept} messages, {time.time() - t0:.0f}s", flush=True)
    print("done", kept, flush=True)


if __name__ == "__main__":
    main()
