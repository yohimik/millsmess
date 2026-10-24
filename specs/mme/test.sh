#!/bin/sh
# SPDX-License-Identifier: GPL-3.0-or-later
# Copyright (c) 2026 yohimik
set -eu

here=$(CDPATH='' cd -- "$(dirname "$0")" && pwd)
tmp=$(mktemp -d "${TMPDIR:-/tmp}/mme-spec-test.XXXXXX")
trap 'rm -rf "$tmp"' EXIT
trap 'exit 1' HUP INT TERM

fixture() {
  dir=$1
  version=$2
  mkdir -p "$dir"
  cp "$here/verify.sh" "$here/LICENSE" "$here/README.md" "$here/dispat.yaml" "$dir/"
  printf '%s\n' "$version" > "$dir/VERSION"
  cat > "$dir/SPEC.md" <<SPEC
# Mills Mess Engine specification

**Version:** $version **Status:** Draft for review
**License:** GPL-3.0-or-later. See [LICENSE](./LICENSE).

This document is Mills Mess Engine specification **$version**.

## Table of contents

- [1. Scope](#1-scope)

## 1. Scope

Example version 1.0.0 is not a normative declaration.
SPEC
}

# The real folder must verify as committed.
sh "$here/verify.sh"

# A consistent fixture verifies at any semantic version, including build metadata.
for version in 0.0.0 1.0.0 '1.0.0-rc.1' '1.0.0+build.01'; do
  fixture "$tmp/ok" "$version"
  (cd "$tmp/ok" && sh verify.sh)
done

# A planned release version that differs from VERSION fails the build gate.
fixture "$tmp/stale" 0.0.0
if (cd "$tmp/stale" && DISPAT_STAGE=build DISPAT_NEW_VERSION=0.1.0 sh verify.sh > /dev/null 2>&1); then
  echo "stale version unexpectedly verified" >&2
  exit 1
fi

# Malformed declarations, symlinks, dangling links and dangling TOC entries fail.
for problem in header symlink link toc; do
  fixture "$tmp/$problem" 0.0.0
  case "$problem" in
    header) sed 's/\*\*Version:\*\* 0.0.0 \*\*Status:\*\*/**Version:** 9.9.9 **Status:**/' "$tmp/$problem/SPEC.md" > "$tmp/$problem/SPEC.new" && mv "$tmp/$problem/SPEC.new" "$tmp/$problem/SPEC.md" ;;
    symlink) mv "$tmp/$problem/VERSION" "$tmp/$problem/real-version" && ln -s real-version "$tmp/$problem/VERSION" ;;
    link) printf '%s\n' 'See [missing](./MISSING.md).' >> "$tmp/$problem/SPEC.md" ;;
    toc) sed 's/- \[1. Scope\](#1-scope)/- [1. Scope](#1-scope)\n- [2. Ghost](#2-ghost)/' "$tmp/$problem/SPEC.md" > "$tmp/$problem/SPEC.new" && mv "$tmp/$problem/SPEC.new" "$tmp/$problem/SPEC.md" ;;
  esac
  if (cd "$tmp/$problem" && sh verify.sh > /dev/null 2>&1); then
    echo "$problem fixture unexpectedly verified" >&2
    exit 1
  fi
done

echo "Mills Mess Engine specification tests passed"
