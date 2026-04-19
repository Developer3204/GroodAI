import cv2
import numpy as np
import json
import os
from gpt4all import GPT4All

class GroodAIModel:
    def __init__(self, model_name="orca-mini-3b-gguf"):
        """
        EMBEDDED AI ENGINE:
        No external servers required. GPT4All runs directly in this process.
        The model will automatically download on the first run.
        This is what we need to explain for the hackathon
        """
        print(f"--- INITIALIZING EMBEDDED ENGINE: {model_name} ---")
        self.model = GPT4All(model_name)
        self.inventory = []
        self.history = []
        self.total_savings = 0.0
        self.total_carbon_avoided = 0.0  # in kg

    def preprocess_image(self, image_path):
        """
        OpenCV Preprocessing for Edge OCR.
        """
        img = cv2.imread(image_path)
        if img is None:
            raise ValueError("Image not found")
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        _, thresh = cv2.threshold(gray, 150, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        return "OCR_MOCK_TEXT: APPLES $3.99 500g, MILK $2.50 1000g, BREAD $1.99 400g"

    def parse_with_embedded_llm(self, text):
        """
        Uses the embedded LLM to parse text into JSON.
        """
        prompt = f"### System: You are a receipt parser. Return ONLY a JSON list.\n### User: Extract items from this text: {text}. Format: [{{'item_name': '', 'price': 0.0, 'weight_grams': 0, 'days_to_eat': 0}}]\n### Response:"
        
        print("--- RUNNING EMBEDDED INFERENCE ---")
        # In a real run, this line does the heavy lifting:
        # response = self.model.generate(prompt, max_tokens=200)
        
        # Mocking the structured output for the script demo
        return [
            {"item_name": "Apples", "price": 3.99, "weight_grams": 500, "days_to_eat": 14},
            {"item_name": "Milk", "price": 2.50, "weight_grams": 1000, "days_to_eat": 7},
            {"item_name": "Bread", "price": 1.99, "weight_grams": 400, "days_to_eat": 5}
        ]

    def log_consumption(self, item_name):
        for i, item in enumerate(self.inventory):
            if item['item_name'] == item_name:
                item['status'] = 'consumed'
                self.history.append(self.inventory.pop(i))
                self.total_savings += item['price']
                carbon_avoided = (item['weight_grams'] / 1000.0) * 2.5
                self.total_carbon_avoided += carbon_avoided
                print(f"Logged Consumption: Saved ${item['price']} | CO2 Avoided: {carbon_avoided}kg")
                return True
        return False

# Example Usage
if __name__ == "__main__":
    # The first time you run this, it will download the 2GB model file.
    grood = GroodAIModel()
    
    raw_text = grood.preprocess_image("path_to_receipt.jpg") if os.path.exists("path_to_receipt.jpg") else "MOCK_TEXT"
    parsed_items = grood.parse_with_embedded_llm(raw_text)
    
    for item in parsed_items:
        item['status'] = 'live'
        grood.inventory.append(item)
    
    print(f"Live Inventory: {len(grood.inventory)} items")
    grood.log_consumption("Apples")
    print(f"Total Savings: ${grood.total_savings}")
    print(f"Carbon Avoided: {grood.total_carbon_avoided}kg")

