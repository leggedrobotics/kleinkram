from typing import Any

from fastapi import FastAPI, HTTPException, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
import tempfile
from bagpy import bagreader

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

        # Now that you have a file path, you can use bagreader
        b = bagreader(temp_file_path)
        topic_table = b.topic_table.to_dict()
        topic_table['start_time'] = b.start_time
        print(b.start_time)
        return topic_table


def convert