#!/bin/sh
# Prepares a lecture video for the site (`make video SRC=… ID=…`):
#   - an MP4 that every browser plays (H.264 video, AAC audio), at most 720p,
#     arranged so playback starts before the whole file has downloaded;
#   - a poster picture for the lesson's video card;
# both named after the lecture's YouTube id (the `id` in the lesson's
# `videos` list), in media/ by default. The lesson then plays this copy
# instead of YouTube's. About 400–700 MB per hour of lecture.
#
#   tools/encode-video.sh "Lecture 05 - CNNs.mp4" ehvWj3Ir7yA [out-dir]
#
# Needs ffmpeg (macOS: brew install ffmpeg; Ubuntu: apt-get install ffmpeg).

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

# CRF 26 suits lectures (slides and a speaker); -2 keeps the width even.
echo "==> Encoding $src -> $out/$id.mp4"
ffmpeg -hide_banner -loglevel warning -stats -y -i "$src" \
    -map 0:v:0 -map '0:a:0?' \
    -c:v libx264 -preset medium -crf 26 -pix_fmt yuv420p \
    -vf "scale=-2:'min(720,ih)'" \
    -c:a aac -b:a 96k -ac 2 \
    -movflags +faststart -f mp4 "$tmp"
mv "$tmp" "$out/$id.mp4"

# The poster: a frame a tenth of the way in (past any title card).
duration=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$out/$id.mp4" 2>/dev/null | cut -d. -f1)
at=$(( ${duration:-0} / 10 ))
ffmpeg -hide_banner -loglevel error -y -ss "$at" -i "$out/$id.mp4" -frames:v 1 -vf "scale=640:-2" -q:v 4 "$out/$id.jpg"

echo "==> Done: $out/$id.mp4 ($(du -h "$out/$id.mp4" | cut -f1)) and $out/$id.jpg"
