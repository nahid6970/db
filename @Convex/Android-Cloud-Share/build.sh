#!/bin/bash

echo "🔧 Setting up Android build environment..."

# Check if Java is installed
if ! command -v java &> /dev/null; then
    echo "Installing Java JDK 17..."
    sudo apt update
    sudo apt install -y openjdk-17-jdk
fi

# Set up Android SDK if not exists
if [ ! -d "$HOME/android-sdk" ]; then
    echo "📦 Downloading Android Command Line Tools..."
    cd ~
    wget -q https://dl.google.com/android/repository/commandlinetools-linux-9477386_latest.zip
    unzip -q commandlinetools-linux-9477386_latest.zip -d android-sdk
    rm commandlinetools-linux-9477386_latest.zip
    
    mkdir -p ~/android-sdk/cmdline-tools/latest
    mv ~/android-sdk/cmdline-tools/bin ~/android-sdk/cmdline-tools/latest/ 2>/dev/null || true
    mv ~/android-sdk/cmdline-tools/lib ~/android-sdk/cmdline-tools/latest/ 2>/dev/null || true
    
    echo "📥 Installing Android SDK components..."
    export ANDROID_HOME=~/android-sdk
    export PATH=$PATH:$ANDROID_HOME/cmdline-tools/latest/bin
    
    yes | sdkmanager --licenses
    sdkmanager "platform-tools" "platforms;android-34" "build-tools;34.0.0"
fi

# Export environment variables
export ANDROID_HOME=~/android-sdk
export PATH=$PATH:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools

echo "✅ Environment ready!"
echo ""
echo "🔨 Building APK..."

cd "$(dirname "$0")"
chmod +x gradlew
./gradlew assembleDebug

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Build successful!"
    echo "📱 APK location: app/build/outputs/apk/debug/app-debug.apk"
else
    echo ""
    echo "❌ Build failed!"
    exit 1
fi
