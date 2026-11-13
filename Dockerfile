FROM node:20-bookworm-slim

ENV NODE_ENV=production
WORKDIR /app

# Pin the GenieACS version so deployments are reproducible.
RUN npm install --global genieacs@1.2.16

COPY gateway.js /app/gateway.js

EXPOSE 10000 7557

# Render services override this command per service in render.yaml.
CMD ["genieacs-cwmp"]
