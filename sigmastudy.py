#!/usr/bin/env python3
"""
Default behavior (no args):
  - Shows ASCII art and prompts for a lksfy.com link.
  - Processes the provided link to extract the key.

Flags:
  --direct-url    : Process a direct URL (nanolinks/arolinks/lksfy) and extract key.
  --default-flow  : Run the original default flow (fetch from zoo0.pages.dev).
  --ssl-bypass    : Disable SSL verification (requests.verify=False). Handy for Termux/testing.
  --debug         : Show debug/background traces.

If you want to target a different URL for --default-flow, set environment variable TARGET_URL.
"""

import argparse
import base64
import json
import os
import re
import sys
import time
import hashlib
from urllib.parse import urlparse, parse_qs, quote

try:
    import requests
except Exception:
    print("ERROR: missing dependency 'requests'. Install: pip install requests", file=sys.stderr)
    sys.exit(1)

try:
    from Crypto.Cipher import AES
except Exception:
    print("WARNING: missing dependency 'pycryptodome'. Install: pip install pycryptodome", file=sys.stderr)
    print("         AES decryption for lksfy links will not work", file=sys.stderr)

# Colors (fallback gracefully)
try:
    from colorama import init as colorama_init, Fore, Style
    colorama_init(autoreset=True)
except Exception:
    class _C:
        RESET = ""; RED = ""; GREEN = ""; YELLOW = ""; CYAN = ""; MAGENTA = ""
    Fore = type("F", (), {"RED": _C.RED, "GREEN": _C.GREEN, "YELLOW": _C.YELLOW, "CYAN": _C.CYAN, "MAGENTA": _C.MAGENTA})
    Style = type("S", (), {"BRIGHT": "", "NORMAL": ""})

def err(msg): print(f"{Fore.RED}[ERROR]{Style.NORMAL} {msg}", file=sys.stderr)
def info(msg): print(f"{Fore.CYAN}[INFO]{Style.NORMAL} {msg}")
def ok(msg): print(f"{Fore.GREEN}[OK]{Style.NORMAL} {msg}")
def dbg(msg, on): 
    if on:
        print(f"{Fore.MAGENTA}[DEBUG]{Style.NORMAL} {msg}")

def print_ascii_art():
    """Prints the SIGMA ASCII art."""
    # ASCII art for "SIGMA"
    art = r"""
    ███████╗██╗ ██████╗ ███╗   ███╗ █████╗ 
    ██╔════╝██║██╔════╝ ████╗ ████║██╔══██╗
    ███████╗██║██║  ███╗██╔████╔██║███████║
    ╚════██║██║██║   ██║██║╚██╔╝██║██╔══██║
    ███████║██║╚██████╔╝██║ ╚═╝ ██║██║  ██║
    ╚══════╝╚═╝ ╚═════╝ ╚═╝     ╚═╝╚═╝  ╚═╝
    """
    print(f"{Fore.CYAN}{Style.BRIGHT}{art}{Style.NORMAL}")

# default target host 
DEFAULT_TARGET = "https://zoo0.pages.dev"
DEFAULT_USER_AGENT = "Dart/3.8 (dart:io)"
KEY = "k6kW8r#Tz3f;"

def extract_telegram_key_from_url(url: str) -> str:
    """
    Extract key from Telegram start links such as:
    https://t.me/sigma_keygen_bot?start=verify_ABCDEF123456
    Returns 'ABCDEF123456' if present, otherwise None.
    """
    if not url:
        return None
    try:
        parsed = urlparse(url)
        if "t.me" not in parsed.netloc.lower():
            return None
        start_param = parse_qs(parsed.query).get("start", [None])[0]
        if not start_param:
            return None
        # Prefer the part after the last underscore, else whole value
        if "_" in start_param:
            return start_param.split("_")[-1]
        return start_param
    except Exception:
        return None

HEADER_NAMES = ("x-request-id", "x-payload", "authorization", "x-data")
def get_initial_response_headers(target_url, user_agent, verify, debug):
    session = requests.Session()
    session.headers.update({"User-Agent": user_agent})
    dbg(f"GET {target_url} (verify={verify})", debug)
    try:
        resp = session.get(target_url, timeout=25, verify=verify, allow_redirects=True)
        dbg(f"Status {resp.status_code}", debug)
    except Exception as e:
        raise RuntimeError(f"Initial GET failed: {e}")
    return resp.headers, resp

