import os

directory = r"d:\Coding Projects\AegisOne\frontend\dashboard"

def fix_file(filepath):
    # Skip package-lock.json since it's huge and can lock up
    if "package-lock.json" in filepath:
        return
        
    with open(filepath, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    new_lines = []
    i = 0
    in_conflict = False
    keep = True

    while i < len(lines):
        line = lines[i]
        if line.startswith('<<<<<<< Updated upstream'):
            in_conflict = True
            keep = True 
        elif line.startswith('======='):
            keep = False 
        elif line.startswith('>>>>>>> Stashed changes'):
            in_conflict = False
            keep = True
        else:
            if not in_conflict or (in_conflict and keep):
                new_lines.append(line)
        i += 1
        
    with open(filepath, 'w', encoding='utf-8') as f:
        f.writelines(new_lines)

count = 0
for root, _, files in os.walk(directory):
    for file in files:
        # Only target typescript and javascript files now to avoid huge lockfiles
        if file.endswith(('.tsx', '.ts', '.jsx', '.js')) and "package-lock.json" not in file:
            filepath = os.path.join(root, file)
            try:
                with open(filepath, 'r', encoding='utf-8') as f:
                    content = f.read()
                if '<<<<<<< Updated upstream' in content:
                    print(f"Fixing {filepath}...")
                    fix_file(filepath)
                    count += 1
            except Exception as e:
                pass

print(f"Successfully fixed {count} code files with merge conflicts!")
