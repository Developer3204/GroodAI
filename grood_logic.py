import cv2
import numpy as np
import json
import os
import requests

class GroodAIModel:
    def __init__(self, ollama_endpoint="http://localhost:11434/api/generate"):
        self.ollama_endpoint = ollama_endpoint
        self.inventory = []
        self.history = []
        self.total_savings = 0.0
        self.total_carbon_avoided = 0.0  # in kg

    def preprocess_image(self, image_path):
        """
        Uses OpenCV to preprocess the receipt image for better OCR.
        """
        img = cv2.imread(image_path)
        if img is None:
            raise ValueError("Image not found")
        
        # Convert to grayscale
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        
        # Apply thresholding
        _, thresh = cv2.threshold(gray, 150, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        
        # Mock OCR output (Placeholder for actual OCR lib like Tesseract)
        return "OCR_MOCK_TEXT: APPLES $3.99 500g, MILK $2.50 1000g, BREAD $1.99 400g"

    def parse_with_llm(self, text):
        """
        Integrates with local Ollama (Llama 3) to parse receipt text.
        Note: Requires Ollama running locally.
        """
        prompt = f"Extract items from this receipt text into a JSON list. For each, include item_name, price (float), weight_grams (int), and days_to_eat (int recommendation). Text: {text}"
        
        # This is the logic requested by the user. 
        # In a real local environment, you would call:
        # response = requests.post(self.ollama_endpoint, json={"model": "llama3", "prompt": prompt})
        
        # Mocking the JSON response for the purpose of the script logic demonstration:
        mock_json = [
            {"item_name": "Apples", "price": 3.99, "weight_grams": 500, "days_to_eat": 14},
            {"item_name": "Milk", "price": 2.50, "weight_grams": 1000, "days_to_eat": 7},
            {"item_name": "Bread", "price": 1.99, "weight_grams": 400, "days_to_eat": 5}
        ]
        return mock_json

    def add_to_inventory(self, items):
        for item in items:
            item['status'] = 'live'
            self.inventory.append(item)

    def log_consumption(self, item_name):
        """
        The Savings Mechanic & Environmental Impact logic.
        """
        for i, item in enumerate(self.inventory):
            if item['item_name'] == item_name:
                # Move to history
                item['status'] = 'consumed'
                self.history.append(self.inventory.pop(i))
                
                # Logic: Savings only added upon consumption
                self.total_savings += item['price']
                
                # Environmental Impact: Weight_kg * 2.5
                carbon_avoided = (item['weight_grams'] / 1000.0) * 2.5
                self.total_carbon_avoided += carbon_avoided
                
                print(f"Logged Consumption: Saved ${item['price']} | CO2 Avoided: {carbon_avoided}kg")
                return True
        return False

    def log_waste(self, item_name):
        for i, item in enumerate(self.inventory):
            if item['item_name'] == item_name:
                item['status'] = 'wasted'
                self.history.append(self.inventory.pop(i))
                print(f"Logged Waste: {item_name}")
                return True
        return False

# Example Usage
if __name__ == "__main__":
    grood = GroodAIModel()
    
    # Complete Workflow
    raw_text = "MOCK RECEIPT TEXT FROM OPENCV PREPROCESSING"
    parsed_items = grood.parse_with_llm(raw_text)
    grood.add_to_inventory(parsed_items)
    
    print(f"Live Inventory: {len(grood.inventory)} items")
    
    # User marks Apples as consumed
    grood.log_consumption("Apples")
    
    # User marks Bread as wasted
    grood.log_waste("Bread")
    
    print(f"Total Savings: ${grood.total_savings}")
    print(f"Carbon Avoided: {grood.total_carbon_avoided}kg")
    print(f"History: {len(grood.history)} items")
