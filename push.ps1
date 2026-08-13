# AegisOne Docker Hub Release Script
Write-Host "Building & Pushing AegisOne Production Containers to Docker Hub..." -ForegroundColor Cyan

docker build -t ahmedraza2006/aegisone-backend:latest -f Dockerfile.backend .
docker push ahmedraza2006/aegisone-backend:latest

docker build -t ahmedraza2006/aegisone-dashboard:latest ./frontend/dashboard
docker push ahmedraza2006/aegisone-dashboard:latest

Write-Host "All Docker Hub images updated successfully!" -ForegroundColor Green
