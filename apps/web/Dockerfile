# The web app as a container. Build from the REPO ROOT (it needs the npm workspace and
# packages/shared):
#   docker build -f apps/web/Dockerfile \
#     --build-arg NEXT_PUBLIC_SUPABASE_URL=... --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=... \
#     --build-arg NEXT_PUBLIC_API_BASE_URL=... -t untiered-web .
# NEXT_PUBLIC_* values are compiled into the browser bundle, so they are build arguments,
# not runtime environment. None of them is secret.
# The server-only EMAIL_CONTENT_TOKEN must instead be supplied at container runtime.
#
# Readable production stack traces: pass the Sentry project (not secret) as build arguments
# and the auth token as a BUILD SECRET, never an argument, which would stay in the image
# history:
#   --build-arg SENTRY_ORG=... --build-arg SENTRY_PROJECT=... \
#   --secret id=sentry_auth_token,env=SENTRY_AUTH_TOKEN
# Without the secret the build succeeds and uploads nothing (see next.config.ts).

FROM node:22-alpine AS deps
WORKDIR /repo
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN npm ci --workspace apps/web --include-workspace-root

FROM node:22-alpine AS build
WORKDIR /repo
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_API_BASE_URL
ARG NEXT_PUBLIC_QUESTION_BANK_BROWSABLE=false
ARG NEXT_PUBLIC_SENTRY_DSN=
ARG NEXT_PUBLIC_SENTRY_ENVIRONMENT=production
ARG NEXT_PUBLIC_LEGAL_OPERATOR_NAME=
ARG NEXT_PUBLIC_GRIEVANCE_OFFICER_NAME=
ARG SENTRY_ORG=
ARG SENTRY_PROJECT=
ENV NEXT_OUTPUT_STANDALONE=true NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /repo/node_modules node_modules
COPY package.json package-lock.json ./
COPY packages/shared packages/shared
COPY apps/web apps/web
# The token is read from the secret mount for this one command only. If the secret is not
# supplied it is empty, which next.config.ts treats as "do not upload source maps".
RUN --mount=type=secret,id=sentry_auth_token \
    SENTRY_AUTH_TOKEN="$(cat /run/secrets/sentry_auth_token 2>/dev/null || true)" \
    npm run build --workspace apps/web

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0 NEXT_TELEMETRY_DISABLED=1
RUN addgroup -S app && adduser -S app -G app
COPY --from=build --chown=app:app /repo/apps/web/.next/standalone ./
COPY --from=build --chown=app:app /repo/apps/web/.next/static apps/web/.next/static
USER app
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
