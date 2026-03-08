import tkinter as tk
from tkinter import messagebox, simpledialog, colorchooser
import os, sys, json, threading, time
from datetime import datetime, timedelta
import gspread
from oauth2client.service_account import ServiceAccountCredentials
from gspread_formatting import CellFormat, Color, format_cell_range
from PIL import Image, ImageTk
import pandas as pd
from googleapiclient.errors import HttpError
from requests.exceptions import RequestException
import winsound  # built-in on Windows for sound playback
import socket
import requests, shutil, subprocess
import smtplib
from email.mime.text import MIMEText



# from tkinter import ttk
# style = ttk.Style()
# style.theme_use("clam")
# style.configure("TNotebook.Tab", font=("Arial", 14, "bold"), padding=[10, 5])
# style.map("TNotebook.Tab", background=[("selected", "#f0c800")])
# # --- Notebook (Tab) Styling ---
# from tkinter import ttk
# style = ttk.Style()
# style.theme_use("clam")

# # Make tabs larger and clearer
# style.configure(
#     "TNotebook.Tab",
#     font=("Arial", 16, "bold"),
#     padding=[20, 10],
#     background="#f9f9f9"
# )
# style.map(
#     "TNotebook.Tab",
#     background=[("selected", "#FFD700")],  # gold highlight for selected tab
#     foreground=[("selected", "black")]
# )
# style.configure("TNotebook", tabmargins=[10, 5, 10, 0])  # spacing around tab area


# --- Paths ---
if getattr(sys, 'frozen', False):
    APP_DIR = sys._MEIPASS
else:
    APP_DIR = os.path.dirname(os.path.abspath(__file__))


def load_local_config():
    """Load local-only config that should not be committed to Git."""
    defaults = {
        "ENABLE_EMAIL": True,
        "ENABLE_EMAIL_HOME": True,
        "SMTP_SERVER": "smtp.gmail.com",
        "SMTP_PORT": 465,
        "ADMIN_EMAIL": "",
        "ADMIN_APP_PASSWORD": "",
        "SCHOOL_NAME": "Avon North Middle School",
    }
    local_config_file = os.path.join(APP_DIR, "local_config.json")

    try:
        with open(local_config_file, "r") as f:
            loaded = json.load(f)
        if isinstance(loaded, dict):
            defaults.update(loaded)
    except FileNotFoundError:
        pass
    except Exception as e:
        print("[LOCAL CONFIG ERROR]", e)

    return defaults


# --- Auto Update Configuration ---
APP_VERSION = "1.0.5"  # <-- current version of your local app
VERSION_URL = "https://raw.githubusercontent.com/CurtisFaughnan/AvonLanyardTracker/main/version.txt"
INSTALLER_URL = "https://github.com/CurtisFaughnan/AvonLanyardTracker/releases/latest/download/LanyardTrackerInstaller.exe"

LOCAL_CONFIG = load_local_config()
DEVICE_NAME = socket.gethostname()

# --- Email Settings ---
ENABLE_EMAIL = bool(LOCAL_CONFIG.get("ENABLE_EMAIL", True))
ENABLE_EMAIL_HOME = bool(LOCAL_CONFIG.get("ENABLE_EMAIL_HOME", True))
SMTP_SERVER = LOCAL_CONFIG.get("SMTP_SERVER", "smtp.gmail.com")
SMTP_PORT = int(LOCAL_CONFIG.get("SMTP_PORT", 465))
ADMIN_EMAIL = LOCAL_CONFIG.get("ADMIN_EMAIL", "")
ADMIN_APP_PASSWORD = LOCAL_CONFIG.get("ADMIN_APP_PASSWORD", "")
SCHOOL_NAME = LOCAL_CONFIG.get("SCHOOL_NAME", "Avon North Middle School")

PENDING_EMAILS_FILE = os.path.join(APP_DIR, "pending_emails.json")
pending_emails = []

# Load pending emails on startup
if os.path.exists(PENDING_EMAILS_FILE):
    try:
        with open(PENDING_EMAILS_FILE, "r") as f:
            pending_emails = json.load(f)
    except:
        pending_emails = []


def save_pending_emails():
    try:
        with open(PENDING_EMAILS_FILE, "w") as f:
            json.dump(pending_emails, f)
    except Exception as e:
        print("[EMAIL SAVE ERROR]", e)


# --- Persistent Settings File ---
SETTINGS_FILE = os.path.join(APP_DIR, "settings.json")

def load_settings():
    """Load persistent settings like ENABLE_EMAIL_HOME from JSON."""
    global ENABLE_EMAIL_HOME
    try:
        with open(SETTINGS_FILE, "r") as f:
            data = json.load(f)
            ENABLE_EMAIL_HOME = data.get("ENABLE_EMAIL_HOME", ENABLE_EMAIL_HOME)
            print(f"[SETTINGS] Loaded ENABLE_EMAIL_HOME={ENABLE_EMAIL_HOME}")
    except FileNotFoundError:
        pass  # no settings yet
    except Exception as e:
        print("[SETTINGS ERROR]", e)

def save_settings():
    """Save persistent settings to JSON."""
    try:
        with open(SETTINGS_FILE, "w") as f:
            json.dump({"ENABLE_EMAIL_HOME": ENABLE_EMAIL_HOME}, f)
            print(f"[SETTINGS] Saved ENABLE_EMAIL_HOME={ENABLE_EMAIL_HOME}")
    except Exception as e:
        print("[SETTINGS SAVE ERROR]", e)


logo_path = os.path.join(APP_DIR, "Avon_Crest.png")

# --- Sent Email Log ---
SENT_EMAIL_LOG = os.path.join(APP_DIR, "sent_emails.json")

def load_sent_emails():
    """Load sent email history from file."""
    if os.path.exists(SENT_EMAIL_LOG):
        try:
            with open(SENT_EMAIL_LOG, "r") as f:
                return json.load(f)
        except:
            pass
    return []

def save_sent_emails(data):
    """Save the sent email history back to disk."""
    try:
        with open(SENT_EMAIL_LOG, "w") as f:
            json.dump(data, f, indent=2)
    except Exception as e:
        print("[SAVE ERROR]", e)

sent_email_history = load_sent_emails()


CREDENTIALS_FILE = os.path.join(APP_DIR, "credentials.json")
THRESHOLDS_FILE = os.path.join(APP_DIR, "lanyard_thresholds.json")
SHEET_NAME = "Lanyard_Data"
STUDENT_TAB = "Lanyard_Data"
SCAN_LOG_SHEET = "lanyard_log"
logo_path = os.path.join(APP_DIR, "Avon_Crest.png")

