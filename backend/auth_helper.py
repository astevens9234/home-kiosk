import os
import sys
from google_auth_oauthlib.flow import InstalledAppFlow

SCOPES = ['https://www.googleapis.com/auth/calendar.readonly']
BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
CREDENTIALS_PATH = os.path.join(BACKEND_DIR, 'credentials.json')
TOKEN_PATH = os.path.join(BACKEND_DIR, 'token.json')

def main():
    print("====================================================")
    print("      Google Calendar API Authentication Helper     ")
    print("====================================================")
    
    if not os.path.exists(CREDENTIALS_PATH):
        print(f"\n[ERROR] '{CREDENTIALS_PATH}' not found!")
        print("\nPlease follow these steps first:")
        print("1. Go to Google Cloud Console (https://console.cloud.google.com/).")
        print("2. Enable Google Calendar API.")
        print("3. Configure OAuth consent screen with scope '.../auth/calendar.readonly' and add your email as Test User.")
        print("4. Create OAuth Client ID (Desktop app) and download JSON.")
        print(f"5. Save JSON to '{CREDENTIALS_PATH}'.")
        print("====================================================\n")
        return

    print(f"\nFound '{CREDENTIALS_PATH}'.")
    
    # Check if user requested console / headless mode or if no display is available
    is_headless = '--headless' in sys.argv or '--console' in sys.argv or (sys.platform != 'win32' and not os.environ.get('DISPLAY'))

    flow = InstalledAppFlow.from_client_secrets_file(CREDENTIALS_PATH, SCOPES)

    creds = None
    if is_headless:
        print("\n--- Headless / Console Flow ---")
        print("1. Visit this URL on any device with a browser:\n")
        auth_url, _ = flow.authorization_url(prompt='consent', access_type='offline')
        print(auth_url)
        print("\n2. Log in, grant permissions, and copy the authorization code provided.")
        print("3. Paste the authorization code below:")
        code = input("\nEnter code: ").strip()
        flow.fetch_token(code=code)
        creds = flow.credentials
    else:
        print("\nAttempting browser-based authorization on http://localhost:8085 ...")
        print("(If you are in a headless/remote environment, run: python backend/auth_helper.py --headless)")
        try:
            creds = flow.run_local_server(
                port=8085,
                prompt='consent',
                success_message='Authorization complete! You can close this tab.'
            )
        except Exception as e:
            print(f"\nBrowser flow failed ({e}). Switching to manual terminal flow...\n")
            auth_url, _ = flow.authorization_url(prompt='consent', access_type='offline')
            print("Visit this URL on any device with a browser:\n")
            print(auth_url)
            print("\nPaste the authorization code below:")
            code = input("\nEnter code: ").strip()
            flow.fetch_token(code=code)
            creds = flow.credentials

    if creds:
        with open(TOKEN_PATH, 'w') as token:
            token.write(creds.to_json())
            
        print("\n====================================================")
        print(f"[SUCCESS] Auth token saved successfully to '{TOKEN_PATH}'!")
        print("====================================================\n")

if __name__ == '__main__':
    main()
