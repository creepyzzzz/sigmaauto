Python Key Extractor Script

This script automates the process of discovering and extracting a key by following a multi-step flow.

It begins by querying a target URL, decoding encrypted headers to find a base API URL, and then hitting an auth endpoint on that API to get a keyUrl. This keyUrl is then routed to the appropriate handler (e.g., nanolinks, arolinks, lksfy) to solve its specific redirect/decryption challenge and extract the final key.

Compatibility

This script is designed to run on Windows and in Termux (on Android).

Note for Termux users: You may need to use the --ssl-bypass flag to avoid SSL verification errors.

Dependencies

Required:

requests

Optional (but recommended):

pycryptodome: Required for handling lksfy.com links.

colorama: For colored console output.

Installation

Optional: Setup Virtual Environment (Recommended)

Using a virtual environment (venv) is a best practice to avoid installing packages globally and prevent version conflicts between projects.

Create the environment (run once):

python3 -m venv .venv


Activate it (run each time you work on the project):

Termux / Linux / macOS:

source .venv/bin/activate


Windows:

.\.venv\Scripts\activate


(You can run deactivate when you are finished.)

Install Packages

With your virtual environment active (or globally if you skipped that step), install the dependencies from requirements.txt:

pip install -r requirements.txt


Or manually:

pip install requests pycryptodome colorama


Usage

Default Flow

Simply execute the script:

python3 sigmastudy.py


Process a Direct URL

If you already have the intermediate link (keyUrl), you can process it directly:

python3 sigmastudy.py --direct-url "<URL>"


Flags

--ssl-bypass: Disable SSL certificate verification. (Often required for Termux).

--debug: Show verbose debug and trace output.

--direct-url <URL>: Skip the initial discovery and process the given URL directly.

Environment Variables

TARGET_URL: Set this to override the default initial discovery URL (which is https://zoo0.pages.dev).

TARGET_URL="<TARGET_URL>" python3 sigmastudy.py
