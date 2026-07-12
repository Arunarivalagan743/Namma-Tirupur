# ==========================================
# Stage 1: Build Vite / React SPA
# ==========================================
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /usr/src/app

# Copy dependency definition files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy the rest of the application source code
COPY . .

# Setup Build Arguments for Vite Environment Variables
ARG VITE_FIREBASE_API_KEY
ARG VITE_FIREBASE_AUTH_DOMAIN
ARG VITE_FIREBASE_PROJECT_ID
ARG VITE_FIREBASE_STORAGE_BUCKET
ARG VITE_FIREBASE_MESSAGING_SENDER_ID
ARG VITE_FIREBASE_APP_ID
ARG VITE_API_URL
ARG VITE_ADMIN_EMAIL
ARG VITE_PANCHAYAT_NAME
ARG VITE_PANCHAYAT_CODE

# Assign Build Arguments to Environment Variables for Vite Compiler
ENV VITE_FIREBASE_API_KEY=$VITE_FIREBASE_API_KEY
ENV VITE_FIREBASE_AUTH_DOMAIN=$VITE_FIREBASE_AUTH_DOMAIN
ENV VITE_FIREBASE_PROJECT_ID=$VITE_FIREBASE_PROJECT_ID
ENV VITE_FIREBASE_STORAGE_BUCKET=$VITE_FIREBASE_STORAGE_BUCKET
ENV VITE_FIREBASE_MESSAGING_SENDER_ID=$VITE_FIREBASE_MESSAGING_SENDER_ID
ENV VITE_FIREBASE_APP_ID=$VITE_FIREBASE_APP_ID
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_ADMIN_EMAIL=$VITE_ADMIN_EMAIL
ENV VITE_PANCHAYAT_NAME=$VITE_PANCHAYAT_NAME
ENV VITE_PANCHAYAT_CODE=$VITE_PANCHAYAT_CODE

# Build the frontend application
RUN npm run build

# ==========================================
# Stage 2: Serve static files using Nginx
# ==========================================
FROM nginx:alpine

# Copy built files from the builder stage
COPY --from=builder /usr/src/app/dist /usr/share/nginx/html

# Copy custom nginx configuration for SPA routing fallback
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose HTTP port
EXPOSE 80

# Health check to ensure Nginx is responding
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost/ || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
