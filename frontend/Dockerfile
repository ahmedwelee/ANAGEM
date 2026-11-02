# Angular SSR web server (public site + admin). Build: node 24, run: node 24 on alpine, non-root.
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
# prebuild generates icons.svg and the three dictionaries, then ng build (production, server output)
RUN npm run build

FROM node:24-alpine
ENV NODE_ENV=production PORT=4000
WORKDIR /app
COPY --from=build /app/dist/anagem-frontend ./dist/anagem-frontend
USER node
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD wget -qO- http://127.0.0.1:4000/robots.txt >/dev/null || exit 1
CMD ["node", "dist/anagem-frontend/server/server.mjs"]
