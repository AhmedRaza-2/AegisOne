import os
import shutil

src_dir = r"d:\Coding Projects\AegisOne\frontend"
dest_dir = r"d:\Coding Projects\AegisOne\frontend\dashboard"

files_to_move = [
    "package.json",
    "package-lock.json",
    "next.config.js",
    "postcss.config.js",
    "tailwind.config.ts",
    "tsconfig.json",
    ".eslintrc.json",
    "next-env.d.ts"
]

for file_name in files_to_move:
    src_file = os.path.join(src_dir, file_name)
    dest_file = os.path.join(dest_dir, file_name)
    
    if os.path.exists(src_file):
        print(f"Moving {file_name} to dashboard folder...")
        shutil.move(src_file, dest_file)
    else:
        print(f"File not found: {file_name}")

print("Done! You can now run 'npm run dev' inside the dashboard folder.")
