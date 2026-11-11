# CI passes a kleinkram wheel built from the same commit as the
# `kleinkram-wheel` build context. Built without it, this stage is empty and
# kleinkram is installed from PyPI.
FROM scratch AS kleinkram-wheel

FROM python:3.11-slim

ARG KLEINKRAM_VERSION

# Install the fixed dependency set (including kleinkram)
COPY requirements.txt /requirements.txt
RUN --mount=type=bind,from=kleinkram-wheel,target=/kleinkram-wheel \
    pip install --no-cache-dir -r /requirements.txt $(ls /kleinkram-wheel/*.whl 2>/dev/null) && \
    if [ -n "$KLEINKRAM_VERSION" ]; then pip install --no-cache-dir kleinkram==$KLEINKRAM_VERSION; fi

# Copy the runner that fetches and executes the submitted script
COPY ./run_script.py /run_script.py

# The submitted script is not in this image; the runner downloads it from
# KLEINKRAM_SCRIPT_URL on startup.
ENTRYPOINT ["python3", "/run_script.py"]
