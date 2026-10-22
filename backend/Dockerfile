FROM python:3.10-slim

WORKDIR /app

# Install curl for Docker healthcheck and minimal glib
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Install CPU-optimized PyTorch first for fast downloads and lean image footprint
RUN pip install --no-cache-dir --index-url https://download.pytorch.org/whl/cpu torch torchvision

# Copy and install application dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend source code
COPY . /app/backend

# Security: Non-root user
RUN useradd -u 1000 -m smartwash && \
    chown -R smartwash:smartwash /app
USER smartwash

EXPOSE 4550

HEALTHCHECK --interval=15s --timeout=5s --start-period=15s --retries=3 \
    CMD curl -f http://localhost:4550/health || exit 1

CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "4550", "--workers", "1"]
