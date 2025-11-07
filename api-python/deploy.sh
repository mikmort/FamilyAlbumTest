#!/bin/bash

# Custom deployment script for Azure Functions Python with dlib
# This installs CMake before building dlib

echo "Installing CMake for dlib compilation..."
apt-get update
apt-get install -y cmake build-essential

echo "Installing Python packages..."
python -m pip install --upgrade pip
pip install -r requirements.txt

echo "Build complete!"
