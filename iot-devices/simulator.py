import pika
import time
import json
import random
import os
import requests
import psutil
from dotenv import load_dotenv

load_dotenv()

# RabbitMQ Config
RABBITMQ_HOST = os.getenv("RABBITMQ_HOST", "rabbitmq")
RABBITMQ_PORT = int(os.getenv("RABBITMQ_PORT", 5672))
RABBITMQ_USER = os.getenv("RABBITMQ_USER", "guest")
RABBITMQ_PASSWORD = os.getenv("RABBITMQ_PASSWORD", "guest")

# Device API Config
DEVICE_API_URL = os.getenv("DEVICE_API_URL", "http://localhost:8001").rstrip("/")
EXCHANGE_NAME = "device_events"

def get_connection():
    credentials = pika.PlainCredentials(RABBITMQ_USER, RABBITMQ_PASSWORD)
    parameters = pika.ConnectionParameters(host=RABBITMQ_HOST, port=RABBITMQ_PORT, credentials=credentials)
    
    while True:
        try:
            connection = pika.BlockingConnection(parameters)
            print("Connected to RabbitMQ!")
            return connection
        except pika.exceptions.AMQPConnectionError as e:
            print(f"Connection failed, retrying in 5s: {e}")
            time.sleep(5)

def fetch_devices():
    """Fetch list of devices from the Device Management API"""
    try:
        response = requests.get(f"{DEVICE_API_URL}/devices/")
        if response.status_code == 200:
            devices = response.json()
            # Convert to dict format {id: {city, name}}
            return {d['device_id']: {'city': d.get('city', 'Unknown'), 'name': d.get('name')} for d in devices}
    except Exception as e:
        print(f"Error fetching devices: {e}")
    return {}

def ensure_host_device():
    """Ensure a Host PC device exists"""
    try:
        devices = fetch_devices()
        # Check if already exists
        for dev_id, info in devices.items():
            if info['name'] == "Host PC":
                print(f"Found existing Host PC: {dev_id}")
                return dev_id

        # Create if not exists
        print("Creating Host PC device...")
        payload = {
            "name": "Host PC",
            "type": "Server",
            "city": "Local",
            "ip_address": "127.0.0.1",
            "mac_address": "00:00:00:00:00:00",
            "firmware_version": "v1.0",
            "latitude": "0",
            "longitude": "0"
        }
        res = requests.post(f"{DEVICE_API_URL}/devices/", json=payload)
        if res.status_code == 200 or res.status_code == 201:
            data = res.json()
            print(f"Created Host PC: {data['device_id']}")
            return data['device_id']
    except Exception as e:
        print(f"Error ensuring host device: {e}")
    return None

def main():
    connection = get_connection()
    channel = connection.channel()
    
    # Declare exchange to ensure it exists
    channel.exchange_declare(exchange=EXCHANGE_NAME, exchange_type='topic', durable=True)

    try:
        while True:
            # 1. Fetch real devices from API
            active_devices = fetch_devices()
            
            if not active_devices:
                print("No devices found. Waiting...")
            
            for device_id, info in active_devices.items():
                city = info['city']
                name = info['name']

                # SKIP Host PC (Logic moved to end-devices/local_monitor.py)
                if city == 'Local' or name == 'Host PC':
                    continue
                
                # Randomize per device to make them distinct
                # We simulate environmental data + some base noise for system stats (optional)
                device_cpu = round(random.uniform(5, 30), 1)
                device_ram = round(random.uniform(20, 60), 1)
                device_disk = round(random.uniform(10, 40), 1)

                payload = {
                    "device_id": device_id,
                    "city": city or "Unknown",
                    "temperature": round(random.uniform(5.0, 45.0), 2),
                    "humidity": round(random.uniform(20.0, 90.0), 2),
                    "cpu_usage": device_cpu,
                    "ram_usage": device_ram,
                    "disk_usage": device_disk,
                    "timestamp": time.time()
                }
                
                # Routing key format: cloud-security-iot.iot.temperature.{device_id}
                routing_key = f"cloud-security-iot.iot.temperature.{device_id}"
                
                channel.basic_publish(
                    exchange=EXCHANGE_NAME,
                    routing_key=routing_key,
                    body=json.dumps(payload)
                )
                print(f"[>] Published for {name} ({city})")
                
            time.sleep(5) 
    except KeyboardInterrupt:
        print("Stopping simulation")
        connection.close()
    except Exception as e:
        print(f"Error: {e}")
        connection.close()

if __name__ == "__main__":
    main()
