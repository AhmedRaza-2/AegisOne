import os

def resolve_conflicts(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    new_lines = []
    in_head = False
    in_theirs = False
    for line in lines:
        if line.startswith('<<<<<<< HEAD'):
            in_head = True
            continue
        elif line.startswith('======='):
            in_head = False
            in_theirs = True
            continue
        elif line.startswith('>>>>>>>'):
            in_theirs = False
            continue
            
        if in_theirs:
            continue
            
        new_lines.append(line)

    with open(filepath, 'w', encoding='utf-8') as f:
        f.writelines(new_lines)

files_to_resolve = [
    "api/services/cache_service.py",
    "api/routers/admin.py",
    "api/services/content_router.py",
    "frontend/package-lock.json",
    "api/services/model_orchestrator.py",
    "api/config.py",
    "tests/load_test_bots.py",
    "api/routers/scan.py"
]

for file in files_to_resolve:
    full_path = os.path.join("D:\\Coding Projects\\AegisOne", file.replace('/', '\\'))
    if os.path.exists(full_path):
        resolve_conflicts(full_path)
        print(f"Resolved {file}")
