FROM node:18-alpine

# Set work directory
WORKDIR /app

# Add package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Build the application for production
RUN npm run build

# Expose port
EXPOSE 3000

# Start the application
CMD ["npm", "start"]
