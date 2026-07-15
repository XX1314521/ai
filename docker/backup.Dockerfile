FROM postgres:16-alpine

RUN apk add --no-cache ca-certificates curl tzdata \
    && curl -fsSL https://dl.min.io/client/mc/release/linux-amd64/mc -o /usr/local/bin/mc \
    && chmod +x /usr/local/bin/mc

COPY docker/backup.sh /usr/local/bin/aikart-backup
RUN chmod +x /usr/local/bin/aikart-backup

CMD ["/usr/local/bin/aikart-backup"]
