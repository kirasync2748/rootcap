# rootcap — self-hosted demo site + API
#
# Build:  docker build -t rootcap .
# Run:    docker run -p 3000:3000 -e ROOTCAP_SECRET=<your-secret> rootcap
#
# The image serves the built website and the challenge / verify / stats API
# from a single Node process (server.mjs). Everything is stateless — no
# database or volume is required.

FROM node:26.13.0-slim AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
# The website build and the library build both write to dist/ (and each build
# empties it), so the site output is set aside before building the library.
RUN npm run build && cp -r dist site && npm run build:lib

FROM node:26.13.0-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

COPY package.json ./
COPY server.mjs ./
COPY --from=build /app/site ./site
COPY --from=build /app/dist ./dist

EXPOSE 3000
CMD ["node", "server.mjs"]
