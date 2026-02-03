"""
RenderCV Serverless Function for generating professional PDFs.
This function receives CV data as JSON and returns a base64-encoded PDF.
"""

from http.server import BaseHTTPRequestHandler
import json
import yaml
import subprocess
import tempfile
import base64
import os
import shutil
import sys
import re
from typing import Any

# Security limits
MAX_BODY_SIZE = 1024 * 1024  # 1 MB
MAX_WORK_HISTORY = 20
MAX_EDUCATION = 10
MAX_HIGHLIGHTS_PER_ENTRY = 10
MAX_SKILLS = 50
ALLOWED_ORIGIN = 'https://jobsilver.com'


def build_rendercv_yaml(data: dict[str, Any]) -> dict[str, Any]:
    """
    Build RenderCV YAML structure from input data.

    Args:
        data: Dictionary containing CV information

    Returns:
        Dictionary matching RenderCV YAML schema
    """
    # Personal info
    name = f"{data.get('first_name', '')} {data.get('last_name', '')}".strip()
    email = data.get('email', '')
    phone = data.get('phone', '')
    location = data.get('location', '')
    linkedin_url = data.get('linkedin_url', '')

    # Build sections
    sections: dict[str, Any] = {}

    # Summary section
    experience_summary = data.get('experience_summary', '')
    if experience_summary:
        sections['summary'] = [experience_summary]

    # Experience section - filter to only valid entries
    work_history = data.get('work_history', [])
    # Only include entries that have both company and position
    valid_work_history = [w for w in work_history if w.get('company') and w.get('position')]
    if valid_work_history:
        experience_items = []
        for job in valid_work_history:
            # Parse dates
            start_date = job.get('start_date', '')
            end_date = job.get('end_date')

            experience_entry = {
                'company': job.get('company', ''),
                'position': job.get('position', ''),
                'start_date': start_date,
                'end_date': end_date if end_date else 'present',
            }

            if job.get('location'):
                experience_entry['location'] = job['location']

            highlights = [h for h in job.get('highlights', []) if h.strip()]
            if highlights:
                experience_entry['highlights'] = highlights

            experience_items.append(experience_entry)

        sections['experience'] = experience_items

    # Education section - filter to only valid entries
    education = data.get('education', [])
    valid_education = [e for e in education if e.get('institution') and e.get('degree')]
    if valid_education:
        education_items = []
        for edu in valid_education:
            education_entry = {
                'institution': edu.get('institution', ''),
                'degree': edu.get('degree', ''),
                'area': edu.get('area', ''),
                'end_date': f"{edu.get('graduation_year', '')}-05",  # Assume May graduation
            }

            if edu.get('location'):
                education_entry['location'] = edu['location']

            highlights = edu.get('highlights', [])
            if highlights and any(h.strip() for h in highlights):
                education_entry['highlights'] = [h for h in highlights if h.strip()]

            education_items.append(education_entry)

        sections['education'] = education_items

    # Skills section
    skills = data.get('skills', [])
    if skills:
        # RenderCV expects skills as a list of strings or dict entries
        sections['skills'] = [', '.join(skills)]

    # Build CV structure
    cv: dict[str, Any] = {
        'name': name,
    }

    if email:
        cv['email'] = email
    if phone:
        cv['phone'] = phone
    if location:
        cv['location'] = location

    # Social networks
    if linkedin_url:
        # Extract username from LinkedIn URL - only accept personal profile URLs (/in/username)
        linkedin_match = re.search(r'linkedin\.com/in/([^/?\s]+)', linkedin_url)
        if linkedin_match:
            linkedin_username = linkedin_match.group(1)
            cv['social_networks'] = [
                {'network': 'LinkedIn', 'username': linkedin_username}
            ]

    cv['sections'] = sections

    # Build final YAML structure
    return {
        'cv': cv,
        'design': {
            'theme': 'classic',
            'page_size': 'letterpaper',
            'font_size': '10pt',
        }
    }


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            # Validate and read request body with size limit
            try:
                content_length = int(self.headers.get('Content-Length', 0))
            except (ValueError, TypeError):
                self.send_error_response(400, 'Invalid Content-Length header')
                return

            if content_length > MAX_BODY_SIZE:
                self.send_error_response(413, 'Request body too large')
                return

            body = self.rfile.read(content_length)
            data = json.loads(body.decode('utf-8'))

            # Apply array size limits
            if 'work_history' in data:
                data['work_history'] = data['work_history'][:MAX_WORK_HISTORY]
                for job in data['work_history']:
                    if 'highlights' in job:
                        job['highlights'] = job['highlights'][:MAX_HIGHLIGHTS_PER_ENTRY]
            if 'education' in data:
                data['education'] = data['education'][:MAX_EDUCATION]
                for edu in data['education']:
                    if 'highlights' in edu:
                        edu['highlights'] = edu['highlights'][:MAX_HIGHLIGHTS_PER_ENTRY]
            if 'skills' in data:
                data['skills'] = data['skills'][:MAX_SKILLS]

            # Validate required fields
            required_fields = ['first_name', 'last_name']
            for field in required_fields:
                if not data.get(field):
                    self.send_error_response(400, f'Missing required field: {field}')
                    return

            # Validate work_history and education
            work_history = data.get('work_history', [])
            education = data.get('education', [])

            if not work_history or not any(w.get('company') and w.get('position') for w in work_history):
                self.send_error_response(400, 'At least one valid work experience is required')
                return

            if not education or not any(e.get('institution') and e.get('degree') for e in education):
                self.send_error_response(400, 'At least one valid education entry is required')
                return

            # Build YAML for RenderCV
            cv_yaml = build_rendercv_yaml(data)

            # Create temporary directory for rendering
            with tempfile.TemporaryDirectory() as tmpdir:
                yaml_path = os.path.join(tmpdir, 'cv.yaml')

                # Write YAML file
                with open(yaml_path, 'w', encoding='utf-8') as f:
                    yaml.dump(cv_yaml, f, default_flow_style=False, allow_unicode=True)

                # Run RenderCV
                try:
                    result = subprocess.run(
                        ['rendercv', 'render', yaml_path, '--output-folder-name', 'output'],
                        cwd=tmpdir,
                        capture_output=True,
                        text=True,
                        timeout=60
                    )

                    if result.returncode != 0:
                        # Log detailed error server-side, return generic message to client
                        error_msg = result.stderr or result.stdout or 'RenderCV failed'
                        print(f'RenderCV error: {error_msg}', file=sys.stderr)
                        self.send_error_response(500, 'PDF generation failed. Please check your CV data and try again.')
                        return

                except subprocess.TimeoutExpired:
                    self.send_error_response(500, 'RenderCV timed out')
                    return
                except FileNotFoundError:
                    self.send_error_response(500, 'RenderCV not installed')
                    return

                # Find the generated PDF
                output_dir = os.path.join(tmpdir, 'output')
                pdf_files = [f for f in os.listdir(output_dir) if f.endswith('.pdf')] if os.path.exists(output_dir) else []

                if not pdf_files:
                    # Try alternative location
                    rendercv_output = os.path.join(tmpdir, 'rendercv_output')
                    if os.path.exists(rendercv_output):
                        pdf_files = [f for f in os.listdir(rendercv_output) if f.endswith('.pdf')]
                        output_dir = rendercv_output

                if not pdf_files:
                    self.send_error_response(500, 'PDF not generated')
                    return

                pdf_path = os.path.join(output_dir, pdf_files[0])

                # Read and encode PDF
                with open(pdf_path, 'rb') as f:
                    pdf_bytes = f.read()
                    pdf_base64 = base64.b64encode(pdf_bytes).decode('utf-8')

                # Send success response
                # Sanitize filename to only allow safe characters
                safe_first = re.sub(r'[^a-zA-Z0-9]', '_', data.get('first_name', 'cv'))
                safe_last = re.sub(r'[^a-zA-Z0-9]', '_', data.get('last_name', ''))
                response = {
                    'success': True,
                    'pdf': pdf_base64,
                    'filename': f"{safe_first}_{safe_last}_CV.pdf"
                }

                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps(response).encode('utf-8'))

        except json.JSONDecodeError:
            self.send_error_response(400, 'Invalid JSON')
        except Exception as e:
            # Log detailed error server-side, return generic message to client
            print(f'Internal error in CV generation: {str(e)}', file=sys.stderr)
            self.send_error_response(500, 'An unexpected error occurred. Please try again.')

    def send_error_response(self, status: int, message: str):
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        response = {'success': False, 'error': message}
        self.wfile.write(json.dumps(response).encode('utf-8'))

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', ALLOWED_ORIGIN)
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
