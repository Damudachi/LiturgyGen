# The API, for a host that builds from a Dockerfile and for compose.yml.
#
# The client is not in here. It is a static bundle on GitHub Pages; this image
# is the Express API and nothing else.

FROM node:22-slim

# No build toolchain here on purpose. better-sqlite3 was the only dependency
# that needed one, and it left with the PostgreSQL migration - `pg` is pure
# JavaScript. Putting python3/make/g++ back adds minutes to every deploy.

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
