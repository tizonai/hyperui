import re,html,pathlib,sys,unicodedata
md_path,out_html,title_suffix,status,track,approvals,desc=sys.argv[1:8]
T=pathlib.Path.home()/'.claude/plugins/marketplaces/tizonai/skills/spec/references/spec-page-template.html'
tpl=T.read_text(); md=pathlib.Path(md_path).read_text()
if md.startswith('---'): md=md.split('---',2)[2].lstrip('\n')
lines=md.splitlines(); title=lines[0].lstrip('# ').strip()
m=re.search(r'\*\*Date:\*\*\s*(\S+)',md); date=m.group(1) if m else ''
def inline(s):
    s=html.escape(s,quote=False); s=re.sub(r'`([^`]+)`',r'<code>\1</code>',s); s=re.sub(r'\*\*([^*]+)\*\*',r'<strong>\1</strong>',s); return s
def slug(h):
    h=unicodedata.normalize('NFKD',h).encode('ascii','ignore').decode(); return re.sub(r'[^a-z0-9]+','-',h.lower()).strip('-')
sections=[];toc=[];cur=None;buf=[];lst=None;tbl=None;fence=None
def flush():
    global lst,tbl
    if lst: buf.append('</%s>'%lst); lst=None
    if tbl:
        head,rows=tbl[0],tbl[1:]
        buf.append('<div class="table-wrap"><table><thead><tr>'+''.join('<th>%s</th>'%inline(c) for c in head)+'</tr></thead><tbody>'+''.join('<tr>'+''.join('<td>%s</td>'%inline(c) for c in r)+'</tr>' for r in rows)+'</tbody></table></div>'); tbl=None
def close():
    global cur,buf
    flush()
    if cur: sections.append('<section id="%s"><h2>%s</h2>\n%s</section>'%(cur[0],inline(cur[1]),'\n'.join(buf)))
    buf=[]
for ln in lines[1:]:
    if ln.startswith('```'):
        if fence is None: flush(); fence=(ln[3:].strip(),[]); continue
        lang,body=fence; txt='\n'.join(body)
        if lang=='mermaid': buf.append('<pre class="mermaid">'+txt.replace('&','&amp;').replace('<','&lt;').replace('>','&gt;')+'</pre>')
        else: buf.append('<pre><code class="language-%s">%s</code></pre>'%(lang or 'text',html.escape(txt,quote=False)))
        fence=None; continue
    if fence is not None: fence[1].append(ln); continue
    if re.match(r'\*\*(Source|Date|Track):\*\*',ln): continue
    if ln.startswith('|'):
        cells=[c.strip() for c in ln.strip().strip('|').split('|')]
        if re.match(r'^\|?\s*:?-{2,}',ln): continue
        if tbl is None: flush(); tbl=[cells]
        else: tbl.append(cells)
        continue
    elif tbl is not None: flush()
    m=re.match(r'^##\s+(.*)',ln)
    if m and not ln.startswith('###'):
        close(); h=m.group(1).strip(); cur=(slug(h),h); toc.append('<li><a href="#%s">%s</a></li>'%(slug(h),inline(h))); continue
    m3=re.match(r'^###\s+(.*)',ln)
    if m3: flush(); buf.append('<h3>%s</h3>'%inline(m3.group(1))); continue
    m4=re.match(r'^####\s+(.*)',ln)
    if m4: flush(); buf.append('<h4>%s</h4>'%inline(m4.group(1))); continue
    mc=re.match(r'^-\s+\[( |x)\]\s+(.*)',ln)
    if mc:
        if lst!='ul': flush(); buf.append('<ul>'); lst='ul'
        buf.append('<li><input type="checkbox" disabled%s> %s</li>'%(' checked' if mc.group(1)=='x' else '',inline(mc.group(2)))); continue
    mo=re.match(r'^(\d+)\.\s+(.*)',ln); mu=re.match(r'^-\s+(.*)',ln)
    if mo:
        if lst!='ol': flush(); buf.append('<ol>'); lst='ol'
        buf.append('<li>%s</li>'%inline(mo.group(2))); continue
    if mu:
        if lst!='ul': flush(); buf.append('<ul>'); lst='ul'
        buf.append('<li>%s</li>'%inline(mu.group(1))); continue
    flush()
    if ln.strip()=='': continue
    if ln.strip().startswith('N/A'): buf.append('<p class="na">%s</p>'%inline(ln.strip())); continue
    buf.append('<p>%s</p>'%inline(ln.strip()))
close()
page=tpl
for k,v in {'lang':'es','title':title+' — '+title_suffix,'description':desc,'status':status,'date':date,'track':track,'root':'/Users/tizon/personal/hyperui','approvals':approvals,'toc':'\n'.join(toc),'sections':'\n'.join(sections)}.items(): page=page.replace('{{%s}}'%k,v)
assert '{{' not in page
head_title=re.search(r'<title>.*?</title>',page,re.S).group(0); meta=re.search(r'<meta name="description"[^>]*>',page).group(0)
style=re.search(r'<style>.*?</style>',page,re.S).group(0); body=re.search(r'<body[^>]*>(.*)</body>',page,re.S).group(1)
pathlib.Path(out_html).write_text(head_title+'\n'+meta+'\n'+style+'\n'+body)
print(out_html,'sections',len(sections),'bytes',len(head_title)+len(style)+len(body))
