import subprocess
import sys

try:
    result = subprocess.run(["docker", "logs", "aegisone-backend", "--tail", "200"], capture_output=True, text=True, check=True)
    with open("docker_logs.txt", "w") as f:
        f.write(result.stdout)
        f.write("\n\n--- ERRORS ---\n\n")
        f.write(result.stderr)
    print("Logs saved to docker_logs.txt")
except Exception as e:
    print(f"Error: {e}")
