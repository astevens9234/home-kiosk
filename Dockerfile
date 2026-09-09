# Build stage with uv for fast, reliable dependency installation
FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim AS builder

WORKDIR /app

# Enable bytecode compilation
ENV UV_COMPILE_BYTECODE=1

# Copy dependency definitions
COPY pyproject.toml uv.lock* ./
COPY backend/requirements.txt ./backend/requirements.txt

# Install dependencies into virtual environment
RUN uv venv /app/.venv && \
    uv pip install --no-cache -r backend/requirements.txt

# Final runtime stage
FROM python:3.12-slim-bookworm

WORKDIR /app

ENV PATH="/app/.venv/bin:$PATH" \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=8000

# Copy installed virtual environment from builder stage
COPY --from=builder /app/.venv /app/.venv

# Copy application code and static assets
COPY backend /app/backend
COPY static /app/static

# Create non-root user for security best practice on Kubernetes
RUN groupadd -r appuser && useradd -r -g appuser appuser && \
    chown -R appuser:appuser /app

USER appuser

EXPOSE 8000

# Healthcheck for container orchestrators
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/api/metrics')" || exit 1

# Launch uvicorn server
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
