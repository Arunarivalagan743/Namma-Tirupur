# ==========================================
# Stage 1: Build & Dependencies
# ==========================================
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /usr/src/app

# Copy dependency definition files
COPY package*.json ./

# Install all dependencies (including devDependencies)
RUN npm ci

# Copy the rest of the application source code
COPY . .

# Prune development dependencies
RUN npm prune --production

# ==========================================
# Stage 2: Production Image
# ==========================================
FROM node:20-alpine

# Set node environment to production
ENV NODE_ENV=production

# Set working directory
WORKDIR /usr/src/app

# Copy package files (for metadata/scripts)
COPY package*.json ./

# Copy built node_modules and source code from builder stage
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/src ./src

# Create a non-privileged system user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001 && \
    chown -R nextjs:nodejs /usr/src/app

# Use the non-root user
USER nextjs

# Expose port
EXPOSE 5000

# Health check utilizing wget (built-in on Alpine)
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5000/api/health || exit 1

# Start the application
CMD ["npm", "start"]
