from __future__ import annotations

import logging
import re
from concurrent.futures import Future
from concurrent.futures import ThreadPoolExecutor
from concurrent.futures import as_completed
from dataclasses import dataclass
from dataclasses import field
from enum import Enum
from pathlib import Path
from time import monotonic
from time import sleep
from typing import Any
from typing import Callable
from typing import Dict
from typing import NamedTuple
from typing import Optional
from typing import Tuple
from uuid import UUID

import boto3.s3.transfer
import botocore.config
import httpx
from botocore.exceptions import ClientError

from kleinkram.api.client import AuthenticatedClient
from kleinkram.config import get_config
from kleinkram.errors import AccessDenied
from kleinkram.errors import InsufficientStorageError
from kleinkram.models import File
from kleinkram.models import FileState
from kleinkram.utils import b64_md5
from kleinkram.utils import format_traceback
from kleinkram.utils import retry

logger = logging.getLogger(__name__)

UPLOAD_CREDS = "/files/temporaryAccess"
UPLOAD_CONFIRM = "/files/upload/confirm"
UPLOAD_CANCEL = "/files/uploads"
