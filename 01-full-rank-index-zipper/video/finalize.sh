#!/usr/bin/env bash
# Join rendered segments, fade the ending to black, and mux the soundtrack.
set -euo pipefail
cd "$(dirname "$0")/build"
last=$(ls seg_*.mp4 | sort | tail -1)
dur=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$last")
st=$(python3 -c "print(max(0, $dur - 1.6))")
ffmpeg -y -loglevel error -i "$last" -vf "fade=t=out:st=$st:d=1.6" -c:v libx264 -preset medium -crf 16 -tune animation -pix_fmt yuv420p -r 30 last_faded.mp4
: > list.txt
for f in $(ls seg_*.mp4 | sort); do
  if [ "$f" = "$last" ]; then echo "file 'last_faded.mp4'" >> list.txt; else echo "file '$f'" >> list.txt; fi
done
ffmpeg -y -loglevel error -f concat -safe 0 -i list.txt -i soundtrack.wav -map 0:v -map 1:a -c:v copy -c:a aac -b:a 192k -shortest -movflags +faststart \
  -metadata title="Every Clue Is an Address - a guided Full Rank solve" ../every-clue-is-an-address.mp4
ffprobe -v error -show_entries format=duration,size:stream=codec_name,width,height,r_frame_rate -of compact ../every-clue-is-an-address.mp4
