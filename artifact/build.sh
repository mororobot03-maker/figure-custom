#!/bin/sh
# 단일 HTML 파일(artifact/dist/index.html) 생성
set -e
cd "$(dirname "$0")/.."
rm -rf artifact/dist && mkdir -p artifact/dist
npx esbuild artifact/entry.jsx --bundle --minify --format=iife \
  --loader:.js=jsx --jsx=automatic \
  --alias:@=. --alias:next/navigation=./artifact/nav.js \
  --define:process.env.NODE_ENV=\"production\" \
  --outdir=artifact/dist --log-level=warning
python3 - <<'PY'
import base64, glob, json, os
js = open('artifact/dist/entry.js', encoding='utf-8').read().replace('</script>', '<\\/script>')
# GLB 모델을 base64로 담아 단일 HTML에서도 로드되게 한다 (fetch 대신 parseAsync로 읽는다)
models = {'/models/' + os.path.basename(f): base64.b64encode(open(f, 'rb').read()).decode() for f in sorted(glob.glob('public/models/*.glb'))}
js = 'window.__FIGUMIX_MODELS__=' + json.dumps(models) + ';\n' + js
css = open('artifact/dist/entry.css', encoding='utf-8').read()
html = f'''<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
<title>FiguMix v0.2 — 시연</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600&family=Gowun+Batang:wght@400;700&family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
<style>{css}</style>
</head>
<body>
<div id="root"></div>
<script>{js}</script>
</body>
</html>'''
open('artifact/dist/index.html', 'w', encoding='utf-8').write(html)
print('size KB:', len(html.encode('utf-8')) // 1024)
PY