def build_combined(headers, debug):
    parts = []
    missing = []
    for hn in HEADER_NAMES:
        val = None
        # headers is case-insensitive in requests but iterate for safety
        for k, v in headers.items():
            if k.lower() == hn.lower():
                val = v.strip()
                break
        if val is None:
            missing.append(hn)
            parts.append("")  # preserve order
        else:
            dbg(f"Found header {hn} (len={len(val)})", debug)
            parts.append(val)
    combined = "".join(parts)
    dbg(f"Combined length: {len(combined)}", debug)
    return combined, missing

def decode_b64_xor(combined_b64: str, xor_key: bytes, debug: bool=False) -> str:
    if not combined_b64:
        raise ValueError("Combined base64 string empty")
    try:
        raw = base64.b64decode(combined_b64)
    except Exception as e:
        raise ValueError(f"Base64 decode failed: {e}")
    dbg(f"Decoded bytes: {len(raw)}", debug)
    if not xor_key:
        raise ValueError("XOR key empty")
    out = bytearray(len(raw))
    for i, b in enumerate(raw):
        out[i] = b ^ xor_key[i % len(xor_key)]
    # try utf-8
    try:
        text = out.decode("utf-8")
        dbg("Decoded to UTF-8", debug)
        return text
    except UnicodeDecodeError:
        dbg("UTF-8 failed; trying to extract JSON substring", debug)
        txt = out.decode("latin1", errors="ignore")
        start = txt.find("{")
        end = txt.rfind("}")
        if start != -1 and end != -1 and end > start:
            return txt[start:end+1]
        raise ValueError("Decoded bytes not valid UTF-8 and no JSON substring found")

def extract_baseurl(decoded_text: str, debug: bool=False) -> str:
    dbg(f"Decoded preview: {decoded_text[:400]}", debug)
    try:
        obj = json.loads(decoded_text)
    except Exception as e:
        dbg("JSON parse failed; extracting block", debug)
        start = decoded_text.find("{")
        end = decoded_text.rfind("}")
        if start == -1 or end == -1 or end <= start:
            raise ValueError(f"JSON parse failed: {e}")
        obj = json.loads(decoded_text[start:end+1])
    if not isinstance(obj, dict):
        raise ValueError("Decoded JSON not an object")
    for k in ("baseUrl", "baseurl", "base_url"):
        if k in obj:
            return obj[k]
    raise ValueError("'baseUrl' not found in decoded JSON")

def fetch_key_flow(baseurl: str, verify: bool, debug: bool, user_agent: str = None) -> tuple:
    """
    Returns: (key, associated_url, error)
    """
    session = requests.Session()
    if user_agent:
        session.headers.update({"User-Agent": user_agent})
    else:
        session.headers.update({"User-Agent": "Mozilla/5.0 (compatible; Python script)"})

    url1 = baseurl.rstrip("/") + "/api/v1/auth/generate?server=1"
    dbg(f"Request1 -> {url1}", debug)
    try:
        r1 = session.get(url1, timeout=30, verify=verify)
        dbg(f"Request1 status: {r1.status_code}", debug)
        r1.raise_for_status()
    except Exception as e:
        raise RuntimeError(f"Request 1 failed: {e}")

    try:
        json1 = r1.json()
        dbg(f"JSON1 preview: {json.dumps(json1)[:800]}", debug)
    except Exception as e:
        raise RuntimeError(f"Response1 not JSON: {e}")

    try:
        key_url = json1["data"]["keyUrl"]
    except Exception as e:
        raise RuntimeError(f"keyUrl missing in response1 JSON: {e}")

    info(f"keyUrl: {key_url}")
    
    # Domain-based routing logic
    if "t.me/" in key_url or "t.me?" in key_url or "telegram.me" in key_url:
        info("Detected Telegram link in keyUrl; extracting start code")
        tg_key = extract_telegram_key_from_url(key_url)
        if tg_key:
            ok(f"Extracted key from Telegram link: {tg_key}")
            # Return key and the full telegram URL
            return tg_key, key_url, None
        return None, key_url, RuntimeError("Telegram link found but no start code/key present")
    elif "nanolinks" in key_url:
        info("Detected nanolinks domain, using nano handler")
        return handle_nano_links(key_url, session, verify, debug)
    elif "arolinks" in key_url:
        info("Detected arolinks domain, using aro handler")
        return handle_aro_links(key_url, session, verify, debug)
    elif "lksfy" in key_url:
        info("Detected lksfy domain, using lksfy handler")
        return handle_lksfy(key_url, session, verify, debug)
    else:
        # Fallback to nano handler as default
        info("Unknown domain, using nano handler as fallback")
        return handle_nano_links(key_url, session, verify, debug)

