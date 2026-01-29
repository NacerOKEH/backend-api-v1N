import requests
import json

try:
    # Test Paris
    response = requests.get("http://localhost:8002/monitoring/predict/Paris")
    data = response.json()

    print("Status Code:", response.status_code)
    
    if "hourly_forecast" in data:
        print("✅ 'hourly_forecast' found in response")
        hourly = data["hourly_forecast"]
        print(f"Count of hourly items: {len(hourly)}")
        if len(hourly) > 0:
            print("First item sample:", hourly[0])
            if "temperature" in hourly[0] and "humidity" in hourly[0] and "time" in hourly[0]:
                 print("✅ Structure looks correct")
            else:
                 print("❌ Structure missing keys")
    else:
        print("❌ 'hourly_forecast' NOT found in response")
        print("Keys found:", data.keys())

except Exception as e:
    print(f"❌ Error: {e}")
