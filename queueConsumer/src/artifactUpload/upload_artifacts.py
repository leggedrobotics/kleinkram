import os
import tarfile
import json
import boto3
from urllib.parse import urlparse
import botocore.config


def compress_directory(source_dir, output_filename):
    """Compresses the source directory into a .tar.gz file."""
    with tarfile.open(output_filename, "w:gz") as tar:
        # arcname ensures we don't store the full absolute path inside the tar
        tar.add(source_dir, arcname=os.path.basename(source_dir))
    return output_filename


def upload_to_storage(file_path, bucket_name, object_name):
    """Uploads the compressed file to S3-compatible storage."""
    # Initialize S3-compatible client
    # Ensure these ENVs are passed to the container
    endpoint_url = os.getenv("S3_ENDPOINT", "http://seaweedfs:9000")
    if not endpoint_url.startswith("http"):
        endpoint_url = f"http://{endpoint_url}"

    config = botocore.config.Config(
        retries={"max_attempts": 60},
        read_timeout=300,
    )

    service_client = boto3.client(
        "s3",
        endpoint_url=endpoint_url,
        aws_access_key_id=os.getenv("S3_ACCESS_KEY"),
        aws_secret_access_key=os.getenv("S3_SECRET_KEY"),
        region_name=os.getenv("S3_REGION", "us-east-1"),
        config=config,
    )

    # Upload
    try:
        service_client.upload_file(file_path, bucket_name, object_name)
        print(f"Successfully uploaded {object_name} to {bucket_name}")
    except Exception as e:
        print(f"Failed to upload {object_name} to {bucket_name}: {e}")
        raise


if __name__ == "__main__":
    # Configuration
    SOURCE_DIR = "/out"
    BUCKET_NAME = os.getenv("S3_ARTIFACTS_BUCKET_NAME", "action-artifacts")
    ACTION_UUID = os.getenv("KLEINKRAM_ACTION_UUID")

    if not ACTION_UUID:
        raise ValueError("KLEINKRAM_ACTION_UUID environment variable is not set.")

    # Define filenames
    tar_filename = f"/tmp/{ACTION_UUID}.tar.gz"

    # The name of the file in the bucket
    object_name = f"{ACTION_UUID}.tar.gz"

    if os.path.exists(SOURCE_DIR):
        print(f"Compressing {SOURCE_DIR}...")
        compress_directory(SOURCE_DIR, tar_filename)

        print(f"Uploading to S3 bucket: {BUCKET_NAME}...")
        upload_to_storage(tar_filename, BUCKET_NAME, object_name)

        # Get file size
        file_size = os.path.getsize(tar_filename)

        # Get file list
        files = []
        with tarfile.open(tar_filename, "r:gz") as tar:
            files = tar.getnames()

        metadata = {"size": file_size, "files": files}
        print(f"ARTIFACT_METADATA: {json.dumps(metadata)}", flush=True)

    else:
        print(f"Directory {SOURCE_DIR} does not exist, skipping upload.")
