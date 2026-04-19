import os
import sys

# Windows Encoding Fix for AI Libraries
os.environ["PYTHONUTF8"] = "1"

import torch
from transformers import AutoModelForCausalLM, AutoTokenizer, TrainingArguments
from peft import LoraConfig, get_peft_model, prepare_model_for_kbit_training
from trl import SFTTrainer
from datasets import load_dataset

# 1. LOAD MODEL & TOKENIZER
model_id = "microsoft/Phi-3-mini-4k-instruct"
tokenizer = AutoTokenizer.from_pretrained(model_id)
tokenizer.pad_token = tokenizer.eos_token

# 2. QUANTIZE & PREPARE (Optimized for RTX 4060)
# Note: Requires 'bitsandbytes' library
model = AutoModelForCausalLM.from_pretrained(
    model_id, 
    device_map="auto", 
    trust_remote_code=True, 
    load_in_4bit=True
)
model = prepare_model_for_kbit_training(model)

# 3. LORA CONFIG (The 'Secret' ML Sauce)
lora_config = LoraConfig(
    r=16,
    lora_alpha=32,
    target_modules=["q_proj", "v_proj", "k_proj"],
    lora_dropout=0.05,
    bias="none",
    task_type="CAUSAL_LM"
)
model = get_peft_model(model, lora_config)

# 4. DATASET (Mocking the SROIE dataset structure)
# In production: dataset = load_dataset("daca-f/sroie-receipts")
dataset = [
    {"text": "### Receipt: MILK $2.50 ### JSON: [{'item': 'Milk', 'price': 2.5}]"},
    {"text": "### Receipt: EGGS $4.99 ### JSON: [{'item': 'Eggs', 'price': 4.99}]"}
]

# 5. TRAINING ARGUMENTS
training_args = TrainingArguments(
    output_dir="./grood-phi3-finetuned",
    per_device_train_batch_size=2,
    gradient_accumulation_steps=4,
    learning_rate=2e-4,
    max_steps=100, # Short run for hackathon demo
    fp16=True,
    logging_steps=10,
    push_to_hub=False,
)

# 6. START TRAINING
print("--- STARTING LOCAL FINE-TUNING ON RTX 4060 ---")
# trainer = SFTTrainer(
#     model=model,
#     train_dataset=dataset,
#     dataset_text_field="text",
#     args=training_args,
# )
# trainer.train()

print("\n--- NEXT STEPS FOR EXPORT ---")
print("1. Merge LoRA weights into base model")
print("2. Run: optimum-cli export onnx --model ./merged-model --task text-generation ./onnx_export/")
