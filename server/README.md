# Backend - Django

This is the Django backend for the AIOMS (AI Operations Management System) application.

## Migration from Flask

The backend has been migrated from Flask to Django while maintaining the same API endpoints and functionality.

## Setup

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Run migrations:
```bash
python manage.py migrate
```

3. Start the development server:
```bash
python manage.py runserver 0.0.0.0:15000
```

Or use the npm script:
```bash
npm run server
```

## API Endpoints

The following endpoints are available (same as the original Flask implementation):

- `GET /api/health` - Health check endpoint
- `GET /api/settings` - Get current application settings
- `POST /api/settings/update` - Update application settings (placeholder)
- `POST /api/generate_prom_rules` - Generate Prometheus rules using superalarm
- `GET /api/check_superalarm` - Check if superalarm command is available

## Configuration

Configuration is loaded from the parent directory's `config.json` file, maintaining compatibility with the existing setup.

## Key Changes from Flask

1. **Framework**: Migrated from Flask to Django with Django REST Framework
2. **CORS**: Using `django-cors-headers` instead of `flask-cors`
3. **Settings**: Configuration moved to Django settings with fallback to config.json
4. **URL Routing**: Using Django's URL routing system
5. **Response Format**: Using Django REST Framework's Response class

## Dependencies

- Django 5.0.1
- Django REST Framework 3.14.0
- django-cors-headers 4.3.1
- PyYAML 6.0.1
- Werkzeug 2.3.7 (kept for compatibility)
