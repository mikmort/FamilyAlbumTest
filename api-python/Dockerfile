# Use the official Azure Functions Python 3.10 base image
FROM mcr.microsoft.com/azure-functions/python:4-python3.10

# Install system dependencies required for dlib
RUN apt-get update && \
    apt-get install -y \
    cmake \
    build-essential \
    libopenblas-dev \
    liblapack-dev \
    && rm -rf /var/lib/apt/lists/*

# Set the working directory
ENV AzureWebJobsScriptRoot=/home/site/wwwroot \
    AzureFunctionsJobHost__Logging__Console__IsEnabled=true

# Copy the function app files
COPY . /home/site/wwwroot

# Install Python dependencies
WORKDIR /home/site/wwwroot
RUN pip install --no-cache-dir -r requirements.txt

# The base image already sets up the correct entry point
