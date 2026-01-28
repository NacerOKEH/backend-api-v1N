import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi_mqtt import FastMQTT, MQTTConfig
from config.database import Base, engine
from controllers import device_controller
from helpers.rabbitmq_helper import rabbitmq_helper
import json
import os
from dotenv import load_dotenv

load_dotenv()

# Create tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Device Management Service",
    description="Microservice for managing devices"
)

app.include_router(device_controller.router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# MQTT Config
mqtt_config = MQTTConfig(
    host=os.getenv("MQTT_HOST", "mosquitto"),
    port=int(os.getenv("MQTT_PORT", 1883)),
    keepalive=60,
    username=os.getenv("MQTT_USER", "guest"),
    password=os.getenv("MQTT_PASSWORD", "guest"),
)

mqtt = FastMQTT(config=mqtt_config)

mqtt.init_app(app)

@mqtt.on_connect()
def connect(client, flags, rc, properties):
    mqtt.client.subscribe("sensors/data")
    print("Connected to MQTT Broker: ", rc)

@mqtt.on_message()
async def message(client, topic, payload, qos, properties):
    print("Received message: ", topic, payload.decode())
    try:
        data = json.loads(payload.decode())
        
        # 1. Forward to RabbitMQ (for Monitoring)
        rabbitmq_helper.publish_event(
            routing_key="device.telemetry",
            message=data
        )
    except Exception as e:
        print(f"Error processing MQTT message: {e}")

@app.get("/")
def root():
    return {"message": "Device Management Service Running"}

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8001, reload=True)
