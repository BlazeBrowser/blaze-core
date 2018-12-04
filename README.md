# Blaze core
Core engine for the Blaze browser for macOS, Windows, Linux. Blaze is based on Electron and is designed to be extremely fast.

## Build from source
Building from source requires Node. If you’re on Linux (and in some cases macOS), you’ll also need libtool, m4, and automake (Unchecked).

### debian/ubuntu
```
sudo apt-get install libtool m4 make g++
```
### fedora
```
sudo dnf install libtool m4 make gcc-c++
```

Clone the core source from GitHub, install the dependencies, and run the build with electron-forge.

```
git clone https://github.com/BlazeBrowser/blaze-core.git
cd blaze-core
npm install
electron-forge start
```

If it fails to start you might need to install electron-forge.

```
npm install electron-forge
```
