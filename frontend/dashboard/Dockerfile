FROM node:18-alpine

# Set working directory
WORKDIR /app/frontend/dashboard

# Copy package files
COPY frontend/dashboard/package.json frontend/dashboard/package-lock.json* ./

# Install dependencies
RUN npm install --legacy-peer-deps

# Copy all files
COPY frontend/dashboard/ .

# Build the Next.js application
RUN npm run build

# Start the application
CMD ["npx", "next", "start", "-H", "0.0.0.0", "-p", "3000"]
