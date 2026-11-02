FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /build
COPY pom.xml .
RUN mvn -q -B dependency:go-offline
COPY src ./src
RUN mvn -q -B -DskipTests package

FROM eclipse-temurin:17-jre
RUN useradd --system --uid 10001 --create-home anagem && mkdir -p /data/storage && chown -R anagem /data
USER anagem
WORKDIR /app
COPY --from=build /build/target/anagem-cms-*.jar app.jar
ENV STORAGE_DIR=/data/storage JAVA_OPTS="-XX:MaxRAMPercentage=75"
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s CMD wget -qO- http://localhost:8080/actuator/health/liveness || exit 1
ENTRYPOINT ["sh", "-c", "exec java $JAVA_OPTS -jar app.jar"]
