FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
COPY apps/web/package*.json ./apps/web/
ENV NPM_CONFIG_UNSAFE_PERM=true
# Install with legacy-peer-deps to avoid peer dependency resolution differences
RUN npm install --workspace @build-empire/web --include-workspace-root --legacy-peer-deps --no-audit --no-fund

FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ARG VITE_API_BASE_URL=
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
# Use prebuilt dist from host (created by CI or local build) to avoid dependency resolution differences
# If you need to build inside the container, remove this COPY and uncomment the RUN command.
COPY apps/web/dist ./apps/web/dist
# RUN npm run build -w @build-empire/web

FROM nginx:1.27-alpine AS runtime
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
