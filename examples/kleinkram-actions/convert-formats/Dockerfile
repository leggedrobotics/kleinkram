FROM python:3.9-slim

# Install Kleinkram CLI and mcap
RUN pip install kleinkram mcap

# Copy scripts
COPY ./entrypoint.sh /entrypoint.sh
COPY ./convert.py /convert.py
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
