#!/bin/sh
# Encode a lecture for self-hosting (make video SRC=... ID=...).
# Produces <ID>.mp4 (H.264/AAC, max 720p, faststart) and an <ID>.jpg poster,
# where ID is the lesson's YouTube video id. Requires ffmpeg.
#
#   tools/encode-video.sh "Lecture 05 - CNNs.mp4" ehvWj3Ir7yA [out-dir]

set -eu

[ $# -ge 2 ] || { echo "usage: $0 SOURCE-VIDEO YOUTUBE-ID [OUT-DIR]"; exit 2; }
src=$1
id=$2
out=${3:-media}
command -v ffmpeg >/dev/null || { echo "ffmpeg isn't installed (macOS: brew install ffmpeg)"; exit 1; }
[ -f "$src" ] || { echo "no such file: $src"; exit 1; }
echo "$id" | grep -Eq '^[A-Za-z0-9_-]{11}$' || {
    echo "\"$id\" isn't a YouTube id: the 11 characters after watch?v= (or youtu.be/)"
    exit 1
}

mkdir -p "$out"
tmp="$out/.$id.partial.mp4"
trap 'rm -f "$tmp"' EXIT

# CRF 26 is sufficient for slide-based lectures; -2 keeps the width even.
echo "==> Encoding $src -> $out/$id.mp4"
ffmpeg -hide_banner -loglevel warning -stats -y -i "$src" \
    -map 0:v:0 -map '0:a:0?' \
    -c:v libx264 -preset medium -crf 26 -pix_fmt yuv420p \
    -vf "scale=-2:'min(720,ih)'" \
    -c:a aac -b:a 96k -ac 2 \
    -movflags +faststart -f mp4 "$tmp"
mv "$tmp" "$out/$id.mp4"

# Poster frame at 10% of the duration, past any title card.
duration=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$out/$id.mp4" 2>/dev/null | cut -d. -f1)
at=$(( ${duration:-0} / 10 ))
ffmpeg -hide_banner -loglevel error -y -ss "$at" -i "$out/$id.mp4" -frames:v 1 -vf "scale=640:-2" -q:v 4 "$out/$id.jpg"

echo "==> Done: $out/$id.mp4 ($(du -h "$out/$id.mp4" | cut -f1)) and $out/$id.jpg"
