import kagglehub
import os

print("Downloading model...")
path = kagglehub.model_download("skanderadamafi/multilingual-tunisian-english-model/scikitLearn/default")
print("Path to model files:", path)
print("Files in path:")
for root, dirs, files in os.walk(path):
    for file in files:
        print(os.path.join(root, file))