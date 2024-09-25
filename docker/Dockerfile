FROM 860638170744.dkr.ecr.af-south-1.amazonaws.com/common/node-devtools:staging

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=1 \
    CHROME_BIN=/usr/bin/chromium-browser \
    CHROME_PATH=/usr/lib/chromium/

RUN echo "http://dl-cdn.alpinelinux.org/alpine/edge/main" > /etc/apk/repositories \
    && echo "http://dl-cdn.alpinelinux.org/alpine/edge/community" >> /etc/apk/repositories \
    && echo "http://dl-cdn.alpinelinux.org/alpine/edge/testing" >> /etc/apk/repositories \
    && echo "http://dl-cdn.alpinelinux.org/alpine/v3.17/main" >> /etc/apk/repositories \
    && apk --no-cache --update upgrade \
    && apk add --no-cache \
    libstdc++ \
    chromium=127.0.6533.99-r0 \
    harfbuzz \
    nss \
    freetype \
    ttf-freefont \
    nss-tools \
    graphicsmagick \
    ghostscript  && \
    mkdir -p $HOME/.pki/nssdb && \
    certutil -d sql:$HOME/.pki/nssdb -N --empty-password && \
    certutil -d sql:$HOME/.pki/nssdb -A -t TC -n "AllanGrayrootSHA256" -i /usr/local/share/ca-certificates/rootSHA256.crt && \
    certutil -d sql:$HOME/.pki/nssdb -A -t TC -n "AllanGrayIssuingCA1SHA256" -i /usr/local/share/ca-certificates/issuingca1SHA256.crt && \
    certutil -d sql:$HOME/.pki/nssdb -A -t TC -n "AllanGrayIssuingCA2SHA256" -i /usr/local/share/ca-certificates/issuingca2SHA256.crt && \
    su -c 'mkdir -p $HOME/.pki/nssdb' node && \
    su -c 'certutil -d sql:$HOME/.pki/nssdb -N --empty-password' node && \
    su -c 'certutil -d sql:$HOME/.pki/nssdb -A -t TC -n "AllanGrayrootSHA256" -i /usr/local/share/ca-certificates/rootSHA256.crt' node && \
    su -c 'certutil -d sql:$HOME/.pki/nssdb -A -t TC -n "AllanGrayIssuingCA1SHA256" -i /usr/local/share/ca-certificates/issuingca1SHA256.crt' node && \
    su -c 'certutil -d sql:$HOME/.pki/nssdb -A -t TC -n "AllanGrayIssuingCA2SHA256" -i /usr/local/share/ca-certificates/issuingca2SHA256.crt' node && \
    npm install -g npm@10.5.0
