# WSL Setup for Android Gradle Build

## Prerequisites

### 1. Install Java (JDK 17)
```bash
sudo apt update
sudo apt install openjdk-17-jdk -y
```

Verify installation:
```bash
java -version
```

### 2. Set JAVA_HOME
```bash
echo 'export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64' >> ~/.bashrc
echo 'export PATH=$JAVA_HOME/bin:$PATH' >> ~/.bashrc
source ~/.bashrc
```

Verify:
```bash
echo $JAVA_HOME
```

### 3. Install Android SDK (Optional - if needed)
```bash
# Download command-line tools from https://developer.android.com/studio#command-tools
# Or use existing Android SDK from Windows
export ANDROID_HOME=/mnt/c/Users/YOUR_USERNAME/AppData/Local/Android/Sdk
export PATH=$ANDROID_HOME/platform-tools:$ANDROID_HOME/tools:$PATH
```

Add to ~/.bashrc:
```bash
echo 'export ANDROID_HOME=/mnt/c/Users/YOUR_USERNAME/AppData/Local/Android/Sdk' >> ~/.bashrc
echo 'export PATH=$ANDROID_HOME/platform-tools:$ANDROID_HOME/tools:$PATH' >> ~/.bashrc
source ~/.bashrc
```

## Build Commands

### Navigate to project
```bash
cd /mnt/c/@delta/db/@Convex/Cloud-Share
```

### Make gradlew executable
```bash
chmod +x gradlew
```

### Build APK (Optimized)
```bash
# First build
./gradlew assembleDebug --daemon --parallel --build-cache

# Subsequent builds (faster)
./gradlew assembleDebug --parallel --build-cache --offline
```

**Useful flags**:
- `--daemon` - Keep Gradle daemon running (faster builds)
- `--parallel` - Build modules in parallel
- `--build-cache` - Reuse previous build outputs
- `--offline` - Skip dependency checks
- `-x test` - Skip tests

**Check daemon status**:
```bash
./gradlew --status
```

**Stop daemon** (to free memory):
```bash
./gradlew --stop
```

## Troubleshooting

### 1. Line ending issues (CRLF → LF)
**Error**: `/usr/bin/env: 'sh\r': No such file or directory`

**Fix**:
```bash
sed -i 's/\r$//' gradlew
chmod +x gradlew
```

### 2. Missing gradle-wrapper.jar
**Error**: `Could not find or load main class org.gradle.wrapper.GradleWrapperMain`

**Fix**:
```bash
curl -L -o gradle/wrapper/gradle-wrapper.jar https://raw.githubusercontent.com/gradle/gradle/master/gradle/wrapper/gradle-wrapper.jar
```

### 3. SDK location not found
**Error**: `SDK location not found. Define a valid SDK location with an ANDROID_HOME`

**Fix**: Create `local.properties` in project root:
```bash
echo "sdk.dir=/mnt/c/Users/YOUR_USERNAME/AppData/Local/Android/Sdk" > local.properties
```

Replace `YOUR_USERNAME` with your actual Windows username.

### 4. Android SDK licenses not accepted
**Error**: `Failed to install the following Android SDK packages as some licences have not been accepted`

**Fix**:
```bash
SDK_PATH="/mnt/c/Users/YOUR_USERNAME/AppData/Local/Android/Sdk"
echo "24333f8a63b6825ea9c5514f83c2829b004d1fee" > $SDK_PATH/licenses/android-sdk-license
echo "d56f5187479451eabf01fb78af6dfcb131a6481e" >> $SDK_PATH/licenses/android-sdk-license
echo "84831b9409646a918e30573bab4c9c91346d8abd" > $SDK_PATH/licenses/android-sdk-preview-license
```

### 5. Permission denied on gradlew
```bash
chmod +x gradlew
```

### 6. Java version mismatch
```bash
sudo update-alternatives --config java
```

### 7. Gradle daemon issues
```bash
./gradlew --stop
./gradlew clean
```

## Quick Setup Script

Save this as `setup-wsl-gradle.sh`:
```bash
#!/bin/bash

# Install Java
sudo apt update
sudo apt install openjdk-17-jdk -y

# Set JAVA_HOME
echo 'export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64' >> ~/.bashrc
echo 'export PATH=$JAVA_HOME/bin:$PATH' >> ~/.bashrc

# Fix common Gradle issues
fix_gradle_project() {
    if [ -f "gradlew" ]; then
        echo "Fixing gradlew line endings..."
        sed -i 's/\r$//' gradlew
        chmod +x gradlew
    fi
    
    if [ ! -f "gradle/wrapper/gradle-wrapper.jar" ]; then
        echo "Downloading gradle-wrapper.jar..."
        curl -L -o gradle/wrapper/gradle-wrapper.jar https://raw.githubusercontent.com/gradle/gradle/master/gradle/wrapper/gradle-wrapper.jar
    fi
    
    if [ ! -f "local.properties" ]; then
        echo "Creating local.properties..."
        USERNAME=$(cmd.exe /c "echo %USERNAME%" 2>/dev/null | tr -d '\r')
        echo "sdk.dir=/mnt/c/Users/$USERNAME/AppData/Local/Android/Sdk" > local.properties
    fi
    
    # Accept Android SDK licenses
    SDK_PATH="/mnt/c/Users/$USERNAME/AppData/Local/Android/Sdk"
    if [ -d "$SDK_PATH" ]; then
        echo "Accepting Android SDK licenses..."
        mkdir -p "$SDK_PATH/licenses"
        echo "24333f8a63b6825ea9c5514f83c2829b004d1fee" > "$SDK_PATH/licenses/android-sdk-license"
        echo "d56f5187479451eabf01fb78af6dfcb131a6481e" >> "$SDK_PATH/licenses/android-sdk-license"
        echo "84831b9409646a918e30573bab4c9c91346d8abd" > "$SDK_PATH/licenses/android-sdk-preview-license"
    fi
}

source ~/.bashrc
echo "Setup complete! Run 'fix_gradle_project' in your project directory or restart terminal."
```

Run with:
```bash
chmod +x setup-wsl-gradle.sh
./setup-wsl-gradle.sh
```

**Quick fix for existing projects**:
```bash
# Fix line endings
sed -i 's/\r$//' gradlew && chmod +x gradlew

# Download wrapper if missing
[ ! -f gradle/wrapper/gradle-wrapper.jar ] && curl -L -o gradle/wrapper/gradle-wrapper.jar https://raw.githubusercontent.com/gradle/gradle/master/gradle/wrapper/gradle-wrapper.jar

# Create local.properties
echo "sdk.dir=/mnt/c/Users/$(cmd.exe /c "echo %USERNAME%" 2>/dev/null | tr -d '\r')/AppData/Local/Android/Sdk" > local.properties

# Accept licenses
SDK_PATH="/mnt/c/Users/$(cmd.exe /c "echo %USERNAME%" 2>/dev/null | tr -d '\r')/AppData/Local/Android/Sdk"
mkdir -p "$SDK_PATH/licenses"
echo "24333f8a63b6825ea9c5514f83c2829b004d1fee" > "$SDK_PATH/licenses/android-sdk-license"
echo "d56f5187479451eabf01fb78af6dfcb131a6481e" >> "$SDK_PATH/licenses/android-sdk-license"
echo "84831b9409646a918e30573bab4c9c91346d8abd" > "$SDK_PATH/licenses/android-sdk-preview-license"
```
