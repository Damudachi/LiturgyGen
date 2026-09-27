# The API, for a host that builds from a Dockerfile and for compose.yml.
#
# The client is not in here. It is a static bundle on GitHub Pages; this image
# is the Express API and nothing else.

FROM node:22-slim

# better-sqlite3 still ships in the dependency list while the PostgreSQL
# migration is in progress, and it falls back to a source build when there is no
# prebuild for this platform. Remove this layer once src/db/index.js runs on pg.
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 make g++ \
 && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
WORKDIR /app

# Copy the manifests first so a code change does not invalidate the install layer.
COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

# The host sets PORT. This is documentation, not a binding.
EXPOSE 3000

# Run as a non-root user. The base image ships one.
USER node

CMD ["node", "server.js"]
