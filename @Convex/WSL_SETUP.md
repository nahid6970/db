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

### Build APK
```bash
./gradlew assembleDebug
```

## Troubleshooting

### Permission denied on gradlew
```bash
chmod +x gradlew
```

### Java version mismatch
```bash
sudo update-alternatives --config java
```

### Gradle daemon issues
```bash
./gradlew --stop
./gradlew clean
```

## Quick Setup Script

Save this as `setup-wsl-gradle.sh`:
```bash
#!/bin/bash
sudo apt update
sudo apt install openjdk-17-jdk -y
echo 'export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64' >> ~/.bashrc
echo 'export PATH=$JAVA_HOME/bin:$PATH' >> ~/.bashrc
source ~/.bashrc
echo "Setup complete! Restart terminal or run: source ~/.bashrc"
```

Run with:
```bash
chmod +x setup-wsl-gradle.sh
./setup-wsl-gradle.sh
```
