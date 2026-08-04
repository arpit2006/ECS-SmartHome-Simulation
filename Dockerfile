# ─────────────────────────────────────────────────────────────────────────────
# Stage 1: Base image with Java 21 JDK + Node.js 18
# eclipse-temurin is the official OpenJDK distribution from Adoptium
# ─────────────────────────────────────────────────────────────────────────────
FROM eclipse-temurin:21-jdk-jammy

# Install Node.js 18 via NodeSource
RUN apt-get update && \
    apt-get install -y curl && \
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash - && \
    apt-get install -y nodejs && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy the full project
COPY . .

# Make the bundled Maven executable (mvn.cmd is Windows-only; use mvn for Linux)
RUN chmod +x maven/apache-maven-3.9.6/bin/mvn

# Install Node.js dependencies for the webapp
WORKDIR /app/webapp
RUN npm install --omit=dev

# Reset working directory to project root
WORKDIR /app

# Render dynamically assigns PORT via environment variable
EXPOSE 3000

CMD ["node", "webapp/server.js"]
