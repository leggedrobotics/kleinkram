from __future__ import annotations

import secrets
from pathlib import Path

import boto3
import tqdm

BUCKET_NAME = "upload-test"
ENDPOINT_URL = "https://minio.datasets.dev.leggedrobotics.com"
ACCESS_KEY = ""
SECRET_KEY = ""
LARGE_FILE = Path(__file__).parent.parent / "data" / "large.bag"


for _ in tqdm.tqdm(range(100)):
    with tqdm.tqdm(total=LARGE_FILE.stat().st_size, unit="B", unit_scale=True) as pbar:
        name = secrets.token_hex(16)
        pbar.write(f"Uploading {LARGE_FILE} to {BUCKET_NAME}/{name}")

        client = boto3.client(
            "s3",
            endpoint_url=ENDPOINT_URL,
            aws_access_key_id=ACCESS_KEY,
            aws_secret_access_key=SECRET_KEY,
        )
        client.upload_file(
            str(LARGE_FILE),
            BUCKET_NAME,
            name,
            Callback=pbar.update,
        )
