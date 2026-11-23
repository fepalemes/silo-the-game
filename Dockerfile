# The game is static files: the page, its stylesheet, its ES modules and one
# image. three.js comes from the CDN in index.html's import map, so there is
# nothing to build and no Node at runtime - nginx serves the files.
#
#   docker build -t silo-the-game .
#   docker run --rm -p 8080:80 silo-the-game      -> http://localhost:8080
#
# TLS is left to whatever stands in front (Dokploy's Traefik): the headset
# only starts a WebXR session on an https origin.
FROM nginx:1.27-alpine

COPY docker/nginx.conf /etc/nginx/conf.d/default.conf

# Only what the page loads. The development server, tests, tools, docs and
# reference images stay out of the image.
COPY index.html /usr/share/nginx/html/
COPY css /usr/share/nginx/html/css
COPY js /usr/share/nginx/html/js
COPY assets/exterior-camera-v1.png /usr/share/nginx/html/assets/

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO /dev/null http://127.0.0.1/healthz || exit 1
