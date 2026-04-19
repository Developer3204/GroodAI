import torch
import os
import json
import shutil
from peft import PeftModel
from transformers import AutoModelForCausalLM, AutoTokenizer

# 1. SETUP PATHS
os.environ["PYTHONUTF8"] = "1"
base_model_id = "microsoft/Phi-3-mini-4k-instruct"
adapter_id = "./grood-phi3-finetuned"
output_dir = "./grood_brain_final"

def merge():
    print("\n" + "="*50)
    print("🚀  STARTING FINAL BRAIN FUSION (MAX STABILITY MODE)")
    print("="*50)
    
    # Check if training actually happened
    if not os.path.exists(adapter_id):
        print(f"❌ ERROR: Cannot find folder {adapter_id}")
        print("Please run 'python finetune_pipeline.py' first!")
        return

    # Fix the adapter_config.json if it's missing keys
    print("\nChecking Knowledge config...")
    config_path = os.path.join(adapter_id, "adapter_config.json")
    with open(config_path, "r") as f:
        config = json.load(f)
    config["peft_type"] = "LORA"
    config["task_type"] = "CAUSAL_LM"
    with open(config_path, "w") as f:
        json.dump(config, f, indent=4)

    try:
        print("\n1. Loading Tokenizer...")
        tokenizer = AutoTokenizer.from_pretrained(base_model_id)

        print("\n2. Loading Base AI Model (Native implementation)...")
        # We REMOVE device_map and trust_remote_code to fix the 'meta' device errors
        # This will load the model directly into your RAM where it's safe.
        base_model = AutoModelForCausalLM.from_pretrained(
            base_model_id, 
            torch_dtype=torch.float32, # Best for CPU/i9
            low_cpu_mem_usage=True,
            trust_remote_code=False # Using native code fixes the nested 'model.model' bug
        )

        print("\n3. Attaching your trained 'Lessons'...")
        # Using a fixed map to ensure the adapter sits on the CPU with the base model
        model = PeftModel.from_pretrained(
            base_model, 
            adapter_id,
            torch_dtype=torch.float32,
            device_map={"": "cpu"} 
        )

        print("\n4. Fusing weights into a single brain (This takes ~60 seconds)...")
        # We manually move to CPU to guarantee no meta-device ghost weights
        model = model.to("cpu")
        merged_model = model.merge_and_unload()

        print(f"\n5. Saving finalized brain to: {output_dir}")
        if os.path.exists(output_dir):
            shutil.rmtree(output_dir)
            
        merged_model.save_pretrained(output_dir, safe_serialization=True)
        tokenizer.save_pretrained(output_dir)
        
        print("\n" + "🏆"*20)
        print("SUCCESS! THE BRAIN IS PERMANENTLY FUSED.")
        print("" + "🏆"*20)
        print(f"\nExport for Web App now with this command:")
        print(f"optimum-cli export onnx --model {output_dir} --task text-generation-with-past ./onnx_export/")

    except Exception as e:
        print(f"\n❌ FUSION FAILED: {e}")
        print("\nTroubleshooting: Close other apps (Chrome/Discord) to free up RAM.")

if __name__ == "__main__":
    merge()
