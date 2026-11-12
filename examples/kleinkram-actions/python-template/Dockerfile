# CI passes a kleinkram wheel built from the same commit as the
# `kleinkram-wheel` build context. Built without it, this stage is empty and
# kleinkram is installed from PyPI.
FROM scratch AS kleinkram-wheel

FROM python:3.10-slim

ARG KLEINKRAM_VERSION

# Install user requirements (including kleinkram)
COPY requirements.txt /requirements.txt
RUN --mount=type=bind,from=kleinkram-wheel,target=/kleinkram-wheel \
    pip install -r /requirements.txt $(ls /kleinkram-wheel/*.whl 2>/dev/null) && \
    if [ -n "$KLEINKRAM_VERSION" ]; then pip install kleinkram==$KLEINKRAM_VERSION; fi

# Copy script
COPY ./main.py /main.py

# Set entrypoint to python script
ENTRYPOINT ["python3", "/main.py"]
