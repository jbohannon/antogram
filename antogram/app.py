from flask import Flask, render_template, request, jsonify, redirect, url_for, session
import requests
from PIL import Image
import io
import base64
import urllib.parse
import string
import os
import json
import time
from datetime import datetime

# Define the Base62 alphabet
BASE62_ALPHABET = string.digits + string.ascii_uppercase + string.ascii_lowercase

def int_to_base62(num):
    """Convert a non-negative integer to a Base62 string."""
    if num == 0:
        return BASE62_ALPHABET[0]
    base62 = []
    while num > 0:
        num, rem = divmod(num, 62)
        base62.append(BASE62_ALPHABET[rem])
    return ''.join(reversed(base62))

def base62_to_int(s):
    """Convert a Base62 string back to a non-negative integer."""
    num = 0
    for char in s:
        num = num * 62 + BASE62_ALPHABET.index(char)
    return num

def encode_message(message):
    """Encode a message string into a Base62 ID."""
    # Convert the message to a big integer
    original_int = int.from_bytes(message.encode('utf-8'), byteorder='big')
    # Convert the integer to a Base62 string
    return int_to_base62(original_int)

def decode_message(encoded_id):
    """Decode a Base62 ID back into the original message."""
    # Convert from Base62 back to an integer
    original_int = base62_to_int(encoded_id)
    # Convert the integer back to bytes and then to a string
    num_bytes = (original_int.bit_length() + 7) // 8
    original_bytes = original_int.to_bytes(num_bytes, byteorder='big')
    return original_bytes.decode('utf-8')

def encode_content(content_type, content):
    """Encode content (text or image URL) into a Base62 ID with type prefix."""
    # Add type prefix (0 for text, 1 for image)
    prefix = '0' if content_type == 'text' else '1'
    # Encode the content
    encoded = encode_message(content)
    return prefix + encoded

def decode_id(encoded_id):
    """Decode a Base62 ID with type prefix back into content type and content."""
    if not encoded_id:
        return None, None
    
    # Extract type prefix and content
    content_type = 'text' if encoded_id[0] == '0' else 'image'
    content = decode_message(encoded_id[1:])
    return content_type, content

app = Flask(__name__)
app.secret_key = os.urandom(24)  # Generate a random secret key

# Visitor counter file path
VISITOR_COUNT_FILE = 'visitor_count.txt'

def get_visitor_count():
    try:
        with open(VISITOR_COUNT_FILE, 'r') as f:
            return int(f.read())
    except (FileNotFoundError, ValueError):
        return 0

def increment_visitor_count():
    count = get_visitor_count() + 1
    with open(VISITOR_COUNT_FILE, 'w') as f:
        f.write(str(count))
    return count

@app.route('/')
def index():
    # Only increment count for new sessions
    if 'visited' not in session:
        session['visited'] = True
        total_visitors = increment_visitor_count()
    else:
        total_visitors = get_visitor_count()
    
    # Get the encoded ID and content type from the URL parameters
    encoded_id = request.args.get('id')
    content_type = request.args.get('type')
    
    return render_template('index.html', 
                         encoded_id=encoded_id, 
                         content_type=content_type,
                         total_visitors=total_visitors)

@app.route('/ant-test')
def ant_test():
    return render_template('ant_test.html')

@app.route('/generate', methods=['GET', 'POST'])
def generate():
    if request.method == 'GET':
        # Handle fetching content by ID
        encoded_id = request.args.get('id')
        if not encoded_id:
            return jsonify({'error': 'No ID provided'}), 400
            
        content_type, content = decode_id(encoded_id)
        if not content_type or not content:
            return jsonify({'error': 'Invalid ID'}), 400
            
        return jsonify({
            'type': content_type,
            'content': content
        })
    
    # Handle POST request (creating new content)
    data = request.get_json()
    content_type = data.get('type')
    content = data.get('content')
    
    if content_type == 'image':
        try:
            # Fetch the image from the URL
            response = requests.get(content)
            response.raise_for_status()
            
            # Convert the image to base64
            img = Image.open(io.BytesIO(response.content))
            buffered = io.BytesIO()
            img.save(buffered, format="PNG")
            img_str = base64.b64encode(buffered.getvalue()).decode()
            
            encoded_id = encode_content(content_type, content)
            return jsonify({
                'image_data': f'data:image/png;base64,{img_str}',
                'encoded_id': encoded_id
            })
        except Exception as e:
            return jsonify({
                'error': str(e)
            }), 400
    elif content_type == 'text':
        encoded_id = encode_content(content_type, content)
        return jsonify({
            'encoded_id': encoded_id
        })
    
    return jsonify({'error': 'Invalid request'}), 400

if __name__ == '__main__':
    app.run(debug=True, port=5001) 