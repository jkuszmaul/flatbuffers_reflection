#!/bin/bash

# Perform runfile initialization here so that child processes have a proper
# RUNFILES_DIR variable set.

# --- begin runfiles.bash initialization v2 ---
# Copy-pasted from the Bazel Bash runfiles library v2.
set -uo pipefail; f=bazel_tools/tools/bash/runfiles/runfiles.bash
source "${RUNFILES_DIR:-/dev/null}/$f" 2>/dev/null || \
  source "$(grep -sm1 "^$f " "${RUNFILES_MANIFEST_FILE:-/dev/null}" | cut -f2- -d' ')" 2>/dev/null || \
  source "$0.runfiles/$f" 2>/dev/null || \
  source "$(grep -sm1 "^$f " "$0.runfiles_manifest" | cut -f2- -d' ')" 2>/dev/null || \
  source "$(grep -sm1 "^$f " "$0.exe.runfiles_manifest" | cut -f2- -d' ')" 2>/dev/null || \
  { echo>&2 "ERROR: cannot find $f"; exit 1; }; f=; set -e
# --- end runfiles.bash initialization v2 ---

external/com_github_google_flatbuffers/flatc --ts --ts-no-import-ext -o ${BUILD_WORKSPACE_DIRECTORY}/src/test/ src/ByteVector.fbs
external/com_github_google_flatbuffers/flatc --binary --schema -o ${BUILD_WORKSPACE_DIRECTORY}/src/test/ src/ByteVector.fbs

# TODO(jkuszmaul): Also codegen the reflection typescript code (I'm currently
# avoiding this because I want to fix some upstream flatbuffers bazel rules).

# Subtle diffs in the .bfbs files will be hard to track; so long as the
# generated typescript is stable, we are probably fine.
cd ${BUILD_WORKSPACE_DIRECTORY}
git diff --exit-code -- ':!*.bfbs'
