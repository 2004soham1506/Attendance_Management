FROM node:20-alpine

WORKDIR /app

# Install dependencies first (layer cache)
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev
# RUN npm install
# Copy source
COPY . .

# Create backups directory
RUN mkdir -p backups

EXPOSE 4040

CMD ["node", "server.js"]