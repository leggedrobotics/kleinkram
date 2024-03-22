from typing import Any

from fastapi import FastAPI, HTTPException, File, UploadFile
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
import tempfile
import subprocess

app = FastAPI()
origins = [
    "*",  # REMOVE for production
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
@app.post("/newBag")
async def upload_bag(file: UploadFile = File(...)) -> Any:
    if not file.filename.endswith('.bag'):
        raise HTTPException(status_code=400, detail="Invalid file type. Please upload a ROS bag file.")
    with tempfile.NamedTemporaryFile(delete=False, suffix=".bag") as temp_file:
        contents = await file.read()
        temp_file.write(contents)
        temp_file_path = temp_file.name
        mcap_path = temp_file_path.replace(".bag", ".mcap")
        cmd = ["mcap", "convert", temp_file_path, mcap_path]
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode != 0:
            raise HTTPException(status_code=500, detail="Conversion failed: " + result.stderr)
        print(mcap_path)
            # Define a generator to read the .mcap file in chunks
        def mcap_file_generator():
            with open(mcap_path, "rb") as mcap_file:
                yield from mcap_file  # Stream the file back to the client

        # Create a StreamingResponse to send the .mcap file to the client
        response = StreamingResponse(mcap_file_generator(), media_type="application/octet-stream")
        response.headers[
            "Content-Disposition"] = f"attachment; filename={file.filename.replace('.bag', '.mcap')}"

        return response


