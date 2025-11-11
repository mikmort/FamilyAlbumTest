#!/bin/bash

# Script to install Azure Functions Core Tools v4
# This enables local development and testing with Azure Functions API

set -e

echo "🔧 Checking Azure Functions Core Tools installation..."
echo ""

# Check if func is already installed
if command -v func &> /dev/null; then
    FUNC_VERSION=$(func --version)
    echo "✅ Azure Functions Core Tools is already installed (version $FUNC_VERSION)"
    exit 0
fi

echo "📦 Azure Functions Core Tools not found. Installing..."
echo ""

# Detect OS
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    # Linux
    echo "🐧 Detected Linux"
    
    # Check if running on Ubuntu/Debian
    if [ -f /etc/debian_version ]; then
        echo "Installing via apt-get..."
        
        # Add Microsoft package repository
        curl -sL https://packages.microsoft.com/keys/microsoft.asc | \
            gpg --dearmor | \
            sudo tee /etc/apt/trusted.gpg.d/microsoft.gpg > /dev/null
        
        # Get Ubuntu version
        UBUNTU_VERSION=$(lsb_release -cs)
        echo "deb [arch=amd64] https://packages.microsoft.com/repos/microsoft-ubuntu-${UBUNTU_VERSION}-prod ${UBUNTU_VERSION} main" | \
            sudo tee /etc/apt/sources.list.d/dotnetdev.list
        
        # Install
        sudo apt-get update -qq
        sudo apt-get install -y azure-functions-core-tools-4
        
    else
        echo "⚠️  Non-Debian Linux detected. Please install manually:"
        echo "   https://docs.microsoft.com/azure/azure-functions/functions-run-local"
        exit 1
    fi
    
elif [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    echo "🍎 Detected macOS"
    
    # Check if brew is installed
    if ! command -v brew &> /dev/null; then
        echo "❌ Homebrew not found. Please install Homebrew first:"
        echo "   /bin/bash -c \"\$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\""
        exit 1
    fi
    
    echo "Installing via Homebrew..."
    brew tap azure/functions
    brew install azure-functions-core-tools@4
    
else
    echo "❌ Unsupported OS: $OSTYPE"
    echo "Please install Azure Functions Core Tools manually:"
    echo "   https://docs.microsoft.com/azure/azure-functions/functions-run-local"
    exit 1
fi

# Verify installation
if command -v func &> /dev/null; then
    FUNC_VERSION=$(func --version)
    echo ""
    echo "✅ Successfully installed Azure Functions Core Tools v$FUNC_VERSION"
    echo ""
    echo "🎯 Next steps:"
    echo "   1. Setup environment: npm run setup:env"
    echo "   2. Start API: npm run dev:api"
    echo "   3. Start full stack: npm run dev:full"
else
    echo ""
    echo "❌ Installation may have failed. Please verify manually:"
    echo "   func --version"
    exit 1
fi
