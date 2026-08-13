import os
import sys
import torch
import importlib.util
from transformers import DistilBertTokenizer

try:
    from AIML.url.model_paths import get_url_model_path
except ImportError:
    from ..url.model_paths import get_url_model_path

class AttachmentUnifiedAI:
    def __init__(self):
        print("🔍 Initializing Unified AI Bridge...")
        self.device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        print(f"🖥️ Using Device: {self.device}")
        self.tokenizer = None
        self.models = {}
        self.modules = {}
        
        self.paths = {
            'email': ('../email/phishing_model_email.py', 'PhishingDetector', '../email/best_phishing_model.pt'),
            'text': ('../text_general/phishing_model_text.py', 'PhishingDetectorText', '../text_general/best_phishing_model_text.pt'),
            'url': ('../url/phishing_model_url.py', 'URLDetector', str(get_url_model_path()))
        }

    def _load_module_safely(self, name, filepath):
        try:
            print(f"📂 Loading module file: {filepath}")
            spec = importlib.util.spec_from_file_location(name, filepath)
            if spec is None:
                print(f"❌ Could not find spec for {filepath}")
                return None
            module = importlib.util.module_from_spec(spec)
            sys.modules[name] = module
            spec.loader.exec_module(module)
            return module
        except Exception as e:
            print(f"❌ Module Load Error: {e}")
            return None

    def _get_tokenizer(self):
        if not self.tokenizer:
            print("📥 Loading DistilBERT Tokenizer...")
            self.tokenizer = DistilBertTokenizer.from_pretrained('distilbert-base-uncased')
        return self.tokenizer

    def _get_model(self, model_key):
        if model_key in self.models:
            return self.models[model_key]
            
        print(f"⚡ Attempting to load {model_key.upper()} AI Brain...")
        try:
            py_path, cls_name, pt_path = self.paths[model_key]
            
            if not os.path.exists(pt_path):
                print(f"⚠️ Weights not found: {pt_path}")
                return None

            # Load the Python architecture file
            module = self._load_module_safely(f"module_{model_key}", py_path)
            if module is None: return None
            self.modules[model_key] = module
            
            # Initialize Class
            print(f"🏗️  Initializing class {cls_name}...")
            ModelClass = getattr(module, cls_name)
            model = ModelClass()
            
            # Load Weights
            print(f"⚖️  Loading weights from {pt_path}...")
            model.load_state_dict(torch.load(pt_path, map_location=self.device), strict=False)
            model.to(self.device).eval()
            
            self.models[model_key] = model
            print(f"✅ {model_key.upper()} AI Loaded Successfully.")
            return model
        except Exception as e:
            print(f"❌ Failed to load {model_key.upper()} AI: {e}")
            import traceback
            traceback.print_exc()
            self.models[model_key] = None
            return None

    def predict_text_content(self, text):
        if not text.strip(): return 0.0
        model = self._get_model('text')
        if not model: return 0.0
        
        tokenizer = self._get_tokenizer()
        encoding = tokenizer(text, add_special_tokens=True, max_length=128, 
                             padding='max_length', truncation=True, return_tensors='pt').to(self.device)
        with torch.no_grad():
            # Check for struct branch
            in_features = 10 # Default for our text model
            if hasattr(model, 'struct_branch') and len(model.struct_branch) > 0:
                in_features = model.struct_branch[0].in_features
                
            struct_feats = torch.zeros(1, in_features).to(self.device)
            logits = model(encoding['input_ids'], encoding['attention_mask'], struct_feats)
            return torch.sigmoid(logits).item()

    def predict_url(self, url):
        model = self._get_model('url')
        if not model: return 0.0
        tokenizer = self._get_tokenizer()
        try:
            encoding = tokenizer(url, add_special_tokens=True, max_length=128, 
                                 padding='max_length', truncation=True, return_tensors='pt').to(self.device)
            
            url_module = self.modules.get('url')
            if url_module and hasattr(url_module, 'extract_url_numerical_features'):
                numerical_feats = url_module.extract_url_numerical_features(url).unsqueeze(0).to(self.device)
            else:
                numerical_feats = torch.zeros(1, 10).to(self.device)

            with torch.no_grad():
                logits = model(encoding['input_ids'], encoding['attention_mask'], numerical_feats)
                if logits.shape[1] > 1:
                    probs = torch.softmax(logits, dim=1)
                    return 1.0 - probs[0][0].item() 
                else:
                    return torch.sigmoid(logits).item()
        except Exception as e:
            print(f"❌ URL Prediction Error: {e}")
            return 0.0

    def predict_image(self, image_path):
        return 0.0
