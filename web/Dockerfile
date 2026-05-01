# Use Node 20 slim image
FROM node:20-slim

# Set working directory
WORKDIR /app/web

# Copy package files
COPY web/package.json web/package-lock.json ./

# Install dependencies
RUN npm install

# Copy web source and global config
# Copy web source
COPY web ./

# Expose the WebUI port
EXPOSE 3000

# Run the dev server
CMD ["npm", "run", "dev"]
