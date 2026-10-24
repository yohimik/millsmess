#!/bin/sh
# SPDX-License-Identifier: GPL-3.0-or-later
# Copyright (c) 2026 yohimik
set -eu

cd "$(dirname "$0")"

for file in VERSION SPEC.md README.md LICENSE; do
  if [ -L "$file" ] || [ ! -f "$file" ]; then
    echo "refusing to verify symlinked or non-regular $file" >&2
    exit 1
  fi
done

version=$(cat VERSION)
if [ "${DISPAT_STAGE:-}" = build ] && [ -n "${DISPAT_NEW_VERSION:-}" ] && [ "$version" != "$DISPAT_NEW_VERSION" ]; then
  echo "specification version $version does not match planned release $DISPAT_NEW_VERSION" >&2
  exit 1
fi
if ! printf '%s\n' "$version" | grep -Eq '^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(-[0-9A-Za-z-]+(\.[0-9A-Za-z-]+)*)?(\+[0-9A-Za-z-]+(\.[0-9A-Za-z-]+)*)?$'; then
  echo "VERSION is not a semantic version: $version" >&2
  exit 1
fi

require_once() {
  label=$1
  text=$2
  count=$(grep -F -c "$text" SPEC.md || true)
  if [ "$count" -ne 1 ]; then
    echo "SPEC.md must contain exactly one $label for $version (found $count)" >&2
    exit 1
  fi
}

require_once "document header" "**Version:** $version **Status:**"
require_once "versioning declaration" "This document is Mills Mess Engine specification **$version**"
require_once "local license link" "**License:** GPL-3.0-or-later. See [LICENSE](./LICENSE)."

grep -Fq 'GNU GENERAL PUBLIC LICENSE' LICENSE
grep -Fq 'Version 3, 29 June 2007' LICENSE
grep -Fq 'changing it is not allowed.' LICENSE

# Every relative link in SPEC.md and README.md must resolve to a file in this folder.
for doc in SPEC.md README.md; do
  grep -o '](\./[^)#]*' "$doc" | sed 's/](\.\///' | sort -u | while IFS= read -r target; do
    if [ ! -f "$target" ]; then
      echo "$doc links to missing file $target" >&2
      exit 1
    fi
  done
done

# Every table-of-contents entry in SPEC.md must point at an existing heading anchor.
awk '/^## Table of contents/{p=1;next} /^## /{if(p)exit} p' SPEC.md | grep -o '](#[^)]*)' | sed 's/](#//; s/)$//' | sort -u > "${TMPDIR:-/tmp}/mme-toc.$$"
grep -E '^#{2,3} ' SPEC.md | sed -E 's/^#+ //' | tr 'A-Z' 'a-z' | sed -E 's/[^a-z0-9 _-]//g; s/ /-/g' | sort -u > "${TMPDIR:-/tmp}/mme-headings.$$"
if ! comm -23 "${TMPDIR:-/tmp}/mme-toc.$$" "${TMPDIR:-/tmp}/mme-headings.$$" | grep -q .; then
  :
else
  echo "SPEC.md table of contents has entries without a heading:" >&2
  comm -23 "${TMPDIR:-/tmp}/mme-toc.$$" "${TMPDIR:-/tmp}/mme-headings.$$" >&2
  rm -f "${TMPDIR:-/tmp}/mme-toc.$$" "${TMPDIR:-/tmp}/mme-headings.$$"
  exit 1
fi
rm -f "${TMPDIR:-/tmp}/mme-toc.$$" "${TMPDIR:-/tmp}/mme-headings.$$"

echo "Mills Mess Engine specification $version is internally consistent"
