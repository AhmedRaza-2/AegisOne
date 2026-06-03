import os
import re
import tempfile
import zipfile
import shutil

# Graceful imports
try:
    import filetype
except ImportError:
    filetype = None

try:
    import fitz  # PyMuPDF
except ImportError:
    fitz = None

try:
    from oletools.olevba import VBA_Parser
except ImportError:
    VBA_Parser = None

try:
    from bs4 import BeautifulSoup
except ImportError:
    BeautifulSoup = None

try:
    import docx
except ImportError:
    docx = None


class AttachmentOrchestrator:
    """
    Advanced Multi-Modal Attachment Engine.
    Handles: PDF, Office, HTML, TXT, and ZIP (Recursive).
    Includes Content-Aware sniffing for spoofed extensions.
    """
    
    URL_REGEX = re.compile(r'https?://(?:[-\w.]|(?:%[\da-fA-F]{2}))+')

    def __init__(self):
        self.supported_types = {
            'pdf': self.extract_pdf,
            'doc': self.extract_office,
            'docx': self.extract_office,
            'xls': self.extract_office,
            'xlsx': self.extract_office,
            'html': self.extract_html,
            'htm': self.extract_html,
            'txt': self.extract_txt,
            'zip': self.extract_zip
        }

    def identify_file_type(self, file_path):
        """Identifies file using magic bytes, falling back to extension + content sniffing."""
        ext = ""
        if filetype:
            kind = filetype.guess(file_path)
            if kind:
                ext = kind.extension
        
        if not ext:
            _, ext = os.path.splitext(file_path)
            ext = ext.lower().replace('.', '')

        # Content Sniffing: Check if a TXT file is actually HTML
        if ext == 'txt' or ext == '':
            try:
                with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                    head = f.read(1000).lower()
                    if '<html' in head or '<form' in head or '<body' in head or '<script' in head:
                        return 'html'
            except:
                pass
                
        return ext

    def extract_urls_from_text(self, text):
        if not text: return []
        return list(set(self.URL_REGEX.findall(text)))

    def extract_pdf(self, file_path):
        result = {'text': '', 'urls': [], 'macros_found': False, 'heuristic_risk': 0.0}
        if not fitz:
            result['error'] = "PyMuPDF (pymupdf) not installed."
            return result
        try:
            doc = fitz.open(file_path)
            text_blocks = []
            for page in doc:
                text_blocks.append(page.get_text())
                links = page.get_links()
                for link in links:
                    if 'uri' in link:
                        result['urls'].append(link['uri'])
            text = " ".join(text_blocks)
            result['text'] = text
            result['urls'].extend(self.extract_urls_from_text(text))
            result['urls'] = list(set(result['urls']))
            # Check for JS in PDF
            if b"/JS" in doc.write() or b"/JavaScript" in doc.write():
                result['heuristic_risk'] += 0.5
        except Exception as e:
            result['error'] = str(e)
        return result

    def extract_office(self, file_path):
        result = {'text': '', 'urls': [], 'macros_found': False, 'heuristic_risk': 0.0, 'vba_analysis': None}
        # 1. Macro Analysis
        if VBA_Parser:
            try:
                vbaparser = VBA_Parser(file_path)
                if vbaparser.detect_vba_macros():
                    result['macros_found'] = True
                    result['heuristic_risk'] += 0.4
                    analysis = vbaparser.analyze_macros()
                    if analysis:
                        suspicious = [kw for typ, kw, desc in analysis if typ in ('AutoExec', 'Suspicious', 'IOC')]
                        if suspicious:
                            result['heuristic_risk'] += 0.5
                            result['vba_analysis'] = f"Suspicious Keywords: {', '.join(suspicious[:5])}"
                vbaparser.close()
            except: pass
        # 2. Text Extraction
        ext = self.identify_file_type(file_path)
        if ext == 'docx' and docx:
            try:
                doc_obj = docx.Document(file_path)
                text = " ".join([p.text for p in doc_obj.paragraphs])
                result['text'] = text
                result['urls'].extend(self.extract_urls_from_text(text))
            except Exception as e:
                result['error'] = f"Docx error: {str(e)}"
        return result

    def extract_html(self, file_path):
        result = {'text': '', 'urls': [], 'macros_found': False, 'heuristic_risk': 0.0}
        if not BeautifulSoup:
            result['error'] = "beautifulsoup4 not installed."
            return result
        try:
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()
                soup = BeautifulSoup(content, 'html.parser')
            result['text'] = soup.get_text(separator=' ', strip=True)
            result['urls'] = [a['href'] for a in soup.find_all('a', href=True)]
            result['urls'].extend([s['src'] for s in soup.find_all('script', src=True)])
            result['urls'].extend([f['action'] for f in soup.find_all('form', action=True)])
            result['urls'].extend(self.extract_urls_from_text(content))
            # Flag password inputs (Credential Harvesting)
            if soup.find_all('input', type='password') or 'password' in result['text'].lower():
                result['heuristic_risk'] += 0.8
            result['urls'] = list(set(result['urls']))
        except Exception as e:
            result['error'] = str(e)
        return result

    def extract_txt(self, file_path):
        result = {'text': '', 'urls': [], 'macros_found': False, 'heuristic_risk': 0.0}
        try:
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                text = f.read()
            result['text'] = text
            result['urls'] = self.extract_urls_from_text(text)
        except Exception as e:
            result['error'] = str(e)
        return result

    def extract_zip(self, file_path):
        """Recursive ZIP extraction and scanning."""
        result = {'text': '[ZIP CONTENT]', 'urls': [], 'macros_found': False, 'heuristic_risk': 0.0, 'files_scanned': 0}
        temp_dir = tempfile.mkdtemp()
        try:
            with zipfile.ZipFile(file_path, 'r') as zref:
                zref.extractall(temp_dir)
                
            for root, dirs, files in os.walk(temp_dir):
                for file in files:
                    full_path = os.path.join(root, file)
                    inner_result = self.process_file(full_path)
                    
                    # Aggregate results
                    result['urls'].extend(inner_result.get('urls', []))
                    if inner_result.get('macros_found'):
                        result['macros_found'] = True
                    result['heuristic_risk'] = max(result['heuristic_risk'], inner_result.get('heuristic_risk', 0.0))
                    result['files_scanned'] += 1
                    
            result['urls'] = list(set(result['urls']))
            result['text'] += f" Scanned {result['files_scanned']} files inside ZIP."
            
        except Exception as e:
            result['error'] = f"ZIP error: {str(e)}"
        finally:
            shutil.rmtree(temp_dir, ignore_errors=True)
            
        return result

    def process_file(self, file_path):
        ext = self.identify_file_type(file_path)
        extractor_func = self.supported_types.get(ext)
        if extractor_func:
            extraction = extractor_func(file_path)
            extraction['file_type'] = ext
            return extraction
        else:
            return {
                'file_type': ext, 'text': '', 'urls': [], 
                'macros_found': False, 'heuristic_risk': 0.0,
                'error': 'Unsupported file format.'
            }

if __name__ == "__main__":
    print("🛡️ AegisOne Attachment Orchestrator V2 (Content-Aware + ZIP Support)")
