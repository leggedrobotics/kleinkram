"""
Compression support for kleinkram CLI.

Handles transparent decompression of zstd-compressed rosbag files during upload.

Why only zstd?
- 5-10x faster decompression than gzip/bzip2
- Excellent compression ratios (similar to bzip2)
- Industry standard for ROS bags and large data files
- Tunable compression levels for speed/size tradeoff
"""

from __future__ import annotations

import logging
import shutil
import tempfile
from enum import Enum
from pathlib import Path
from typing import Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)


class CompressionType(Enum):
    """Supported compression types."""
    ZSTD = "zstd"


# Map file extensions to compression types
COMPRESSION_EXTENSIONS: Dict[str, CompressionType] = {
    ".zst": CompressionType.ZSTD,
    ".zstd": CompressionType.ZSTD,
}


def detect_compression(path: Path) -> Optional[CompressionType]:
    """
    Detect if a file is compressed based on its extension.

    Args:
        path: Path to the file

    Returns:
        CompressionType if compressed, None otherwise

    Examples:
        >>> detect_compression(Path("data.mcap.zst"))
        CompressionType.ZSTD
        >>> detect_compression(Path("data.mcap"))
        None
    """
    # Check if the last suffix is a compression extension
    suffix = path.suffix.lower()
    return COMPRESSION_EXTENSIONS.get(suffix)


def get_uncompressed_name(path: Path) -> str:
    """
    Get the uncompressed filename by removing compression extension.

    Args:
        path: Path to compressed file

    Returns:
        Filename without compression extension

    Examples:
        >>> get_uncompressed_name(Path("data.mcap.zst"))
        "data.mcap"
        >>> get_uncompressed_name(Path("data.bag.gz"))
        "data.bag"
    """
    compression_type = detect_compression(path)
    if compression_type is None:
        return path.name

    # Remove compression extension
    return path.stem


def decompress_zstd(input_path: Path, output_path: Path) -> None:
    """
    Decompress a zstd-compressed file.

    Args:
        input_path: Path to compressed file
        output_path: Path where decompressed file will be written

    Raises:
        ImportError: If zstandard library is not installed
        Exception: If decompression fails
    """
    try:
        import zstandard as zstd
    except ImportError:
        raise ImportError(
            "zstandard library is required for .zst files. "
            "Install with: pip install zstandard"
        )

    dctx = zstd.ZstdDecompressor()
    with open(input_path, "rb") as ifh, open(output_path, "wb") as ofh:
        dctx.copy_stream(ifh, ofh)


def decompress_file(
    input_path: Path,
    output_dir: Optional[Path] = None,
    *,
    verbose: bool = False,
) -> Path:
    """
    Decompress a compressed file to a temporary location.

    Args:
        input_path: Path to compressed file
        output_dir: Directory for decompressed file (temp dir if None)
        verbose: Whether to print progress messages

    Returns:
        Path to decompressed file

    Raises:
        ValueError: If compression type is not supported or file is not compressed
        Exception: If decompression fails
    """
    compression_type = detect_compression(input_path)
    if compression_type is None:
        raise ValueError(f"File is not compressed: {input_path}")

    # Create output path
    if output_dir is None:
        output_dir = Path(tempfile.mkdtemp(prefix="kleinkram_decompress_"))
    else:
        output_dir.mkdir(parents=True, exist_ok=True)

    uncompressed_name = get_uncompressed_name(input_path)
    output_path = output_dir / uncompressed_name

    if verbose:
        logger.info(f"Decompressing {input_path} to {output_path}")

    # Decompress (only zstd supported)
    try:
        if compression_type == CompressionType.ZSTD:
            decompress_zstd(input_path, output_path)
        else:
            raise ValueError(f"Unsupported compression type: {compression_type}")
    except Exception as e:
        logger.error(f"Failed to decompress {input_path}: {e}")
        # Clean up partial output file
        if output_path.exists():
            output_path.unlink()
        raise

    if verbose:
        input_size = input_path.stat().st_size
        output_size = output_path.stat().st_size
        ratio = output_size / input_size if input_size > 0 else 0
        logger.info(
            f"Decompressed {input_size:,} bytes to {output_size:,} bytes "
            f"(ratio: {ratio:.2f}x)"
        )

    return output_path


def decompress_files(
    paths: List[Path],
    *,
    verbose: bool = False,
) -> Tuple[Dict[Path, Path], Path]:
    """
    Decompress multiple files to a temporary directory.

    Args:
        paths: List of file paths (compressed or uncompressed)
        verbose: Whether to print progress messages

    Returns:
        Tuple of (mapping from original path to decompressed path, temp directory)
        Uncompressed files are mapped to themselves.

    Example:
        >>> paths = [Path("a.mcap.zst"), Path("b.mcap")]
        >>> mapping, temp_dir = decompress_files(paths)
        >>> # mapping = {
        >>> #   Path("a.mcap.zst"): Path("/tmp/kleinkram.../a.mcap"),
        >>> #   Path("b.mcap"): Path("b.mcap")
        >>> # }
    """
    temp_dir = Path(tempfile.mkdtemp(prefix="kleinkram_decompress_"))
    mapping: Dict[Path, Path] = {}

    for path in paths:
        compression_type = detect_compression(path)
        if compression_type is not None:
            # Decompress to temp dir
            try:
                per_file_temp_dir = Path(
                    tempfile.mkdtemp(prefix="file_", dir=str(temp_dir))
                )
                decompressed_path = decompress_file(
                    path, output_dir=per_file_temp_dir, verbose=verbose
                )
                mapping[path] = decompressed_path
            except Exception as e:
                # Clean up temp dir on error
                cleanup_temp_dir(temp_dir)
                raise RuntimeError(
                    f"Failed to decompress {path}: {e}"
                ) from e
        else:
            # File is not compressed, use as-is
            mapping[path] = path

    return mapping, temp_dir


def cleanup_temp_dir(temp_dir: Path) -> None:
    """
    Clean up temporary decompression directory.

    Args:
        temp_dir: Path to temporary directory
    """
    if temp_dir.exists() and temp_dir.is_dir():
        try:
            shutil.rmtree(temp_dir)
            logger.debug(f"Cleaned up temp directory: {temp_dir}")
        except Exception as e:
            logger.warning(f"Failed to clean up temp directory {temp_dir}: {e}")
