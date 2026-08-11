import bcrypt

hash = b'$2b$12$1vye7Zb5Xze5XUTXEBKSNOv.GZmbSmKLIBg6x2sIH6Z9NPOYppqCe'
pw = b'f8pc8zqegjX#'

print(bcrypt.checkpw(pw, hash))
