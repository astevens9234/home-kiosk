import os
import sys
from urllib.parse import urlparse, parse_qs
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

    creds = None

    if is_headless:
        print("\n--- Headless / Remote Flow ---")
        # Use localhost loopback redirect URI (OOB flow has been deprecated by Google)
        redirect_uri = "http://localhost:8085/"
        flow = InstalledAppFlow.from_client_secrets_file(
            CREDENTIALS_PATH, 
            SCOPES, 
            redirect_uri=redirect_uri
        )
        
        auth_url, _ = flow.authorization_url(prompt='consent', access_type='offline')
        
        print("\n1. Open this URL in a browser on your computer/phone:\n")
        print("----------------------------------------------------")
        print(auth_url)
        print("----------------------------------------------------\n")
        print("2. Sign in with Google and approve calendar access.")
        print("3. After approval, your browser will try to redirect to http://localhost:8085/?state=...&code=...")
        print("   (The page will say 'This site can't be reached' or 'Unable to connect' - THAT IS EXPECTED).")
        print("4. Copy the ENTIRE redirected URL from your browser address bar and paste it below:\n")
        
        user_input = input("Paste redirected URL (or code): ").strip()
        
        # Extract code if entire URL or query string was pasted
        if 'code=' in user_input:
            parsed = urlparse(user_input)
            qs = parse_qs(parsed.query if parsed.query else parsed.path)
            code = qs.get('code', [user_input])[0]
        else:
            code = user_input
            
        flow.fetch_token(code=code)
        creds = flow.credentials

    else:
        print("\nAttempting browser-based authorization on http://localhost:8085 ...")
        print("(If you are in a headless/remote environment, run: python backend/auth_helper.py --headless)")
        try:
            flow = InstalledAppFlow.from_client_secrets_file(CREDENTIALS_PATH, SCOPES)
            creds = flow.run_local_server(
                port=8085,
                prompt='consent',
                success_message='Authorization complete! You can close this tab.'
            )
        except Exception as e:
            print(f"\nBrowser flow failed ({e}). Switching to remote URL flow...\n")
            redirect_uri = "http://localhost:8085/"
            flow = InstalledAppFlow.from_client_secrets_file(
                CREDENTIALS_PATH, 
                SCOPES, 
                redirect_uri=redirect_uri
            )
            auth_url, _ = flow.authorization_url(prompt='consent', access_type='offline')
            print("1. Open this URL in your browser:\n")
            print(auth_url)
            print("\n2. After approval, copy the entire redirected URL from your browser bar and paste here:")
            user_input = input("\nPaste redirected URL: ").strip()
            if 'code=' in user_input:
                parsed = urlparse(user_input)
                qs = parse_qs(parsed.query if parsed.query else parsed.path)
                code = qs.get('code', [user_input])[0]
            else:
                code = user_input
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
