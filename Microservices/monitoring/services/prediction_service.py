import requests
from datetime import datetime

class PredictionService:
    def __init__(self):
        # Mapping cities to Lat/Lon for Open-Meteo
        self.city_coords = {
            "Paris": {"lat": 48.8566, "lon": 2.3522},
            "London": {"lat": 51.5074, "lon": -0.1278},
            "New York": {"lat": 40.7128, "lon": -74.0060},
            "Tokyo": {"lat": 35.6762, "lon": 139.6503},
            "Berlin": {"lat": 52.5200, "lon": 13.4050},
            "Madrid": {"lat": 40.4168, "lon": -3.7038},
            "Rome": {"lat": 41.9028, "lon": 12.4964},
            "Beijing": {"lat": 39.9042, "lon": 116.4074},
            "Sydney": {"lat": -33.8688, "lon": 151.2093},
            "Moskow": {"lat": 55.7558, "lon": 37.6173},
            "Dubai": {"lat": 25.2048, "lon": 55.2708},
            "Singapore": {"lat": 1.3521, "lon": 103.8198},
            "Toronto": {"lat": 43.6510, "lon": -79.3470},
            "Mumbai": {"lat": 19.0760, "lon": 72.8777},
            "Sao Paulo": {"lat": -23.5505, "lon": -46.6333},
            "Cairo": {"lat": 30.0444, "lon": 31.2357},
            "Istanbul": {"lat": 41.0082, "lon": 28.9784},
            "Seoul": {"lat": 37.5665, "lon": 126.9780},
            # Moroccan Cities
            "Casablanca": {"lat": 33.5898, "lon": -7.6038},
            "Rabat": {"lat": 34.0208, "lon": -6.8416},
            "Marrakech": {"lat": 31.6286, "lon": -7.9920},
            "Tanger": {"lat": 35.7673, "lon": -5.7998},
            "Agadir": {"lat": 30.4277, "lon": -9.5981},
            "Fes": {"lat": 34.0400, "lon": -4.8700},
            "Meknes": {"lat": 33.8935, "lon": -5.5473},
            "Oujda": {"lat": 34.6894, "lon": -1.9128},
            "Tetouan": {"lat": 35.5785, "lon": -5.3684},
            "Essaouira": {"lat": 31.5063, "lon": -9.7543},
            "Unknown": {"lat": 33.5898, "lon": -7.6038} # Default to Casablanca
        }

    def predict_temperature(self, city: str):
        coords = self.city_coords.get(city, self.city_coords["Unknown"])
        
        # 1. Fetch 7-Day Forecast & Hourly Data from Open-Meteo
        # daily=temperature_2m_max,temperature_2m_min,weathercode
        # hourly=temperature_2m,relative_humidity_2m
        url = f"https://api.open-meteo.com/v1/forecast?latitude={coords['lat']}&longitude={coords['lon']}&daily=temperature_2m_max,temperature_2m_min,weathercode&hourly=temperature_2m,relative_humidity_2m&timezone=auto"
        
        try:
            response = requests.get(url)
            data = response.json()
            
            daily = data.get("daily", {})
            times = daily.get("time", [])
            max_temps = daily.get("temperature_2m_max", [])
            min_temps = daily.get("temperature_2m_min", [])
            codes = daily.get("weathercode", [])
            
            hourly = data.get("hourly", {})
            h_times = hourly.get("time", [])
            h_temps = hourly.get("temperature_2m", [])
            h_humidity = hourly.get("relative_humidity_2m", [])

            if not times:
                return {"error": "External API connection failed"}

            # Process Daily Forecast
            forecast = []
            for i in range(len(times)):
                forecast.append({
                    "date": times[i],
                    "max_temp": max_temps[i],
                    "min_temp": min_temps[i],
                    "condition": self.get_weather_condition(codes[i])
                })

            # Process Hourly Forecast (Next 24 hours)
            hourly_forecast = []
            # We'll take the first 24 hours from the response
            limit = min(len(h_times), 24)
            for i in range(limit):
                # Format time to be more readable (e.g., "14:00")
                dt = datetime.fromisoformat(h_times[i])
                time_str = dt.strftime("%H:%M")
                
                hourly_forecast.append({
                    "time": time_str,
                    "temperature": h_temps[i],
                    "humidity": h_humidity[i]
                })

            return {
                "city": city,
                "latitude": coords['lat'],
                "longitude": coords['lon'],
                "weekly_forecast": forecast,
                "hourly_forecast": hourly_forecast
            }

        except Exception as e:
            print(f"Prediction Error: {e}")
            return {"error": str(e)}

    def get_weather_condition(self, code):
        # WMO Weather interpretation codes (WW)
        if code == 0: return "Clear sky"
        if code in [1, 2, 3]: return "Partly cloudy"
        if code in [45, 48]: return "Fog"
        if code in [51, 53, 55]: return "Drizzle"
        if code in [61, 63, 65]: return "Rain"
        if code in [71, 73, 75]: return "Snow"
        if code in [95, 96, 99]: return "Thunderstorm"
        return "Unknown"

prediction_service = PredictionService()
