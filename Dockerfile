# Use Node.js LTS Alpine for smaller image size
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (ignore scripts to prevent postinstall from running)
RUN npm ci --ignore-scripts

# Copy application files
COPY . .

# Build the application explicitly
RUN npm run build

# Remove dev dependencies to reduce image size  
RUN npm prune --production

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S tmvisuals -u 1001

# Change ownership of the app directory
RUN chown -R tmvisuals:nodejs /app
USER tmvisuals

# Expose the port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3001/api/health || exit 1

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3001

# Start the application
CMD ["npm", "start"]
