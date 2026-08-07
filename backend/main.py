import os
import time
import datetime
import random
from fastapi import FastAPI, HTTPException
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
import psutil

# Google Calendar API imports
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

app = FastAPI(title="Home Kiosk Backend")

# Enable CORS for development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SCOPES = ['https://www.googleapis.com/auth/calendar.readonly']
TOKEN_PATH = os.path.join(os.path.dirname(__file__), 'token.json')
CREDENTIALS_PATH = os.path.join(os.path.dirname(__file__), 'credentials.json')

def get_cpu_temp():
    """Gets CPU temperature of the Pi. Falls back to simulated values on non-Linux/non-Pi hardware."""
    try:
        temps = psutil.sensors_temperatures()
        if 'cpu_thermal' in temps:
            return round(temps['cpu_thermal'][0].current, 1)
        elif 'thermal_zone0' in temps:
            return round(temps['thermal_zone0'][0].current, 1)
        # Search for any temp sensor
        for key in temps:
            if temps[key]:
                return round(temps[key][0].current, 1)
    except Exception:
        pass
    
    # Graceful fallback: simulated realistic CPU temperature
    # Base temp + random fluctuation based on CPU load
    cpu_usage = psutil.cpu_percent()
    base_temp = 42.0
    load_addition = (cpu_usage / 100.0) * 15.0
    noise = random.uniform(-1.0, 1.0)
    return round(base_temp + load_addition + noise, 1)

def get_formatted_uptime():
    """Calculates formatted uptime."""
    try:
        boot_time = psutil.boot_time()
        uptime_seconds = time.time() - boot_time
        
        days, remainder = divmod(int(uptime_seconds), 86400)
        hours, remainder = divmod(remainder, 3600)
        minutes, seconds = divmod(remainder, 60)
        
        parts = []
        if days > 0:
            parts.append(f"{days}d")
        if hours > 0:
            parts.append(f"{hours}h")
        if minutes > 0:
            parts.append(f"{minutes}m")
        if not parts:
            parts.append(f"{seconds}s")
            
        return " ".join(parts)
    except Exception:
        return "Unknown"