def process_direct_url(direct_url: str, verify: bool, debug: bool, user_agent: str = None) -> tuple:
    """
    Route a user-provided URL directly to the appropriate handler.
    Returns: (key, associated_url, error)
    """
    session = requests.Session()
    if user_agent:
        session.headers.update({"User-Agent": user_agent})
    else:
        session.headers.update({"User-Agent": "Mozilla/5.0 (compatible; Python script)"})

    lower_url = direct_url.lower()
    info(f"Direct URL provided: {direct_url}")

    if "lksfy" in lower_url:
        info("Detected lksfy domain from direct URL")
        return handle_lksfy(direct_url, session, verify, debug)
    elif "arolinks" in lower_url:
        info("Detected arolinks domain from direct URL")
        return handle_aro_links(direct_url, session, verify, debug)
    elif "nanolinks" in lower_url:
        info("Detected nanolinks domain from direct URL")
        return handle_nano_links(direct_url, session, verify, debug)
    else:
        info("Unknown direct URL domain, using nanolinks handler as fallback")
        return handle_nano_links(direct_url, session, verify, debug)

def handle_nano_links(key_url, session, verify, debug):
    """
    Handler for nanolinks.in URLs
    Returns: (key, associated_url, error)
    """
    info("Using nanolinks handler...")
    
    # Extract ID from the URL
    parsed = urlparse(key_url)
    extracted_id = parsed.path.strip("/").split("/")[-1]
    info(f"Extracted ID from URL: {extracted_id}")
    
    # First request with extracted ID
    first_url = f"https://nano.tackledsoul.com/includes/open.php?id={extracted_id}"
    cookies = {
        "tp": extracted_id,
        "open": extracted_id
    }
    
    dbg(f"Nanolinks request 1 -> {first_url}", debug)
    try:
        # Don't follow redirects automatically so we can capture the redirect URL
        r1 = session.get(first_url, cookies=cookies, timeout=30, verify=verify, allow_redirects=False)
        dbg(f"Nanolinks request 1 status: {r1.status_code}", debug)
        
        if r1.status_code in (301, 302, 303, 307, 308):
            redirect_url = r1.headers.get('Location')
            dbg(f"Redirect URL: {redirect_url}", debug)
            
            # Extract new ID from redirect URL
            parsed = urlparse(redirect_url)
            new_id = parsed.path.strip("/").split("/")[-1]
            info(f"Extracted new ID: {new_id}")
            
            # Second request with new ID
            second_url = f"https://vi-music.app/includes/open.php?id={new_id}"
            new_cookies = {
                "tp": new_id,
                "open": new_id
            }
            
            dbg(f"Nanolinks request 2 -> {second_url}", debug)
            r2 = session.get(second_url, cookies=new_cookies, timeout=30, verify=verify, allow_redirects=False)
            dbg(f"Nanolinks request 2 status: {r2.status_code}", debug)
            
            if r2.status_code in (301, 302, 303, 307, 308):
                final_redirect = r2.headers.get('Location')
                dbg(f"Final redirect URL: {final_redirect}", debug)
                
                # Extract key from final redirect URL
                parsed = urlparse(final_redirect)
                key = parse_qs(parsed.query).get("key", [None])[0]
                
                if key:
                    ok(f"Extracted key from nanolinks: {key}")
                    # Return key and the final URL
                    return key, final_redirect, None
                else:
                    return None, final_redirect, RuntimeError("Could not extract 'key' parameter from final redirect URL")
            else:
                return None, key_url, RuntimeError(f"Second request did not redirect as expected: {r2.status_code}")
        else:
            return None, key_url, RuntimeError(f"First request did not redirect as expected: {r1.status_code}")
    except Exception as e:
        return None, key_url, RuntimeError(f"Nanolinks handler failed: {e}")

