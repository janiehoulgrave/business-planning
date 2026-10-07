# Builds the single-file preview and shapes it for Claude's artifact page.
import re, subprocess, sys
subprocess.run(['npx','vite','build','-c','vite.preview.config.ts'],check=True,capture_output=True)
s=open('preview-dist/index.html',encoding='utf-8').read()
head=re.search(r'<head>(.*)</head>',s,re.S).group(1); body=re.search(r'<body>(.*)</body>',s,re.S).group(1)
out='<title>Business Planning Series</title>\n'+''.join(re.findall(r'<style[^>]*>.*?</style>',head,re.S))+'\n'+body+'\n'+''.join(re.findall(r'<script[^>]*>.*?</script>',head,re.S))
out=out.replace('�','\\uFFFD')
open(sys.argv[1],'w',encoding='utf-8').write(out); print('ok',len(out))
