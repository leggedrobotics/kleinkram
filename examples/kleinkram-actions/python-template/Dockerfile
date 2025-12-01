FROM python:3.9-slim

ARG KLEINKRAM_VERSION

# Install user requirements (including kleinkram)
COPY requirements.txt /requirements.txt
RUN pip install -r /requirements.txt && \
    if [ -n "$KLEINKRAM_VERSION" ]; then pip install kleinkram==$KLEINKRAM_VERSION; fi

# Copy script
COPY ./main.py /main.py

# Set entrypoint to python script
ENTRYPOINT ["python3", "/main.py"]
