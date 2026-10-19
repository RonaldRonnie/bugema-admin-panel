# The console is plain static files — no build step, no node_modules, no
# bundler. The image is nginx plus this directory.
FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY index.html config.js /usr/share/nginx/html/
COPY assets/ /usr/share/nginx/html/assets/
COPY js/     /usr/share/nginx/html/js/

EXPOSE 8080

# Point a deployed console at a different API without rebuilding:
#   docker run -v $PWD/config.js:/usr/share/nginx/html/config.js:ro ...
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD wget -q -O /dev/null http://localhost:8080/index.html || exit 1
