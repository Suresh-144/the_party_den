# Stage 1: Build the React frontend
FROM node:20-slim AS build-stage
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Stage 2: Run the server
FROM node:20-slim
WORKDIR /app

# Install production dependencies only
COPY package*.json ./
RUN npm install --production

# Copy built assets from build-stage and server source
COPY --from=build-stage /app/dist ./dist
COPY --from=build-stage /app/server.ts ./
COPY --from=build-stage /app/tsconfig.json ./

# The app uses better-sqlite3 which requires local storage
# Ensure the directory is writable for the SQLite database
RUN touch partyhouse.db && chmod 666 partyhouse.db

ENV NODE_ENV=production
EXPOSE 3000

# Use tsx to run the TypeScript server as defined in your package.json
RUN npm install -g tsx
CMD ["tsx", "server.ts"]
