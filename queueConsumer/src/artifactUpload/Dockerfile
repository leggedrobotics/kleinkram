FROM python:3.9-slim

ENV PYTHONUNBUFFERED=1
WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Run the S3 upload script
CMD ["python", "upload_artifacts.py"]
