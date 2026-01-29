import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import socketio
from services.consumer import DeviceEventConsumer
import asyncio

from controllers import monitoring_controller

app = FastAPI(title="Monitoring Service")

app.include_router(monitoring_controller.router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Socket.IO Setup
sio = socketio.AsyncServer(async_mode='asgi', cors_allowed_origins='*')
socket_app = socketio.ASGIApp(sio, app)

# Helper to emit from sync thread
def emit_event(event, data):
    try:
        loop = asyncio.get_event_loop()
        asyncio.run_coroutine_threadsafe(sio.emit(event, data), loop)
    except Exception as e:
        print(f"Emit error: {e}")

# Pass a wrapper or the raw object.
# Since existing consumer code in previous step had issues with async emit, 
# I will patch the consumer to take a loop and use run_coroutine_threadsafe.

@app.on_event("startup")
async def startup_event():
    # Start consumer thread
    # We pass the sio instance, but we need to handle the async call there.
    # The consumer is in a thread, so it can't await. 
    # We will redefine Consumer to accept a loop.
    loop = asyncio.get_running_loop()
    print("STARTUP: Monitoring Service Starting...")

    # Wrapper to bridge sync consumer thread -> async sio emit
    class SioWrapper:
        def __init__(self, original_sio, loop):
            self.original_sio = original_sio
            self.loop = loop
            
        def emit(self, event, data):
            # Schedule the coroutine in the main event loop
            asyncio.run_coroutine_threadsafe(self.original_sio.emit(event, data), self.loop)
             
    # Start Consumer
    try:
        print("STARTUP: Initializing DeviceEventConsumer...")
        consumer = DeviceEventConsumer(SioWrapper(sio, loop))
        consumer.start()
        print("STARTUP: DeviceEventConsumer started.")
    except Exception as e:
        print(f"STARTUP ERROR: Could not start consumer: {e}")

@sio.event
async def connect(sid, environ):
    print("Client connected", sid)

@sio.event
async def disconnect(sid):
    print("Client disconnected", sid)

@app.get("/")
def root():
    return {"message": "Monitoring Service Running"}

if __name__ == "__main__":
    uvicorn.run("main:socket_app", host="0.0.0.0", port=8002, reload=True)