def handle_aro_links(key_url, session, verify, debug):
    """
    Handler for arolinks.com URLs
    Returns: (key, associated_url, error)
    """
    info("Using arolinks handler...")
    
    # Extract the identifier from the URL
    parsed = urlparse(key_url)
    identifier = parsed.path.strip("/").split("/")[-1]
    info(f"Extracted identifier: {identifier}")
    
    # Make initial request
    dbg(f"Arolinks request 1 -> {key_url}", debug)
    try:
        response = session.get(key_url, timeout=30, verify=verify)
        dbg(f"Arolinks request 1 status: {response.status_code}", debug)
        
        if response.status_code == 200:
            # Extract the redirect URL from the response
            redirect_url_match = re.search(r'window\.location\.href = "([^"]+)"', response.text)
            
            if not redirect_url_match:
                # Try to find it in the <a> tag
                redirect_url_match = re.search(r'<a href="([^"]+)"', response.text)
            
            if redirect_url_match:
                redirect_url = redirect_url_match.group(1)
                dbg(f"Found redirect URL: {redirect_url}", debug)
                
                # Update headers for the second request
                updated_headers = {
                    "cookie": f"gt_uc_={identifier}",
                    "referer": redirect_url
                }
                
                # Make the second request
                dbg(f"Arolinks request 2 -> {key_url} with updated headers", debug)
                second_response = session.get(key_url, headers=updated_headers, timeout=30, verify=verify)
                dbg(f"Arolinks request 2 status: {second_response.status_code}", debug)
                
                if second_response.status_code == 200:
                    # Extract the final URL with the key
                    final_url_match = re.search(r'nofollow noopener noreferrer" href="(https?://[^"]+key=[^"&]+[^"]*)"', second_response.text)
                    final_url_match2 = re.search(r'nofollow noopener noreferrer" href="(httpshttps?://[^"]+code=[^"&]+[^"]*)"', second_response.text)
                    final_url = None

                    if final_url_match:
                        final_url = final_url_match.group(1)
                        dbg(f"Found final URL: {final_url}", debug)
                        key_match = re.search(r'key=([^&"]+)', final_url)
                        if key_match:
                            key = key_match.group(1)
                            ok(f"Extracted key: {key}")
                            return key, final_url, None
                    elif final_url_match2:
                        final_url = final_url_match2.group(1)
                        code_match = re.search(r'code=([^&"]+)', final_url)
                        if code_match:
                            key = code_match.group(1)
                            ok(f"Extracted code as key: {key}")
                            return key, final_url, None
                    
                    return None, key_url, RuntimeError("Final URL with key/code not found in the second response")
                else:
                    return None, key_url, RuntimeError(f"Second request failed with status code: {second_response.status_code}")
            else:
                return None, key_url, RuntimeError("Redirect URL not found in the initial response")
        else:
            return None, key_url, RuntimeError(f"Initial request failed with status code: {response.status_code}")
    except Exception as e:
        return None, key_url, RuntimeError(f"Arolinks handler failed: {e}")


def decrypt(chipertext: str, alias: str, debug: bool=False) -> str:
    try:
        key_source = "sDye71jNq5" + alias
        iv_source = "7M9u8DG4X" + alias
        key_hash = hashlib.sha256(key_source.encode("utf-8")).hexdigest()
        iv_hash = hashlib.sha256(iv_source.encode("utf-8")).hexdigest()
        key_bytes = key_hash[:32].encode("utf-8")  # 32 bytes -> AES-256
        iv_bytes = iv_hash[:16].encode("utf-8")    # 16 bytes -> IV
        ciphertext = base64.b64decode(base64.b64decode(chipertext)) # Decoding base64 twice
        cipher = AES.new(key_bytes, AES.MODE_CBC, iv=iv_bytes)
        decrypted = cipher.decrypt(ciphertext)
        return decrypted.decode("utf-8")
    except Exception as e:
        dbg(f"Decryption error: {e}", debug)
        return None

