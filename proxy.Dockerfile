# ============================================================
# Plimsoll RPC Proxy (Python) — Lightweight vault-aware proxy
#
# Build:  docker build -f proxy.Dockerfile -t plimsoll-proxy .
# Run:    docker run -p 8545:8545 \
#           -e PLIMSOLL_UPSTREAM_RPC="https://base-mainnet.g.alchemy.com/v2/KEY" \
#           plimsoll-proxy
# ============================================================

FROM python:3.12-slim

WORKDIR /app

# Install the plimsoll package with proxy extras
COPY pyproject.toml README.md LICENSE ./
COPY plimsoll/ plimsoll/
RUN pip install --no-cache-dir ".[proxy]"

# Environment defaults
# Railway assigns PORT dynamically; fall back to 8545 for local dev
ENV PLIMSOLL_UPSTREAM_RPC=https://mainnet.base.org \
    PLIMSOLL_HOST=0.0.0.0 \
    PORT=8545

EXPOSE 8545

# Use shell form so $PORT is expanded at runtime
CMD uvicorn plimsoll.proxy.interceptor:app --host 0.0.0.0 --port $PORT
