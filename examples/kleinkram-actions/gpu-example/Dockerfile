# CI passes a kleinkram wheel built from the same commit as the
# `kleinkram-wheel` build context. Built without it, this stage is empty and
# kleinkram is installed from PyPI.
FROM scratch AS kleinkram-wheel

FROM nvidia/cuda:12.6.3-base-ubuntu24.04

ENV DEBIAN_FRONTEND=noninteractive
ENV PIP_BREAK_SYSTEM_PACKAGES=1

# Install Python and PIP
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    && rm -rf /var/lib/apt/lists/*

RUN ln -s /usr/bin/python3 /usr/bin/python

ARG KLEINKRAM_VERSION

# Install Kleinkram CLI
RUN --mount=type=bind,from=kleinkram-wheel,target=/kleinkram-wheel \
    pip install $(ls /kleinkram-wheel/*.whl 2>/dev/null || echo kleinkram${KLEINKRAM_VERSION:+==$KLEINKRAM_VERSION})

# Copy scripts
COPY ./entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
