FROM node:20-slim

# System deps for Claude Agent SDK (needs git for workspace context)
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    curl \
    jq \
    ca-certificates \
    python3 \
    python3-venv \
    && rm -rf /var/lib/apt/lists/*

# Install uv (for crm-cli)
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

# Install Claude Code globally (required by Claude Agent SDK)
RUN npm install -g @anthropic-ai/claude-code@latest

# Install clawling dependencies
WORKDIR /app
COPY package.json /app/package.json
RUN npm install --production

# Copy framework source
COPY src/ /app/src/
COPY tsconfig.json /app/tsconfig.json
COPY entrypoint.sh /app/entrypoint.sh

# Config and skills are bind-mounted at runtime
# Workspace is bind-mounted at runtime

# Claude Code needs a home dir for config/sessions
RUN mkdir -p /home/node/.claude /app/data && chown -R node:node /home/node /app

USER node
ENV PATH="/home/node/.local/bin:${PATH}"

EXPOSE 8001

ENTRYPOINT ["/app/entrypoint.sh"]
