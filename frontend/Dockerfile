# Сборка SPA → раздача статики через nginx.
FROM node:24-alpine AS build
WORKDIR /app

# Манифесты отдельным слоем: npm ci переиспользуется, пока не менялись зависимости.
COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:1.27-alpine AS runtime
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
