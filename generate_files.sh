#!/bin/bash

set -eo pipefail

flatc_version="24.3.25"
expected_flatc_version_output="flatc version $flatc_version"

# Detect whether an installed flatc is usable or download it if requested.
flatc_executable=$(command -v flatc || echo "")
if [[ -n "$flatc_executable" ]] && [[ $(flatc --version) = "$expected_flatc_version_output" ]]; then
  echo "Using preinstalled flatc $flatc_version from \$PATH."
elif [[ -n "$flatc_executable" ]] && [[ -z "$DOWNLOAD_FLATC" ]]; then
  echo "Files have been generated with flatc $flatc_version; you have $(flatc --version)."
  echo "Please install the correct version or set DOWNLOAD_FLATC=<platform> to download it."
  exit 1
else
  case "$DOWNLOAD_FLATC" in
    "")
      echo "flatc $flatc_version is not installed. Install flatc or set DOWNLOAD_FLATC=<platform> to download it."
      exit 1
      ;;
    linux)
      flatc_artifact_name=Linux.flatc.binary.clang++-15.zip
      ;;
    mac)
      flatc_artifact_name=Mac.flatc.binary.zip
      ;;
    *)
      echo "Unsupported platform $DOWNLOAD_FLATC. Install flatc manually to continue."
      exit 1
  esac
  flatc_url="https://github.com/google/flatbuffers/releases/download/v$flatc_version/$flatc_artifact_name"
  echo "Downloading $flatc_url..."
  mkdir -p tmp
  curl -sL -o tmp/flatc.zip "$flatc_url"
  unzip -o -d tmp tmp/flatc.zip
  flatc_executable="tmp/flatc"
fi

"$flatc_executable" --version

echo "Downloading reflection.fbs..."
rm -rf src/vendor
mkdir -p src/vendor
curl -sL -o src/vendor/reflection.fbs "https://raw.githubusercontent.com/google/flatbuffers/refs/tags/v$flatc_version/reflection/reflection.fbs"

rm -rf src/vendor/gen
"$flatc_executable" --ts --ts-no-import-ext --gen-object-api -o src/vendor/gen src/vendor/*.fbs
"$flatc_executable" --binary --schema -o src/vendor/gen src/vendor/*.fbs

rm -rf src/test/gen
"$flatc_executable" --ts --ts-no-import-ext --gen-object-api -o src/test/gen src/test/*.fbs
"$flatc_executable" --binary --schema -o src/test/gen src/test/*.fbs

rm -rf tmp
