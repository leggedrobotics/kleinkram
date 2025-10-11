"""
Tests for zstd compression support in kleinkram CLI.

Why only zstd?
- 5-10x faster than gzip/bzip2
- Excellent compression ratios
- Industry standard for ROS bags
"""

from __future__ import annotations

import tempfile
from pathlib import Path

import pytest

from kleinkram import compression, utils


class TestCompressionDetection:
    """Test zstd compression detection."""

    def test_detect_zst(self):
        assert compression.detect_compression(Path("file.mcap.zst")) == compression.CompressionType.ZSTD

    def test_detect_zstd(self):
        assert compression.detect_compression(Path("file.bag.zstd")) == compression.CompressionType.ZSTD

    def test_detect_no_compression(self):
        assert compression.detect_compression(Path("file.mcap")) is None
        assert compression.detect_compression(Path("file.bag")) is None

    def test_case_insensitive(self):
        assert compression.detect_compression(Path("file.MCAP.ZST")) == compression.CompressionType.ZSTD
        assert compression.detect_compression(Path("file.Bag.ZSTD")) == compression.CompressionType.ZSTD


class TestUncompressedName:
    """Test getting uncompressed filenames."""

    def test_remove_zst(self):
        assert compression.get_uncompressed_name(Path("data.mcap.zst")) == "data.mcap"

    def test_remove_zstd(self):
        assert compression.get_uncompressed_name(Path("data.bag.zstd")) == "data.bag"

    def test_no_compression(self):
        assert compression.get_uncompressed_name(Path("data.mcap")) == "data.mcap"

    def test_complex_name(self):
        assert compression.get_uncompressed_name(Path("my_data_2024.mcap.zst")) == "my_data_2024.mcap"


class TestFileValidation:
    """Test that zstd-compressed files pass validation."""

    def test_check_file_path_compressed(self):
        """Test that zstd-compressed files with valid base types are accepted."""
        # Create temporary compressed file
        with tempfile.NamedTemporaryFile(suffix=".mcap.zst", delete=False) as f:
            temp_path = Path(f.name)

        try:
            # Should not raise an exception
            utils.check_file_path(temp_path)
        finally:
            temp_path.unlink()

    def test_get_filename_strips_compression(self):
        """Test that get_filename removes zstd compression extension."""
        assert utils.get_filename(Path("data.mcap.zst")) == "data.mcap"
        assert utils.get_filename(Path("data.bag.zstd")) == "data.bag"
        assert utils.get_filename(Path("data.mcap")) == "data.mcap"

    def test_sanitize_compressed_filename(self):
        """Test filename sanitization works with zstd-compressed files."""
        # Spaces should be replaced with underscores
        assert utils.get_filename(Path("my data.mcap.zst")) == "my_data.mcap"
        assert utils.get_filename(Path("test_file.bag.zstd")) == "test_file.bag"


class TestCompressionExtensionsInUtils:
    """Test that COMPRESSION_EXTENSIONS is available in utils module."""

    def test_compression_extensions_defined(self):
        assert hasattr(utils, 'COMPRESSION_EXTENSIONS')
        assert isinstance(utils.COMPRESSION_EXTENSIONS, list)
        assert '.zst' in utils.COMPRESSION_EXTENSIONS
        assert '.zstd' in utils.COMPRESSION_EXTENSIONS


# Integration-style tests that would require actual compression/decompression
# are marked as slow and require the zstandard library

@pytest.mark.slow
class TestActualDecompression:
    """Tests that actually compress and decompress files."""

    def test_decompress_zstd_roundtrip(self):
        """Test compressing and decompressing a file."""
        pytest.importorskip("zstandard")
        import zstandard as zstd

        # Create a test file
        with tempfile.NamedTemporaryFile(mode='w', suffix=".mcap", delete=False) as f:
            f.write("test data" * 1000)
            original_path = Path(f.name)

        # Compress it
        compressed_path = original_path.with_suffix(original_path.suffix + ".zst")
        cctx = zstd.ZstdCompressor()
        with open(original_path, 'rb') as ifh, open(compressed_path, 'wb') as ofh:
            cctx.copy_stream(ifh, ofh)

        try:
            # Decompress using our function
            decompressed_path = compression.decompress_file(compressed_path, verbose=False)

            # Verify contents match
            assert decompressed_path.read_text() == original_path.read_text()
            assert decompressed_path.name == original_path.name

            # Cleanup decompressed file and its temp directory
            decompressed_path.unlink()
            decompressed_path.parent.rmdir()
        finally:
            original_path.unlink()
            if compressed_path.exists():
                compressed_path.unlink()

    def test_decompress_files_unique_paths(self):
        """Compressed files with shared names decompress into distinct paths."""
        pytest.importorskip("zstandard")
        import zstandard as zstd

        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)

            first_original = root / "foo" / "data.mcap"
            first_original.parent.mkdir(parents=True, exist_ok=True)
            first_original.write_text("foo contents")
            first_compressed = first_original.with_suffix(first_original.suffix + ".zst")

            second_original = root / "bar" / "data.mcap"
            second_original.parent.mkdir(parents=True, exist_ok=True)
            second_original.write_text("bar contents")
            second_compressed = second_original.with_suffix(
                second_original.suffix + ".zst"
            )

            cctx = zstd.ZstdCompressor()
            with open(first_original, "rb") as src, open(first_compressed, "wb") as dst:
                cctx.copy_stream(src, dst)
            with open(second_original, "rb") as src, open(second_compressed, "wb") as dst:
                cctx.copy_stream(src, dst)

            mapping, temp_dir = compression.decompress_files(
                [first_compressed, second_compressed]
            )

            try:
                first_decompressed = mapping[first_compressed]
                second_decompressed = mapping[second_compressed]

                assert first_decompressed != second_decompressed
                assert first_decompressed.name == "data.mcap"
                assert second_decompressed.name == "data.mcap"
                assert first_decompressed.read_text() == first_original.read_text()
                assert second_decompressed.read_text() == second_original.read_text()
            finally:
                compression.cleanup_temp_dir(temp_dir)
