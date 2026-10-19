FROM node:22-alpine

# Set working directory
WORKDIR /app

# Install dependencies needed for native modules and fonts
RUN apk add --no-cache tzdata dumb-init

# Set timezone to Iraq (Asia/Baghdad)
ENV TZ=Asia/Baghdad
ENV NODE_ENV=production
ENV PORT=3000

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci --omit=dev || npm install --omit=dev

# Copy source code
COPY . .

# Ensure state and output directories exist
RUN mkdir -p /app/state /app/out /app/assets

# Expose HTTP dashboard and webhook port
EXPOSE 3000

# Use dumb-init to properly handle signal termination
ENTRYPOINT ["dumb-init", "--"]

# Start the self-healing supervisor and bot
CMD ["node", "watchdog.js"]
