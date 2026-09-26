import os

lines = []
lines.append("TEST_DATA = [")
for i in range(2000):
    lines.append("    {")
    lines.append(f"        'id': {i},")
    lines.append(f"        'name': 'Test Item {i}',")
    lines.append(f"        'value': {i * 1.5},")
    lines.append("        'active': True,")
    lines.append("        'description': 'This is a long description to make the code look somewhat realistic for a test case.',")
    lines.append("    },")
lines.append("]")

with open('f:\\AegisOne\\test_large_dummy_data.py', 'w') as f:
    f.write('\n'.join(lines))
print(f"Generated test_large_dummy_data.py with {len(lines)} lines.")