def extract_form_data(html_content):
    # Extract _csrfToken
    csrf_token_match = re.search(r'name="_csrfToken"[^>]*value="([^"]+)"', html_content)
    csrf_token = csrf_token_match.group(1) if csrf_token_match else ""
    
    # Extract ad_form_data
    ad_form_data_match = re.search(r'name="ad_form_data"[^>]*value="([^"]+)"', html_content)
    ad_form_data = ad_form_data_match.group(1) if ad_form_data_match else ""
    
    # Extract Token fields
    token_fields_match = re.search(r'name="_Token\[fields\]"[^>]*value="([^"]+)"', html_content)
    token_fields = token_fields_match.group(1) if token_fields_match else ""
    
    # Extract Token unlocked
    token_unlocked_match = re.search(r'name="_Token\[unlocked\]"[^>]*value="([^"]+)"', html_content)
    token_unlocked = token_unlocked_match.group(1) if token_unlocked_match else ""
    
    # Extract form action
    action_match = re.search(r'action="([^"]+)"', html_content)
    action = action_match.group(1) if action_match else ""
    
    return {
        "csrf_token": csrf_token,
        "ad_form_data": ad_form_data,
        "token_fields": token_fields,
        "token_unlocked": token_unlocked,
        "action": action
    }

def handle_lksfy(key_url, session, verify, debug):
    """
    Handler for lksfy.com URLs
    Returns: (key, associated_url, error)
    """
    info("Using lksfy handler...")
    
    # Extract the alias from the URL
    parsed = urlparse(key_url)
    alias = parsed.path.strip("/").split("/")[-1]
    info(f"Extracted alias: {alias}")
    
    # Make initial request
    dbg(f"Lksfy request 1 -> {key_url}", debug)
    try:
        # First get the redirect
        response = session.get(key_url, headers={"referer": key_url}, timeout=30, verify=verify, allow_redirects=False)
        dbg(f"Lksfy request 1 status: {response.status_code}", debug)
        
        if response.status_code in (301, 302, 303, 307, 308):
            redirect_url = response.headers.get('Location')
            dbg(f"Redirect URL: {redirect_url}", debug)
            
            # Now make the second request with referer
            headers = {"referer": redirect_url}
            dbg(f"Lksfy request 2 -> {key_url} with referer", debug)
            second_response = session.get(key_url, headers=headers, timeout=30, verify=verify)
            dbg(f"Lksfy request 2 status: {second_response.status_code}", debug)
            
            if second_response.status_code == 200:
                # Extract the base64 value from HTML
                base64_match = re.search(r'var base64 = \'([^\']+)\'', second_response.text)
                if base64_match:
                    base64_value = base64_match.group(1)
                    dbg(f"Found base64 value: {base64_value[:20]}...", debug)
                    
                    # Decrypt the base64 value
                    decrypted_html = decrypt(base64_value, alias, debug)
                    if decrypted_html:
                        dbg("Successfully decrypted HTML form data", debug)
                        
                        # Extract form data
                        form_data = extract_form_data(decrypted_html)
                        
                        # Prepare POST request
                        post_url = f"https://lksfy.com{form_data['action']}"
                        
                        post_headers = {
                            "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
                            "referer": "https://lksfy.com/",
                            "cookie": f"csrfToken={form_data['csrf_token']}",
                            "x-requested-with": "XMLHttpRequest"
                        }
                        
                        # Manually build the POST body with individually URL-encoded values
                        post_body = (
                            f"_method=POST"
                            f"&_csrfToken={quote(form_data['csrf_token'])}"
                            f"&ad_form_data={quote(form_data['ad_form_data'])}"
                            f"&_Token%5Bfields%5D={form_data['token_fields']}"
                            f"&_Token%5Bunlocked%5D={quote(form_data['token_unlocked'])}"
                        )
                        
                        dbg(f"POST body: {post_body[:100]}...", debug)
                        
                        # Wait longer to prevent rate limiting and bot checks
                        info("Waiting for 10 seconds to prevent bad request/anti-bot issues")
                        time.sleep(10)

                        # attempt up to 2 tries
                        attempts = 2
                        decrypted_url = None # To store final URL
                        for attempt in range(1, attempts + 1):
                            dbg(f"Lksfy request 3 (attempt {attempt}) -> {post_url} (POST)", debug)
                            post_response = session.post(post_url, headers=post_headers, data=post_body, timeout=30, verify=verify)
                            dbg(f"Lksfy request 3 status: {post_response.status_code}", debug)

                            if post_response.status_code != 200:
                                if attempt < attempts:
                                    info("POST not ok, waiting 6s and retrying...")
                                    time.sleep(6)
                                    continue
                                return None, key_url, RuntimeError(f"POST request failed with status code: {post_response.status_code}")

                            try:
                                json_response = post_response.json()
                                if json_response.get("status") != "success":
                                    if attempt < attempts:
                                        info("Response not success, waiting 6s and retrying...")
                                        time.sleep(6)
                                        continue
                                    return None, key_url, RuntimeError(f"Error in response: {json_response.get('message')}")

                                encrypted_url = json_response.get("url")
                                dbg(f"Got encrypted URL: {encrypted_url[:60]}...", debug)
                                
                                # Decrypt the URL
                                decrypted_url = decrypt(encrypted_url, alias, debug)
                                if not decrypted_url:
                                    if attempt < attempts:
                                        info("Decryption failed, waiting 6s and retrying...")
                                        time.sleep(6)
                                        continue
                                    return None, key_url, RuntimeError("Failed to decrypt the URL")

                                dbg(f"Final URL: {decrypted_url}", debug)

                                # Telegram link check first
                                tg_key = extract_telegram_key_from_url(decrypted_url)
                                if tg_key:
                                    ok(f"Extracted key from Telegram link: {tg_key}")
                                    return tg_key, decrypted_url, None

                                # Extract the key from multiple other possible params
                                key_match = re.search(r'[?&]key=([^&]+)', decrypted_url)
                                if not key_match:
                                    key_match = re.search(r'[?&]code=([^&]+)', decrypted_url)
                                if not key_match:
                                    key_match = re.search(r'[?&]token=([^&]+)', decrypted_url)

                                if key_match:
                                    key = key_match.group(1)
                                    ok(f"Extracted key: {key}")
                                    return key, decrypted_url, None
                                
                                if attempt < attempts:
                                    info("Key parameter not found, waiting 6s and retrying...")
                                    time.sleep(6)
                                    continue
                                return None, decrypted_url, RuntimeError("Key not found in the URL")

                            except Exception as e:
                                if attempt < attempts:
                                    info("Error parsing JSON, waiting 6s and retrying...")
                                    time.sleep(6)
                                    continue
                                return None, key_url, RuntimeError(f"Error parsing JSON response: {e}")
                    else:
                        return None, key_url, RuntimeError("Failed to decrypt the base64 value")
                else:
                    return None, key_url, RuntimeError("Base64 value not found in the HTML")
            else:
                return None, key_url, RuntimeError(f"Second GET request failed with status code: {second_response.status_code}")
        else:
            return None, key_url, RuntimeError(f"First request did not redirect as expected: {response.status_code}")
    except Exception as e:
        return None, key_url, RuntimeError(f"Lksfy handler failed: {e}")




