FROM python:3.9-slim

# Install Kleinkram CLI
RUN pip install kleinkram

# Copy entrypoint script and make it executable
COPY ./entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
