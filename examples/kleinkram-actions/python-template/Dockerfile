FROM python:3.9-slim

# Install user requirements (including kleinkram)
COPY requirements.txt /requirements.txt
RUN pip install -r /requirements.txt

# Copy script
COPY ./main.py /main.py

# Set entrypoint to python script
ENTRYPOINT ["python3", "/main.py"]
