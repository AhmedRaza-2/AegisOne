#!/bin/sh
# Build and push the two AegisOne images used by docker-compose.prod.yml (Docker Hub user: ahmedraza2006).
# Usage:  sh scripts/build_push_images.sh [tag]      (default tag: today's date; also tagged "latest")
# Run `docker login` first. The backend image bakes in the model weights, so the build context is large.
set -e
TAG="${1:-$(date +%Y-%m-%d)}"
cd "$(dirname "$0")/.."
docker build -f Dockerfile.backend -t "ahmedraza2006/aegisone-backend:$TAG" -t ahmedraza2006/aegisone-backend:latest .
docker build -f frontend/dashboard/Dockerfile -t "ahmedraza2006/aegisone-dashboard:$TAG" -t ahmedraza2006/aegisone-dashboard:latest .
for r in backend dashboard; do
  docker push "ahmedraza2006/aegisone-$r:$TAG"
  docker push "ahmedraza2006/aegisone-$r:latest"
done