# --- Globals ---
logo_img = None
student_data = []
scan_counts = {}  # cache scan counts
scanned_today = set()  # keeps track of student IDs scanned today
admin_logged_in = False
sound_enabled = True  # 🔊 default: ON
current_section = 1  # Tracks the active section number for the day
last_reset_time = "N/A"
color_thresholds = [
    {"min": 1, "max": 4, "color": (0.7, 1, 0.7), "title":"Tier 1"},
    {"min": 5, "max": 9, "color": (1, 1, 0.6), "title":"Tier 2"},
    {"min": 10, "max": 14, "color": (1, 0.8, 0.5), "title":"Tier 3"},
    {"min": 15, "max": 9999, "color": (1, 0.6, 0.6), "title":"Tier 4"}
]

PENDING_FILE = os.path.join(APP_DIR, "pending_scans.json")
pending_scans = []

# Load pending scans on startup
if os.path.exists(PENDING_FILE):
    try:
        with open(PENDING_FILE,"r") as f:
            pending_scans = json.load(f)
    except:
        pending_scans = []

# Helper to save pending scans to file
def save_pending_scans():
    try:
        with open(PENDING_FILE,"w") as f:
            json.dump(pending_scans, f)
    except:
        pass



if os.path.exists(THRESHOLDS_FILE):
    try:
        with open(THRESHOLDS_FILE,"r") as f:
            color_thresholds = json.load(f)
    except: pass

# --- Google client ---
def get_client():
    scope = ["https://spreadsheets.google.com/feeds", "https://www.googleapis.com/auth/drive"]
    with open(CREDENTIALS_FILE) as f:
        creds = json.load(f)
    return gspread.authorize(ServiceAccountCredentials.from_json_keyfile_dict(creds, scope))

# load thresholds from sheet if available
def load_thresholds_from_sheet():
    global color_thresholds
    try:
        client = get_client()
        sheet = client.open(SHEET_NAME).worksheet("Thresholds")
        values = sheet.get_all_records()
        if values:
            color_thresholds.clear()
            for row in values:
                # Convert r,g,b to floats
                r = float(row.get("r",1))
                g = float(row.get("g",1))
                b = float(row.get("b",1))
                color_thresholds.append({
                    "min": int(row.get("min",1)),
                    "max": int(row.get("max",9999)),
                    "color": (r,g,b),
                    "title": row.get("title","Tier")
                })
    except Exception as e:
        print("Failed to load thresholds from sheet:", e)

def save_scan_locally(student, uploaded="No"):
    """Append scan to local backup file"""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    try:
        df = pd.read_excel(LOCAL_LOG)
    except FileNotFoundError:
        df = pd.DataFrame(columns=["Timestamp", "Student ID", "Name", "Class Year", "Team", "Uploaded"])
    new_row = {
        "Timestamp": timestamp,
        "Student ID": student["student_id"],
        "Name": f"{student['first_name']} {student['last_name']}",
        "Class Year": student.get("class_year", ""),
        "Team": student.get("team", ""),
        "Uploaded": uploaded
    }
    df = pd.concat([df, pd.DataFrame([new_row])], ignore_index=True)
    df.to_excel(LOCAL_LOG, index=False)
    return timestamp

def mark_scan_uploaded(timestamp, student_id):
    """Mark a local scan row as uploaded successfully"""
    try:
        df = pd.read_excel(LOCAL_LOG)
        mask = (df["Timestamp"] == timestamp) & (df["Student ID"].astype(str) == str(student_id))
        df.loc[mask, "Uploaded"] = "Yes"
        df.to_excel(LOCAL_LOG, index=False)
    except FileNotFoundError:
        pass

# --- Color Helpers ---
def get_color_by_count(total_count):
    for th in color_thresholds:
        if th["min"] <= total_count <= th["max"]:
            r,g,b = th["color"]
            return Color(r,g,b)
    return Color(1,1,1)

def should_email_home(total_count):
    """
    Returns True if the student's total count is in a threshold
    where the title is 'Email Home' (case-insensitive).
    """
    for th in color_thresholds:
        title = th.get("title", "").strip().lower()
        if th["min"] <= total_count <= th["max"] and title == "email home":
            return True
    return False


def get_color_hex(total_count):
    c = get_color_by_count(total_count)
    return f'#{int(c.red*255):02x}{int(c.green*255):02x}{int(c.blue*255):02x}'

def generate_ai_parent_email(student, total_count):
    """
    Creates a professional email for the parent when a lanyard violation threshold is hit.
    """
    full_name = f"{student['first_name']} {student['last_name']}"
    parent = student.get("parent_email", "")
    team = student.get("team", "")
    class_year = student.get("class_year", "")

    # Determine tier title
    tier_label = None
    for th in color_thresholds:
        if th["min"] <= total_count <= th["max"]:
            tier_label = th.get("title", "")
            break

    subject = f"{full_name} Lanyard Policy Notice ({total_count} total Lanyard Violations)"
    body = f"""
Good afternoon,

This message is to inform you that {full_name} has reached {total_count} recorded lanyard violations in our system.

This places them in {tier_label if tier_label else 'a new tier'} of our lanyard policy.
Team: {team}
Class Year: {class_year}

We kindly ask for your support in reinforcing the importance of adhering to our lanyard policy to ensure a safe and secure environment for all students.

Thank you for your partnership,
{SCHOOL_NAME} Administration
"""
    return subject.strip(), body.strip()

# --- Gmail API Email Sender ---
import base64, pickle
from googleapiclient.discovery import build
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request

GMAIL_SCOPES = ["https://www.googleapis.com/auth/gmail.send"]

def send_email_gmail_api(to_addr, subject, body):
    creds = None
    token_file = "gmail_token.pkl"

    if os.path.exists(token_file):
        with open(token_file, "rb") as token:
            creds = pickle.load(token)

    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            gmail_credentials_path = os.path.join(APP_DIR, "gmail_credentials.json")
            flow = InstalledAppFlow.from_client_secrets_file(
                gmail_credentials_path, GMAIL_SCOPES
            )

            creds = flow.run_local_server(port=0)
        with open(token_file, "wb") as token:
            pickle.dump(creds, token)

    service = build("gmail", "v1", credentials=creds)

    from_addr = ADMIN_EMAIL
    message_text = f"From: {from_addr}\nTo: {to_addr}\nSubject: {subject}\n\n{body}"

    encoded_message = base64.urlsafe_b64encode(
        message_text.encode("utf-8")
    ).decode("utf-8")

    message = {"raw": encoded_message}

    try:
        service.users().messages().send(userId="me", body=message).execute()
        print(f"✅ Email sent successfully to {to_addr}")
        messagebox.showinfo("Email Sent", f"Email sent to {to_addr}")
    except Exception as e:
        messagebox.showerror("Email Error", f"Failed to send email:\n{e}")