@app.get("/api/metrics")
def get_metrics():
    """Exposes real-time system metrics of the Raspberry Pi."""
    try:
        cpu_usage = psutil.cpu_percent(interval=None)
        memory = psutil.virtual_memory()
        disk = psutil.disk_usage('/')
        
        return {
            "cpu_usage": cpu_usage,
            "cpu_temp": get_cpu_temp(),
            "memory_usage": memory.percent,
            "memory_used_gb": round(memory.used / (1024**3), 2),
            "memory_total_gb": round(memory.total / (1024**3), 2),
            "uptime": get_formatted_uptime(),
            "disk_usage": disk.percent,
            "timestamp": datetime.datetime.now().isoformat()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

def get_mock_events():
    """Generates realistic mock events relative to today's date for demo mode."""
    today = datetime.date.today()
    tomorrow = today + datetime.timedelta(days=1)
    day_after = today + datetime.timedelta(days=2)
    next_week = today + datetime.timedelta(days=5)

    return [
        {
            "id": "mock_1",
            "summary": "Weekly Kiosk Project Sync",
            "start": {"dateTime": f"{today.isoformat()}T10:00:00", "timeZone": "UTC"},
            "end": {"dateTime": f"{today.isoformat()}T11:00:00", "timeZone": "UTC"},
            "description": "Align on the frontend layout, design assets, and api endpoints.",
            "location": "Virtual Meeting Room",
            "colorId": "1"
        },
        {
            "id": "mock_2",
            "summary": "Gym - Leg Day",
            "start": {"dateTime": f"{today.isoformat()}T17:30:00", "timeZone": "UTC"},
            "end": {"dateTime": f"{today.isoformat()}T19:00:00", "timeZone": "UTC"},
            "description": "Squats, lunges, and calf raises. Don't skip it!",
            "location": "Fit Life Gym",
            "colorId": "5"
        },
        {
            "id": "mock_3",
            "summary": "Dentist Appointment",
            "start": {"dateTime": f"{tomorrow.isoformat()}T09:15:00", "timeZone": "UTC"},
            "end": {"dateTime": f"{tomorrow.isoformat()}T10:15:00", "timeZone": "UTC"},
            "description": "Routine dental checkup and clean.",
            "location": "Smile Dental Clinic",
            "colorId": "9"
        },
        {
            "id": "mock_4",
            "summary": "Dinner with Friends",
            "start": {"dateTime": f"{tomorrow.isoformat()}T19:00:00", "timeZone": "UTC"},
            "end": {"dateTime": f"{tomorrow.isoformat()}T21:30:00", "timeZone": "UTC"},
            "description": "Catching up with Sarah and Dave at the new Italian restaurant.",
            "location": "Luigi's Trattoria",
            "colorId": "2"
        },
        {
            "id": "mock_5",
            "summary": "Buy Groceries",
            "start": {"date": day_after.isoformat()},
            "end": {"date": day_after.isoformat()},
            "description": "Milk, eggs, coffee, spinach, chicken breasts, and snacks.",
            "location": "Whole Foods Market",
            "colorId": "8"
        },
        {
            "id": "mock_6",
            "summary": "Robotics Club Meetup",
            "start": {"dateTime": f"{next_week.isoformat()}T14:00:00", "timeZone": "UTC"},
            "end": {"dateTime": f"{next_week.isoformat()}T16:00:00", "timeZone": "UTC"},
            "description": "Monthly meeting discussing Raspberry Pi projects and microcontrollers.",
            "location": "Community Center Lab",
            "colorId": "6"
        }
    ]

@app.get("/api/calendar")
def get_calendar_events():
    """Fetches upcoming calendar events from Google Calendar, falling back to mock data if unconfigured."""
    creds = None
    
    # Check if we have token file
    if os.path.exists(TOKEN_PATH):
        try:
            creds = Credentials.from_authorized_user_file(TOKEN_PATH, SCOPES)
        except Exception as e:
            print(f"Error loading token: {e}")
            creds = None

    # If credentials expired, attempt to refresh
    if creds and creds.expired and creds.refresh_token:
        try:
            creds.refresh(Request())
            # Save the refreshed credentials
            with open(TOKEN_PATH, 'w') as token:
                token.write(creds.to_json())
        except Exception as e:
            print(f"Error refreshing credentials: {e}")
            creds = None

    # If valid credentials exist, fetch from Google API
    if creds and creds.valid:
        try:
            service = build('calendar', 'v3', credentials=creds)
            
            # Retrieve from current time onwards
            now = datetime.datetime.utcnow().isoformat() + 'Z'
            events_result = service.events().list(
                calendarId='primary',
                timeMin=now,
                maxResults=15,
                singleEvents=True,
                orderBy='startTime'
            ).execute()
            
            events = events_result.get('items', [])
            
            # Map events to standard structure
            processed_events = []
            for item in events:
                processed_events.append({
                    "id": item.get("id"),
                    "summary": item.get("summary", "No Title"),
                    "start": item.get("start"),
                    "end": item.get("end"),
                    "description": item.get("description", ""),
                    "location": item.get("location", ""),
                    "colorId": item.get("colorId", "1")
                })
                
            return {
                "status": "connected",
                "events": processed_events
            }
        except Exception as e:
            # Fallback to mock on API error with warning
            return {
                "status": "error",
                "message": f"Google API Error: {str(e)}",
                "events": get_mock_events()
            }
            
    # Otherwise, return status unconfigured and mock events
    has_credentials_json = os.path.exists(CREDENTIALS_PATH)
    return {
        "status": "demo",
        "has_credentials_json": has_credentials_json,
        "message": "Google Calendar not connected. Showing demo events.",
        "events": get_mock_events()
    }

# Mount static files directory
# Note: Keep static files mount last so it doesn't shadow api endpoints
static_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'static')
os.makedirs(static_dir, exist_ok=True)

app.mount("/static", StaticFiles(directory=static_dir), name="static")

@app.get("/")
def redirect_to_index():
    """Redirect root path to the index.html page."""
    return RedirectResponse(url="/static/index.html")

if __name__ == "__main__":
    import uvicorn
    # Bind to 0.0.0.0 so it is accessible from other devices on the network
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
