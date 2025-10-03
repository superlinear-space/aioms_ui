# AIOMS UI - Cluster Management Dashboard

A modern React-based dashboard for managing cluster configurations with support for both text-based and YAML-based configuration files.

## 🚀 Quick Start

### Prerequisites

- **Node.js** (v16 or higher)
- **Python** (v3.8 or higher) - for Django backend
- **npm** or **yarn** - for frontend dependencies

### Frontend Setup

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Start Development Server**
   ```bash
   npm run dev
   ```

3. **Access the Application**
   - Open your browser and navigate to `http://localhost:5173`
   - The dashboard will load with a professional UI for cluster management

### Backend Setup (Django)

1. **Navigate to Backend Directory**
   ```bash
   cd ../aioms_backend  # Adjust path as needed
   ```

2. **Create Virtual Environment**
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. **Install Dependencies**
   ```bash
   pip install -r requirements.txt
   ```

4. **Run Database Migrations**
   ```bash
   python manage.py migrate
   ```

5. **Create Superuser (Optional)**
   ```bash
   python manage.py createsuperuser
   ```

6. **Start Django Server**
   ```bash
   python manage.py runserver
   ```

7. **Backend API Access**
   - API will be available at `http://localhost:8000`
   - Admin panel at `http://localhost:8000/admin`

## 📁 Project Structure

```
aioms_ui/
├── src/
│   ├── components/
│   │   ├── Dashboard.tsx      # Main dashboard with config editors
│   │   └── Login.tsx          # Authentication component
│   ├── contexts/
│   │   └── AuthContext.tsx    # Authentication state management
│   ├── services/
│   │   └── api.ts             # API service layer
│   └── config/
│       └── api.ts             # API configuration
├── public/
│   ├── cluster_all.txt        # Text-based cluster configuration
│   └── cluster.yml            # YAML-based cluster configuration
└── package.json
```

## 🎯 Features

### Configuration Management
- **Text Editor** - Edit `cluster_all.txt` with structured sections
- **YAML Editor** - Manage `cluster.yml` with tabbed interface
- **Real-time Validation** - Syntax checking and error reporting
- **File Operations** - Load, save, download configurations

### Structured Editing
- **Device Groups** - Manage hardware models and instances
- **Networks** - Configure network mappings and links
- **Tenants** - Set up tenant-specific configurations
- **System Checks** - Define monitoring and validation rules
- **Labels** - Manage request and set labels

### Professional UI
- **Modern Design** - Clean, enterprise-grade interface
- **Responsive Layout** - Works on desktop and mobile
- **Tab Navigation** - Organized section management
- **Real-time Updates** - Instant feedback and validation

## 🔧 Development

### Available Scripts

```bash
# Development
npm run dev          # Start development server
npm run build        # Build for production
npm run preview      # Preview production build
npm run lint         # Run ESLint

# Backend (Django)
python manage.py runserver     # Start Django server
python manage.py migrate       # Run database migrations
python manage.py collectstatic # Collect static files
```

### Environment Variables

Create a `.env` file in the root directory:

```env
# Frontend
VITE_API_URL=http://localhost:8000/api

# Backend (Django settings)
SECRET_KEY=your-secret-key-here
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1
```

## 🌐 API Integration

The frontend is designed to work with a Django REST API backend:

- **Authentication** - JWT-based authentication
- **Configuration Management** - CRUD operations for cluster configs
- **File Operations** - Upload/download configuration files
- **Real-time Updates** - WebSocket support for live updates

## 📝 Configuration Files

### cluster_all.txt
Text-based configuration with sections:
- Settings (monitor_mode, etc.)
- Device Groups (hardware models)
- Networks (mappings and links)
- Tenants (instance assignments)
- System (monitoring checks)

### cluster.yml
YAML-based configuration with:
- Devices (models and instances)
- Networks (node and link files)
- Tenants (instance assignments)
- System (epilogue commands)
- Labels (request and set labels)

## 🚀 Deployment

### Frontend Deployment
```bash
npm run build
# Deploy the 'dist' folder to your web server
```

### Backend Deployment
```bash
python manage.py collectstatic
python manage.py migrate
# Deploy using gunicorn, uWSGI, or similar WSGI server
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and linting
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

---

## Technical Details

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
