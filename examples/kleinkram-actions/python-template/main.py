import os
import sys
import subprocess
import kleinkram

# This is a template script.
# You can modify this script to perform any processing on the data.
# The data is located in /data
# The output should be saved to /out

DATA_DIR = "/data"
OUTPUT_DIR = "/out"

def main():
    # Get mission UUID from environment
    mission_uuid = os.environ.get("KLEINKRAM_MISSION_UUID")
    if not mission_uuid:
        print("Error: KLEINKRAM_MISSION_UUID not set")
        return

    print(f"Starting Python Action for mission {mission_uuid}")
    subprocess.run(["klein", "--version"])

    # Download data
    # The client automatically picks up authentication from environment variables
    # (KLEINKRAM_API_KEY, KLEINKRAM_API_ENDPOINT)
    print("Downloading data...")
    os.makedirs(DATA_DIR, exist_ok=True)
    try:
        kleinkram.download(
            mission_ids=[mission_uuid],
            dest=DATA_DIR,
            verbose=True
        )
    except Exception as e:
        print(f"Error downloading data: {e}")
        return
    
    print(f"Processing data in {DATA_DIR}")
    
    # Example: List files
    files = os.listdir(DATA_DIR)
    print(f"Found {len(files)} files:")
    for f in files:
        print(f" - {f}")
        
    # Example: Create an output file
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    output_file = os.path.join(OUTPUT_DIR, "result.txt")
    with open(output_file, "w") as f:
        f.write("Processing complete!\n")
        f.write(f"Processed {len(files)} files.\n")
        
    print(f"Results saved to {output_file}")

if __name__ == "__main__":
    main()
