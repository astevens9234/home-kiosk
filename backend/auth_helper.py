import os
from google_auth_oauthlib.flow import InstalledAppFlow

SCOPES = ['https://www.googleapis.com/auth/calendar.readonly']
BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
CREDENTIALS_PATH = os.path.join(BACKEND_DIR, 'credentials.json')
TOKEN_PATH = os.path.join(BACKEND_DIR, 'token.json')

def main():
    print("====================================================")
    print("      Google Calendar API Authentication Helper      ")
    print("====================================================")
    
    if not os.path.exists(CREDENTIALS_PATH):
        print(f"\n[ERROR] '{CREDENTIALS_PATH}' not found!")
        print("\nPlease follow these steps first:")
        print("1. Go to the Google Cloud Console: https://console.cloud.google.com/")
        print("2. Create a new Project (or select an existing one).")
        print("3. Search for 'Google Calendar API' and Enable it.")
        print("4. Go to 'APIs & Services' > 'OAuth consent screen'.")
        print("   - Set User Type to 'External'.")
        print("   - Fill in app name and developer email.")
        print("   - Add the scopes: '.../auth/calendar.readonly'.")
        print("   - Under 'Test users', add the Gmail address of the calendar owner.")
        print("5. Go to 'APIs & Services' > 'Credentials'.")
        print("   - Click '+ Create Credentials' > 'OAuth client ID'.")
        print("   - Select Application type: 'Web application' or 'Desktop app'.")
        print("     - Note: 'Desktop app' is easiest for local authentication.")
        print("   - Name it and click Create.")
        print("   - Download the JSON client secrets file.")
        print(f"6. Place the downloaded JSON file in '{CREDENTIALS_PATH}'.")
        print("7. Re-run this script.")
        print("====================================================\n")
        return

    print(f"\nFound '{CREDENTIALS_PATH}'. Starting authentication flow...")
    try:
        # Run local server flow
        # We bind to port 8085 or similar.
        flow = InstalledAppFlow.from_client_secrets_file(CREDENTIALS_PATH, SCOPES)
        
        # This will open a browser window on the local machine.
        # If running headless on a Pi via SSH, run this helper on your laptop,
        # copy the resulting token.json to the Pi's backend folder.
        # Alternatively, use SSH port forwarding to access the flow server locally:
        # ssh -L 8085:localhost:8085 pi@<pi-ip-address>
        creds = flow.run_local_server(
            port=8085,
            prompt='consent',
            success_message='Authorization complete! You can close this tab.'
        )
        
        # Save credentials for future use
        with open(TOKEN_PATH, 'w') as token:
            token.write(creds.to_json())
            
        print("\n====================================================")
        print(f"[SUCCESS] Auth token saved successfully to '{TOKEN_PATH}'!")
        print("You can now restart your backend server.")
        print("====================================================\n")
        
    except Exception as e:
        print(f"\n[ERROR] Authentication failed: {e}")
        print("If you are SSH'd into a headless Raspberry Pi:")
        print("1. Run this script on your laptop instead (it will launch the browser).")
        print(f"2. Copy the generated '{TOKEN_PATH}' file to the Pi at '{TOKEN_PATH}'.")
        print("====================================================\n")

if __name__ == '__main__':
    main()
