FROM node:20-alpine AS builder

ARG VITE_API_URL
ARG VITE_TERMS_URL
ARG VITE_PRIVACY_URL
ARG VITE_SUPPORT_URL
ARG VITE_GITHUB_URL

ENV VITE_API_URL=$VITE_API_URL
ENV VITE_TERMS_URL=$VITE_TERMS_URL
ENV VITE_PRIVACY_URL=$VITE_PRIVACY_URL
ENV VITE_SUPPORT_URL=$VITE_SUPPORT_URL
ENV VITE_GITHUB_URL=$VITE_GITHUB_URL

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY . .

RUN npm run build

FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html

COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