def fetch_parent_email_from_sheet(student_id):
    """Fetch parent_email from Google Sheet by student_id — now shows headers for debugging."""
    print(f"[FETCH] Looking up parent_email for student_id={student_id}")
    try:
        client = get_client()
        sheet = client.open(SHEET_NAME).worksheet(STUDENT_TAB)
        rows = sheet.get_all_records(default_blank="")

        if not rows:
            print("[FETCH] No rows found in sheet!")
            return ""

        print(f"[FETCH] Sheet headers detected: {list(rows[0].keys())}")

        for row in rows:
            sid = str(row.get("student_id", "")).strip().lstrip("0")
            if sid == str(student_id).strip().lstrip("0"):
                # Try multiple possible header variants
                for key in row.keys():
                    if "email" in key.lower():  # <- ANY column with 'email' in the name
                        val = str(row[key]).strip()
                        if val:
                            print(f"[FETCH] Found parent_email='{val}' under header '{key}'")
                            return val
                print("[FETCH] Student found, but no email in row:", row)
                return ""
        print("[FETCH] No matching student_id found in sheet.")
    except Exception as e:
        print("[FETCH ERROR]", e)
    return ""





def show_parent_email_popup(student, total_count, refresh_window=None):
    print("DEBUG student keys:", student.keys())
    print("DEBUG parent email from memory:", student.get("parent_email"))
    """Popup that shows the AI-generated parent email and lets admin send it."""
    if not ENABLE_EMAIL:
        return

    subject, body = generate_ai_parent_email(student, total_count)

    win = tk.Toplevel(root)
    win.title("Parent Notification Email")
    win.geometry("650x500")
    win.grab_set()

    # --- Parent Email field ---
    tk.Label(win, text="Parent Email:", font=("Arial", 12, "bold")).pack(anchor="w", padx=10, pady=(10, 0))
    entry_to = tk.Entry(win, width=50, font=("Arial", 12))
    entry_to.pack(padx=10, pady=5)

    # --- Try to get parent email ---
    print("DEBUG — student dict:", student)
    print("DEBUG — student_id being passed:", student.get("student_id"))

    parent_email = (student.get("parent_email") or "").strip()
    if not parent_email:
        print("[DEBUG] parent_email missing in memory, fetching from sheet...")
        parent_email = fetch_parent_email_from_sheet(student.get("student_id", ""))
    else:
        print("[DEBUG] Using parent_email from memory:", parent_email)

    entry_to.insert(0, parent_email)
    print("[DEBUG] Inserted parent_email into entry box:", parent_email)

    # --- Subject field ---
    tk.Label(win, text="Subject:", font=("Arial", 12, "bold")).pack(anchor="w", padx=10)
    entry_subject = tk.Entry(win, width=60, font=("Arial", 12))
    entry_subject.pack(padx=10, pady=5)
    entry_subject.insert(0, subject)

    # --- Body field ---
    tk.Label(win, text="Body:", font=("Arial", 12, "bold")).pack(anchor="w", padx=10)
    text_body = tk.Text(win, wrap="word", height=18)
    text_body.pack(fill="both", expand=True, padx=10, pady=5)
    text_body.insert("1.0", body)

    # --- Send button ---
    def do_send():
        to_addr = entry_to.get().strip()
        sub = entry_subject.get().strip()
        msg_body = text_body.get("1.0", "end").strip()

        if not to_addr:
            messagebox.showerror("Missing", "Please enter a parent email.")
            return

        try:
            send_email_gmail_api(to_addr, sub, msg_body)
            messagebox.showinfo("Email Sent", f"Email successfully sent to {to_addr}.")

            # ✅ Log to sent email history
            global sent_email_history
            record = {
                "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                "student_id": student["student_id"],
                "name": f"{student['first_name']} {student['last_name']}",
                "parent_email": to_addr,
                "total_count": total_count,
                "tier": next((th.get("title") for th in color_thresholds
                            if th["min"] <= total_count <= th["max"]), "N/A")
            }
            sent_email_history.append(record)
            save_sent_emails(sent_email_history)
            print(f"[LOG] Recorded email sent to {record['name']} at {record['timestamp']}")

            # ✅ Remove from pending list
            global pending_emails
            pending_emails = [p for p in pending_emails if p["student_id"] != student["student_id"]]
            save_pending_emails()

            # ✅ Refresh pending window if open
            if refresh_window:
                open_pending_email_list(existing_win=refresh_window)

            win.destroy()

        except Exception as e:
            messagebox.showerror("Email Error", f"Failed to send email:\n{e}")


    tk.Button(win, text="Send Email", font=("Arial", 12, "bold"),
              bg="#4CAF50", fg="white", command=do_send).pack(pady=10)


def play_scan_sound(sound_type="success"):
    """Play a specific sound based on scan result."""
    if not sound_enabled:
        return
    try:
        sound_files = {
            "success": os.path.join(APP_DIR, "Correct.wav"),
            "duplicate": os.path.join(APP_DIR, "Incorrect.wav"),
            "error": os.path.join(APP_DIR, "Incorrect.wav")
        }
        file = sound_files.get(sound_type)
        if os.path.exists(file):
            winsound.PlaySound(file, winsound.SND_FILENAME | winsound.SND_ASYNC)
        else:
            winsound.MessageBeep()
    except Exception as e:
        print("Sound error:", e)



# --- Load students ---
def load_students_from_google():
    def task():
        global student_data, scan_counts
        try:
            client = get_client()
            sheet = client.open(SHEET_NAME).worksheet(STUDENT_TAB)
            student_data = sheet.get_all_records()
            # build scan counts
            log_sheet = client.open(SHEET_NAME).worksheet(SCAN_LOG_SHEET)
            ids = log_sheet.col_values(2)
            scan_counts.clear()
            for sid in ids:
                scan_counts[sid] = scan_counts.get(sid,0)+1
        except Exception as e:
            messagebox.showerror("Google Error", f"Failed to load students:\n{e}")
    threading.Thread(target=task,daemon=True).start()

def already_scanned_today(student_id):
    """Check if a student has already been scanned in the current section."""
    global scanned_today, current_section

    # If their ID with the current section number is stored, it's a duplicate
    if f"{student_id}_{current_section}" in scanned_today:
        return True

    # Otherwise, they haven't been scanned yet this section
    return False



