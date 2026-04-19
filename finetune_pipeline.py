import os
import torch
from transformers import (
    AutoModelForCausalLM, 
    AutoTokenizer, 
    TrainingArguments,
    Trainer,
    DataCollatorForLanguageModeling
)
from peft import LoraConfig, get_peft_model
from datasets import Dataset

# Fix for Windows Encoding
os.environ["PYTHONUTF8"] = "1"

# 1. LOAD MODEL & TOKENIZER (CPU Optimized)
model_id = "microsoft/Phi-3-mini-4k-instruct"
tokenizer = AutoTokenizer.from_pretrained(model_id)
tokenizer.pad_token = tokenizer.eos_token

print("\n--- 🚀 INITIALIZING STABLE i9 ENGINE ---")
model = AutoModelForCausalLM.from_pretrained(
    model_id, 
    device_map={"": "cpu"},
    torch_dtype=torch.float32,
    trust_remote_code=True
)

# 2. LORA CONFIG (FIXED FOR PHI-3)
lora_config = LoraConfig(
    r=8, 
    lora_alpha=16,
    target_modules=["qkv_proj"], # Fixed: Phi-3 uses combined qkv_proj
    lora_dropout=0.05,
    bias="none",
    task_type="CAUSAL_LM"
)
model = get_peft_model(model, lora_config)

# 3. DATASET
data = [
    {"text": "### Receipt: MILK $2.50 ### JSON: [{'item': 'Milk', 'price': 2.5}]"},
    {"text": "### Receipt: EGGS $4.99 ### JSON: [{'item': 'Eggs', 'price': 4.99}]"},
    {"text": "### Receipt: BREAD $3.25 ### JSON: [{'item': 'Bread', 'price': 3.25}]"},
    {"text": "### Receipt: APPLE $1.20 ### JSON: [{'item': 'Apple', 'price': 1.20}]"}
]
dataset = Dataset.from_list(data)

def tokenize_function(examples):
    return tokenizer(examples["text"], padding="max_length", truncation=True, max_length=128)

tokenized_dataset = dataset.map(tokenize_function, batched=True)

# 4. TRAINING ARGUMENTS
training_args = TrainingArguments(
    output_dir="./grood-phi3-finetuned",
    per_device_train_batch_size=1, 
    gradient_accumulation_steps=1,
    learning_rate=2e-4,
    max_steps=20, 
    use_cpu=True,
    logging_steps=5,
    report_to="none"
)

# 5. START TRAINING
print("\n--- 🧠 TRAINING ON i9 CPU ---")
print("Module 'qkv_proj' targeted. This is the correct Phi-3 structure.")
trainer = Trainer(
    model=model,
    train_dataset=tokenized_dataset,
    args=training_args,
    data_collator=DataCollatorForLanguageModeling(tokenizer, mlm=False),
)

trainer.train()

# 6. SAVE
print("\n--- 💾 SAVING TO: ./grood-phi3-finetuned ---")
model.save_pretrained("./grood-phi3-finetuned")
tokenizer.save_pretrained("./grood-phi3-finetuned")

print("\n🏆 SUCCESS! i9 TRAINING COMPLETE.")
