from flask import Flask, request, jsonify
import joblib,requests,re, json, logging
from sentence_transformers import SentenceTransformer
from urllib.parse import urlparse
from scipy.sparse import csr_matrix, hstack
from sklearn.preprocessing import StandardScaler
from flask_cors import CORS
from datetime import datetime

app = Flask(__name__)
CORS(app)

# -------------------- LOAD MODELS -------------------- #
email_model = joblib.load("phishing_model.joblib")
url_model = joblib.load("url_phishing_model.joblib")
embedder = SentenceTransformer("sentence_embedder")
sender_columns = joblib.load("sender_columns.joblib")
scaler = StandardScaler()

# -------------------- HELPERS -------------------- #
def preprocess_text(text):
    if isinstance(text, str):
        text = text.lower()
        return ''.join(c for c in text if c.isalnum() or c == ' ')
    return ''

def extract_domain(sender):
    email = re.search(r'<(.+?)>', sender)
    if email:
        return email.group(1).split('@')[-1].lower()
    return ""

def extract_url_features(url):
    try:
        parsed = urlparse("http://" + str(url))
        domain = parsed.netloc.lower()
    except:
        domain = ""
    return [
        len(str(url)),
        sum(c.isdigit() for c in str(url)),
        sum(str(url).count(c) for c in ['-', '@', '?', '&', '=', '_', '%', '/']),
        1 if re.search(r'\d+\.\d+\.\d+\.\d+', str(url)) else 0,
        len(domain.split('.')[-1]) if '.' in domain else 0
    ]

# -------------------- EMAIL PREDICTION ROUTE -------------------- #
@app.route("/predict", methods=["POST"])
def predict():
    try:
        data = request.json
        user_email = data.get("userEmail")
        subject = data.get("subject", "")
        body = data.get("body", "")
        sender = data.get("sender", "")
        urls = data.get("urls", [])
        # FIX: If array contains individual characters, join them
        raw_urls = data.get("urls", [])
        urls = []

# Case 1: URL characters list like ['h','t','t','p']
        if len(raw_urls) > 0 and isinstance(raw_urls[0], str) and len(raw_urls) > 5:
            combined = "".join(raw_urls)
            urls.append(combined)

# Case 2: Proper URL list of strings
        elif all(isinstance(x, str) for x in raw_urls):
            urls = raw_urls

# Case 3: Nested character-lists like [ ['h','t','t','p',...] ]
        elif all(isinstance(x, list) for x in raw_urls):
            for item in raw_urls:
                urls.append("".join(item))

# Fallback for safety
        else:
            urls = []
# ML prediction
        cleaned = preprocess_text(f"{subject} {body}")
        text_embed = embedder.encode([cleaned])
        text_sparse = csr_matrix(text_embed)

        sender_domain = extract_domain(sender)
        sender_vector = [1 if col == sender_domain else 0 for col in sender_columns]
        sender_sparse = csr_matrix([sender_vector])

        combined = hstack([text_sparse, sender_sparse])
        email_pred = int(email_model.predict(combined)[0])
        email_conf = float(email_model.predict_proba(combined)[0][email_pred])

        # URL predictions
        url_results = []
        for url in urls:
            feats = extract_url_features(url)
            scaled = scaler.fit_transform([feats])
            up = int(url_model.predict(scaled)[0])
            uc = float(url_model.predict_proba(scaled)[0][up])
            url_results.append({
                "url": url,
                "prediction": up,
                "confidence": round(uc, 4)
            })

        result = {
            "email_prediction": email_pred,
            "email_confidence": round(email_conf, 4),
            "url_results": url_results
        }
        now = datetime.now()
        date_str = now.strftime("%Y-%m-%d")
        time_str = now.strftime("%H:%M:%S")
        day_str = now.strftime("%A")   
        # forward to Node backend
        try:
            requests.post(
                "http://localhost:5000/api/emails",
                json={
                    "userEmail": user_email,
                    "subject": subject,
                    "body": body,
                    "sender": sender,
                    "urls": url_results,
                    "prediction": email_pred,
                    "confidence": round(email_conf, 4),
                    "date": date_str,
                    "time": time_str,
                    "day": day_str
                }
            )
        except Exception as e:
            print("Failed to send to Node:", e)

        return jsonify(result)

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/")
def home():
    return "Phishing API running 🚀", 200

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5001, debug=True)