def log_to_google(student):
    def task():
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        try:
            client = get_client()
            sheet = client.open(SHEET_NAME).worksheet(SCAN_LOG_SHEET)

            # Count how many times this student has been scanned
            ids = sheet.col_values(2)  # student_id column
            count = ids.count(str(student["student_id"])) + 1  # running total

            # Build row with running total
            row = [
                timestamp,
                student["student_id"],
                f"{student['first_name']} {student['last_name']}",
                student.get("class_year", ""),
                student.get("team", ""),
                count,              # running total
                student.get("parent_email", ""),
                DEVICE_NAME        
            ]

            
            sheet.append_row(row)

            # Save in local cache too
            scan_counts[student["student_id"]] = count

            # Format the last row
            last_row_index = len(sheet.col_values(1))
            fmt = CellFormat(backgroundColor=get_color_by_count(count))
            format_cell_range(sheet, f"A{last_row_index}:H{last_row_index}", fmt)

            root.after(0, lambda: update_scan_label(count))

            # Trigger "Email Home" if this count falls in that threshold
            if should_email_home(count):
                print(f"[DEBUG] Queued Email Home for {student['first_name']} {student['last_name']} (count={count})")
                if ENABLE_EMAIL_HOME:
                    pending_emails.append({
                        "student_id": student["student_id"],
                        "first_name": student["first_name"],
                        "last_name": student["last_name"],
                        "team": student.get("team", ""),
                        "class_year": student.get("class_year", ""),
                        "total_count": count
                    })
                    save_pending_emails()

                        

        except Exception as e:
            # Failed to log, queue locally
            row = [
                timestamp,
                student["student_id"],
                f"{student['first_name']} {student['last_name']}",
                student.get("class_year",""),
                student.get("team",""),
                scan_counts.get(student["student_id"], 0) + 1
            ]
            pending_scans.append(row)
            save_pending_scans()
            root.after(0, lambda: messagebox.showwarning(
                "Offline", f"Scan saved locally. Will retry when online.\n{e}"
            ))

    threading.Thread(target=task, daemon=True).start()


def update_scan_label(count):
    label_scans.config(text=f"Scans This Semester: {count}", bg=get_color_hex(count))

# --- Lookup ---
def lookup_student():
    scanned_id = entry_id.get().strip()
    if not scanned_id:
        messagebox.showwarning("Missing","Enter or scan a student ID.")
        return
    if already_scanned_today(scanned_id):
        messagebox.showinfo("Duplicate","This student has already been scanned today.")
        entry_id.delete(0,tk.END); entry_id.focus()
        return
    for s in student_data:
        if str(s["student_id"])==scanned_id:
            label_name.config(text=f"Name: {s['first_name']} {s['last_name']}")
            label_year.config(text=f"Class Year: {s.get('class_year','')}")
            label_team.config(text=f"Team: {s.get('team','')}")
            log_to_google(s)
            play_scan_sound()
            entry_id.delete(0,tk.END); entry_id.focus()
            scanned_today.add(f"{scanned_id}_{current_section}")
            return
    label_name.config(text="Name: Not Found")
    label_year.config(text="Class Year: -")
    label_team.config(text="Team: -")
    label_scans.config(text="Scans This Semester:", bg="white")
    entry_id.delete(0,tk.END); entry_id.focus()

def new_section():
    """Admin-only: start a new section and allow re-scanning."""
    global current_section, last_reset_time
    if not admin_logged_in:
        messagebox.showerror("Access Denied", "Admin login required to start a new section.")
        return

    if messagebox.askyesno("New Section", "Start a new section? This allows re-scanning students today."):
        scanned_today.clear()
        current_section += 1
        last_reset_time = datetime.now().strftime("%I:%M %p")
        play_scan_sound("success")
        label_last_reset.config(text=f"Last Section Reset: {last_reset_time}")
        messagebox.showinfo("Section Reset", f"Section {current_section} started — students can now be scanned again today.")


def open_sent_email_log():
    """Displays a searchable list of all sent parent emails with timestamps."""
    def render_list(filter_text=""):
        # Clear existing list
        for widget in list_frame.winfo_children():
            widget.destroy()

        # Filter and display matching rows
        filtered = [
            r for r in sent_email_history[::-1]
            if filter_text.lower() in r["name"].lower()
            or filter_text.lower() in r["parent_email"].lower()
            or filter_text.lower() in str(r.get("tier", "")).lower()
            or filter_text.lower() in str(r.get("total_count", "")).lower()
        ]

        if not filtered:
            tk.Label(list_frame, text="🔍 No matching records.", font=("Arial", 12)).pack(pady=10)
            return

        # Header row
        header = tk.Frame(list_frame)
        header.pack(fill="x", pady=2)
        for col, width in [("Date", 15), ("Student", 20), ("Parent Email", 25), ("Tier", 10), ("Count", 8)]:
            tk.Label(header, text=col, font=("Arial", 10, "bold"), width=width).pack(side="left", padx=3)

        # Rows
        for record in filtered:
            row = tk.Frame(list_frame)
            row.pack(fill="x", pady=1)

            tk.Label(row, text=record["timestamp"], width=15, anchor="w").pack(side="left", padx=3)
            tk.Label(row, text=record["name"], width=20, anchor="w").pack(side="left", padx=3)
            tk.Label(row, text=record["parent_email"], width=25, anchor="w").pack(side="left", padx=3)
            tk.Label(row, text=record.get("tier", "N/A"), width=10).pack(side="left", padx=3)
            tk.Label(row, text=str(record["total_count"]), width=8).pack(side="left", padx=3)

    # --- Create Window ---
    win = tk.Toplevel(root)
    win.title("Sent Parent Emails")
    win.geometry("780x500")
    win.grab_set()

    tk.Label(win, text="Parent Email History", font=("Arial", 16, "bold")).pack(pady=10)

    # --- Search Bar ---
    search_frame = tk.Frame(win)
    search_frame.pack(fill="x", padx=10)
    tk.Label(search_frame, text="Search:", font=("Arial", 12)).pack(side="left", padx=5)
    search_var = tk.StringVar()
    search_entry = tk.Entry(search_frame, textvariable=search_var, width=40)
    search_entry.pack(side="left", padx=5)
    tk.Button(search_frame, text="🔄 Clear", command=lambda: (search_var.set(""), render_list())).pack(side="left", padx=5)

    # --- Scrollable Frame for Records ---
    canvas = tk.Canvas(win)
    scrollbar = tk.Scrollbar(win, orient="vertical", command=canvas.yview)
    list_frame = tk.Frame(canvas)

    list_frame.bind(
        "<Configure>",
        lambda e: canvas.configure(scrollregion=canvas.bbox("all"))
    )
    canvas.create_window((0, 0), window=list_frame, anchor="nw")
    canvas.configure(yscrollcommand=scrollbar.set)

    canvas.pack(side="left", fill="both", expand=True, padx=(10, 0))
    scrollbar.pack(side="right", fill="y")

    # --- Bind search updates ---
    def on_search(*_):
        render_list(search_var.get())

    search_var.trace_add("write", on_search)

    # Initial render
    render_list()


# --- Reset log ---
def reset_google_log():
    def confirm():
        if password.get()=="AvonNorth":
            try:
                client=get_client()
                sheet=client.open(SHEET_NAME).worksheet(SCAN_LOG_SHEET)
                sheet.clear()
                sheet.append_row(["timestamp","student_id","name","class_year","team","scan_number","section"])
                messagebox.showinfo("Reset","Scan log cleared.")
                win.destroy()
            except Exception as e: messagebox.showerror("Reset Failed", str(e))
        else: messagebox.showerror("Denied","Incorrect password.")
    win=tk.Toplevel(root)
    tk.Label(win,text="Enter password:").pack(pady=5)
    password=tk.Entry(win, show="*"); password.pack()
    tk.Button(win,text="Reset Log",command=confirm).pack(pady=10)

