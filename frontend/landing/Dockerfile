FROM node:20-slim

WORKDIR /app/frontend/landing

COPY frontend/landing/package.json frontend/landing/package-lock.json* ./

RUN npm install --legacy-peer-deps

COPY frontend/landing/ .
COPY frontend/shared-assistant/ ../shared-assistant/

ARG VITE_ASSISTANT_ENABLED=false
ARG VITE_ASSISTANT_VOICE_ENABLED=false
ARG VITE_ASSISTANT_API_URL=
ENV VITE_ASSISTANT_ENABLED=$VITE_ASSISTANT_ENABLED VITE_ASSISTANT_VOICE_ENABLED=$VITE_ASSISTANT_VOICE_ENABLED VITE_ASSISTANT_API_URL=$VITE_ASSISTANT_API_URL

EXPOSE 3000

CMD ["npm", "run", "start"]
