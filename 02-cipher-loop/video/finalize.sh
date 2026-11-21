#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/build"
: > list.txt; for f in $(ls seg_*.mp4 | sort); do echo "file '$f'" >> list.txt; done
dur=$(python3 -c "import json;print(json.load(open('timeline.json'))['total'])")
st=$(python3 -c "print(max(0, $dur - 1.8))")
ffmpeg -y -loglevel error -f concat -safe 0 -i list.txt -i soundtrack.wav -map 0:v -map 1:a \
  -vf "noise=alls=2:allf=t,vignette=angle=PI/7,fade=t=out:st=$st:d=1.8,format=yuv420p" \
  -c:v libx264 -preset medium -crf 22 -c:a aac -b:a 192k -shortest -movflags +faststart \
  -metadata title="Cipher Loop - a guided solve" ../cipher-loop.mp4
ffprobe -v error -show_entries format=duration,size:stream=codec_name,width,height,r_frame_rate -of compact ../cipher-loop.mp4
