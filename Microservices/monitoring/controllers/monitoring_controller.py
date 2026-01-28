from fastapi import APIRouter
from config.database import collection

router = APIRouter(
    prefix="/monitoring",
    tags=["monitoring"]
)

@router.get("/events")
def get_events(limit: int = 100):
    events = list(collection.find({}, {"_id": 0}).sort("timestamp", -1).limit(limit))
    return events

# Integration of Prediction Service
from services.prediction_service import prediction_service

@router.get("/predict/{city}", tags=["machine-learning"])
async def predict_city(city: str):
    """
    Predicts temperature for the next hour using Open-Meteo API and Scikit-Learn.
    """
    return prediction_service.predict_temperature(city)
