FROM python:3.9-slim

ARG KLEINKRAM_VERSION

# Install Kleinkram CLI and mcap
RUN pip install kleinkram${KLEINKRAM_VERSION:+==$KLEINKRAM_VERSION} mcap

# Copy scripts
COPY ./entrypoint.sh /entrypoint.sh
COPY ./convert.py /convert.py
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
