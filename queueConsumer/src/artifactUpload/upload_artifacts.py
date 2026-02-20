import os
import tarfile
import json
from minio import Minio


def compress_directory(source_dir, output_filename):
    """Compresses the source directory into a .tar.gz file."""
    with tarfile.open(output_filename, "w:gz") as tar:
        # arcname ensures we don't store the full absolute path inside the tar
        tar.add(source_dir, arcname=os.path.basename(source_dir))
    return output_filename


def upload_to_minio(file_path, bucket_name, object_name):
    """Uploads the compressed file to MinIO."""
    # Initialize MinIO client
    # Ensure these ENVs are passed to the container
    client = Minio(
        endpoint=os.getenv("S3_ENDPOINT", "seaweedfs:9000"),
        access_key=os.getenv("S3_ACCESS_KEY"),
        secret_key=os.getenv("S3_SECRET_KEY"),
        secure=False,  # Set to True if using HTTPS inside the network
    )

    # Check if bucket exists
    if not client.bucket_exists(bucket_name=bucket_name):
        print(f"Bucket {bucket_name} does not exist. Please check configuration.")
        return

    # Upload
    client.fput_object(
        bucket_name=bucket_name,
        object_name=object_name,
        file_path=file_path,
        content_type="application/gzip",
    )
    print(f"Successfully uploaded {object_name} to {bucket_name}")


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

        print(f"Uploading to MinIO bucket: {BUCKET_NAME}...")
        upload_to_minio(tar_filename, BUCKET_NAME, object_name)

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
