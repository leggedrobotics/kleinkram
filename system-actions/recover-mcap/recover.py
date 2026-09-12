import os
import subprocess
import sys
from pathlib import Path


def main():
    api_key = os.environ.get("KLEINKRAM_API_KEY")
    mission_uuid = os.environ.get("KLEINKRAM_MISSION_UUID")
    file_uuid = os.environ.get("KLEINKRAM_FILE_UUID")
    api_endpoint = os.environ.get("KLEINKRAM_API_ENDPOINT")

    if not api_key:
        print("Error: KLEINKRAM_API_KEY environment variable is required", file=sys.stderr)
        sys.exit(1)
    if not mission_uuid:
        print("Error: KLEINKRAM_MISSION_UUID environment variable is required", file=sys.stderr)
        sys.exit(1)

    # Configure endpoint if provided
    if api_endpoint:
        subprocess.run(["klein", "config", "set", "endpoint.api", api_endpoint], check=False)

    # Login
    print("Logging into Kleinkram...")
    subprocess.run(["klein", "login", "--key", api_key], check=True)

    input_dir = Path("/data/input")
    output_dir = Path("/data/output")
    input_dir.mkdir(parents=True, exist_ok=True)
    output_dir.mkdir(parents=True, exist_ok=True)

    print(f"Starting recovery for mission {mission_uuid} (file: {file_uuid or 'all corrupted'})")

    # Download corrupted files
    download_cmd = [
        "klein",
        "download",
        "--dest",
        str(input_dir),
        "--include-corrupt-files",
        "--allow-corrupt",
        "--create-dirs",
        "--overwrite",
    ]
    if file_uuid:
        download_cmd.extend(["-f", file_uuid])
    else:
        download_cmd.extend(["-m", mission_uuid])

    try:
        subprocess.run(download_cmd, check=True)
    except subprocess.CalledProcessError as e:
        print(f"Download failed: {e}", file=sys.stderr)
        sys.exit(1)

    mcap_files = list(input_dir.rglob("*.mcap"))
    if not mcap_files:
        print("No MCAP files found to recover.")
        return

    for mcap_file in mcap_files:
        print(f"Processing {mcap_file.name}...")

        # Run mcap doctor to inspect input
        print("--- Running mcap doctor on input file ---")
        subprocess.run(["mcap", "doctor", str(mcap_file)], check=False)

        recovered_name = f"recovered_{mcap_file.name}"
        recovered_path = output_dir / recovered_name

        # Run mcap recover
        print(f"--- Recovering to {recovered_name} ---")
        recover_cmd = ["mcap", "recover", "-o", str(recovered_path), str(mcap_file)]
        recover_result = subprocess.run(recover_cmd)

        if recover_result.returncode != 0 or not recovered_path.exists() or recovered_path.stat().st_size == 0:
            print(f"mcap recover failed for {mcap_file.name}", file=sys.stderr)
            continue

        # Run mcap doctor on recovered file
        print("--- Running mcap doctor on recovered file ---")
        subprocess.run(["mcap", "doctor", str(recovered_path)], check=False)

        # Upload recovered file and link to parent
        print(f"--- Uploading recovered file {recovered_name} ---")
        upload_cmd = [
            "klein",
            "upload",
            str(recovered_path),
            "-m",
            mission_uuid,
        ]
        if file_uuid:
            upload_cmd.extend(["--parent", file_uuid])

        upload_result = subprocess.run(upload_cmd)
        if upload_result.returncode != 0:
            print(f"Failed to upload recovered file {recovered_name}", file=sys.stderr)
            sys.exit(upload_result.returncode)

        print(f"Successfully recovered and uploaded {recovered_name}")


if __name__ == "__main__":
    main()
