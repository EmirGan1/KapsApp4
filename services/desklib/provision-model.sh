#!/usr/bin/env bash
set -euo pipefail

target=${1:?Usage: provision-model.sh /absolute/path/to/model}
[[ "$target" = /* ]] || { echo 'Use an absolute model path.' >&2; exit 1; }
script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
manifest="$script_dir/checkpoint.sha256"
model=desklib/ai-text-detector-v1.01
if [[ "${2:-english}" == turkish ]]; then
  manifest="$script_dir/turkish-checkpoint.sha256"
  model=ads2009/turkish-ai-text-detector-berturk-v2
fi
revision=5fdea974cd4287c61674951ec78803aa274e2fb7
if [[ "${2:-english}" == turkish ]]; then
  revision=bc9df3aab4cb42cf8e6bea0a7fb377b12b8bb661
fi
base="https://huggingface.co/$model/resolve/$revision"
if [[ -d "$target" ]]; then
  (cd -- "$target" && sha256sum -c "$manifest")
  exit
fi

parent=$(dirname -- "$target")
mkdir -p -- "$parent"
temporary=$(mktemp -d -- "$parent/.desklib-download.XXXXXXXX")
trap 'rm -rf -- "$temporary"' EXIT
while read -r _ file; do
  curl --fail --silent --show-error --location --retry 2 --connect-timeout 15 --max-time 3600 \
    "$base/$file?download=true" --output "$temporary/$file"
done < "$manifest"
(cd -- "$temporary" && sha256sum -c "$manifest")
mv -T -- "$temporary" "$target"
