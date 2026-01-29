import requests
import json

URL = "http://localhost:8001/devices/"

payload = {
    "name": "TestScript",
    "type": "Sensor",
    "city": "Paris",
    "ip_address": "1.2.3.4",
    "mac_address": "AA:BB:CC:DD:EE:FF",
    "firmware_version": "v1.0",
    "latitude": "0",
    "longitude": "0"
}

print(f"Sending POST to {URL} with payload: {payload}")
try:
    res = requests.post(URL, json=payload)
    print(f"Status Code: {res.status_code}")
    print(f"Response: {res.text}")
    
    if res.status_code == 200:
        print("Device added. Fetching list...")
        list_res = requests.get(URL)
        devices = list_res.json()
        found = any(d['name'] == "TestScript" for d in devices)
        print(f"Device found in list: {found}")
        for d in devices:
            if d['name'] == "TestScript":
                 print(f"Device Data: {d}")
except Exception as e:
    print(f"Error: {e}")