# --- Admin Login ---
def admin_login():
    global admin_logged_in
    if admin_logged_in:
        leave_admin()
        return

    pw = simpledialog.askstring("Admin Login", "Enter Admin Password:", show="*")
    if pw == "AvonNorth":
        admin_logged_in = True
        color_btn.place(relx=1.0, rely=1.0, anchor="se", x=-10, y=-60)
        reset_btn.place(relx=1.0, rely=1.0, anchor="se", x=-10, y=-10)
        section_btn.place(relx=1.0, rely=1.0, anchor="se", x=-10, y=-160)
        email_toggle_btn.place(relx=1.0, rely=1.0, anchor="se", x=-10, y=-210)
        review_email_btn.place(relx=1.0, rely=1.0, anchor="se", x=-10, y=-260)
        sent_log_btn.place(relx=1.0, rely=1.0, anchor="se", x=-10, y=-310)
        admin_btn.config(text="Leave Admin")
    else:
        messagebox.showerror("Denied", "Incorrect password")


def toggle_email_home():
    global ENABLE_EMAIL_HOME
    ENABLE_EMAIL_HOME = not ENABLE_EMAIL_HOME
    new_state = "ON" if ENABLE_EMAIL_HOME else "OFF"
    email_toggle_btn.config(text=f"📧 Email Home: {new_state}")
    save_settings()
    messagebox.showinfo("Email Home", f"Email Home feature is now {new_state}.")


        

def leave_admin():
    global admin_logged_in
    admin_logged_in = False
    color_btn.place_forget()
    reset_btn.place_forget()
    email_toggle_btn.place_forget()
    section_btn.place_forget()
    review_email_btn.place_forget()
    sent_log_btn.place_forget()
    admin_btn.config(text="Admin Login")

# --- SETTINGS PAGE ---
# --- SETTINGS PAGE (with tabs) ---
# --- SETTINGS PAGE (with tabs and role-based visibility) ---
from tkinter import ttk

def render_settings_page():
    """Render settings screen with password-gated admin tabs."""
    for widget in settings_frame.winfo_children():
        widget.destroy()

    tk.Label(settings_frame, text="⚙️ Settings", font=("Arial", 28, "bold"), bg="white").pack(pady=(20, 10))

    if not admin_logged_in:
        # Normal user view
        tk.Label(settings_frame, text="General Controls", font=("Arial", 20, "bold"), bg="white").pack(pady=10)

        tk.Button(settings_frame, text=f"🔊 Sound: {'ON' if sound_enabled else 'OFF'}",
                font=("Arial", 16), width=25, command=toggle_sound).pack(pady=5)

        tk.Button(settings_frame, text="🔄 Check for App Updates",
                font=("Arial", 16), width=25, command=check_for_update).pack(pady=5)

        tk.Button(settings_frame, text="🔐 Admin Login", font=("Arial", 16), width=25,
                command=open_admin_dashboard).pack(pady=5)

        tk.Button(settings_frame, text="⬅ Back to Main Screen", font=("Arial", 18, "bold"),
                bg="#ddd", command=show_main).pack(pady=15)

    else:
        render_admin_dashboard()

from tkinter import ttk

def open_admin_dashboard():
    """Prompt for password and open admin view if correct."""
    pw = simpledialog.askstring("Admin Login", "Enter Admin Password:", show="*")
    if pw == "AvonNorth":
        global admin_logged_in
        admin_logged_in = True
        render_admin_dashboard()
    else:
        messagebox.showerror("Denied", "Incorrect password")


def render_admin_dashboard():
    """Show tabbed admin settings dashboard."""
    for widget in settings_frame.winfo_children():
        widget.destroy()

    tk.Label(settings_frame, text="🔧 Admin Dashboard", font=("Arial", 28, "bold"), bg="white").pack(pady=(20, 10))

    notebook = ttk.Notebook(settings_frame)
    notebook.pack(fill="both", expand=True, padx=20, pady=10)

    # Tabs
    tab_general = tk.Frame(notebook, bg="white")
    tab_email = tk.Frame(notebook, bg="white")
    tab_thresholds = tk.Frame(notebook, bg="white")   # renamed from Appearance
    tab_system = tk.Frame(notebook, bg="white")
    tab_reset = tk.Frame(notebook, bg="white")        # new tab for Reset

    # Order matters — this is how tabs appear left → right
    notebook.add(tab_general, text="🧩 General")
    notebook.add(tab_email, text="📧 Email Tools")
    notebook.add(tab_thresholds, text="🎨 Thresholds")
    notebook.add(tab_system, text="⚙ System")
    notebook.add(tab_reset, text="🔒 Reset")

    # =====================================================
    # 🧩 GENERAL TAB
    # =====================================================
    tk.Label(tab_general, text="General Controls", font=("Arial", 20, "bold"), bg="white").pack(pady=10)
    tk.Button(tab_general, text=f"🔊 Sound: {'ON' if sound_enabled else 'OFF'}",
              font=("Arial", 16), width=25, command=toggle_sound).pack(pady=5)

    # =====================================================
    # 📧 EMAIL TAB
    # =====================================================
    tk.Label(tab_email, text="Parent Email Tools", font=("Arial", 20, "bold"), bg="white").pack(pady=10)
    tk.Button(tab_email, text=f"Email Home: {'ON' if ENABLE_EMAIL_HOME else 'OFF'}",
              font=("Arial", 16), width=25, command=toggle_email_home).pack(pady=5)
    tk.Button(tab_email, text="📬 Review Parent Emails", font=("Arial", 16), width=25,
              command=open_pending_email_list).pack(pady=5)
    tk.Button(tab_email, text="📨 View Sent Emails", font=("Arial", 16), width=25,
              command=open_sent_email_log).pack(pady=5)

    # =====================================================
    # 🎨 THRESHOLDS TAB
    # =====================================================
    tk.Label(tab_thresholds, text="Edit Tier Thresholds", font=("Arial", 20, "bold"), bg="white").pack(pady=10)
    tk.Button(tab_thresholds, text="🎨 Open Color Threshold Settings", font=("Arial", 16), width=30,
              command=open_color_settings).pack(pady=5)

    # =====================================================
    # ⚙️ SYSTEM TAB
    # =====================================================
    tk.Label(tab_system, text="System Tools", font=("Arial", 20, "bold"), bg="white").pack(pady=10)
    tk.Button(tab_system, text="🔄 Check for Updates", font=("Arial", 16), width=25,
              command=check_for_update).pack(pady=5)

    # =====================================================
    # 🔒 RESET TAB
    # =====================================================
    tk.Label(tab_reset, text="Reset Data", font=("Arial", 20, "bold"), bg="white").pack(pady=10)
    tk.Button(tab_reset, text="🧹 Reset Google Log", font=("Arial", 16), width=25,
              command=reset_google_log).pack(pady=5)
    tk.Label(tab_reset, text="⚠️ Use with caution — this permanently clears the scan log!",
             font=("Arial", 12), bg="white", fg="red").pack(pady=5)

    # =====================================================
    # EXIT SETTINGS BUTTON — always visible at bottom
    # =====================================================
    exit_btn = tk.Button(settings_frame, text="⬅ Exit Settings", font=("Arial", 18, "bold"),
                     bg="#ddd", width=25, command=show_main)
    exit_btn.pack(side="bottom", pady=10)







