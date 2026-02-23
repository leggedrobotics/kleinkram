FROM python:3.10-slim

ARG KLEINKRAM_VERSION

# Install Kleinkram CLI
RUN pip install kleinkram${KLEINKRAM_VERSION:+==$KLEINKRAM_VERSION}

# Copy entrypoint script and make it executable
COPY ./entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
