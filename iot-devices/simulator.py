import paho.mqtt.client as mqtt
import time
import json
import random
import os
from dotenv import load_dotenv

load_dotenv()

BROKER = os.getenv("MQTT_BROKER", "localhost")
PORT = int(os.getenv("MQTT_PORT", 1883))
TOPIC = "sensors/data"

client = mqtt.Client()

def on_connect(client, userdata, flags, rc):
    print(f"Connected with result code {rc}")

client.on_connect = on_connect

try:
    client.connect(BROKER, PORT, 60)
except Exception as e:
    print(f"Connection failed: {e}")
    exit(1)

client.loop_start()

# Major cities list
# Major cities list
cities_list = [
    "Casablanca", "Rabat", "Marrakech", "Tanger", "Agadir", "Fes", "Meknes", "Oujda", "Tetouan", "Essaouira",
    "Paris", "London", "New York", "Tokyo", "Berlin", "Madrid", "Rome", 
    "Beijing", "Sydney", "Moskow", "Dubai", "Singapore", "Toronto", 
    "Mumbai", "Sao Paulo", "Cairo", "Istanbul", "Seoul"
]

# Generate device IDs dynamically
devices = {f"device_{i+1:03d}": city for i, city in enumerate(cities_list)}

try:
    while True:
        for device_id, city in devices.items():
            payload = {
                "device_id": device_id,
                "city": city,
                "temperature": round(random.uniform(5.0, 45.0), 2), # Wider range
                "humidity": round(random.uniform(20.0, 90.0), 2),
                "timestamp": time.time()
            }
            client.publish(TOPIC, json.dumps(payload))
            print(f"Published to {TOPIC}: {payload}")
        time.sleep(5)
except KeyboardInterrupt:
    print("Stopping simulation")
    client.loop_stop()
    client.disconnect()
