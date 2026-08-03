FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm install --include=optional

# Copy all files
COPY . .

# Build the Next.js application
RUN npm run build

# Start the application
CMD ["npm", "start"]
