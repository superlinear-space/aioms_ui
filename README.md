# AIOMS UI - Cluster Management Dashboard

A modern React-based dashboard for managing cluster configurations with support for both text-based and YAML-based configuration files.

## 🚀 Quick Start

### Prerequisites

- **Node.js** (v16 or higher)
- **npm** or **yarn** - for frontend dependencies

### Backend setup
cd server
python -m pip install -r requirements.txt or
uv pip install -r requirements
npm run server


### Frontend Setup

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Start Development Server**
   ```bash
   VITE_PROMETHEUS_BASE_URL=http://localhost:9090 npm run dev
   ```

   ```bash
   if deployed on  remote server
   VITE_PROMETHEUS_BASE_URL=http://localhost:9090 npm run dev -- --host 0.0.0.0
   ```

3. **Access the Application**
   - Open your browser and navigate to `http://localhost:5173`
   - The dashboard will load with a professional UI for cluster management
   - **Note**: This is currently a frontend-only application with mock data


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
```

### Environment Variables

Create a `.env` file in the root directory (optional for future backend integration):

```env
# Frontend (for future backend integration)
VITE_API_URL=http://localhost:8000/api
```

## 🌐 Current Status

This is currently a **frontend-only application** with the following characteristics:

- **Mock Data** - Uses sample configuration data for demonstration
- **File-based Configuration** - Reads from `public/cluster_all.txt` and `public/cluster.yml`
- **No Backend Required** - Fully functional standalone application
- **Future Ready** - Designed to integrate with a Django REST API backend when available

### Future Backend Integration

When a backend server is added, the application will support:
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

### Backend Deployment (Future)
```bash
# When backend is added:
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