def main():
    parser = argparse.ArgumentParser(description="Auto extract gt key.")
    parser.add_argument("--ssl-bypass", action="store_true", help="Disable SSL verification (requests.verify=False).")
    parser.add_argument("--debug", action="store_true", help="Show debug/background traces.")
    parser.add_argument("--direct-url", type=str, default=None, help="Process a direct URL (nanolinks/arolinks/lksfy) and extract key.")
    parser.add_argument("--default-flow", action="store_true", help="Run the original default flow (fetch from zoo0.pages.dev).")
    args = parser.parse_args()

    # Determine target URL: env TARGET_URL or default
    target_url = os.environ.get("TARGET_URL", DEFAULT_TARGET)
    user_agent = DEFAULT_USER_AGENT
    debug = args.debug
    verify = not args.ssl_bypass

    if args.ssl_bypass:
        try:
            import urllib3
            urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
            dbg("Disabled InsecureRequestWarning", debug)
        except Exception:
            dbg("Could not import urllib3 to suppress warnings", debug)

    try:
        # Priority 1: --direct-url
        if args.direct_url:
            key, associated_url, error = process_direct_url(args.direct_url, verify=verify, debug=debug, user_agent=user_agent)
            if key:
                ok(f"Final key: {key}")
                if associated_url and ("t.me/" in associated_url or "telegram.me" in associated_url):
                    ok(f"Telegram URL: {associated_url}")
                return
            else:
                err_msg = str(error) or "Failed to process the provided URL"
                if associated_url:
                    err_msg += f" (Associated URL: {associated_url})"
                raise RuntimeError(err_msg)

        # Priority 2: --default-flow (original behavior)
        if args.default_flow:
            info("Running original default flow (--default-flow)...")
            try:
                headers, resp = get_initial_response_headers(target_url, user_agent, verify, debug)
                
                for hn in HEADER_NAMES:
                    val = None
                    for k, v in headers.items():
                        if k.lower() == hn.lower():
                            val = v
                            break
                    if val is not None:
                        val
                    else:
                        err(f"{hn} not present in response headers")

                combined, missing = build_combined(headers, debug)
                if all(not ch for ch in combined):
                    raise ValueError("Combined payload empty — server didn't return required headers.")

                xor_key_bytes = KEY.encode("utf-8")
                dbg(f"Using XOR key (len={len(xor_key_bytes)}): {KEY}", debug)
                decoded = decode_b64_xor(combined, xor_key_bytes, debug)
                dbg(f"Decoded payload preview: {decoded[:800]}", debug)

                baseurl = extract_baseurl(decoded, debug)
                ok(f"baseUrl: {baseurl}")

                key, associated_url, error = fetch_key_flow(baseurl, verify=verify, debug=debug, user_agent=user_agent)
                
                if key:
                    ok(f"Final key: {key}")
                    if associated_url and ("t.me/" in associated_url or "telegram.me" in associated_url):
                        ok(f"Telegram URL: {associated_url}")
                else:
                    err_msg = str(error) or "Failed to get key"
                    if associated_url:
                        err_msg += f" (Associated URL: {associated_url})"
                    raise RuntimeError(err_msg)
                
            except Exception as e:
                err(f"Default flow failed: {e}")
                if debug:
                    raise
                sys.exit(2)
            return  # Exit after default flow

        # NEW DEFAULT (no flags): Interactive Lksfy mode
        print_ascii_art()
        info("Welcome to the interactive link helper.")
        
        try:
            link = input(f"{Fore.YELLOW}Paste your lksfy.com link and press Enter:\n{Style.NORMAL}> ")
        except EOFError:
            err("\nNo input provided. Exiting.")
            sys.exit(1)
        
        link = link.strip()
        
        if not link:
            err("No link provided. Exiting.")
            sys.exit(1)
            
        if "lksfy.com" not in link.lower():
            err("This does not appear to be a lksfy.com link. Exiting.")
            err("If this is another link type, please use --direct-url <link>")
            sys.exit(1)
        
        # We have a lksfy link, process it using the existing function
        info(f"Processing link: {link}")
        key, associated_url, error = process_direct_url(link, verify=verify, debug=debug, user_agent=user_agent)
        
        if key:
            ok(f"Final key: {key}")
            if associated_url and ("t.me/" in associated_url or "telegram.me" in associated_url):
                ok(f"Telegram URL: {associated_url}")
        else:
            err_msg = str(error) or "Failed to process the provided URL"
            if associated_url:
                err_msg += f" (Associated URL: {associated_url})"
            raise RuntimeError(err_msg)

    except KeyboardInterrupt:
        err("\nInterrupted by user")
        sys.exit(1)
    except Exception as e:
        err(str(e))
        if debug:
            raise
        sys.exit(2)

if __name__ == "__main__":
    main()