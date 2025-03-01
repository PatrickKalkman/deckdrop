import json

# Load the JSON file
with open("dropmind/models/improved_qtable_final.json", "r") as f:
    qtable = json.load(f)

# Create a TypeScript file
with open("dropmind/models/qtable.ts", "w") as f:
    f.write("// Auto-generated Q-table\n")
    f.write("export const qTableData = ")
    json.dump(qtable, f)
    f.write(";\n")
