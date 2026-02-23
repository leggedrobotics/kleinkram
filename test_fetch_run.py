import sys
import json
from kleinkram.api.client import client_from_env
from kleinkram.api.routes import get_run

client = client_from_env()
run_uuid = sys.argv[1]
try:
    resp = client.get(f"/actions/{run_uuid}")
    print(resp.json())
except Exception as e:
    print(e)