# --- Color Settings ---
def open_color_settings():
    win=tk.Toplevel(root); win.title("Color Thresholds"); win.grab_set()
    temp=[t.copy() for t in color_thresholds]; entries=[]; buttons=[]
    def render():
        for w in win.winfo_children(): w.destroy()
        entries.clear(); buttons.clear()
        for i,th in enumerate(temp):
            tk.Label(win,text=f"Range {i+1}:").grid(row=i,column=0)
            min_e,max_e=tk.Entry(win,width=5),tk.Entry(win,width=5)
            min_e.insert(0,th["min"]); max_e.insert(0,th["max"])
            min_e.grid(row=i,column=1); max_e.grid(row=i,column=2)
            title_e=tk.Entry(win,width=12); title_e.insert(0,th.get("title","Tier")); title_e.grid(row=i,column=4)
            def choose(idx=i):
                _,hex_color=colorchooser.askcolor(parent=win)
                if hex_color:
                    r=int(hex_color[1:3],16)/255; g=int(hex_color[3:5],16)/255; b=int(hex_color[5:7],16)/255
                    temp[idx]["color"]=(r,g,b); buttons[idx].config(bg=hex_color)
            btn=tk.Button(win,text="Color",command=choose); btn.grid(row=i,column=3)
            r,g,b=th["color"]; btn.config(bg=f'#{int(r*255):02x}{int(g*255):02x}{int(b*255):02x}')
            entries.append((min_e,max_e,title_e)); buttons.append(btn)
        tk.Button(win,text="Add",command=add_row).grid(row=len(temp),column=0,pady=5)
        tk.Button(win,text="Subtract",command=subtract_row).grid(row=len(temp),column=1,pady=5)
        tk.Button(win,text="Save",command=save).grid(row=len(temp)+1,column=0,columnspan=5,pady=10)

    def add_row():
        temp.append({"min":1,"max":1,"color":(1,1,1),"title":"Tier"}); render()
    def subtract_row():
        if len(temp)>1: temp.pop(); render()
    def save():
        for i,(min_e,max_e,title_e) in enumerate(entries):
            temp[i]["min"]=int(min_e.get()); temp[i]["max"]=int(max_e.get())
            temp[i]["title"]=title_e.get()
        color_thresholds.clear(); color_thresholds.extend(temp)
        # save to google sheet
        try:
            client = get_client()
            sheet = client.open(SHEET_NAME).worksheet("Thresholds")
            sheet.clear()
            sheet.append_row(["min","max","r","g","b","title"])
            for th in color_thresholds:
                r,g,b = th["color"]
                sheet.append_row([th["min"], th["max"], r, g, b, th["title"]])
        except: pass

        win.destroy()
        render_legend()
    render()


def open_pending_email_list(existing_win=None):
    """Admin view showing all students who need an email home."""
    global pending_emails

    # If window already open, clear and reuse
    if existing_win:
        for widget in existing_win.winfo_children():
            widget.destroy()
        win = existing_win
    else:
        win = tk.Toplevel(root)
        win.title("Pending Parent Emails")
        win.geometry("750x450")

        # ✅ Keep it visible but not blocking
        win.transient(root)
        win.lift()
        # remove topmost mode after lift so popups can appear over it
        win.after(200, lambda: win.attributes("-topmost", False))
        win.protocol("WM_DELETE_WINDOW", lambda: win.destroy())

    # --- Main content area ---
    tk.Label(win, text="Students Needing Email Home", font=("Arial", 16, "bold")).pack(pady=10)
    frame = tk.Frame(win)
    frame.pack(fill="both", expand=True)

    # --- Bulk buttons at top ---
    btn_frame = tk.Frame(win)
    btn_frame.pack(fill="x", pady=5)
    tk.Button(btn_frame, text="✅ Mark All as Sent", bg="#4CAF50", fg="white",
              command=lambda: clear_all_pending(win)).pack(side="right", padx=5)
    tk.Button(btn_frame, text="🔄 Refresh", command=lambda: open_pending_email_list(existing_win=win)).pack(side="right", padx=5)

    if not pending_emails:
        tk.Label(frame, text="✅ No pending parent emails!", font=("Arial", 12)).pack(pady=20)
        return

    for student in pending_emails:
        name = f"{student['first_name']} {student['last_name']}"
        team = student.get("team", "")
        count = student.get("total_count", "")
        line = tk.Frame(frame)
        line.pack(fill="x", padx=10, pady=4)

        tk.Label(line, text=name, width=22, anchor="w").pack(side="left")
        tk.Label(line, text=f"{team} | {count}", width=18).pack(side="left")

        # --- View Email button ---
        def open_email_viewer(stu=student):
            show_parent_email_popup(stu, stu["total_count"], refresh_window=win)

        tk.Button(line, text="View Email", bg="#4CAF50", fg="white",
                  command=open_email_viewer).pack(side="right", padx=5)

        # --- Delete button ---
        def delete_student(stu=student):
            if messagebox.askyesno("Remove Student", f"Remove {stu['first_name']} {stu['last_name']} from pending emails?"):
                global pending_emails
                pending_emails = [p for p in pending_emails if p["student_id"] != stu["student_id"]]
                save_pending_emails()
                open_pending_email_list(existing_win=win)  # refresh list
                print(f"[DELETE] Removed {stu['first_name']} {stu['last_name']} manually.")

        tk.Button(line, text="🗑 Delete", bg="#e74c3c", fg="white",
                  command=delete_student).pack(side="right", padx=5)
        
        def clear_all_pending(win):
            """Mark all pending emails as handled (bulk clear)."""
            global pending_emails
            if messagebox.askyesno("Confirm", "Mark all pending parent emails as handled?"):
                pending_emails.clear()
                save_pending_emails()
                open_pending_email_list(existing_win=win)
                print("[CLEANUP] All pending parent emails cleared.")


