FROM restic/restic:0.19.0 AS restic

FROM mysql:8.4.11@sha256:85b9bf2e29cf836ecb8c2a15a935d4ba0c606631dff1dd79531a11983c638f2a

COPY --from=restic /usr/bin/restic /usr/local/bin/restic

COPY --chmod=755 scripts/deploy/backup-loop.sh /usr/local/bin/backup-loop

ENV HOME=/tmp
ENV RESTIC_CACHE_DIR=/tmp/restic-cache

USER 1000:1000
ENTRYPOINT ["/usr/local/bin/backup-loop"]
