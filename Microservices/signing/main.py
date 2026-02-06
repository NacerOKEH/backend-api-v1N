import uvicorn

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from controllers.auth_controller import router
from helpers.config import Base,engine

app=FastAPI(
    title="Authentication app",
    description="Micro service signing app "
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

#create one time
Base.metadata.create_all(bind=engine)
app.include_router(router)


if __name__ == '__main__':
    uvicorn.run("main:app",host="0.0.0.0",reload=True)