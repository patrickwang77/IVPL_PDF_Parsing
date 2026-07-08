import os
import re
import base64

def bundle_html():
    base_dir = r"D:\Antigravity workspace\PDF-Extractor2"
    index_path = os.path.join(base_dir, "index.html")
    styles_path = os.path.join(base_dir, "styles.css")
    app_path = os.path.join(base_dir, "app.js")
    
    # Read files
    with open(index_path, "r", encoding="utf-8") as f:
        html = f.read()
        
    with open(styles_path, "r", encoding="utf-8") as f:
        css = f.read()
        
    with open(app_path, "r", encoding="utf-8") as f:
        js = f.read()
        
    # Read libraries
    lib_dir = os.path.join(base_dir, "lib")
    with open(os.path.join(lib_dir, "lucide.min.js"), "r", encoding="utf-8") as f:
        lucide = f.read()
    with open(os.path.join(lib_dir, "pdf.min.js"), "r", encoding="utf-8") as f:
        pdf_js = f.read()
    with open(os.path.join(lib_dir, "xlsx.full.min.js"), "r", encoding="utf-8") as f:
        xlsx_js = f.read()
        
    # Base64 encode the pdf.worker.min.js file
    worker_path = os.path.join(lib_dir, "pdf.worker.min.js")
    with open(worker_path, "rb") as f:
        worker_b64 = base64.b64encode(f.read()).decode("utf-8")
        
    # Replace worker source in app.js with inline blob loading
    worker_inline_code = f"""
    // Inline PDF.js Worker using Blob URL to bypass CORS and file:/// origin errors
    const workerB64 = "{worker_b64}";
    const binStr = atob(workerB64);
    const len = binStr.length;
    const arr = new Uint8Array(len);
    for (let i = 0; i < len; i++) {{
        arr[i] = binStr.charCodeAt(i);
    }}
    const blob = new Blob([arr], {{ type: 'application/javascript' }});
    pdfjsLib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(blob);
    """
    
    # Replace workerSrc target line
    js = js.replace("pdfjsLib.GlobalWorkerOptions.workerSrc = 'lib/pdf.worker.min.js';", worker_inline_code)
    
    # Replace style link
    html = html.replace('<link rel="stylesheet" href="styles.css">', f"<style>\n{css}\n</style>")
    
    # Replace script tags with inlined content
    html = html.replace('<script src="lib/lucide.min.js"></script>', f"<script>\n{lucide}\n</script>")
    html = html.replace('<script src="lib/pdf.min.js"></script>', f"<script>\n{pdf_js}\n</script>")
    html = html.replace('<script src="lib/xlsx.full.min.js"></script>', f"<script>\n{xlsx_js}\n</script>")
    html = html.replace('<script src="app.js"></script>', f"<script>\n{js}\n</script>")
    
    output_path = os.path.join(base_dir, "PDF-Extractor-Standalone.html")
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(html)
        
    print(f"Bundled successfully! Size: {os.path.getsize(output_path) / 1024 / 1024:.2f} MB")
    print(f"File saved to: {output_path}")

if __name__ == '__main__':
    bundle_html()
