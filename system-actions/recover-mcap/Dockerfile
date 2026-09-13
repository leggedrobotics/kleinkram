FROM python:3.10-slim

ARG KLEINKRAM_VERSION

# Install curl
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

# Install mcap CLI binary
ARG TARGETARCH
RUN case "${TARGETARCH}" in \
        "arm64") ARCH="arm64" ;; \
        *) ARCH="amd64" ;; \
    esac && \
    curl -L -o /usr/local/bin/mcap "https://github.com/foxglove/mcap/releases/download/releases/mcap-cli/v0.3.0/mcap-linux-${ARCH}" && \
    chmod +x /usr/local/bin/mcap

# Install Kleinkram CLI
RUN pip install --no-cache-dir kleinkram${KLEINKRAM_VERSION:+==$KLEINKRAM_VERSION}

# Copy scripts
COPY ./entrypoint.sh /entrypoint.sh
COPY ./recover.py /recover.py
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
