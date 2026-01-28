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
    
    class AsyncConsumer(DeviceEventConsumer):
        def __init__(self, sio, loop):
            super().__init__(sio)
            self.loop = loop

        def emit_device_update(self, event_data, routing_key):
             # This method replaces the direct self.sio.emit call in the parent class
             asyncio.run_coroutine_threadsafe(self.sio.emit('device_update', {'type': routing_key, 'data': event_data}), self.loop)

    consumer = AsyncConsumer(sio, loop)
    
    # We also need to monkeypatch the callback in the parent or change the parent to call a method we can override.
    # Looking at consumer.py: calls self.sio.emit(...) directly.
    # So we MUST monkeypatch it on the instance, but NOT by calling self.sio.emit inside the lambda.
    
    # Correct approach:
    # 1. Define the async emitter function
    def thread_safe_emit(event, data):
        asyncio.run_coroutine_threadsafe(sio.emit(event, data), loop)
        
    # 2. Assign this function to the consumer instance's sio component, essentially mocking it partially.
    # BUT sio is the actual AsyncServer object. We can't overwrite .emit on it if we want to use it.
    
    # Better: wrapping sio.
    class SioWrapper:
        def __init__(self, original_sio, loop):
            self.original_sio = original_sio
            self.loop = loop
            
        def emit(self, event, data):
             asyncio.run_coroutine_threadsafe(self.original_sio.emit(event, data), self.loop)
             
    # Pass the wrapper to the consumer instead of the raw sio
    consumer = DeviceEventConsumer(SioWrapper(sio, loop))
    consumer.start()

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
