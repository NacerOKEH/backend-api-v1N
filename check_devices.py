import urllib.request
import json

try:
    with urllib.request.urlopen("http://localhost:8001/devices/") as response:
        data = json.load(response)
        print(f"{'ID':<15} | {'Name':<10} | {'City'}")
        print("-" * 40)
        for d in data:
            print(f"{d.get('device_id')[:8]:<15} | {d.get('name'):<10} | {d.get('city')}")
except Exception as e:
    print(e)
