# Antogram

A web application that creates animated ant colonies that form text messages or images. Built with Flask and p5.js.

## Features

- Create animated text messages using ant colonies
- Convert images into ant colony animations
- Share your creations via email and social media
- Responsive design that works on desktop and mobile

## Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/antogram.git
cd antogram
```

2. Create and activate a virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

4. Run the development server:
```bash
flask run
```

## Deployment

The application can be deployed using Gunicorn and Nginx:

1. Install Gunicorn:
```bash
pip install gunicorn
```

2. Run with Gunicorn:
```bash
gunicorn -w 4 -b 0.0.0.0:8000 app:app
```

3. Configure Nginx as a reverse proxy

## Project Structure

```
antogram/
├── app.py              # Flask application
├── requirements.txt    # Python dependencies
├── static/            # Static files
│   ├── css/          # CSS styles
│   └── js/           # JavaScript files
└── templates/         # HTML templates
```

## License

MIT License

## Author

John Bohannon - [johnbohannon.org](https://johnbohannon.org) 