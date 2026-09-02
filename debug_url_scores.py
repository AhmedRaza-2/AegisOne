import asyncio
import sys
from api.routers.compatibility import _contextual_engine, _url_model, _text_model
from AIML.url.url_feature_extractor import extract_url_features
from AIML.url.brand_engine import check_brand_impersonation
from AIML.url.fusion_engine import fuse_url_intelligence
import torch

def test_url(url):
    print(f"Testing URL: {url}")
    
    # Run URL model
    url_features = extract_url_features(url)
    brand_result = check_brand_impersonation(url)
    
    lexical_tensor = torch.tensor(url_features["lexical_features"]).float()
    
    # We don't have the full async neural net easily, but we can call it if it's sync, 
    # or just look at the fusion engine if we pass dummy probs.
    # Actually, _url_model is available. It has a predict(url) method?
    
    print(f"Brand result: {brand_result}")
    # Let's just import the actual _url_model to get the score.
    # _url_model is an instance of URLPhishingModel in AIML/unified_server.py
    
async def run():
    from AIML.unified_server import get_unified_models
    models = get_unified_models()
    url_model = models["url"]
    
    for u in ["https://www.paypal.com", "https://trello.com", "https://www.netflix.com"]:
        res = await url_model.predict(u)
        print(f"URL: {u}")
        print(f"URL Risk: {res['risk_score']}")
        print(f"Explanation: {res.get('explanation')}")
        print(f"Brand result: {res['evidence']['brand_impersonation']}")
        print("--------------------")

if __name__ == "__main__":
    asyncio.run(run())
