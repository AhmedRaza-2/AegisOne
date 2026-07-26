import os
import shutil

src_dir = r"d:\Coding Projects\AegisOne\frontend\src"
dest_dir = r"d:\Coding Projects\AegisOne\frontend\dashboard\src"

def merge_directories(src, dst):
    if not os.path.exists(dst):
        os.makedirs(dst)
    
    for item in os.listdir(src):
        s = os.path.join(src, item)
        d = os.path.join(dst, item)
        
        if os.path.isdir(s):
            merge_directories(s, d)
        else:
            if not os.path.exists(d):
                print(f"Moving {s} to {d}")
                shutil.move(s, d)
            else:
                print(f"Skipping {s}, already exists at destination")

merge_directories(src_dir, dest_dir)
print("Merge complete. Cleaning up empty directories...")

# Clean up empty source directories
for root, dirs, files in os.walk(src_dir, topdown=False):
    for dir_name in dirs:
        dir_path = os.path.join(root, dir_name)
        if not os.listdir(dir_path):
            os.rmdir(dir_path)

if not os.listdir(src_dir):
    os.rmdir(src_dir)

print("Done! All scattered source files have been restored to frontend/dashboard/src")
