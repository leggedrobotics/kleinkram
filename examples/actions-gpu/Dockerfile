# Use NVIDIA's CUDA base image with Python
FROM nvidia/cuda:11.8.0-cudnn8-devel-ubuntu22.04

# Set up environment variables for NVIDIA container toolkit
ENV PATH /usr/local/nvidia/bin:/usr/local/cuda/bin:${PATH}
ENV LD_LIBRARY_PATH /usr/local/cuda/lib64:${LD_LIBRARY_PATH}

# Install Python and other dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3-pip \
    python3-dev \
    && rm -rf /var/lib/apt/lists/*

# Set Python 3 as default
RUN update-alternatives --install /usr/bin/python python /usr/bin/python3 1

# Install kleinkram as CLI
RUN pip install --upgrade pip && \
    pip install kleinkram --pre --force-reinstall

# Install additional Python packages for GPU acceleration (e.g., TensorFlow or PyTorch)
# Uncomment the one you need or add your own:
# RUN pip install tensorflow-gpu
# RUN pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu118

# Copy entrypoint and make it executable
COPY ./entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Set entrypoint
ENTRYPOINT ["/entrypoint.sh"]