# --- Add Student ---
def add_student():
    win = tk.Toplevel(root)
    win.title("Add Student")
    win.grab_set()

    tk.Label(win, text="Student ID:").pack()
    id_e = tk.Entry(win)
    id_e.pack()

    tk.Label(win, text="First Name:").pack()
    first_e = tk.Entry(win)
    first_e.pack()

    tk.Label(win, text="Last Name:").pack()
    last_e = tk.Entry(win)
    last_e.pack()

    tk.Label(win, text="Class Year:").pack()
    year_e = tk.Entry(win)
    year_e.pack()

    tk.Label(win, text="Team:").pack()
    team_e = tk.Entry(win)
    team_e.pack()

    # 👇 NEW FIELD
    tk.Label(win, text="Parent Email:").pack()
    parent_e = tk.Entry(win)
    parent_e.pack()

    def save():
        if not id_e.get().strip() or not first_e.get().strip() or not last_e.get().strip():
            messagebox.showerror("Missing", "ID, First Name, and Last Name are required")
            return

        if messagebox.askyesno("Confirm", "Add this student?"):
            # 👇 Include parent_email in the row
            row = [
                id_e.get().strip(),
                first_e.get().strip(),
                last_e.get().strip(),
                year_e.get().strip(),
                team_e.get().strip(),
                parent_e.get().strip()  # 👈 NEW COLUMN
            ]

            try:
                client = get_client()
                sheet = client.open(SHEET_NAME).worksheet(STUDENT_TAB)
                sheet.append_row(row)
                messagebox.showinfo("Success", "Student added successfully!")
                load_students_from_google()
                win.destroy()
            except Exception as e:
                # save locally for offline mode
                pending_scans.append(["STUDENT"] + row)
                save_pending_scans()
                messagebox.showwarning(
                    "Offline",
                    f"Student saved locally. Will retry when online.\n{e}"
                )
                load_students_from_google()
                win.destroy()

    tk.Button(win, text="Save", command=save).pack(pady=5)
    tk.Button(win, text="Cancel", command=win.destroy).pack(pady=5)


# --- GUI Setup ---
root = tk.Tk()
root.withdraw()  # Hide the temporary blank window

root.title("Lanyard Policy Tracker")
root.state("zoomed")
root.configure(bg="white")

# --- Notebook and UI styling (AFTER root exists) ---
from tkinter import ttk
style = ttk.Style(root)
style.theme_use("clam")
style.configure(
    "TNotebook.Tab",
    font=("Arial", 16, "bold"),
    padding=[20, 10],
    background="#f9f9f9"
)
style.map(
    "TNotebook.Tab",
    background=[("selected", "#FFD700")],
    foreground=[("selected", "black")]
)
style.configure("TNotebook", tabmargins=[10, 5, 10, 0])


load_settings()

# After main_frame and UI setup are done:
root.deiconify()  # Show the real window now

BASE_FONT = ("Arial", 18)
# --- PAGE SWITCHING SYSTEM ---
def show_main():
    settings_frame.pack_forget()
    main_frame.pack(fill="both", expand=True)
    entry_id.focus_set()


def show_settings():
    """Shows the main settings frame."""
    main_frame.pack_forget()
    settings_frame.pack(fill="both", expand=True)
    render_settings_page()

main_frame = tk.Frame(root, bg="white")
main_frame.pack(fill="both", expand=True)
settings_frame = tk.Frame(root, bg="white")

# --- Sound Toggle ---
def toggle_sound():
    global sound_enabled
    sound_enabled = not sound_enabled
    if sound_enabled:
        sound_btn.config(text="🔊")  # on
    else:
        sound_btn.config(text="🔇")  # off

sound_btn = tk.Button(main_frame, text="🔊", font=("Arial", 20), bg="white",
                      command=toggle_sound, borderwidth=0)
sound_btn.place(relx=1.0, rely=0.0, anchor="ne", x=-20, y=10)

tk.Label(main_frame, text="Scan or Enter Student ID:", font=BASE_FONT, bg="white").pack(pady=(10,0))
entry_id = tk.Entry(main_frame, width=30, font=("Arial",20)); entry_id.pack()
tk.Button(main_frame, text="🔍 Lookup", font=BASE_FONT, command=lookup_student).pack(pady=5)
entry_id.bind("<Return>", lambda event: lookup_student())
tk.Button(main_frame, text="🔄 Clear", font=BASE_FONT, command=lambda:[entry_id.delete(0,tk.END),
    label_name.config(text="Name:"),label_year.config(text="Class Year:"),label_team.config(text="Team:"),
    label_scans.config(text="Scans This Semester:",bg="white")]).pack(pady=5)
tk.Button(main_frame, text="➕ Add Student", font=BASE_FONT, command=add_student).pack(pady=5)

label_name = tk.Label(main_frame, text="Name:", font=BASE_FONT, bg="white"); label_name.pack(anchor="w", padx=20)
label_year = tk.Label(main_frame, text="Class Year:", font=BASE_FONT, bg="white"); label_year.pack(anchor="w", padx=20)
label_team = tk.Label(main_frame, text="Team:", font=BASE_FONT, bg="white"); label_team.pack(anchor="w", padx=20)
label_scans = tk.Label(main_frame, text="Scans This Semester:", font=BASE_FONT, bg="white"); label_scans.pack(anchor="w", padx=20)

bottom = tk.Frame(main_frame, bg="white"); bottom.pack(side="bottom", fill="x", pady=10)
tk.Label(bottom, image=logo_img, bg="white").pack()
tk.Label(bottom, text="LANYARD POLICY TRACKER", font=("Arial",24,"bold"), bg="white").pack()
label_last_reset = tk.Label(main_frame, text="Last Section Reset: N/A", font=("Arial", 14), bg="white")
label_last_reset.place(relx=0.0, rely=0.0, anchor="nw", x=10, y=10)




def sync_unsent_scans():
    try:
        df = pd.read_excel(LOCAL_LOG)
    except FileNotFoundError:
        messagebox.showinfo("Sync", "No local scans to sync.")
        return

    client = get_client()
    sheet = client.open(SHEET_NAME).worksheet(SCAN_LOG_SHEET)
    updated = 0

    for _, row in df[df["Uploaded"] == "No"].iterrows():
        try:
            values = [[row["Timestamp"], row["Student ID"], row["Name"], row["Class Year"], row["Team"]]]
            sheet.append_row(values[0])
            mark_scan_uploaded(row["Timestamp"], row["Student ID"])
            updated += 1
        except Exception as e:
            print("Failed to sync row:", e)

    messagebox.showinfo("Sync", f"Synced {updated} offline scans to Google.")



# --- Legend ---
legend_visible=False
legend_frame=tk.Frame(root,bg="white",bd=1,relief="solid")
legend_labels=[]
def render_legend():
    for widget in legend_frame.winfo_children():
        widget.destroy()

    for i, threshold in enumerate(color_thresholds):
        start_num = threshold["min"]
        title = threshold.get("title", "")
        color = threshold["color"]
        hex_color = f'#{int(color[0]*255):02x}{int(color[1]*255):02x}{int(color[2]*255):02x}'

        tier_frame = tk.Frame(legend_frame, bg="white")
        tier_frame.pack(side="top", anchor="w", pady=2)

        color_box = tk.Label(tier_frame, bg=hex_color, width=3, height=1, relief="solid")
        color_box.pack(side="left", padx=(0,5))

        label_text = f"{start_num} - {title}" if title else f"{start_num}"
        tier_label = tk.Label(tier_frame, text=label_text, bg="white")
        tier_label.pack(side="left")

