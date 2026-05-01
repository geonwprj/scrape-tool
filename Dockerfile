# Use Python 3.13 slim image
FROM python:3.13-slim

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install uv for Python package management
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

# Set working directory
WORKDIR /app

# Disable uv's automatic sync on run to speed up startup
ENV UV_PROJECT_ENVIRONMENT=/app/.venv
ENV PATH="/app/.venv/bin:$PATH"
ENV PYTHONPATH=/app

# Copy dependency files first for better caching
COPY pyproject.toml uv.lock ./

# Create virtual environment and install dependencies
RUN uv sync --frozen --no-dev --no-install-project

# Copy the rest of the source code
COPY . .

# Install the project itself
RUN uv sync --frozen --no-dev

# Expose the API port
EXPOSE 8000

# Run the application using the python in the virtualenv
# This avoids uv's sync-on-run check
CMD ["python", "-m", "src.scrape_tool.main"]
