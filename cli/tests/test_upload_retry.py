from __future__ import annotations

from pathlib import Path
from unittest.mock import patch

import pytest

import kleinkram.api.file_transfer as ft
from kleinkram.api.client import AuthenticatedClient
from kleinkram.api.file_transfer import UploadState
from kleinkram.api.file_transfer import upload_file


@pytest.mark.slow
def test_upload_file_retries_on_s3_error(mission, tmp_path):

    # Create a temporary file
    test_file = tmp_path / "test_retry.yaml"
    test_file.write_text("Hello World for Retry Test")

    client = AuthenticatedClient()

    call_count = {"count": 0}
    original_s3_upload = ft._s3_upload

    def mock_s3_upload(*args, **kwargs):
        if call_count["count"] == 0:
            call_count["count"] += 1
            raise RuntimeError("Simulated S3 Upload Error on first attempt")
        else:
            call_count["count"] += 1
            return original_s3_upload(*args, **kwargs)

    with patch("kleinkram.api.file_transfer._s3_upload", side_effect=mock_s3_upload):
        with patch("kleinkram.api.file_transfer._cancel_file_upload", wraps=ft._cancel_file_upload) as mocked_cancel:
            state, size = upload_file(client=client, mission_id=mission.id, filename=test_file.name, path=test_file)
            assert state == UploadState.UPLOADED
            assert size == len("Hello World for Retry Test")

            assert call_count["count"] == 2
            mocked_cancel.assert_called_once()


@pytest.mark.slow
def test_upload_file_aborts_on_cancellation_error(mission, tmp_path):
    # Create a temporary file
    test_file = tmp_path / "test_retry_abort.yaml"
    test_file.write_text("Hello World for Retry Abort Test")

    client = AuthenticatedClient()

    # Simulate S3 upload failure
    def mock_s3_upload(*args, **kwargs):
        raise RuntimeError("Simulated S3 Upload Error")

    # Simulate cancel upload failure
    def mock_cancel_upload(*args, **kwargs):
        raise RuntimeError("Simulated Cancellation Error")

    with patch("kleinkram.api.file_transfer._s3_upload", side_effect=mock_s3_upload):
        with patch("kleinkram.api.file_transfer._cancel_file_upload", side_effect=mock_cancel_upload) as mocked_cancel:
            with pytest.raises(RuntimeError) as exc_info:
                upload_file(client=client, mission_id=mission.id, filename=test_file.name, path=test_file)

            # The exception should wrap the cancellation error and abort immediately
            assert "cancellation failed" in str(exc_info.value)
            mocked_cancel.assert_called_once()


@pytest.mark.slow
def test_upload_file_fails_on_insufficient_storage(mission, tmp_path):
    from httpx import Response

    from kleinkram.errors import InsufficientStorageError

    # Create a temporary file
    test_file = tmp_path / "test_insufficient_storage.yaml"
    test_file.write_text("Hello World for Storage Test")

    client = AuthenticatedClient()

    # Mock client.post to return 507 when requesting credentials
    mock_response = Response(status_code=507)

    with patch.object(client, "post", return_value=mock_response) as mock_post:
        with pytest.raises(InsufficientStorageError) as exc_info:
            upload_file(client=client, mission_id=mission.id, filename=test_file.name, path=test_file)

        assert "Insufficient storage space on the server" in str(exc_info.value)
        mock_post.assert_called_once()