def toggle_legend():
    global legend_visible
    if legend_visible:
        legend_frame.place_forget()
        legend_visible = False
    else:
        render_legend()
        # Temporarily place off-screen so Tkinter calculates size
        legend_frame.place(x=-1000, y=-1000)
        legend_frame.update_idletasks()  # calculate proper width/height
        # Now place in correct position
        x = 10
        y = root.winfo_height() - legend_frame.winfo_height() - 50
        legend_frame.place(x=x, y=y, anchor='sw')
        legend_frame.lift()
        legend_btn.lift()
        legend_visible = True



legend_btn=tk.Button(root,text="Legend",font=BASE_FONT,command=toggle_legend)
legend_btn.place(relx=0.0,rely=1.0,anchor='sw',x=10,y=-10)

settings_btn = tk.Button(main_frame, text="⚙ Settings", font=BASE_FONT, command=show_settings)
settings_btn.place(relx=1.0, rely=1.0, anchor="se", x=-10, y=-10)



# --- Admin Buttons ---
# admin_btn = tk.Button(root, text="Admin Login", font=BASE_FONT, command=admin_login)
# admin_btn.place(relx=1.0, rely=1.0, anchor="se", x=-10, y=-110)

color_btn = tk.Button(root, text="⚙️ Color Settings", font=BASE_FONT, command=open_color_settings)
reset_btn = tk.Button(root, text="🔒 Reset Log", font=BASE_FONT, command=reset_google_log)

review_email_btn = tk.Button(root, text="📬 Review Parent Emails", font=BASE_FONT, command=open_pending_email_list)
sent_log_btn = tk.Button(root, text="📨 View Sent Emails", font=BASE_FONT, command=open_sent_email_log)


# ✅ NEW: create the Email Home toggle button before placing it
email_toggle_btn = tk.Button(
    root,
    text=f"📧 Email Home: {'ON' if ENABLE_EMAIL_HOME else 'OFF'}",
    font=BASE_FONT,
    command=toggle_email_home
)


section_btn = tk.Button(
    root,
    text="🆕 New Section",
    font=BASE_FONT,
    command=new_section
)

# ✅ NEW: Review Pending Parent Emails button
review_email_btn = tk.Button(
    root,
    text="📧 Review Parent Emails",
    font=BASE_FONT,
    command=open_pending_email_list  # this function you’ll add in Step 4
)


# --- Daily reset ---
def clear_daily_highlights():
    """Resets only daily colors and scanned list; keeps semester totals."""
    while True:
        now = datetime.now()
        midnight = datetime.combine(now.date(), datetime.min.time()) + timedelta(days=1)
        time.sleep((midnight - now).total_seconds())

        try:
            client = get_client()
            sheet = client.open(SHEET_NAME).worksheet(SCAN_LOG_SHEET)
            rows = len(sheet.get_all_values())

            if rows > 1:
                # Clear background colors only
                fmt = CellFormat(backgroundColor=Color(1, 1, 1))
                format_cell_range(sheet, f"A2:H{rows}", fmt)
                print("[RESET] Cleared highlight colors, kept totals.")

            scanned_today.clear()  # reset daily scanned IDs
            print("[RESET] Cleared daily scanned list.")
        except Exception as e:
            print("[RESET ERROR]", e)



# Load students

# --- Retry pending scans and students ---
def retry_pending_scans():
    while True:
        if pending_scans:
            try:
                client = get_client()
                sheet_scan = client.open(SHEET_NAME).worksheet(SCAN_LOG_SHEET)
                sheet_student = client.open(SHEET_NAME).worksheet(STUDENT_TAB)
                remaining = []

                for row in pending_scans:
                    try:
                        if row[0] == "STUDENT":  # offline student add
                            sheet_student.append_row(row[1:])
                        else:  # regular scan log
                            sheet_scan.append_row(row)
                            student_id = row[1]
                            ids = sheet_scan.col_values(2)
                            count = ids.count(str(student_id))
                            scan_counts[student_id] = count
                        time.sleep(0.1)
                    except:
                        remaining.append(row)

                pending_scans.clear()
                pending_scans.extend(remaining)
                save_pending_scans()
            except:
                pass  # still offline
        time.sleep(30)

# Start the retry thread
threading.Thread(target=retry_pending_scans, daemon=True).start()

def check_for_update():
    """Check GitHub for new version and replace the local EXE automatically."""
    try:
        response = requests.get(VERSION_URL, timeout=5)
        latest = response.text.strip()

        if latest != APP_VERSION:
            if messagebox.askyesno("Update Available", f"A new version ({latest}) is available.\n\nInstall automatically?"):
                new_exe_url = INSTALLER_URL  # GitHub download link
                current_path = sys.executable  # Path to current running exe
                temp_path = os.path.join(os.path.dirname(current_path), "update_temp.exe")

                # Download the new version to a temp file
                with requests.get(new_exe_url, stream=True) as r:
                    r.raise_for_status()
                    with open(temp_path, "wb") as f:
                        shutil.copyfileobj(r.raw, f)

                # Relaunch updater script to replace the exe safely
                updater_script = f"""
import os, time, shutil, sys
old = r"{current_path}"
new = r"{temp_path}"
time.sleep(1)
try:
    os.remove(old)
    shutil.move(new, old)
    os.startfile(old)
except Exception as e:
    import traceback; open('update_error.log','w').write(traceback.format_exc())
"""
                updater_file = os.path.join(os.path.dirname(current_path), "run_update.py")
                with open(updater_file, "w") as f:
                    f.write(updater_script)

                subprocess.Popen(["python", updater_file])
                root.destroy()  # close main app
    except Exception as e:
        print("Update check failed:", e)



#update_btn = tk.Button(root, text="🔁 Check for Updates", font=BASE_FONT, command=check_for_update)
#update_btn.place(relx=0.0, rely=1.0, anchor='sw', x=10, y=-60)



load_students_from_google()
load_thresholds_from_sheet()
threading.Thread(target=clear_daily_highlights, daemon=True).start()

# --- Final UI focus & bindings ---
def focus_entry_id():
    try:
        entry_id.focus_set()  # auto-focus on open
    except:
        root.after(500, focus_entry_id)  # retry until ready

root.after(500, focus_entry_id)  # initial focus when app opens
entry_id.bind("<Return>", lambda event: lookup_student())  # press Enter to scan


root.after(1000, lambda: root.focus_force())
root.after(1500, lambda: entry_id.focus_force())

root.deiconify()  # show after setup
check_for_update()  # check once visible
root.mainloop()


