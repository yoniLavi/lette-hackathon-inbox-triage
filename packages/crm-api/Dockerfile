FROM node:20-slim

RUN npm install -g pnpm@10.11.0

WORKDIR /app

# Copy workspace root config
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./

# Copy package manifests for workspace dependency resolution
COPY packages/crm-schema/package.json packages/crm-schema/
COPY packages/crm-api/package.json packages/crm-api/

# Install only CRM API and its workspace deps
RUN pnpm install --frozen-lockfile --filter @repo/crm-api...

# Copy source code
COPY packages/crm-schema/ packages/crm-schema/
COPY packages/crm-api/ packages/crm-api/

EXPOSE 8002
CMD ["pnpm", "--filter", "@repo/crm-api", "dev"]
