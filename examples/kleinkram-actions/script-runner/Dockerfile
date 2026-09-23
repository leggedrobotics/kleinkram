FROM python:3.11-slim

ARG KLEINKRAM_VERSION

# Install the fixed dependency set (including kleinkram)
COPY requirements.txt /requirements.txt
RUN pip install --no-cache-dir -r /requirements.txt && \
    if [ -n "$KLEINKRAM_VERSION" ]; then pip install --no-cache-dir kleinkram==$KLEINKRAM_VERSION; fi

# Copy the runner that fetches and executes the submitted script
COPY ./run_script.py /run_script.py

# The submitted script is not in this image; the runner downloads it from
# KLEINKRAM_SCRIPT_URL on startup.
ENTRYPOINT ["python3", "/run_script.py"]
