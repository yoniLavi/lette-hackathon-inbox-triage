FROM node:20-slim

ARG CLAUDE_CODE_VERSION=latest

RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    curl \
    jq \
    ca-certificates \
    python3 \
    python3-venv \
    && rm -rf /var/lib/apt/lists/*

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

# Install Claude Code globally
RUN npm install -g @anthropic-ai/claude-code@${CLAUDE_CODE_VERSION}

# Install Python dependencies via uv
COPY pyproject.toml /app/pyproject.toml
RUN cd /app && uv sync --no-dev

COPY api.py /app/api.py
COPY entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

# Agent workspace — CLAUDE.md and skills
COPY workspace/ /workspace/

# Claude Code needs a home dir for config/sessions
RUN mkdir -p /home/node/.claude && chown -R node:node /home/node /workspace

USER node
WORKDIR /workspace

EXPOSE 8001

ENTRYPOINT ["/app/entrypoint.sh"]
