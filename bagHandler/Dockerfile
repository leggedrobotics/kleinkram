# Dockerfile
FROM python:3.12

WORKDIR /usr/src/app

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
RUN wget https://github.com/foxglove/mcap/releases/download/releases%2Fmcap-cli%2Fv0.0.42/mcap-linux-amd64 -O /usr/local/bin/mcap \
    && chmod +x /usr/local/bin/mcap

COPY . .

CMD ["uvicorn", "api:app", "--host", "0.0.0.0", "--reload"]
