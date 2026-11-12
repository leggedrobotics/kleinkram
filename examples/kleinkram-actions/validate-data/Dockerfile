# CI passes a kleinkram wheel built from the same commit as the
# `kleinkram-wheel` build context. Built without it, this stage is empty and
# kleinkram is installed from PyPI.
FROM scratch AS kleinkram-wheel

FROM python:3.10-slim

ARG KLEINKRAM_VERSION

# Install Kleinkram CLI
RUN --mount=type=bind,from=kleinkram-wheel,target=/kleinkram-wheel \
    pip install $(ls /kleinkram-wheel/*.whl 2>/dev/null || echo kleinkram${KLEINKRAM_VERSION:+==$KLEINKRAM_VERSION})

# Copy entrypoint script and make it executable
COPY ./entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
