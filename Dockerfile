FROM nginx:alpine

# Copy game files
COPY game/ /usr/share/nginx/html/

# Custom nginx config for SPA
RUN printf 'server {\n\
  listen 8080;\n\
  root /usr/share/nginx/html;\n\
  index index.html;\n\
  gzip on;\n\
  gzip_types text/html text/css application/javascript;\n\
  location / {\n\
    try_files $uri $uri/ /index.html;\n\
    add_header Cache-Control "no-cache, must-revalidate";\n\
  }\n\
  location ~* \\.(js|css|png|jpg|gif|ico|svg|woff2)$ {\n\
    expires 1d;\n\
    add_header Cache-Control "public, max-age=86400";\n\
  }\n\
}\n' > /etc/nginx/conf.d/default.conf

EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
