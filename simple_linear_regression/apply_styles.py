import os, re
index_path = r'c:\工作\111\Linear-Regression_Boston-Housing-Dataset\Linear-Regression_Boston-Housing-Dataset-main\simple_linear_regression\templates\index.html'
replacements = {
    '#5b35f5': '#2563eb',
    '#c9c1ff': '#bfdbfe',
    '#f7f5ff': '#eff6ff',
    'rgba(91, 53, 245': 'rgba(37, 99, 235',
    'rgba(91,53,245': 'rgba(37,99,235',
    '#321aa2': '#1e40af'
}
if os.path.exists(index_path):
    with open(index_path, 'r', encoding='utf-8') as f:
        content = f.read()
    for old, new in replacements.items():
        content = content.replace(old, new)
    with open(index_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print('Updated index.html colors')

css_block = '''<style>
/* Formal Educational Platform Style */
.theory-page {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    color: #1f2d3d;
    line-height: 1.8;
    padding: 20px 40px;
    max-width: 1000px;
    background-color: #ffffff;
}
.page-header {
    border-bottom: 2px solid #eaebec;
    padding-bottom: 20px;
    margin-bottom: 30px;
}
.page-header h1 {
    font-size: 28px;
    color: #0f172a;
    margin: 0 0 10px;
    font-weight: 600;
}
.page-header .subtitle {
    font-size: 15px;
    color: #475569;
    margin: 0;
}
.section { margin-bottom: 40px; }
.section-title {
    font-size: 20px;
    color: #1e3a8a;
    border-left: 4px solid #2563eb;
    padding-left: 12px;
    margin-bottom: 20px;
    font-weight: 600;
}
.section-content {
    padding-left: 16px;
    color: #334155;
    font-size: 15px;
}
.data-table {
    width: 100%;
    border-collapse: collapse;
    margin: 20px 0;
    font-size: 14px;
}
.data-table th, .data-table td {
    border: 1px solid #cbd5e1;
    padding: 12px;
    text-align: left;
}
.data-table th { background-color: #f1f5f9; color: #1e293b; font-weight: 600; }
.math-block {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    padding: 16px 20px;
    margin: 20px 0;
    font-family: "Cambria Math", "Times New Roman", serif;
    font-size: 16px;
    color: #0f172a;
}
.admonition {
    border-left: 4px solid #059669;
    background-color: #ecfdf5;
    padding: 16px;
    margin: 20px 0;
    color: #047857;
}
.admonition-title { font-weight: 600; margin-bottom: 8px; }
</style>
'''

target_html_files = ['criterion.html', 'evaluation.html', 'optimization.html', 'purpose.html', 'result.html', 'thinking.html', 'knowledge.html']
base_dir = r'c:\工作\111\Linear-Regression_Boston-Housing-Dataset\Linear-Regression_Boston-Housing-Dataset-main\simple_linear_regression\static\theory-html'

for file_name in target_html_files:
    file_path = os.path.join(base_dir, file_name)
    if os.path.exists(file_path):
        with open(file_path, 'r', encoding='utf-8') as f:
            old_html = f.read()

        cleaned = re.sub(r'<style>.*?</style>', '', old_html, flags=re.DOTALL)
        cleaned = cleaned.replace('class="theory-hero"', 'class="page-header"')
        cleaned = cleaned.replace('class="theory-card"', 'class="section"')
        cleaned = re.sub(r'<h2>(.*?)</h2>', r'<h2 class="section-title">\1</h2><div class="section-content">', cleaned)
        cleaned = cleaned.replace('</div>\n\n  <div class="section">', '</div></div>\n\n  <div class="section">') # Close section content roughly
        cleaned = cleaned.replace('class="note"', 'class="admonition"').replace('class="tip"', 'class="admonition"').replace('class="warn"', 'class="admonition"')
        cleaned = cleaned.replace('class="formula"', 'class="math-block"')
        cleaned = cleaned.replace('<table', '<table class="data-table"')
        
        new_html = css_block + cleaned.lstrip()
        new_html = new_html + "</div>" # close last section content
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(new_html)
        print('Updated', file_name)
