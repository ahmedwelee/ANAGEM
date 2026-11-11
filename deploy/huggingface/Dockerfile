# Hugging Face Space (free, no card): backend + website in ONE container, database on Neon.
# Copy this file and README.md into a new Space (SDK: Docker). The build downloads the public code from GitHub.
FROM alpine/git AS src
ARG REPO=https://github.com/ahmedwelee/ANAGEM.git
ARG REF=main
RUN git clone --depth 1 --branch "$REF" "$REPO" /src

FROM maven:3.9-eclipse-temurin-17 AS backend
WORKDIR /build
COPY --from=src /src/backend/pom.xml .
RUN mvn -q -B dependency:go-offline
COPY --from=src /src/backend/src ./src
RUN mvn -q -B -DskipTests package

FROM node:24-slim AS web
WORKDIR /app
COPY --from=src /src/frontend/package.json /src/frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY --from=src /src/frontend ./
RUN npm run build

FROM eclipse-temurin:17-jre
COPY --from=node:24-slim /usr/local/bin/node /usr/local/bin/node
RUN useradd -m -u 1000 user && mkdir -p /home/user/storage && chown -R user /home/user
USER user
WORKDIR /home/user/app
COPY --from=backend --chown=user /build/target/anagem-cms-*.jar app.jar
COPY --from=web --chown=user /app/dist/anagem-frontend ./web
COPY --from=src --chown=user /src/deploy/huggingface/start.sh start.sh
ENV PORT=7860 STORAGE_DIR=/home/user/storage ALLOWED_HOSTS="*.hf.space,localhost,127.0.0.1" PROXY_API=true \
    API_ORIGIN=http://127.0.0.1:8080 JAVA_OPTS="-XX:MaxRAMPercentage=45 -XX:+UseSerialGC"
EXPOSE 7860
CMD ["bash", "start.sh"]
