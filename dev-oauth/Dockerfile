# Use an official lightweight Python image
FROM python:3.10-slim

# Set the working directory
WORKDIR /app

# Install required dependencies
RUN pip install flask

# Copy the application files into the container
COPY . .

# Expose the port Flask runs on
EXPOSE 5000

# Command to run the Flask app
CMD ["python", "fake_oauth.py"]